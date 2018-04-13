/**
 * add info from file - acoustid
 * add info from url
 */

const _ = require('lodash');
const fs = require('fs');
const requestNoPromise = require('request');
const EyeD3 = require('eyed3');
const smartcrop = require('smartcrop-sharp');
var eyed3 = new EyeD3({ eyed3_path: 'eyeD3' });
eyed3.metaHook = (m) => m;
const request = require('request-promise');
const sharp = require('sharp');
const youtubedl = require('youtube-dl');
const Promise = require('bluebird');

var API_LASTFM = "6fd6b491a65d377ec730977998ed5bdf";

function imatch(textSearched, text) {
	// [TODO] Improve this function (use .test and espace special caracters + use it everywhere else)
	return text.match(new RegExp(textSearched, 'gi'));
}
function vsimpleName(text, exact) {
	if (exact === undefined) {
		exact = false;
	}
	text = text.toLowerCase();
	if (!exact) {
		// text = text.replace('feat', '');
	}
	text = text.replace(/((\[)|(\())?radio edit((\])|(\)))?/ig, '');
	text = text.replace(/[^a-zA-Z0-9]/ig, '');
	return text;
}
function delArtist(artist, text, exact) {
	if (exact === undefined) {
		exact = false;
	}
	if (vsimpleName(artist).length <= 2) { // Artist with a very short name (Mathieu Chedid - M)
		return vsimpleName(text, exact);
	} else {
		// [TODO] Improve, escape regex special caracters in vsimpleName(artist)
		return vsimpleName(text, exact).replace(new RegExp(vsimpleName(artist), 'ig'), '');
	}
}
function simpleName(text) {
	return text.replace(/\(.+\)/g, '');
}


