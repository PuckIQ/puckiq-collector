var request = require('request');
var MongoClient = require('mongodb').MongoClient;
var config = require('../config.js');
var allteams = require('./teamlist');

var url = "https://statsapi.web.nhl.com/api/v1/teams";

var dbUri = 'mongodb://' + config.dbUser + ':' + config.dbPass + '@' + config.dbUri + ':' + config.dbPort + '/' + config.dbName + '?slaveOk=true';

var fullTeamInfo = function (season, callback) {
  var allTeams = new Array();
  request.get({ url: url + '?season=' + season, json: true }, (err, res, data) => {
    if (!err && res.statusCode === 200) {
      data.teams.forEach(function (teamInfo, index) {
          var team = new Object();
          team['_id'] = teamInfo.abbreviation + season;
          team['nhlteamid'] = teamInfo.id
          team['name'] = teamInfo.name;
          team['abbr'] = teamInfo.abbreviation;
          for (var i = 0; i < allteams.length; i++) {
            if (teamInfo.abbreviation === allteams[i].teamID) {
              team['pxp'] = allteams[i].TeamPXP;
            }
          }
          team['teamName'] = teamInfo.teamName;
          team['conference'] = teamInfo.conference.name;
          team['division'] = teamInfo.division.name;
          team['season'] = parseInt(season);
          allTeams.push(team);
      });
      callback(allTeams);
    }
  });
};

var addTeams = function (team, callback) {
  MongoClient.connect(dbUri, function (err, db) {
    var Collection = db.collection('nhlteams');

    Collection.insertMany(team, function (err, result) {
      if (!err)
        callback(result);
      else
        callback(err);
      db.close();
    });
  });
}

//var availseasons = ['20102011', '20112012', '20122013', '20132014', '20142015', '20152016', '20162017'];
var availseasons = ['20172018'];

for (var i = 0; i < availseasons.length; i++) {
  var curseason = availseasons[i];
  fullTeamInfo(curseason, function (data) {
    addTeams(data, function (result) {
    });
  });
}