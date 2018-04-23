var gpm = new (require('playmusic'));
var config = require('./config');
var log = require('./logger').log
const _ = require('lodash');
const request = require('request');
const fs = require('fs');
const async = require('async');
const tag = require('./at3-custom/tagger').tagFile;
const Promise = require('bluebird');
const readline = require('readline');
// const rl = readline.createInterface(process.stdin, process.stdout, null);

var app = require('express')();
PORT = 8080;
IP = '127.0.0.1';

// TODO: get playlists;
// TODO: get playlist entries;
// TODO: download songs


var playlists = {};
var tracks = [];
var playlistLookup = {};
var songs = playlists;

var BASE_PATH = '/media/l/C09021D69021D426/music/mousiki/';
var PLAYLISTID;
var FOLDER// = (songs[PLAYLISTID] && songs[PLAYLISTID]['name']) ? songs[PLAYLISTID]['name'] + '/' : PLAYLISTID + '/';
var LOG_LINE_NO = 0
var MAX_SIMUL = 30 // not advisable over this, the program may go berserk and good chance it wont download all the songs.

if (!fs.existsSync(BASE_PATH + FOLDER)) fs.mkdirSync(BASE_PATH + FOLDER)

// readline.cursorTo(process.stdout, 0, 0);
// 1readline.clearScreenDown(process.stdout);

var getPlayLists = function () {
  return new Promise(function (resolve, reject) {
    gpm.getPlayLists(function (err, res) {
      // log.info(res)
      if (err) return reject("ERROR:", err)
      _.each(res.data.items, function (p) {
        playlistLookup[p.id] = p.name;
        playlists[p.name] = p;
        playlists[p.name]['size'] = 0
        playlists[p.name]['tracks'] = []
        // delete playlists[p.id]['ownerName']
      });
      playlists['unknown'] = {}
      playlists['unknown']['tracks'] = []
      return resolve();
    });
  });
}


/**
 * pm.getPlaylistEntries(no_of_entries_to_return)
 * gives the first 5000 songs on your play music (I only have about 1000)
 */
var getPlayListEntries = function (nextPageToken) {
  var opts = {};
  if (!!nextPageToken) opts.nextPageToken = nextPageToken

  return new Promise(function (resolve, reject) {
    gpm.getPlayListEntries(opts, function (err, res) {
      if (err) return reject(err)
      var pl_name;
      _.each(res.data.items, function (track) {
        if (!track.track || !playlistLookup[track.playlistId]) return;
        else pl_name = playlistLookup[track.playlistId];
        playlists[pl_name]['size']++;
        playlists[pl_name]['tracks'].push(track.track);
      });
      if (!!res.nextPageToken && res.nextPageToken.length > 1) {
        getPlayListEntries(res.nextPageToken).then(function () {
          return resolve();
        }).catch(function (err) { return reject(err) });
      } else return resolve();
    });
  });
}

