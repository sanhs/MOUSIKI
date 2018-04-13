const _ = require('lodash');
const request = require('request-promise');
const lcs = require('longest-common-substring');

var config = require('./config');
var API_GOOGLE = config.API_GOOGLE;
var regionCode = config.REGION_CODE;

const pre_url_search = 'https://www.googleapis.com/youtube/v3/search?part=snippet&key=';
const pre_url_stats = 'https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&key=';
var maxResults = '&maxResults=' + config.MAX_RESULTS + '&q=';


/**
 * 
 * @param {string} query - song.title + song.artistname 
 * @param {*} relevanceLanguage 
 * 
 * @returns a promise of list of videos for the search query returned
 */
var search = function(query, relevanceLanguage) {
/**
  * Remove useless information in the title
  * like (audio only), (lyrics)...
  * @param title string
  * @return string
  */
	function improveTitle(title) {
		var useless = [
			'audio only',
			'audio',
			'paroles/lyrics',
			'lyrics/paroles',
			'with lyrics',
			'w/lyrics',
			'w / lyrics',
			'avec paroles',
			'avec les paroles',
			'avec parole',
			'lyrics',
			'paroles',
			'parole',
			'radio edit.',
			'radio edit',
			'radio-edit',
			'shazam version',
			'shazam v...',
			'music video',
			'clip officiel',
			'officiel',
			'new song',
			'official video',
			'official'
		];

		_.forEach(useless, function (u) {
			title = title.replace(new RegExp('((\\\(|\\\[)?)( ?)' + u + '( ?)((\\\)|\\\])?)', 'gi'), '');
		});

		title = title.replace(new RegExp('(\\\(|\\\[)( ?)hd( ?)(\\\)|\\\])', 'gi'), '');
		title = title.replace(new RegExp('hd','gi'), '');
		title = _.trim(title);

		return title;
	}

	/**
  * Returns an ISO 8601 Time as PT3M6S (=3min and 6seconds)
  * in seconds
  */
	function parseTime(time) {
		time = time.replace('PT','');
		time = time.replace('S', '');
		if (/M/.test(time)) {
			time = time.split('M');
			return (parseInt(time[0])*60 + (parseInt(time[1]) || 0));
		} else {
			return parseInt(time[0]);
		}
	}

	
	function calcRealLike(likeCount, dislikeCount) {
		var ratio = 1.0;
		if (dislikeCount > 0) {
			ratio = likeCount / dislikeCount;
		}
		if (ratio === 0) {
			ratio = 1;
		}
		return (likeCount - dislikeCount) * ratio;
	}

  var results = [];

  // We simply search on YouTube
  let localePart;
  if (regionCode) {
  	localePart = '&regionCode=' + regionCode;
  } else if (relevanceLanguage) {
  	localePart = '&relevanceLanguage=' + relevanceLanguage;
  }
  
  return request({
  	url: pre_url_search + API_GOOGLE + localePart + maxResults + encodeURIComponent(query),
  	json: true
  }).then(function (body) {
  	if (!body.items || body.items.length === 0) {
  		return Promise.reject("No videos for the query");
  	}

  	var requests = [];

  	console.log("fetching video stats...");
  	_.forEach(body.items, function (s) {
  		if (!s.id.videoId) {
  			return;
  		}
      // console.log("fetching stats for ", s.snippet.title)
      var req = request({
      	url: pre_url_stats + API_GOOGLE + '&id=' + s.id.videoId,
      	json: true
      }).then(function (video) {
      	video = video.items[0];
      	if (!video.statistics) {
      		return;
      	}

      	results.push({
      		id: video.id,
      		url: 'https://www.youtube.com/watch?v=' + video.id,
      		title: video.snippet.title,
      		hd: (video.contentDetails.definition == 'hd'),
      		duration: parseTime(video.contentDetails.duration),
      		views: parseInt(video.statistics.viewCount),
      		realLike: calcRealLike(video.statistics.likeCount, video.statistics.dislikeCount)
      	});
      });

      requests.push(req);
  });
  	return Promise.all(requests);
  }).then(function() {
  	return _.orderBy(results, ['views'], ['desc']);
  });
};


