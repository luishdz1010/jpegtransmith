var smith = require('../lib/gmsmith'),
    extend = require('obj-extend'),
    commonTest = require('spritesmith-engine-test').content;
module.exports = extend({}, commonTest, {
  'gmsmith': function () {
    this.smith = smith;

    var expectedDir = __dirname + '/expected_files/';
    this.expectedFilepaths = [expectedDir + '/multiple.png', expectedDir + '/multiple2.png'];
  }
});