var getSongs = function (cb) {
  log.info('Downloading Playlist: ', playlists[PLAYLISTID]['name']); LOG_LINE_NO++;
  var batchRequests = [], urlRequests = [[]], songRequests = [], taggingTasks = [];
  var downloadComp = 0, existingDownloads = 0, currentbatch = 0, tagsComp = 0

  var _logProgress = function (pos, size, line) {
    var percent = (pos / size * 100).toFixed(2);
    // readline.cursorTo(process.stdout, 1, line)
    try {
      var prog = Array(Math.round(Math.floor(percent / 5))).join("█"), total = Array(Math.round(Math.floor(21 - percent / 5))).join("░");
      process.stdout.cursorTo(2)
      process.stdout.write(pos + " of " + size);
      process.stdout.cursorTo(25);
      process.stdout.write(prog + total);
      process.stdout.cursorTo(0);
    } catch (e) {
      log.error(e);
    }
  }

  // check for already downloaded songs...
  var _lookForDownload = function (song) {
    return fs.existsSync(_getFileName(song));
  }

  var _getFileName = function (song) {
    return BASE_PATH + FOLDER + song.artist.replace(/[\/\\,+()~'":*?<>{}]/g, '') + ' - ' + song.title.replace(/[\/\\,+()~'":*?<>{}]/g, '') + '.mp3'
  }

  var _getInfos = function (song) {
    return {
      title: song.title,
      artistName: song.artist,
      album: song.album,
      year: song.year,
      position: song.trackNumber,
      cover: song.albumArtRef[0] || null
    }
  }

  /**
   * 
   * @param {string} url string fetched from gpm.getStreamUrl
   * @param {os.path} path song will be downloaded to this path
   * @param {function} cb1 
   */
  var downloadSong = function (url, path, cb1) {
    // log.debug(path);
    var options = {
      method: 'GET',
      uri: url,
    };
    var size = 0; var pos = 0
    request(options)
      .on('error', function (err) { return cb1(err, path) })
      .on('response', function (res) {
        size = res.headers['content-length']
      })
      .on('data', function (data) {
        pos += data.length
        // _logProgress(pos, size, 5);
        if (!fs.existsSync(path)) fs.writeFileSync(path, data);
        else fs.appendFileSync(path, data);
      })
      .on('end', function () {
        _logProgress(++downloadComp, currentbatch*30 + songRequests.length, 4);
        return cb1(null, path)
      });
  }

  /**
   * 
   * @param {Object} song song Oject currently from songs.js will be moved to a dynamic json later
   * @param {function} cb2 
   * @param {stack trace} err 
   * @param {string} url 
   */
  var getUrls = function (song, cb2, err, url) {
    // log.debug(song.title, '-', song.artist, url, err)
    if (err) return cb2('ERROR:', err);
    if (!_.includes(_.lowerCase(url), 'http')) log.error(url);
    _logProgress(songRequests.length, ((batchRequests.length - 1) * MAX_SIMUL + urlCount), 2)
    var path = _getFileName(song);
    var infos = _getInfos(song);
    if (fs.existsSync(path)) return cb2();
    songRequests.push(async.reflect(function (cb1) { downloadSong(url, path, cb1) }));
    taggingTasks.push(async.reflect(function (cb1) { tag(path, infos).then(function () {
      _logProgress(tagsComp++, taggingTasks); 
      return cb1();
    }).catch(function (err) { log.error(err) }) }));
    return cb2()
  }

  // NOTE: create url requests for each song from playlist with 'MAX_SIMUL' in each batch
  // log.info(songs[PLAYLISTID]['tracks'].length, 'tracks\nfetching urls...'); 
  var urlCount = 0, batch = 0
  _.each(playlists[PLAYLISTID]['tracks'], function (song, i) {
    // log.warn(urlCount + '...', urlRequests.length, song.title, song.artist, '...', downloaded);
    if (_lookForDownload(song)) { existingDownloads++; return; }
    if (urlCount < MAX_SIMUL) urlCount++;
    else {
      log.debug('batch', batch, 'length', urlRequests[batch].length)
      log.debug(Array(80).join('-'));
      batch++; urlCount = 1
      urlRequests[batch] = [];
    }
    urlRequests[batch].push(async.reflect(function (cb2) { gpm.getStreamUrl(song.storeId, getUrls.bind(null, song, cb2)) }));
  });
  log.debug('batch', batch, 'length', urlRequests[batch].length)
  log.debug(Array(80).join('-'));
 
  if (existingDownloads === playlists[PLAYLISTID]['tracks'].length) return cb('Downloads already exist');
  
  // NOTE: create batch tasks
  _.each(urlRequests, function (req, batch) {
    batchRequests.push(
      function (cb3) {
        async.parallel(urlRequests[batch], function (err, res) {
          if (err) log.error(err);
          log.info('starting downloads: batch', batch, '\n');
          async.parallel(songRequests, function (err, res) {
            if (err) log.error(err);
            // log.info(taggingTasks);s
            // readline.cursorTo(process.stdout, 0, songRequests.length + 3)
            // rl.close()
            log.info('downloads complete\ntagging...\n');
            async.parallel(taggingTasks, function (err, res) {
              if (err) log.error(err);
              log.debug(Array(80).join('-'));
              log.info(batch + ' complete..');
              songRequests.length = 0; songRequests = []; taggingTasks = []; currentbatch++;
              return cb3();
            });
          });
        });
      });
  });
  // log.debug(batchRequests.length)
  
  // NOTE: execute each batch in series...
  async.series(batchRequests, function (err, res) {
    return cb('Complete...')
  });
}


app.get('/get-playlist-songs', function (req, res) {
  if (!req.query.playlist) return res.send('No valid playlist given\nURL FORMAT: IP:PORT?"playlist": "<playlist name>"');
  PLAYLISTID = JSON.parse(req.query.playlist);
  if (!playlists[PLAYLISTID]) { log.error('Invalid playlist:', PLAYLISTID); return res.send('Invalid Playlist'); }
  FOLDER = playlists[PLAYLISTID]['name'] + '/';
  getSongs(function (msg) { return res.send(msg) });
});

app.get('/get-playlists', function (req, res) {
  getPlayLists().then(function () {
    res.send(_.keys(playlists)); 
    log.info(JSON.stringify(playlistLookup, null, 4));
  }).catch(function (err) { log.error(err); res.send(err) })
});

app.get('/get-playlist-entries', function (req, res) {
  getPlayLists().then(function () {
    getPlayListEntries().then(function () {
      res.send(JSON.stringify(playlists, null, 4));
      fs.writeFileSync(__dirname + '/playlists.txt', JSON.stringify(playlists, null, 4));
    }).catch(function (err) { log.error(err); res.send(err) });
  }).catch(function (err) { log.error(err); res.send(err) });
});

var server = app.listen(PORT, IP, function (err, res) {
  if (err) log.fatal(err);
  log.info('server starting on:', IP + ':' + PORT);
  gpm.init({ email: config.email, password: config.password }, function (err) {
    if (err) return log.info("ERROR:\n" + err);
    getPlayLists().then(function () {
      getPlayListEntries().then(function () {
        log.info(_.keys(playlists).join('\n'));
        // songs = playlists;
        log.info('server ready...')
        fs.writeFileSync(__dirname + '/playlists.js', JSON.stringify(playlists, null, 4));
      }).catch(function (err) { log.error(err); });
    }).catch(function (err) { log.error(err); });
  });
});

process.on('SIGINT', function () {
  log.info('\nclosing server..')
  server.close();
  process.exit();
});

process.on('uncaughtException', function (err) {
  log.error(err);
});