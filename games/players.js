var request = require('request');
var MongoClient = require('mongodb').MongoClient;
var config = require('../config.js');

var url = 'https://statsapi.web.nhl.com/api/v1/teams';

var dbUri = 'mongodb://' + config.dbUser + ':' + config.dbPass + '@' + config.dbUri + ':' + config.dbPort + '/' + config.dbName + '?slaveOk=true';

var teamList = function(season, callback) {
  MongoClient.connect(dbUri, (err, db) => {
    var Collection = db.collection('nhlteams');
    var results = Collection.find({'season': season});

    results.toArray((err, docs) => {
      if(!err)
        callback(docs);
      else
        callback(err);
      db.close();
    });
  });
};

var playerBuilder = function(team, callback) {
  var allTeamPlayers = new Array();
  var urlBuilder = url + '?teamId=' + team.nhlteamid + '&season=' + team.season + '&expand=team.roster,roster.person';
  request.get({url: urlBuilder, json: true}, (err, res, data) => {
    if(!err && res.statusCode == 200) {
      var roster = data.teams[0].roster.roster;
      for(var i = 0; i < roster.length; i++) {
        var teamPlayer = {
          _id: roster[i].person.id + team._id,
          playerid: roster[i].person.id,
          teamseasonid: team._id,
          teamabbr: team.abbr,
          teampxp: team.pxp,
          fullName: roster[i].person.fullName,
          firstName: roster[i].person.firstName,
          lastName: roster[i].person.lastName,
          position: roster[i].position.code,
          type: roster[i].position.type,
          conference: team.conference,
          division: team.division,
          season: team.season
        };
        allTeamPlayers.push(teamPlayer);
      }
      callback(allTeamPlayers);
    } else {
      callback(err);
    }
  });
}

var addPlayers = function(players, callback) {
    MongoClient.connect(dbUri, function(err, db) {
        var Collection = db.collection('nhlplayers');

        Collection.insertMany(players, function(err, result) {
            if(!err)
                callback(result);
            else
                callback(err);
            db.close();
        });
    });
}

var availseasons = [20102011, 20112012, 20122013, 20132014, 20142015, 20152016, 20162017];

for (var x = 0; x < availseasons.length; x++) {
  var curseason = availseasons[x];
  teamList(curseason, (teams) => {
    for(var i = 0; i < teams.length; i++) {
      playerBuilder(teams[i], (players) => {
        addPlayers(players, (data) => {
          console.log(data);
        });
      });
    }
  });
}