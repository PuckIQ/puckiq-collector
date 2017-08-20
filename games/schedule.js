var request = require('request');
var MongoClient = require('mongodb').MongoClient;
var config = require('../config.js');

var url = 'https://statsapi.web.nhl.com/api/v1/schedule';

var dbUri = 'mongodb://' + config.dbUser + ':' + config.dbPass + '@' + config.dbUri + ':' + config.dbPort + '/' + config.dbName + '?slaveOk=true';

//var teamList = function(home, away, season, callback) {
var teamList = function(season, callback) {
  MongoClient.connect(dbUri, (err, db) => {
    var Collection = db.collection('nhlteams');
    //var results = Collection.find({'nhlteamid': { $in: [home, away] }, 'season': season});
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

var scheduleBuilder = function(season, teams, callback) {
  var allGames = new Array();
  var urlBuilder = url + '?startDate=' + season.startdate + '&endDate=' + season.enddate + '&expand=schedule.linescore';

  request.get({url: urlBuilder, json: true}, (err, res, data) => {
    if(!err && res.statusCode == 200) {
      var gamedates = data.dates;
      for(var i = 0; i < gamedates.length; i++) {
        var gamelist = gamedates[i].games;
        for(var x = 0; x < gamelist.length; x++) {
          if(gamelist[x].gameType === 'R' || gamelist[x].gameType === 'P') {
            var scheduleInfo = {
              _id: gamelist[x].gamePk,
              htmlid: gamelist[x].gamePk.toString().substr(4),
              simplegamedate: gamedates[i].date,
              gamedate: new Date(gamelist[x].gameDate),
              type: gamelist[x].gameType,
              home: teams.teamIdFind({nhlteamid: gamelist[x].teams.home.team.id})[0].abbr,
              away: teams.teamIdFind({nhlteamid: gamelist[x].teams.away.team.id})[0].abbr,
              homepxp: teams.teamIdFind({nhlteamid: gamelist[x].teams.home.team.id})[0].pxp,
              awaypxp: teams.teamIdFind({nhlteamid: gamelist[x].teams.away.team.id})[0].pxp,
              homeseasonid: teams.teamIdFind({nhlteamid: gamelist[x].teams.home.team.id})[0]._id,
              awayseasonid: teams.teamIdFind({nhlteamid: gamelist[x].teams.away.team.id})[0]._id,
              homescore: (gamelist[x].status.detailedState === 'Scheduled') ? null : gamelist[x].teams.home.score,
              awayscore: (gamelist[x].status.detailedState === 'Scheduled') ? null : gamelist[x].teams.away.score,
              period: gamelist[x].linescore.currentPeriod,
              periodtimeremain: gamelist[x].linescore.currentPeriodTimeRemaining,
              shootout: gamelist[x].linescore.hasShootout,
              statuscode: parseInt(gamelist[x].status.statusCode),
              status: gamelist[x].status.abstractGameState,
              season: parseInt(gamelist[x].season)
            }
            allGames.push(scheduleInfo);
          }
        }
      }
      callback(allGames);
    } else {
      callback(err);
    }
  });
};

var addSchedules = function(schedule, callback) {
    MongoClient.connect(dbUri, function(err, db) {
        var Collection = db.collection('nhlschedule');

        Collection.insertMany(schedule, function(err, result) {
            if(!err)
                callback(result);
            else
                callback(err);
            db.close();
        });
    });
};

var allSeasons = [
  {season: 20102011, startdate: '2010-10-07', enddate: '2011-04-10'},
  {season: 20112012, startdate: '2011-10-06', enddate: '2012-04-07'},
  {season: 20122013, startdate: '2013-01-19', enddate: '2013-04-28'},
  {season: 20132014, startdate: '2013-10-01', enddate: '2014-04-13'},
  {season: 20142015, startdate: '2014-10-08', enddate: '2015-04-11'},
  {season: 20152016, startdate: '2015-10-07', enddate: '2016-04-10'},
  {season: 20162017, startdate: '2016-10-12', enddate: '2017-04-09'}
];

/*var allSeasons = [
  {season: 20152016, startdate: '2015-10-07', enddate: '2016-04-10'}
]*/

allSeasons.forEach((val) => {
  teamList(val.season, (allTeams) => {
    scheduleBuilder(val, allTeams, (schedule) => {
      addSchedules(schedule, (data) => {
      });
    });
  });
});

Array.prototype.teamIdFind = function(obj) {
  return this.filter(function(item) {
    for(var property in obj) {
      if(!(property in item) || obj[property] !== item[property])
        return false;
      return true;
    }
  })
}