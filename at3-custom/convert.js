const _ = require('lodash');
const ffmpeg = require('fluent-ffmpeg');
const EventEmitter = require('events');
const fs = require('fs');


var convertInMP3 = function (inputFile, outputFile, bitrate) {
  if (!bitrate) bitrate = '320k';

  const convertEmitter = new EventEmitter();
  var aborted = false;
  var started = false;

  var convert = ffmpeg(inputFile);

  convert.audioBitrate(bitrate)
    .audioCodec('libmp3lame')
    .on('codecData', function (data) {
      console.log('converting...');
    })
    .on('progress', function (progress) {
      process.stdout.cursorTo(2);
      process.stdout.write(_.round(progress.percent, 2) + "%");
      process.stdout.cursorTo(25);
      process.stdout.write(Array(Math.floor(progress.percent / 5)).join("█") + Array(Math.floor(21 - progress.percent / 5)).join("░"));
      process.stdout.cursorTo(0);
    })
    .on('end', function () {
      fs.unlinkSync(inputFile);
      console.log("conversion complete");
      convertEmitter.emit('end');
    })
    .on('error', e => {
      if (!aborted) {
        convertEmitter.emit('error', e);
      } else {
        if (fs.existsSync(inputFile)) {
          fs.unlink(inputFile, () => { });
        }
        if (fs.existsSync(outputFile)) {
          fs.unlink(outputFile, () => { });
        }
      }
    })
    .on('start', () => {
      started = true;
      if (aborted) {
        abort();
      }
    })
    .save(outputFile);

  function abort() {
    aborted = true;
    if (started) {
      convert.kill();
    }
  }

  convertEmitter.on('abort', abort);

  return convertEmitter;
};


exports.convert = convertInMP3;

// var infile = "/media/l/C09021D69021D426/music/mousiki/AlvBkNa138.mp3";
// var outputfile = infile.replace('.mp3', '-convert.mp3')
// convertInMP3(infile, outputfile, '320k')