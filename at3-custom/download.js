const fs = require('fs');
const EventEmitter = require('events');
const youtubedl = require('youtube-dl');
const randomstring = require('randomstring');

const opfolder = "/media/l/C09021D69021D426/music/mousiki";


/**
* Download a single video with youtube-dl
* @param url
* @param outputFile
* @return Event
*/
var download = function(url, outputFile, options) {
	var dl = youtubedl(url, options, {maxBuffer: Infinity});
	const downloadEmitter = new EventEmitter();
	var aborted = false;

	var size = 0;
	dl.on('info', function(info) {
		size = info.size;
		console.log("title: " + info.title + 
			"\nviews: " + info.view_count + 
			"\nlike count: " + info.like_count + 
			"\ndislike count: " + info.dislike_count + 
			"\nupload date: " + info.upload_date
			);

		dl.pipe(fs.createWriteStream(outputFile));
	});

	var pos = 0;
	dl.on('data', function data(chunk) {
		if (aborted) {
			abort();
		}
		pos += chunk.length;

		if (size) {
			var percent = (pos / size * 100).toFixed(2);
			process.stdout.cursorTo(1);
			process.stdout.write(percent + "%");
			process.stdout.cursorTo(25);
			process.stdout.write(Array(Math.floor(percent/5)).join("█") + Array(Math.floor(21-percent/5)).join("░"));
			process.stdout.cursorTo(0);
		}
	});

	dl.on('end', function end() {
		if (aborted) {
			return;
		}
		console.log("Download Complete..");
	});

	dl.on('error', function(error) {
		downloadEmitter.emit('error', new Error(error));
	});

	function abort() {
		aborted = true;
		if (dl._source && dl._source.stream) {
			dl._source.stream.abort();
		}
		if (fs.existsSync(outputFile)) {
			fs.unlinkSync(outputFile);
		}
	}

	downloadEmitter.on('abort', abort);

	return downloadEmitter;
};


var downloadVideo = function(url, outputFile) {
	var options = ['-f', 'bestvideo/best', '--no-check-certificate', '--format=18'];
	var opfile = opfolder + randomstring.generate(10) + '.mp4';
	download(url, outputFile, options);
}

var downloadAudio = function(url, outputFile) {
	var options = ['-f', 'bestaudio/best', '--no-check-certificate'];
	var opfile = opfolder + randomstring.generate(10) + '.mp3';
	download(url, outputFile, options);
}

downloadAudio("https://www.youtube.com/watch?v=Eyn6ZkS4cpc", opfile);