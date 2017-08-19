var MongoClient = require('mongodb').MongoClient;
var config = require('../config.js');
var dbUri = 'mongodb://' + config.dbUser + ':' + config.dbPass + '@' + config.dbUri + ':' + config.dbPort + '/' + config.dbName + '?slaveOk=true';

var getPlayersBySeason = function (season, callback) {
  try {
    MongoClient.connect(dbUri, (err, db) => {
      var Collection = db.collection('nhlplayers');
      var results = Collection.find({ season: season });

      results.toArray((err, docs) => {
        if (!err)
          callback(docs);
        else
          callback(err);
        db.close();
      });
    });
  } catch (err) {
    callback(err);
  }
};

var addPlayerPostion = function (playerinfo, callback) {
  try {
    MongoClient.connect(dbUri, (err, db) => {
      var Collection = db.collection('nhlplayers');
      var newposition = { possible: [playerinfo.position] };
      Collection.updateOne(playerinfo, {$set: newposition }, (err, data) => {
        if (!err)
          callback(data);
        else
          callback(err);
        db.close();
      });
    });
  } catch (err) {
    callback(err);
  }
}

getPlayersBySeason(20112012, (playerinfo) => {
  playerinfo.forEach((player) => {
    addPlayerPostion(player, (data) => {
      //console.log(data);
    });
  });
});