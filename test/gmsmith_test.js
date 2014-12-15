// Load our dependencies
var gmsmith = require('../lib/gmsmith');
var spritesmithEngineTest = require('spritesmith-engine-test');

// Run our tests
spritesmithEngineTest.run({
  engine: gmsmith,
  engineName: 'jpegtransmith',
  options: {
    // If we are on Windows, skip over performance test (it cannot handle the long argument string)
    skipRidiculousImagesTest: process.platform === 'win32'
  }
});
