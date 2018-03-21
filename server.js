var express = require('express');
var logger = require('log4js').getLogger('SERVER');
logger.level = "debug";
var app = express();

app.get('/', function(req, res){
	res.send('playlists unavailabe at this time');
});


var server = app.listen(8080, "127.0.0.1", function(err, res){
	//var host = server.address().addess;
	// var port = server.address().port;
	logger.info("server started on " + JSON.stringify(server.address()));
});