/**
* Retrieve informations about a track from artist and title
* @param title
* @param artistName
* @param exact boolean Exact search or not
* @param v boolean Verbose
* @return Promise
*/
var retrieveTrackInformations = function (title, artistName, exact, v) {
	if (exact === undefined) {
		exact = false;
	}
	if (v === undefined) {
		v = false;
	}

	if (!exact) {
		_.forEach([title, artistName], function (q) {
			q = q.replace(/((\[)|(\())?radio edit((\])|(\)))?/ig, '');
			q = q.replace(/\(.*\)/g, '');
			q = q.replace(/\[.*\]/g, '');
			q = q.replace(/lyric(s?)|parole(s?)/ig, '');
			q = q.replace(/^'/, '');
			q = q.replace(/ '/g, ' ');
			q = q.replace(/' /g, ' ');
			q = q.replace(/Original Motion Picture Soundtrack/i, '');
			q = q.replace(/bande originale/i, '');
		});
	}

	var infos = {
		title: title,
		artistName: artistName
	};
	var lastfm_infos = {};

	var requests = [];


	var requestLastfm = request({
		url: 'http://ws.audioscrobbler.com/2.0/?method=track.getInfo&api_key=' + API_LASTFM + '&artist=' + artistName + '&track=' + title + '&format=json'
	}).then(function (res) {
		res = JSON.parse(res);
		lastfm_infos.title = res.track.name;
		lastfm_infos.artistName = res.track.artist.name;
		lastfm_infos.album = res.track.album.title;
		lastfm_infos.position = res.track.album['@attr']['position'];

		lastfm_infos.genre = res.track.toptags.tag[0]['name'];
		lastfm_infos.duration = res.track.duration / 1000;
		lastfm_infos.cover = res.track.album.image.pop()['#text'].replace('300x300', '600x600');
		// console.log(lastfm_infos);
		return lastfm_infos;
	}).catch(function (err) {
		console.log(err)
	});


	var requestiTunes = request({
		url: 'https://itunes.apple.com/search?media=music&term=' + encodeURIComponent(artistName + ' ' + title),
		json: true
	}).then(function (body) {
		var itunesInfos;
		_.forEach(body.results, function (s) {
			if (!infos.itunesId && (imatch(vsimpleName(title), vsimpleName(s.trackName)) || imatch(vsimpleName(title), vsimpleName(s.trackCensoredName))) && imatch(vsimpleName(artistName), vsimpleName(s.artistName))) {
				infos.itunesId = s.trackId;
				itunesInfos = _.clone(s);
			}
		});
		if (!infos.deezerId && itunesInfos) {
			infos.artistName = itunesInfos.artistName;
			if (imatch(vsimpleName(infos.title), vsimpleName(itunesInfos.trackName))) {
				infos.title = itunesInfos.trackName;
			} else {
				infos.title = itunesInfos.trackCensoredName;
			}
			infos.itunesAlbum = itunesInfos.collectionId;
			infos.position = itunesInfos.trackNumber;
			infos.nbTracks = itunesInfos.trackCount;
			infos.album = itunesInfos.collectionName;
			infos.releaseDate = itunesInfos.releaseDate.replace(/T.+/, '');
			infos.cover = itunesInfos.artworkUrl100.replace('100x100', '600x600');
			infos.genre = itunesInfos.primaryGenreName;
			infos.discNumber = itunesInfos.discNumber;
			infos.duration = itunesInfos.trackTimeMillis / 1000;
		}

		if (v) {
			console.log("iTunes infos: ", itunesInfos);
		}
		return itunesInfos;
	});

	requests.push(requestiTunes);
	requests.push(requestLastfm);

	return new Promise(function (resolve, reject) {
		Promise.all(requests).then(function () {
			return resolve({
				itunes: infos,
				lastfm: lastfm_infos
			});
		}).catch(function (err) { reject(err) });
	});
}


/**
* Try to find to title and artist from a string
* (example: a YouTube video title)
* @param query string
* @param exact boolean Can the query be modified or not
* @param last boolean Last call
* @param v boolean Verbose
* @return Promise
*/
var guessTrackFromString = function (query, exact, last, v) {
	// [TODO] Replace exact by a level of strictness
	// 0: no change at all
	// 4: remove every thing useless
	if (exact === undefined) {
		exact = false;
	}
	if (last === undefined) {
		last = false;
	}
	if (v === undefined) {
		v = true;
	}

	if (v) {
		console.log("Query: ", query);
	}

	var searchq = query;
	if (!exact) {
		searchq = searchq.replace(/\(.*\)/g, '');
		searchq = searchq.replace(/\[.*\]/g, '');
		searchq = searchq.replace(/lyric(s?)|parole(s?)/ig, '');
		searchq = searchq.replace(/^'/, '');
		searchq = searchq.replace(/ '/g, ' ');
		searchq = searchq.replace(/' /g, ' ');
		searchq = searchq.replace(/Original Motion Picture Soundtrack/i, '');
		searchq = searchq.replace(/bande originale/i, '');
		searchq = searchq.replace(/ ~.*/g, '');
	}

	var requests = [];
	var infos = {
		title: null,
		artistName: null,
		query: searchq
	};


	// iTunes
	var requestiTunes = request({
		url: 'https://itunes.apple.com/search?media=music&term=' + encodeURIComponent(searchq),
		json: true
	}).then(function (body) {
		var title, artistName, tempTitle;
		_.forEach(body.results, function (s) {
			if (!title) {
				if (vsimpleName(searchq, exact).match(new RegExp(vsimpleName(s.artistName), 'gi'))) {
					if (delArtist(s.artistName, searchq, exact).match(new RegExp(vsimpleName(s.trackCensoredName), 'gi'))) {
						artistName = s.artistName;
						title = s.trackCensoredName;
					} else if (delArtist(s.artistName, searchq, exact).match(new RegExp(vsimpleName(s.trackName), 'gi'))) {
						artistName = s.artistName;
						title = s.trackName;
					} else if (!artistName) {
						artistName = s.artistName;
						temp_title = s.trackName;
					}
				}
			}
		});
		if (title && artistName) {
			infos.title = title;
			infos.artistName = artistName;
		}
		if (v) {
			// console.log("iTunes answer: ", title, '-', artistName);
		}
	});

	requests.push(requestiTunes);

	return Promise.all(requests).then(function () {
		if (!last && (!infos.title || !infos.artistName)) {
			searchq = searchq.replace(/f(ea)?t(\.)? [^-]+/ig, ' ');
			return guessTrackFromString(searchq, false, true, v);
		}
		return infos;
	});

};

/**
* Get infos about an online video with youtube-dl
* @param url
* @return Promise
*/
var getInfosWithYoutubeDl = function (url) {
	return new Promise(function (resolve, reject) {
		youtubedl.getInfo(url, ['--no-check-certificate'], function (err, infos) {
			if (err) return reject(err);
			else {
				return resolve({
					title: infos.title,
					author: infos.uploader,
					picture: infos.thumbnail
				});
			}
		});
	});
};
exports.getYoutubeInfo = getInfosWithYoutubeDl;


var tagFile = function (file, infos) {
	var meta = {
		title: infos.title,
		artist: infos.artistName
	};
	if (infos.album) {
		meta.album = infos.album;
	}
	if (infos.position) {
		meta.track = infos.position;
	}
	if (infos.nbTracks) {
		meta.trackTotal = infos.nbTracks;
	}
	if (infos.discNumber) {
		meta.disc = infos.discNumber;
	}
	if (infos.lyrics) {
		meta.lyrics = infos.lyrics;
	}
	if (infos.releaseDate) {
		meta.year = (/[0-9]{4}/.exec(infos.releaseDate))[0];
	}
	if (infos.genre) {
		meta.genre = infos.genre.replace(/\/.+/g, '');
	}
	function renameFile(file, filename) {
		var f = file.split('/');
		f.pop();
		f = f.join('/') + '/' + filename + '.mp3';
		fs.renameSync(file, f);
	}

	return new Promise(function (resolve, reject) {
		eyed3.updateMeta(file, eyed3.metaHook(meta), function (err) {
			if (err) {
				return reject(err);
			}
			if (infos.cover) {
				var coverPath = file + '.cover.jpg';

				requestNoPromise(infos.cover, function () {

					// Check that the cover is a square
					const coverFile = sharp(coverPath);
					coverFile.metadata().then(metadata => {
						if (metadata.width != metadata.height) {
							console.log(metadata.width + 'x' + metadata.height);
							var crop_size = 600
							// In that case we will crop the cover to get a square
							const tempCoverPath = file + '.cover.resized.jpg';
							return smartcrop.crop(coverPath, { width: crop_size, height: crop_size }).then(function (result) {
								var crop = result.topCrop;
								return coverFile
									.extract({ width: crop.width, height: crop.height, left: crop.x, top: crop.y })
									.toFile(tempCoverPath);
							}).then(() => {
								fs.renameSync(tempCoverPath, coverPath);
							});
						}
					}).then(() => {
						eyed3.updateMeta(file, eyed3.metaHook({ image: coverPath }), function (err) {
							fs.unlinkSync(coverPath);

							if (err) {
								return reject(err);
							}
							renameFile(file, infos.artistName + ' - ' + infos.title)
							resolve();
						});
					});
				}).pipe(fs.createWriteStream(coverPath));
			} else {
				renameFile(file, infos.artistName + ' - ' + infos.title)
				resolve();
			}
		});
	});

};


// take title and artist along with url to search for tags, 
// in case you can't find the tags then go with this as the last resort.
exports.tagWithUrl = function (file, url) {
	getInfosWithYoutubeDl(url)
		.then(function (info) {
			console.log(info);
			guessTrackFromString(info.title).then(function (infos) {
				// console.log(infos)
				if ((!infos.title || !infos.artistName)) {
					var s = infos.query.split('-');
					infos.title = s[0];
					infos.artistName = s[1];
					infos.cover = info.picture;
				}
				return tagFile(file, infos)
					.then(function () {
						console.log("file tagging complete");
					}).catch(function (err) { console.log(err) });
			}).catch(function (err) { console.log(err) });
		}).catch(function (err) { console.log(err) });
}


exports.tagWithTitle = function (file, title, artist, url) {
	retrieveTrackInformations(title, artist).then(function (res) {
		if (!res.itunes && res.lastfm) {
			console.log("No tag infos found, tagging with youtube info\nthese might be incorrect and you might have to redo this");
			if (url)
				return exports.tagWithUrl(file, url);
		} else if (!res.itunes) {
			console.log("No itunes infos found, tagging with lastfm");
			return tagFile(file, res.lastfm)
				.then(function () { console.log("file tagged with lastfm info") })
				.catch(function (err) { console.log(err) });
		} else {
			return tagFile(file, res.itunes)
				.then(function () { console.log("file tagged with itunes info") })
				.catch(function (err) { console.log(err) });
		}
	}).catch(function (err) { console.log("ERROR", err) });
}


exports.retrieveTrackInformations = retrieveTrackInformations;

// var file = '/media/l/C09021D69021D426/music/mousiki/gvRt6uBgVW.mp3'
// exports.tagWithTitle(file, "strong", "london grammar").then(function () {console.log("done")}).catch(function (err) {console.log('ERROR:', err)});