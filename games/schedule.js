var teams = require('../teams');
var moment = require('moment-timezone');

function schedHandler(request) {
  "use strict";

  var schedURL = 'live.nhl.com/GameData/SeasonSchedule-';

  this.seasonschedule = function(season, callback) {
    schedule(season, function(response) {
      callback(response);
    });
  }

  var schedule = function(season, callback) {
    var schedJSON = 'http://' + schedURL + season + '.json';

    request(schedJSON, function(error, response, json) {
      if(!error && response.statusCode == 200) {
        var finalSchedule = new Array();
        var scheduledGames = JSON.parse(json);

        scheduledGames.forEach(function(singleGame) {
          var dt = singleGame.est.split(' ');
          var year = dt[0].substring(0,4);
          var month = dt[0].substring(4,6);
          var date = dt[0].substring(6,8);
          var time = dt[1].split(':');
          var gametm = moment.tz(year+'-'+month+'-'+date+' '+time[0]+':'+time[1]+':'+time[2],'America/Toronto');

          var gameInfo = new Object();
          gameInfo['gameid'] = singleGame.id;
          gameInfo['home'] = singleGame.h;
          gameInfo['away'] = singleGame.a;
          gameInfo['gametime'] = gametm.format();
          finalSchedule.push(gameInfo);
        });
        callback(finalSchedule);
      } else {
        callback(error);
      }
    })
  }
}

module.exports = schedHandler;
