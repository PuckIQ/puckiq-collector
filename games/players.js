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
        //var bioInfo = $('.bioInfo', tombstone);
        var bio = $(tombstone).html().replace(/(\r\n|\n|\r)/gm,"")

        var playerpageInfo = new Object();

        playerpageInfo['name'] = $('.sweater').parent().html().split('&')[0].trim();

        var countline = 0;
        var drafted = new Object();
        $(bio).each(function(i,v) {
          $(v).find('td').each(function() {
            if(countline%2 == 0) {
              switch ($(this).text().replace(':','').toLowerCase()) {
                case 'birthdate':
                  var jsdate = new Date($(this).next().text().split('(')[0].trim());
                  var utctime = new moment.tz(jsdate, 'UTC');
                  playerpageInfo['dob'] = utctime.format();
                  break;
                case 'height':
                  var feet = parseInt($(this).next().text().split('\'')[0].trim())*12;
                  var inches = parseInt($(this).next().text().split('\'')[1].trim());
                  playerpageInfo['height'] = feet+inches;
                  break;
                case 'birthplace':
                case 'shoots':
                  playerpageInfo['birthplace'] = $(this).next().text().trim();
                  break;
                case 'weight':
                  playerpageInfo['wieght'] = parseInt($(this).next().text().trim());
                  break;
                case 'drafted':
                  var splitDraft = $(this).next().text().trim().split(' ');
                  var draftteam = splitDraft[0].replace('/','');
                  drafted['team'] = draftteam;
                  drafted['year'] = splitDraft[1];
                  break;
                case 'round':
                  var splitDraft = $(this).next().text().trim().split(' ')[0].split('(');
                  drafted['round'] = parseInt(splitDraft[0]);
                  drafted['overall'] = parseInt(splitDraft[1]);
                  playerpageInfo['drafted'] = drafted;
              }
              console.log($(this).text().toLowerCase() + $(this).next().text());
            }
            countline++
          });
        })

        callback(playerpageInfo);
      } else {
        callback(error);
      }
    });
  }
}


module.exports = playersHandler;
