var amp = require('alltomp3');
var dir = require("./config").save_directory;
var dl;

function findAndDownload(title, artist, callback) {
	var song = title + " " + artist;
	if (song === "undefined") return callback("both title and artist cannot be empty");
	dl = amp.findAndDownload(song, "./", function (res) {
		logger.info("song saved as ", res, " at ", dir);
		return callback(null, res)
	});
}


dl.on('search-end', function () {console.log("finished searching")});

dl.on('download', function (res) {
	process.stdout.cursorTo(0);
	process.stdout.cursorTo(1);
	process.stdout.write(res.progress + "%" + "\t\t" + Array(Math.floor(res.progress/5)).join("▇") + "");
});
dl.on('download-end', function () {console.log("\nfinished downloading...")});

dl.on('convert', function (res) {
	process.stdout.cursorTo(0);
	process.stdout.cursorTo(1);
	process.stdout.write(res.progress + "%")
});
dl.on('convert-end', function () {console.log("\nconversion complete...")});

dl.on('infos', function (res) {});

exports.findAndDownload = findAndDownload;