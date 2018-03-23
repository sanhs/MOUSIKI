/**
Uses alltomp3 node module
alltomp3: download music video based on title and artist converts it to mp3 attaches the id3 tags
*/

/**
what's next:
Api to download playlist based on a text file with title and artist.
*/
const Promise = require('bluebird');
const EventEmitter = require('events');
const async = require('async');


var at3 = require('./at3');
var search = require('./at3-custom/search').search;

var dir = require("./config").save_directory;
var dl = new EventEmitter();


var _events = function (dl) {
	dl.on('error', function (err) {console.error("ERROR:", err)});

	dl.on('search-end', function () {console.log("downloading...")});

	dl.on('download', function (res) {
		process.stdout.cursorTo(1);
		process.stdout.write(res.progress + "%");
		process.stdout.cursorTo(25);
		process.stdout.write(Array(Math.floor(res.progress/5)).join("█") + Array(Math.floor(21-res.progress/5)).join("░"));
		process.stdout.cursorTo(0);
	});
	dl.on('download-end', function () {console.log("\nconverting...")});

	dl.on('convert', function (res) {
		process.stdout.cursorTo(1);
		process.stdout.write(res.progress + "%");
		process.stdout.cursorTo(25);
		process.stdout.write(Array(Math.floor(res.progress/5)).join("█") + Array(Math.floor(21-res.progress/5)).join("░"));
		process.stdout.cursorTo(0);
	});
	dl.on('convert-end', function () {console.log("\nconversion complete...")});

	dl.on('infos', function (res) {});
};


function findAndDownload(title, artist, callback) {
	var song = title + " " + artist;
	if (song === "undefined") return callback("both title and artist cannot be empty");
	dl = at3.findAndDownload(song, dir, function (res, err) {
		if (err) return callback(err);
		console.log("file downloaded to ", dir);
		return callback(null, res)
	}, true);
	_events(dl);
}

var tracks = [
"More than a feeling Boston",
"rebel rebel David Bowie",
""
]

function find(title, artist) {
	return new Promise(function(resolve, reject) {
		search(title + ' ' + artist).then(function(res) {
			return resolve(res);
		}).catch(function(err) {reject(err)});
	});
}


exports.findAndDownload = findAndDownload;
exports.find = find;