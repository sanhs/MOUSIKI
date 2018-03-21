var pm = new (require('playmusic'));
var config = require('./config')


pm.init({email: config.email, password: config.password}, function(err){
  if (err) return console.log("ERROR:\n"+err);
  // pm.getPlayLists(function(err, res){
  //   if (err) return console.log(err);
  //   console.log(JSON.stringify(res));
  // });
  pm.getPlayListEntries(5000, function(err, res){
    if (err) return console.log(err);
    console.log(JSON.stringify(res));
    var tracks = res.data.items
    });
});
