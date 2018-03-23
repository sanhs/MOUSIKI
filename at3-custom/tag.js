


at3.getInfosWithYoutubeDl = function(url) {
  return new Promise(function (resolve, reject) {
    youtubedl.getInfo(url, ['--no-check-certificate'], function (err, infos) {
      if (err || infos === undefined) {
        reject();
      } else {
        resolve({
          title: infos.title,
          author: infos.uploader,
          picture: infos.thumbnail
        });
      }
    });
  });
};


at3.guessTrackFromString = function(query, exact, last, v) {
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
  }

  var requests = [];
  var infos = {
    title: null,
    artistName: null,
  };

  // We search on Deezer and iTunes
  // [TODO] Adding Spotify

  // Deezer
  var requestDeezer = request({
    url: 'https://api.deezer.com/2.0/search?q=' + encodeURIComponent(searchq),
    json: true
  }).then(function (body) {
    var title, artistName, tempTitle;
    _.forEach(body.data, function (s) {
      if (!title) {
        if (vsimpleName(searchq,exact).replace(new RegExp(vsimpleName(s.artist.name), 'ig'))) {
          if (delArtist(s.artist.name, searchq, exact).match(new RegExp(vsimpleName(s.title_short), 'ig')) || vsimpleName(s.title_short).match(new RegExp(delArtist(s.artist.name, searchq, exact), 'ig'))) {
            artistName = s.artist.name;
            title = s.title;
          } else if(!artistName) {
            artistName = s.artist.name;
            tempTitle = s.title;
          }
        }
      }
    });
    if (title && artistName) {
      infos.title = title;
      infos.artistName = artistName;
    }
    if (v) {
      console.log("Deezer answer: ", title, '-', artistName);
    }
  });

  // iTunes
  var requestiTunes = request({
    url: 'https://itunes.apple.com/search?media=music&term=' + encodeURIComponent(searchq),
    json: true
  }).then(function (body) {
    var title, artistName, tempTitle;
    _.forEach(body.results, function (s) {
      if (!title) {
        if (vsimpleName(searchq, exact).match(new RegExp(vsimpleName(s.artistName), 'gi'))) {
          if(delArtist(s.artistName, searchq, exact).match(new RegExp(vsimpleName(s.trackCensoredName), 'gi'))) {
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
      console.log("iTunes answer: ", title, '-', artistName);
    }
  });

  requests.push(requestDeezer);
  requests.push(requestiTunes);

  return Promise.all(requests).then(function() {
    if (!last && (!infos.title || !infos.artistName)) {
      searchq = searchq.replace(/f(ea)?t(\.)? [^-]+/ig,' ');
      return at3.guessTrackFromString(searchq, false, true, v);
    }
    return infos;
  });

};


at3.guessTrackFromFile = function (file) {
  return new Promise(function (resolve, reject) {
    acoustid(file, { key: API_ACOUSTID, fpcalc: { command: at3.FPCALC_PATH } }, function (err, results) {
      if (err || results.length === 0 || !results[0].recordings || results[0].recordings.length === 0 || !results[0].recordings[0].artists || results[0].recordings[0].artists.length === 0) {
        resolve({});
        return;
      }
      resolve({
        title: results[0].recordings[0].title,
        artistName: results[0].recordings[0].artists[0].name
      });
    });
  });
};

at3.retrieveTrackInformations = function (title, artistName, exact, v) {
  if (exact === undefined) {
    exact = false;
  }
  if (v === undefined) {
    v = true;
  }

  if (!exact) {
    title = title.replace(/((\[)|(\())?radio edit((\])|(\)))?/ig, '');
  }

  var infos = {
    title: title,
    artistName: artistName
  };

  var requests = [];

  var requestDeezer = request({
    url: 'https://api.deezer.com/2.0/search?q=' + encodeURIComponent(artistName + ' ' + title),
    json: true
  }).then(function (body) {
    var deezerInfos;
    _.forEach(body.data, function (s) {
      if(!infos.deezerId && imatch(vsimpleName(title), vsimpleName(s.title)) && imatch(vsimpleName(artistName), vsimpleName(s.artist.name))) {
        infos.deezerId = s.id;
        deezerInfos = _.clone(s);
      }
    });
    if (infos.deezerId) {
      infos.artistName = deezerInfos.artist.name;
      infos.title = deezerInfos.title;

      return at3.getDeezerTrackInfos(infos.deezerId, v).then(function (deezerInfos) {
        infos = deezerInfos;
      }).catch(function () {

      });
    }
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
      infos.cover = itunesInfos.artworkUrl100.replace('100x100', '200x200');
      infos.genre = itunesInfos.primaryGenreName;
      infos.discNumber = itunesInfos.discNumber;
      infos.duration = itunesInfos.trackTimeMillis/1000;
    }

    if (v) {
      console.log("iTunes infos: ", itunesInfos.trackName + ' ' + itunesInfos.artistName);
    }
  });

  requests.push(requestDeezer);
  requests.push(requestiTunes);

  return Promise.all(requests).then(function () {
    return infos;
  });
};

/**
* Retrieve detailed infos about a Deezer Track
* @param trackId
* @param v boolean Verbosity
* @return Promise(trackInfos)
*/
at3.getDeezerTrackInfos = function(trackId, v) {
  var infos = {
    deezerId: trackId
  };

  return request({
    url: 'https://api.deezer.com/2.0/track/' + infos.deezerId,
    json: true
  }).then(function (trackInfos) {
    if (trackInfos.error) {
      return Promise.reject();
    }

    infos.title = trackInfos.title;
    infos.artistName = trackInfos.artist.name;
    infos.position = trackInfos.track_position;
    infos.duration = trackInfos.duration;
    infos.deezerAlbum = trackInfos.album.id;
    infos.discNumber = trackInfos.disk_number;

    return request({
      url: 'https://api.deezer.com/2.0/album/' + infos.deezerAlbum,
      json: true
    });
  }).then(function (albumInfos) {
    infos.album = albumInfos.title;
    infos.releaseDate = albumInfos.release_date;
    infos.nbTracks = albumInfos.tracks.data.length;
    infos.genreId = albumInfos.genre_id;
    infos.cover = albumInfos.cover_big;

    return request({
      url: 'https://api.deezer.com/2.0/genre/' + infos.genreId,
      json: true
    });
  }).then(function (genreInfos) {
    infos.genre = genreInfos.name;

    if (v) {
      console.log("Deezer infos: ", infos);
    }

    return infos;
  });
};

/**
 * Get complete information (title, artist, release date, genre, album name...)
 * for a Spotify track
 * @param {trackId} string The Spotify track id
 * @param {v} boolean The verbosity
 * @return Promise
 */
at3.getSpotifyTrackInfos = function (trackId, v) {
  let infos = {
    spotifyId: trackId
  };

  return at3.requestSpotify('https://api.spotify.com/v1/tracks/' + trackId).then(trackInfos => {
    infos.title = trackInfos.name;
    infos.artistName = trackInfos.artists[0].name;
    infos.duration = Math.ceil(trackInfos.duration_ms/1000);
    infos.position = trackInfos.track_number;
    infos.discNumber = trackInfos.disc_number;
    infos.spotifyAlbum = trackInfos.album.id;

    return at3.requestSpotify('https://api.spotify.com/v1/albums/' + trackInfos.album.id);
  }).then(albumInfos => {
    infos.album = albumInfos.name;
    infos.cover = albumInfos.images[0].url;
    infos.genre = albumInfos.genres[0] || '';
    infos.nbTracks = albumInfos.tracks.total;
    infos.releaseDate = albumInfos.release_date;

    return infos;
  });
};


/**
* Search and return complete information about a single video url
* @param url
* @param v boolean Verbosity
* @return Promise(object)
*/
at3.getCompleteInfosFromURL = function(url, v) {
  var infosFromString;
  // Try to find information based on video title
  return at3.getInfosWithYoutubeDl(url).then(function(videoInfos) {
    infosFromString = {
      title: videoInfos.title,
      artistName: videoInfos.author,
      cover: videoInfos.picture.replace('hqdefault', 'mqdefault'), // [TODO]: getting a better resolution and removing the black borders
      originalTitle: videoInfos.title
    };

    if (v) {
      console.log("Video infos: ", infosFromString);
    }

    // progressEmitter.emit('infos', _.clone(infosFromString));

    return at3.guessTrackFromString(videoInfos.title, false, false, v);
  }).then(function (guessStringInfos) {
    if (guessStringInfos.title && guessStringInfos.artistName) {
      return at3.retrieveTrackInformations(guessStringInfos.title, guessStringInfos.artistName, false, v);
    } else {
      return Promise.resolve();
    }
  }).then(function (guessStringInfos) {
    if (guessStringInfos) {
      guessStringInfos.originalTitle = infosFromString.originalTitle;
      infosFromString = guessStringInfos;
      // progressEmitter.emit('infos', _.clone(infosFromString));
      if (v) {
        console.log("guessStringInfos: ", guessStringInfos);
      }
    } else {
      if (v) {
        console.log('Cannot retrieve detailed information from video title');
      }
    }

    return infosFromString;
  }).catch(function(error) {
    // The download must have failed to, and emit an error
  });
};

/**
* Identify the song from a file and then search complete information about it
* @param file string
* @param v boolean Verbosity
* @return Promise(object)
*/
at3.getCompleteInfosFromFile = function(file, v) {
  return at3.guessTrackFromFile(file).then(function (guessFileInfos) {
    if (guessFileInfos.title && guessFileInfos.artistName) {
      return at3.retrieveTrackInformations(guessFileInfos.title, guessFileInfos.artistName, false, v);
    } else {
      return Promise.resolve();
    }
  }).then(function (guessFileInfos) {
    if (guessFileInfos) {
      if (v) {
        console.log("guessFileInfos: ", guessFileInfos);
      }
      return guessFileInfos;
    } else {
      if (v) {
        console.log('Cannot retrieve detailed information from MP3 file');
      }
    }
  });
};



at3.tagFile = function (file, infos) {
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
              // In that case we will crop the cover to get a square
              const tempCoverPath = file + '.cover.resized.jpg';
              return smartcrop.crop(coverPath, {width: 300, height: 300}).then(function(result) {
                var crop = result.topCrop;
                return coverFile
                .extract({width: crop.width, height: crop.height, left: crop.x, top: crop.y})
                .toFile(tempCoverPath);
              }).then(() => {
                fs.renameSync(tempCoverPath, coverPath);
              });
            }
          }).then(() => {
            eyed3.updateMeta(file, eyed3.metaHook({image: coverPath}), function (err) {
              fs.unlinkSync(coverPath);

              if (err) {
                return reject(err);
              }

              resolve();
            });
          });
        }).pipe(fs.createWriteStream(coverPath));
      } else {
        resolve();
      }
    });
  });

};


var infoFromTitle = function(title, artist) {
  
}

var infoFromUrl = function() {}