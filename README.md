# jpegtransmith

[jpegtran][jpegtran] engine for [spritesmith][spritesmith]. It uses jpegtran and [gm][gm] for lossless crop'n'drop, which allows it to
improve the quality on the edges in each image of the sprite.

[jpegtran]: http://jpegclub.org/jpegtran/
[gm]: http://aheckmann.github.io/gm/
[spritesmith]: https://github.com/Ensighten/spritesmith

## Getting Started
Install the module with: `npm install jpegtransmith`

```js
var
  spritesmith = require('spritesmith'), // or if using grunt-spritesmith: require('grunt-spritesmith/node_modules/spritesmith/src/smith.js')
  jpegtransmith = require('jpegtransmith');

  spritesmith.addEngine('jpegtransmith', jpegtransmith);

  spritesmith({src: sprites, engine: 'jpegtransmith'}, function handleResult (err, result) {
    result.image; // Binary string representation of image
    result.coordinates; // Object mapping filename to {x, y, width, height} of image
    result.properties; // Object with metadata about spritesheet {width, height}, see Requirements for possible disparities
  });
```

*NOTE*: This module is slow, mainly because of jpegtran usage. If you have any suggestion in how to improve speed, open an issue.

## Requirements
`jpegtransmith` depends on:
* [jpegtran][jpegtran], the download link is at the bottom in section `3`, the binary must be globally accessible
* [gm](https://github.com/aheckmann/gm) which depends on [Graphics Magick](http://www.graphicsmagick.org/).

For this to work, we use a virtual grid of 8x8 blocks. It requires your images dimensions to be multiple of 8, for the
jpegtran -drop command to work correctly. If you specify a padding in spritesmith, it must also be a multiple of 8.
If your images don't fit this description they will be used as-is but the individual images may be cropped and their generated dimensions
 will be off by a few pixels (since they will be readjusted to align to 8x8), to correct the second problem you can use this (on `grunt-spritesmith`):

```js
  var imdDataCache = {};

  // Save the real img data for later use
  jpegtransmith.imageDataMutator = function(imgData){
    imgDataCache[imgData.file] = imgData;
  }

  // grunt config
  // Restore the original width and height
  sprite: {
    my_sprite: {
      // ...
      cssVarMap: function(sprite){
        var imgData = imgDataCache[sprite.source_image];
        if(imgData){
          sprite.width = imgData.realWidth;
          sprite.height = imgData.realHeight;
        }
      }
    }
  }
```

> Alternatively, you can use ImageMagick which is implicitly discovered if `gm` is not installed.
> http://www.imagemagick.org/script/index.php



## Documentation
This module was built to the specification for all spritesmith modules.

NOTE: This module fails most of the test in `spritesmith-engine-test` because it only works for JPEG images and it modifies the final size of the
sprite by adjusting each image to a 8x8 grid.

https://github.com/twolfson/spritesmith-engine-test

### canvas\['export'\](options, cb)
These are options specific `jpegtranmsith`

- options `Object`
  - quality `Number`: 92 - Quality of each image on a scale from 0 to 100 (All image edges will be in original quality)
  - improvedEdgeSize `Number`: 8 - The number of pixels from the edge inwards to keep intact for the individual images in the final sprite
  - bg `String`: `black` - The background color used on the sprite
  - samplingFactor `String`: 1x1,1x1,1x1

## Contributing
Take care to maintain the existing coding style. Add unit tests for any new or changed functionality.

## License
MIT
Copyright (c) 2014 Luis Hernandez