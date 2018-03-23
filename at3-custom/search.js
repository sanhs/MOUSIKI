const _ = require('lodash');
const request = require('request-promise');

var config = require('./config');
var API_GOOGLE = config.API_GOOGLE;
var regionCode = config.REGION_CODE;

const pre_url_search = 'https://www.googleapis.com/youtube/v3/search?part=snippet&key=';
const pre_url_stats = 'https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&key=';
var maxResults = '&maxResults=' + config.MAX_RESULTS + '&q=';


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

  	console.log("fetching stats...");
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
  	return results;
  });
};


// search("strong - london grammar").then(function(res) {
// 	console.log(res);
// }).catch(function(err) {
// 	console.log(err);
// });

module.exports = {
	search: search,
};