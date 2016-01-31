var teams = require('../teams');
var moment = require('moment-timezone');

function playersHandler(request, cheerio) {
  "use strict";

  var playersURL = 'nhlwc.cdnak.neulion.com/fs1/nhl/league/playerstatsline/';
  var playerpageURL = 'www.nhl.com/ice/player.htm?id=';

  this.playerpage = function(season, gametype, team, callback) {
    players(season, gametype, team, function(response) {
      response.forEach(function(v) {
        playerpage(v.nhlid, function(player) {
          var allplayerinfo = new Object();
          allplayerinfo['nhlid'] = v.nhlid;
          allplayerinfo['jerseynum'] = v.jerseynum;
          allplayerinfo['pos'] = v.pos;
          allplayerinfo['firstname'] = player.name.replace(' ' + v.lastname, '');
          allplayerinfo['lastname'] = v.lastname;
          allplayerinfo['fullname'] = player.name;
          allplayerinfo['team'] = v.team;
          allplayerinfo['season'] = v.season;
          allplayerinfo['dob'] = player.dob;
          allplayerinfo['height'] = player.height;
          allplayerinfo['weight'] = player.weight;
          allplayerinfo['drafted'] = (typeof player.drafted === 'undefined') ? 'Undrafted' : player.drafted;
          allplayerinfo['shootsorcatches'] = player.shootsorcatches;
          callback(allplayerinfo);
        });
      });
    });
  }

  var players = function(season, gametype, team, callback) {
    var playersJSON = 'http://' + playersURL + season + '/' + gametype + '/' + team + '/iphone/playerstatsline.json';

    request(playersJSON, function(error, response, json) {
        if(!error && response.statusCode == 200) {
          var rosterPlayers = new Array();
          var allJSON = JSON.parse(json);

          allJSON.skaterData.forEach(function(singleSkater) {
            var skater = new Object();
            var fixdata = singleSkater.data.replace(' ','').split(',');
            skater['nhlid'] = singleSkater.id;
            skater['jerseynum'] = parseInt(fixdata[0]);
            skater['pos'] = fixdata[1];
            skater['lastname'] = fixdata[2].split('.')[1].trim();
            skater['team'] = team;
            skater['season'] = season;

            rosterPlayers.push(skater);
          });

          allJSON.goalieData.forEach(function(singleSkater) {
            var skater = new Object();
            var fixdata = singleSkater.data.replace(' ','').split(',');
            skater['nhlid'] = singleSkater.id;
            skater['jerseynum'] = fixdata[0];
            skater['pos'] = fixdata[1];
            skater['lastname'] = fixdata[2].split('.')[1].trim();
            skater['team'] = team;
            skater['season'] = season;

            rosterPlayers.push(skater);
          });

          callback(rosterPlayers);
        } else {
          callback(error);
        }
    });
  }

  var playerpage = function(playerid, callback) {
    var playerpageHTML = 'http://' + playerpageURL + playerid;

    request(playerpageHTML, function(error, response, html) {
      if(!error && response.statusCode == 200) {
        var modhtml = html.replace(/&nbsp;/g,' ');
				var $ = cheerio.load(modhtml);

        var tombstone = $('#tombstone');
        var bio = $(tombstone).html().replace(/(\r\n|\n|\r)/gm,"");

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
                  var birthplace = $(this).next().text().split(',');
                  var allbirthplace = new Object();
                  if(birthplace.length > 2) {
                    allbirthplace['city'] = birthplace[0].trim();
                    allbirthplace['state'] = birthplace[1].trim();
                    allbirthplace['country'] = birthplace[2].trim();
                  } else {
                    allbirthplace['city'] = birthplace[0].trim();
                    allbirthplace['country'] = birthplace[1].trim();
                  }
                  playerpageInfo['birthplace'] = allbirthplace;
                  break;
                case 'shoots':
                case 'catches':
                  playerpageInfo['shootsorcatches'] = $(this).next().text().trim();
                  break;
                case 'weight':
                  playerpageInfo['weight'] = parseInt($(this).next().text().trim());
                  break;
                case 'drafted':
                  var splitDraft = $(this).next().text().trim().split(' ');
                  var draftteam = splitDraft[0].replace('/','');
                  drafted['team'] = draftteam;
                  drafted['year'] = parseInt(splitDraft[1]);
                  break;
                case 'round':
                  var splitDraft = $(this).next().text().trim().split(' ')[0].split('(');
                  drafted['round'] = parseInt(splitDraft[0]);
                  drafted['overall'] = parseInt(splitDraft[1]);
                  playerpageInfo['drafted'] = drafted;
              };
            };
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
