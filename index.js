var logger = require('log4js').getLogger('app');
logger.level = 'debug'
var inq = require('inquirer');

var q = require('./index-questions').questions;
var amp = require('./amp3-api').findAndDownload;

inq.prompt(q).then(function(res){
	// logger.debug(res);
	findAndDownload(res.title, res.artist, function (err, res) {
		if(err) return logger.error(err);
	});
}).catch(function(err){
	logger.error("ERR", err)
});