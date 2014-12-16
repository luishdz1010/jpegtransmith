var fs = require('fs'),
  path = require('path'),
  async = require('async'),
  assert = require('assert'),
  exec = require('child_process').exec,
  Tempfile = require('temporary/lib/file'),
  which = require('which'),
  _gm = require('gm'),
  _ = require('lodash'),
  debug = require('debug')('jpegtransmith'),
  gmExists = false,
  engine = {};

try {
  gmExists = !!which.sync('gm');
} catch (e) {}

function getGm() {
  return gmExists? _gm : _gm.subClass({ imageMagick: true });
}

function jpegtran(args, cb){
  exec('jpegtran ' + args.join(' '), cb);
}

function createImage(file, cb) {
  var img = getGm()(file);

  async.waterfall([
    img.size.bind(img),
    function (size, cb) {
      // We need multiples of 8 for the jpegtran -drop command to work
      var data = {
        height: (size.height + 7) & ~7,
        width: (size.width + 7) & ~7,
        realHeight: size.height,
        realWidth: size.width,
        file: file
      };

      // If you modify the samplingFactor, you must correct the data.height and data.width properties accordingly
      if(engine.imageDataMutator)
        engine.imageDataMutator(data);

      cb(null, data);
    }
  ], cb);
}

function createImages(files, cb) {
  async.mapLimit(files, 50, createImage, cb);
}

function createCanvas(width, height, cb) {
  cb(null, new Canvas(width, height));
}

function Canvas(width, height) {
  this.images = [];
  this.width = width;
  this.height = height;
}

Canvas.prototype.addImage = function (img, x, y) {
  this.images.push({
    img: img,
    x: x,
    y: y
  });
};

Canvas.prototype['export'] = function (options, cb) {
  options = _.defaults(options, {
    format: 'jpg',
    improvedEdgeSize: 8,
    bg: 'black',
    quality: 92,

    // This makes each MCU 8x8
    samplingFactor: '1x1,1x1,1x1',

    // How many images are processed in parallel, increasing this wont necessarily increase performance, since
    // the biggest bottleneck is on jpegtran -drop, which we can't do in parallel
    parallelLimit: 40
  });

  assert(['jpg', 'jpeg'].indexOf(options.format) !== -1, 'Exporter ' + options.format + ' does not exist for spritesmith\'s jpegtran engine');

  var
    self = this,
    canvas,
    usedFiles = [],
    ec = options.improvedEdgeSize;

  async.waterfall([
    function createSprite(cb){
      async.parallel([
        processCanvas,
        processImages
      ], cb);
    },
    function optimizeSprite(_, cb){
      jpegtran([
        '-optimize',
        '-copy', 'none',
        '-outfile', canvas,
        canvas
      ], cb);
    },
    function convertToBinary(_, __, cb){
      debug('canvas optimized');
      fs.readFile(canvas, 'binary', cb);
    },
    function deleteTempFiles(bytes, cb){
      // Ignore error
      debug('converted to binary');
      async.each(usedFiles, fs.unlink.bind(fs), function(){
        cb(null, bytes);
      });
    }
  ], cb);

  function processCanvas(cb){
    async.series([
      function createCanvas(cb){
        canvas = tempFile(options.format);
        getGm()(self.width, self.height, options.bg)
          .samplingFactor(options.samplingFactor)
          .type('TrueColor')
          .quality(1)
          .write(canvas, cb)
      },
      function (cb){
        debug('canvas created');
        putImageInCanvasQueue.resume();
        cb();
      }
    ], cb);
  }

  function processImages(cb){
    async.eachLimit(self.images, options.parallelLimit, function(def, done){
      var
        img = def.img,
        imgStatus = { file: img.file };

      async.parallel([
        function prepareOriginal(cb){
          var converted = tempFile(options.format);

          async.series([
            function convertToGoodFormat(cb){
              getGm()(img.file)
                .samplingFactor(options.samplingFactor)
                .quality(100)
                .write(converted, cb);
            },
            function enqueueOriginalDrop(cb){
              debug('original created %s', img.file);
              putImageInCanvasQueue.push(_.defaults({ img: converted }, def), cb);
            },
            function resumeOptimizedDrop(cb){
              debug('original dropped %s', img.file);
              imgStatus.originalIsInCanvas = true;
              tryPushOptimizedDrop(imgStatus);
              cb();
            }
          ], cb);
        },
        function createOptimized(cb) {
          var optimized = tempFile(options.format);

          async.series([
            function createLowQuality(cb) {
              getGm()(img.file)
                .quality(options.quality)
                .samplingFactor(options.samplingFactor)
                .write(optimized, cb);
            },
            function crop(cb) {
              debug('optimized created %s', img.file);
              jpegtran([
                '-perfect',
                '-crop', (img.realWidth - ec * 2) + 'x' + (img.realHeight - ec * 2) + '+' + (ec) + '+' + (ec),
                '-outfile', optimized,
                optimized
              ], cb);
            },
            function enqueueCropped(cb) {
              debug('optimized cropped %s', img.file);
              imgStatus.optimizedReadyToBeInCanvas = true;
              imgStatus.optimizedInCanvasCallback = cb;
              imgStatus.putOptimizedInCanvasWork = {
                img: optimized,
                x: def.x + ec,
                y: def.y + ec
              };
              tryPushOptimizedDrop(imgStatus);
            }
          ], cb);
        }
      ], done);
    }, cb);
  }

  // We can only put images 1 at a time to avoid corrupting the jpeg file
  var putImageInCanvasQueue = async.queue(function(def, done){
    jpegtran([
      '-perfect',
      //'-optimize',
      //'-copy', 'none',
      '-drop', '+' + def.x + '+' + def.y, def.img,
      '-outfile', canvas,
      canvas
    ], done);
  }, 1);
  // Start paused, resume when canvas is ready
  putImageInCanvasQueue.pause();

  // Optimized images can only be dropped once the original is in place
  function tryPushOptimizedDrop(imgStatus){
    if(imgStatus.originalIsInCanvas && imgStatus.optimizedReadyToBeInCanvas){
      putImageInCanvasQueue.push(imgStatus.putOptimizedInCanvasWork, function(){
        debug('optimized dropped %s', imgStatus.file);
        imgStatus.optimizedInCanvasCallback.apply(null, arguments);
      });
    }
  }

  function tempFile(suffix){
    var tmp = new Tempfile();
    usedFiles.push(tmp.path);
    if(suffix){
      usedFiles.push(tmp.path + '.' + suffix);
    }
    return tmp.path + '.' + suffix;
  }
};

engine.createCanvas = createCanvas;
engine.createImages = createImages;

module.exports = engine;