var findBestVideo = function(song, videos, v) {
  if (v === undefined) {
    v = true;
  }

  /**
  * Returns the score of a video, comparing to the request
  * @param song Object Searched song
  * @param video object
  * @param largestRealLike
  * @param largestViews
  * @return Object
  */
  function score(song, video, largestRealLike, largestViews) {
		// weight of each argument
		// TODO: move these weights into config
    let weights = {
      title: 0.35,
      hd: 0.3,
      duration: 3,
      views: 	5,
      realLike: 2
    };

    let duration = song.duration || video.duration;

    // Score for title
    let videoTitle = ' ' + _.lowerCase(video.title) + ' ';
    let songTitle = ' ' + _.lowerCase(song.title) + ' '; // we add spaces to help longest-common-substring
    let songArtist = ' ' + _.lowerCase(song.artistName) + ' '; // (example: the artist "M")

    // for longest-common-substring, which works with arrays
    let videoTitlea = videoTitle.split('');
    let songTitlea = songTitle.split('');
    let songArtista = songArtist.split('');

    let videoSongTitle = lcs(videoTitlea, songTitlea);
    if (videoSongTitle.length > 0 && videoSongTitle.startString2 === 0 && videoTitle[videoSongTitle.startString1 + videoSongTitle.length - 1] == ' ') { // The substring must start at the beginning of the song title, and the next char in the video title must be a space
      videoTitle = videoTitle.substring(0, videoSongTitle.startString1) + ' ' + videoTitle.substring(videoSongTitle.startString1 + videoSongTitle.length);
      videoTitlea = videoTitle.split('');
    }
    let videoSongArtist = lcs(videoTitlea, songArtista);
    if (videoSongArtist.length > 0 && videoSongArtist.startString2 === 0 && videoTitle[videoSongArtist.startString1 + videoSongArtist.length - 1] == ' ') { // The substring must start at the beginning of the song title, and the next char in the video title must be a space
      videoTitle = videoTitle.substring(0, videoSongArtist.startString1) + videoTitle.substring(videoSongArtist.startString1 + videoSongArtist.length);
    }


    videoTitle = _.lowerCase(videoTitle);
    let sTitle = videoTitle.length + (songTitle.length - videoSongTitle.length) + (songArtist.length - videoSongArtist.length);

    let videoScore = {
      title: sTitle*weights.title,
      hd: video.hd*weights.hd,
      duration: Math.sqrt(Math.abs(video.duration - duration))*weights.duration,
      views: (video.views/largestViews)*weights.views,
      realLike: (video.realLike/largestRealLike)*weights.realLike || -50 // video.realLike is NaN when the likes has been deactivated, which is a very bad sign
    };
    video.videoScore = videoScore;

    let preVideoScore = videoScore.views + videoScore.realLike - videoScore.title - videoScore.duration;
    preVideoScore = preVideoScore + Math.abs(preVideoScore)*videoScore.hd;

    return preVideoScore;
  }

  var largestRealLike = _.reduce(videos, function (v, r) {
    if (r.realLike > v) {
      return r.realLike;
    }
    return v;
  }, 0);
  var largestViews = _.reduce(videos, function (v, r) {
    if (r.views > v) {
      return r.views;
    }
    return v;
  }, 0);

  _.forEach(videos, function(r) {
    r.score = score(song, r, largestRealLike, largestViews);
    console.log(r.title + " score: " + r.score);
  });

  return _.reverse(_.sortBy(videos, 'score'));
};


// var song = {title: 'gemini', artistName: 'xan griffin'}
// var query = 'gemini xan griffin'
// var song2 = {title: 'strong', artistName: 'london grammar'}
// var query2 = 'strong london grammar'
// search(query2).then(function (videos) {
// 	findBestVideo(song2, videos);
// }).catch(function (err) {console.log(err)})

module.exports = {
	search: search,
	findBestVideo: findBestVideo
};