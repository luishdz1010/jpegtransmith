var fs = require('fs'),
    path = require('path'),
    async = require('async'),
    assert = require('assert'),
    execFile = require('child_process').execFile,
    Tempfile = require('temporary/lib/file'),
    which = require('which'),
    _gm = require('gm'),
    _ = require('lodash'),
    gmExists = false,
    engine = {};

try {
  gmExists = !!which.sync('gm');
} catch (e) {}

function getGm() {
  return gmExists? _gm : _gm.subClass({ imageMagick: true });
}

function jpegtran(args, cb){
  execFile('jpegtran', args, cb);
}

/**
 * @param {String} file File path to load in
 * @param {Function} callback Error first callback to retrun the image from
 * @prop {Number} image.width
 * @prop {Number} image.height
 * @note Must be guaranteed to integrate into own library via .addImage
 */
function createImage(file, cb) {
  var img = getGm()(file);

  async.waterfall([
    img.size.bind(img),
    function (size, cb) {
      cb(null, {
        height: size.height,
        width: size.width,
        file: file
      });
    }
  ], cb);
}

function createImages(files, cb) {
  async.mapLimit(files, 10, createImage, cb);
}

// Create paths for the scratch directory and transparent pixel
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

Canvas.prototype.export = function (options, cb) {
  options = _.defaults(options, {
    format: 'jpg',
    improvedEdgeSize: 8,
    bg: 'black',
    quality: 92
  });

  assert(['jpg', 'jpeg'].indexOf(options.format) !== -1, 'Exporter ' + options.format + ' does not exist for spritesmith\'s jpegtran engine');

  // Create a big x8 mult canvas file with dark bg
  // Put each image inside the canvas
  // Generate a options.quality image for each image
  // Crop each image by options.improvedEdgeSize from all sides
  // Merge cropped image into canvas
  // Save canvas

  var
    self = this,
    canvas,
    usedFiles = [],
    croppedImages = [],
    ec = options.improvedEdgeSize;

  async.auto({
    createCanvas: function(cb){
      canvas = tempFile();
      getGm()(self.width, self.height, options.bg).write(canvas, cb);
    },
    putOrigImages: ['createCanvas', function(cb){
      async.eachSeries(self.images, function(def, done){
        jpegtran([
          '-drop', '+' + def.x + '+' + def.y, def.img.file,
          '-perfect',
          '-outfile', canvas,
          canvas
        ], done);
      }, cb);
    }],
    createOptimizedImg: function(cb){
      async.eachLimit(self.images, 10, function(def, done){
        var
          optImg = tempFile(),
          img = def.img;

        croppedImages.push({
          file: optImg,
          x: def.x + ec,
          y: def.y + ec
        });

        async.series([
          function createLowQuality(cb){
            getGm()(img.file)
              .quality(options.quality)
              .write(optImg, cb);
          },
          function crop(cb){
            jpegtran([
              '-crop', (img.width - ec*2) + 'x' + (img-height - ec*2) + '+' + (def.x - ec) + '+' + (def.y - ec),
              '-perfect',
              '-outfile', optImg,
              optImg
            ], cb);
          }
        ], done);
      }, cb);
    },
    merge: ['putOrigImages', 'createOptimizedImg', function(cb){
      async.eachSeries(croppedImages, function(img, done){
        jpegtran([
          '-drop', '+' + img.x + '+' + img.y, img.file,
          '-perfect',
          '-optimize',
          '-copy', 'none',
          '-outfile', canvas,
          canvas
        ], done);
      }, cb);
    }]
  }, function(err){
    if(err) return cb(err);

    fs.readFile(canvas, 'binary', function (bytes) {
      // Get rid of temp files
      async.each(usedFiles, fs.unlink.bind(fs), function(){ // Ignore error
        cb(null, bytes);
      });
    });
  });

  function tempFile(){
    var tmp = new Tempfile();
    usedFiles.push(tmp);
    return tmp.path;
  }
};

engine.createCanvas = createCanvas;
engine.createImages = createImages;

module.exports = engine;