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

var getPlayerInfo = function(playerinfo, callback) {
  try {
    MongoClient.connect(dbUri, (err, db) => {

    });
  } catch (err) {
    console.log(err);
  }
}