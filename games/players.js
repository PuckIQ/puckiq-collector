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
          var playerteaminfo = new Object();

          playerteaminfo['team'] = v.team;
          playerteaminfo['season'] = v.season;
          playerteaminfo['jerseynum'] = v.jerseynum;

          allplayerinfo['nhlid'] = v.nhlid;
          allplayerinfo['pos'] = v.pos;
          allplayerinfo['firstname'] = player.name.replace(' ' + v.lastname, '');
          allplayerinfo['lastname'] = v.lastname;
          allplayerinfo['fullname'] = player.name;
          allplayerinfo['dob'] = player.dob;
          allplayerinfo['height'] = player.height;
          allplayerinfo['weight'] = player.weight;
          allplayerinfo['birthplace'] = player.birthplace;
          allplayerinfo['drafted'] = (typeof player.drafted === 'undefined') ? 'Undrafted' : player.drafted;
          allplayerinfo['shootsorcatches'] = player.shootsorcatches;
          allplayerinfo['tsj'] = playerteaminfo;
          callback(allplayerinfo);
        });
      });
    });
  }

  // grab JSON data from the neulion source and return an array
  // the source from neulion will have all players that have played games for the team
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
            skater['season'] = parseInt(season);

            rosterPlayers.push(skater);
          });

          allJSON.goalieData.forEach(function(singleSkater) {
            var skater = new Object();
            var fixdata = singleSkater.data.replace(' ','').split(',');
            skater['nhlid'] = singleSkater.id;
            skater['jerseynum'] = parseInt(fixdata[0]);
            skater['pos'] = fixdata[1];
            skater['lastname'] = fixdata[2].split('.')[1].trim();
            skater['team'] = team;
            skater['season'] = parseInt(season);

            rosterPlayers.push(skater);
          });

          callback(rosterPlayers);
        } else {
          callback(error);
        }
    });
  }

  // to be used in conjunction with the unexposed players function
  // function crawls the appropriate players bio page on nhl.com and returns an object with the players bio
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
                // birthplace will separate city, province/state and country for North American skaters
                // and city & country for non-NA players
                case 'birthplace':
                  var birthplace = $(this).next().text().split(',');
                  var allbirthplace = new Object();
                  if(birthplace.length > 2) {
                    allbirthplace['city'] = birthplace[0].trim();
                    allbirthplace['province'] = birthplace[1].trim();
                    allbirthplace['country'] = birthplace[2].trim();
                  } else {
                    allbirthplace['city'] = birthplace[0].trim();
                    allbirthplace['country'] = birthplace[1].trim();
                  }
                  playerpageInfo['birthplace'] = allbirthplace;
                  break;
                // combined the shoots & catches variables for skaters and goalies to keep data consistent
                case 'shoots':
                case 'catches':
                  playerpageInfo['shootsorcatches'] = $(this).next().text().trim();
                  break;
                case 'weight':
                  playerpageInfo['weight'] = parseInt($(this).next().text().trim());
                  break;
                // both the drafted and round variables contain information about the players draft posistion and year
                // this is combined and placed into an embeded object within the primary object allowing for easier
                // access and querying
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
