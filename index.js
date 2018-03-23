/**
add option to download playlists.
*/


const logger = require('log4js').getLogger('app');
logger.level = 'debug'
const inq = require('inquirer');
const _ = require('lodash');

const schema = require('./ind-schema');
const t = schema.track;
const s = schema.search;
var findAndDownload = require('./amp3-api').findAndDownload;
var find = require('./amp3-api').find;


var search = function() {
	var search_results = {};
	inq.prompt(t).then(function(res){
		logger.debug(res);
		find(res.title, res.artist).then(function(res) {
			// logger.info(res);
			_.each(res, function(r) {
				var dur = Math.floor(r.duration / 60) + ":" + r.duration % 60
				c = r.title + " duration: " + dur + " views: " + r.views + " realLike: " + r.realLike + " hd: " + r.hd;
				search_results[c] = r.url;
			});
			// logger.debug(search_results);
		}).then(function () {
			inq.prompt(s(_.keys(search_results))).then(function(res) {
				logger.info(search_results[res.video])
			}).catch(function(err) {logger.error(err)});
		})
	}).catch(function(err){
		logger.error("ERR", err)
	});
}

var main = function() {
	inq.prompt
}