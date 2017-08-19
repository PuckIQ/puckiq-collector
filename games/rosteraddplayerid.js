var MongoClient = require('mongodb').MongoClient;
var config = require('../config.js');
var dbUri = 'mongodb://' + config.dbUser + ':' + config.dbPass + '@' + config.dbUri + ':' + config.dbPort + '/' + config.dbName + '?slaveOk=true';

var getRoster = function (gameid, callback) {
  try {
    MongoClient.connect(dbUri, (err, db) => {
      var Collection = db.collection('nhlgameroster');
      var results = Collection.find(gameid);

      results.toArray((err, docs) => {
        if (!err)
          callback(docs);
        else
          callback(err);
        db.close();
      });
    });
  } catch (err) {
    console.log(err);
  }
};

var parsePlayerInfo = function(roster, callback) {
  var season = roster.season;
  var hometm = roster.home.team;
  var awaytm = roster.away.team;
}

var getPlayerInfo = function(playerinfo, callback) {
  var query = {
    season: playerinfo.season,
    teamseasonid: playerinfo.seasonid,
    team: playerinfo.team,
    lastName: playerinfo.lastname,
    position: playerinfo.pos
  };
  try {
    MongoClient.connect(dbUri, (err, db) => {
      var Collection = db.collection('nhlplayers');
    });
  } catch (err) {
    console.log(err);
  }
}