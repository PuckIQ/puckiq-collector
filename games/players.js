var teams = require('../teams');
var moment = require('moment-timezone');

function playersHandler(request, cheerio) {
  "use strict";

  var playersURL = 'nhlwc.cdnak.neulion.com/fs1/nhl/league/playerstatsline/';
  var playerpageURL = 'www.nhl.com/ice/player.htm?id=';

  this.playerpage = function(playerid, callback) {
    playerpage(playerid, function(response) {
      callback(response);
    });
  }

  var players = function(season, gametype, team, callback) {
    var playersJSON = 'http://' + playersURL + season + '/' + gametype + '/' + team + '/iphone/playerstatsline.json';
  }

  var playerpage = function(playerid, callback) {
    var playerpageHTML = 'http://' + playerpageURL + playerid;

    request(playerpageHTML, function(error, response, html) {
      if(!error && response.statusCode == 200) {
        var modhtml = html.replace(/&nbsp;/g,' ');
				var $ = cheerio.load(modhtml);

        var tombstone = $('#tombstone');
        var bioInfo = $('.bioInfo', tombstone);
        var bio = $(bioInfo).html().replace(/(\r\n|\n|\r)/gm,"")

        var playerpageInfo = new Object();

        playerpageInfo['name'] = $('.sweater').parent().html().split('&')[0].trim();

        $(bio).each(function(tr, td) {
          console.log($(td).html());
        });

        callback(playerpageInfo);
      } else {
        callback(error);
      }
    });
  }
}


module.exports = playersHandler;
