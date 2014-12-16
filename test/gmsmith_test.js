// Load our dependencies
var jpegtransmith = require('../lib/jpegtransmith');
var spritesmithEngineTest = require('spritesmith-engine-test');

// Run our tests
spritesmithEngineTest.run({
  engine: jpegtransmith,
  engineName: 'jpegtransmith',
  options: {
    // If we are on Windows, skip over performance test (it cannot handle the long argument string)
    skipRidiculousImagesTest: process.platform === 'win32'
  }
});
