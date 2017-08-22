var argv = require('minimist')(process.argv.slice(2));

var MongoClient = require('mongodb').MongoClient;

var config = require('../config.js');
var dbUri = 'mongodb://' + config.dbUser + ':' + config.dbPass + '@' + config.dbUri + ':' + config.dbPort + '/' + config.dbName;

var getGameShifts = function(gameid, callback) {
  
};