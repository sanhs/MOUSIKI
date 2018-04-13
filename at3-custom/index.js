// DONE: download a single video with a url => add optional arguments of title and artist => add tags based on arguments
// DONE: download a single video with title artist
// TODO: download playlists with title and artist from a file or a json Object
// TODO: log downloaded playlists info for qc.
// TODO: get songs from play music and automatically download them

const _ = require('lodash');
const inq = require('inquirer');
const fs = require('fs');
const randomstring = require('randomstring');
const logger = require('log4js').getLogger('app');
logger.level = 'debug';

const schema = require('./ind-schema');
var s = require('./search');
var d = require('./download');
var c = require('./convert');
var t = require('./tagger');
const outputFolder = '/media/l/C09021D69021D426/music/mousiki/';

/**
 * @util
 * @param {*} fileType 
 */
var createOpFile = function (fileType) {
    if (fileType === "video") return outputFolder + randomstring.generate(10) + '.mp4';
    else return outputFolder + randomstring.generate(10) + '.mp3';
};

/**
 * @util
 * @param {list} results - list returned from search api
 */
var processSearchResults = function (results) {
    var res = {};
    _.each(results, function (r) {
        var dur = Math.floor(r.duration / 60) + ":" + r.duration % 60
        c = r.title + ", views: " + r.views + ", duration: " + dur + ", score: " + r.realLike + " hd: " + r.hd;
        res[c] = r.url;
    });
    return res;
};

/**
 * 
 * @param {string} url 
 * @param {string} title 
 * @param {string} artist 
 */
var downloadVideo = function (url, title, artist) {
    var tempfile = createOpFile("video");
    var dl = d.downloadVideo(url, tempfile);
    t.retrieveTrackInformations(title, artist).then(function (infos) {
        album = '';
        if (!infos.itunes && !infos.lastfm) { }
        else if (!infos.lastfm) {
            title = infos.itunes.title;
            artist = infos.itunes.artistName;
            album = infos.itunes.album;
        } else {
            title = infos.lastfm.title;
            artist = infos.lastfm.artistName;
            album = infos.lastfm.album;
        }
        dl.on('end', function () {
            var f = tempfile.split('/');
            f.pop();
            f = f.join('/') + '/' + artist + ' - ' + album + ' - ' + title + '.' + tempfile.split('.').pop();
            fs.renameSync(tempfile, f);
        });
    }).catch(function (err) { logger.error('ERROR:', err) });
    dl.on('error', function (err) { logger.error(err) });
}

/**
 * 
 * @param {string} url 
 * @param {string} fileType 
 * @param {string} title 
 * @param {string} artist 
 */
var download = function (url, fileType, title, artist) {
    if (fileType === "audio") {
        var tempfile = createOpFile("audio");
        var dl = d.downloadAudio(url, tempfile);
        dl.on('error', function (err) { logger.error('ERROR', err) });
        dl.on('end', function () {
            var outputfile = tempfile.replace('.mp3', '-convert.mp3')
            var cn = c.convert(tempfile, outputfile);
            cn.on('error', function (err) { logger.error('ERROR', err) });
            cn.on('end', function () {
                if (title && artist) t.tagWithTitle(outputfile, title, artist, url);
                else t.tagWithUrl(outputfile, url);
            });
        });
    } else {
        downloadVideo(url, title, artist);
    };
}


var getPlaylistUrls = function (url) {
    var playlistId = url.match(/list=([0-9a-zA-Z_-]+)/);
    playlistId = playlistId[1];
    let playlistInfos = {};
    let playlistq = request({
        url: 'https://www.googleapis.com/youtube/v3/playlists?part=snippet&key=' + API_GOOGLE + '&id=' + playlistId,
        json: true
    }).then(function (playlistDetails) {
        let snippet = playlistDetails.items[0].snippet;
        playlistInfos.title = snippet.title;
        playlistInfos.artistName = snippet.channelTitle;
        playlistInfos.cover = snippet.thumbnails.medium.url;
    });
    let playlistItemsq = request({
        url: 'https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&key=' + API_GOOGLE + '&maxResults=50&playlistId=' + playlistId,
        json: true
    }).then(function (playlistDetails) {
        let playlistItems = [];

        _.forEach(playlistDetails.items, function (item) {
            if (!item.snippet || !item.snippet.thumbnails) {
                // Video unavailable, like cbixLt0WBQs
                return;
            }
            var highestUrl;
            _.forEach(['maxres', 'standart', 'high', 'medium', 'default'], function (res) {
                if (!highestUrl && item.snippet.thumbnails[res]) {
                    highestUrl = item.snippet.thumbnails[res].url;
                }
            });
            playlistItems.push({
                url: 'http://youtube.com/watch?v=' + item.snippet.resourceId.videoId,
                title: item.snippet.title,
                cover: highestUrl
            });
        });

        playlistInfos.items = playlistItems;
    });
    return Promise.all([playlistItemsq, playlistq]).then(() => {
        return playlistInfos;
    });
}

/**
 * 
 * @param {list of objects} songs
 * @param {string} outputFolder 
 * @param {function} callback 
 * @param {integer} maxSimultaneous 
 */
var downloadPlaylists = function (songs, outputFolder, maxSimultaneous) {
    if (!maxSimultaneous) { maxSimultaneous = 1 }
    
}

inq.prompt(schema.main).then(function (main_res) {
    if (main_res.main == "search and download") {
        inq.prompt(schema.track).then(function (track) {
            var song = track.title + " " + track.artist;
            s.search(song)
                .then(function (results) {
                    resObj = processSearchResults(results);
                    inq.prompt(schema.search(_.keys(resObj))).then(function (v) {
                        download(resObj[v.video], main_res.fileType, track.title, track.artist);
                    }).catch(function (err) { logger.error('ERROR:', err) })
                }).catch(function (err) { logger.error('ERROR:', err) })
        }).catch(function (err) { logger.error('ERROR:', err) });
    } else {
        inq.prompt(schema.url).then(function (url_res) {
            download(url, main_res.fileType)
        }).catch(function (err) { logger.error(err) });
    }
}).catch(function (err) { logger.error(err) })

// var uri = "https://www.youtube.com/watch?v=6drfp_3823I";
// downloadWithUrl(uri, "audio")
