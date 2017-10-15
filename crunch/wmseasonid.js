var argv = require('minimist')(process.argv.slice(2));
var MongoClient = require('mongodb').MongoClient;
var config = require('../config.js');
var dbUri = 'mongodb://' + config.dbUser + ':' + config.dbPass + '@' + config.dbUri + ':' + config.dbPort + '/' + config.dbName;

var getPlayersBySeason = function (season, callback) {
  try {
    MongoClient.connect(dbUri, (err, db) => {
      var Collection = db.collection('woodmoneylive');
      var results = Collection.find({season: season, $or: [ { playerseasonid: {$exists: false} }, { teamseasonid: {$exists: false} } ] });

      results.toArray((err, docs) => {
        if (!err) {
          docs.forEach((doc) => {
            var playerkeys = {
              playerseasonid: doc.PlayerId + doc.Team + doc.season,
              teamseasonid: doc.Team + doc.season
            };
            Collection.updateOne({ _id: doc._id }, { $set: playerkeys }, (err, data) => {
              if(!err)
                callback(data);
              else
                callback(err);
            });
          });
        }
        else {
          callback(err);
        }
        db.close();
      });
    });
  } catch (err) {
    callback(err);
  }
};

//var teams = ["ANA","ARI","TBL","EDM","VAN","SJS","OTT","FLA","CHI","CGY","WSH","CBJ","CAR","NSH","MIN","STL","TOR","PHI","DET","WPG","PIT","NJD","MTL","LAK","NYI","BOS","NYR","BUF","COL","DAL"];

/*teams.forEach((team) => {
  getPlayersBySeason(parseInt(20162017), team, (playerinfo) => {
    console.log(playerinfo);
    console.log('------------------------');
  });
});*/

getPlayersBySeason(parseInt(argv.season), (playerinfo) => {
});