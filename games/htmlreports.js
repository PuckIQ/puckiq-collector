var jsdom = require('jsdom');
var $ = require('jquery')(jsdom.jsdom().defaultView);

var sprintf = require('sprintf-js').sprintf;
var teams = require('../teams');

function ReportHandler() {
  "use strict";

  var htmlReportsUrl = 'www.nhl.com/scores/htmlreports';

  this.roster = function (season, gametype, gameid, callback) {
    reportRoster(season, gametype, gameid, function (response) {
      callback(response);
    });
  }

  this.playbyplay = function (season, gametype, gameid, callback) {
    reportPlayByPlay(season, gametype, gameid, function (response) {
      callback(response);
    });
  };

  this.toi = function (season, gametype, gameid, team, callback) {
    reportTOI(season, gametype, gameid, team, function (response) {
      callback(response);
    });
  };

  var reportRoster = function (season, gametype, gameid, callback) {
    var rosterUrl = 'http://' + htmlReportsUrl + '/' + season + '/RO' + gametype + gameid + '.HTM';

    $.get(rosterUrl, function (html) {
      html.replace(/\r?\n|\r/g, '').replace(/&nbsp;/g, ' ');

      var nhlgame = new Object();
      var hm = new Object();
      var aw = new Object();

      nhlgame['season'] = parseInt(season);
      nhlgame['gametype'] = gametype;
      nhlgame['gameid'] = gameid;

      var hometeam = $(($('#Home > tbody', html).first().children('tr:nth-child(3)').html()).replace('<br>', '|')).text().split('|')[0].trim();
      var awayteam = $(($('#Visitor > tbody', html).first().children('tr:nth-child(3)').html()).replace('<br>', '|')).text().split('|')[0].trim();

      var homeabbr;
      var gametimezone;

      teams.forEach(function (v, i) {
        if (v.name.toUpperCase() == hometeam) {
          hm['team'] = v.teamID;
          homeabbr = v.TeamPXP;
          process.env.TZ = v.TimeZone;
        }
        if (v.name.toUpperCase() == awayteam) {
          aw['team'] = v.teamID;
        }
      });

      // bit of a pain in the ass but this helps capture puck drop time
      var gameDate = $('#GameInfo > tbody', html).first().children('tr:nth-child(4)').text().trim();
      var gameTime = ($('#GameInfo > tbody', html).first().children('tr:nth-child(6)').text().trim().replace('Start', '').trim().split(';')[0]).split(':');
      var gameStart = (parseInt(gameTime[0]) < 10) ? sprintf('%02f', parseInt(gameTime[0]) + 12) + ':' + gameTime[1].substring(0, gameTime[1].length - 3).trim() : sprintf('%02f', parseInt(gameTime[0])) + ':' + gameTime[1].substring(0, gameTime[1].length - 3).trim();

      var gamestartJS = new Date(gameDate + ' ' + gameStart);
      nhlgame['gamestart'] = gamestartJS.toISOString();

      var getTeamRosters = $('#Scratches', html).siblings().html().replace(/(\r\n|\n|\r)/gm, "");
      var getTeamScratches = $('#Scratches', html).html().replace(/(\r\n|\n|\r)/gm, "");

      var getTeamCoaches = $('#HeadCoaches', html).html().replace(/(\r\n|\n|\r)/gm, "");
      var getGameOfficials = $('#Scratches', html).siblings('tr[valign="top"]').html().replace(/(\r\n|\n|\r)/gm, "");

      // Parse through all of the officials
      var officials = new Array();
      $('tr', getGameOfficials).each(function (OfficialIndex, OfficialValue) {
        if (OfficialIndex >= 2 && OfficialIndex <= 5) {
          var official = new Object();
          if ($('td', OfficialValue).attr('align') == 'left') {
            var numcount = $(OfficialValue).text().replace('#', '').indexOf(' ');
            var off = $(OfficialValue).text().replace('#', '').split(' ');
            official['jerseynum'] = parseInt(off[0]);
            official['name'] = $(OfficialValue).text().substring(numcount + 2, $(OfficialValue).text().length);
            official['referee'] = true;
            officials.push(official);
          } else {
            var numcount = $(OfficialValue).text().replace('#', '').indexOf(' ');
            var off = $(OfficialValue).text().replace('#', '').split(' ');
            official['jerseynum'] = parseInt(off[0]);
            official['name'] = $(OfficialValue).text().substring(numcount + 2, $(OfficialValue).text().length);
            official['linesman'] = true;
            officials.push(official);
          }
        }
      });

      nhlgame['officials'] = officials;

      // Parse through all of the rosters to make home & away splits easier
      // If you can find a simpler way of doing this please modify between *ROSTER*
      /* ROSTER */
      var homeRoster = new Array();
      var awayRoster = new Array();
      var teamCount = 0;

      $('tr', getTeamRosters).each(function (EachroI, EachroV) {
        var indPlayer = new Object();
        if ($('td:first', EachroV).text() === '#') {
          teamCount++;
        } else {
          $('td', EachroV).each(function (EachColI, EachColV) {
            switch (EachColI) {
              case 0:
                indPlayer['jerseynum'] = parseInt($(EachColV).text());
                break;
              case 1:
                indPlayer['pos'] = $(EachColV).text();
                break;
              case 2:
                indPlayer['name'] = $(EachColV).text().toProperCase().replace('  (A)', '').replace('  (C)', '');
                //indPlayer['team'] = teamCount > 1 ? nhlgame.home : nhlgame.away;
                break;
            }
          });
          if (teamCount > 1)
            homeRoster.push(indPlayer);
          else
            awayRoster.push(indPlayer);
        }
      });

      hm['roster'] = homeRoster;
      aw['roster'] = awayRoster;

      // Add the scratches to the game report
      var homeScratches = new Array();
      var awayScratches = new Array();
      var scratchCount = 0;
      $('tr', getTeamScratches).each(function (EachroI, EachroV) {
        var indPlayer = new Object();
        if ($('td:first', EachroV).text() === '#') {
          scratchCount++;
        } else {
          $('td', EachroV).each(function (EachColI, EachColV) {
            switch (EachColI) {
              case 0:
                indPlayer['jerseynum'] = parseInt($(EachColV).text());
                break;
              case 1:
                indPlayer['pos'] = $(EachColV).text();
                break;
              case 2:
                indPlayer['name'] = $(EachColV).text().toProperCase().replace('  (A)', '').replace('  (C)', '');
                //indPlayer['team'] = teamCount > 1 ? nhlgame.home : nhlgame.away;
                //indPlayer['scratch'] = true;
                break;
            }
          });
          if (scratchCount > 1)
            homeScratches.push(indPlayer);
          else
            awayScratches.push(indPlayer);
        }
      });

      hm['scratches'] = homeScratches;
      aw['scratches'] = awayScratches;

      // Add coaches to the teams
      var homeCoach, awayCoach;
      var coachCount = 0;
      $('tr', getTeamCoaches).each(function (CoachIndex, CoachValue) {
        var tempCoach = new Object();
        tempCoach = $(CoachValue).text().toProperCase();
        if (CoachIndex > 0) {
          homeCoach = tempCoach
        } else {
          awayCoach = tempCoach
        }
        coachCount++;
      });

      hm['coach'] = homeCoach;
      aw['coach'] = awayCoach;

      nhlgame['home'] = hm;
      nhlgame['away'] = aw;

      callback(nhlgame);
    });
  };

  var reportPlayByPlay = function (season, gametype, gameid, callback) {
    var playbyplayUrl = 'http://' + htmlReportsUrl + '/' + season + '/PL' + gametype + gameid + '.HTM';

    $.get(playbyplayUrl, function (html) {
      html.replace(/\r?\n|\r/g, '').replace(/&nbsp;/g, ' ');

      var nhlgame = new Object();

      nhlgame['season'] = parseInt(season);
      nhlgame['gametype'] = gametype;
      nhlgame['gameid'] = gameid;

      var hometeam = $(($('#Home:first > tbody', html).first().children('tr:nth-child(3)').html()).replace('<br>', '|')).text().split('|')[0].trim();
      var awayteam = $(($('#Visitor:first > tbody', html).first().children('tr:nth-child(3)').html()).replace('<br>', '|')).text().split('|')[0].trim();

      var homeabbr;
      var gametimezone;

      teams.forEach(function (v, i) {
        if (v.name.toUpperCase() == hometeam) {
          nhlgame['home'] = v.teamID;
          homeabbr = v.TeamPXP;
          process.env.TZ = v.TimeZone;
        }
        if (v.name.toUpperCase() == awayteam) {
          nhlgame['away'] = v.teamID;
        }
      });

      // bit of a pain in the ass but this helps capture puck drop time
      var gameDate = $('#GameInfo:first > tbody', html).first().children('tr:nth-child(4)').text().trim();
      var gameTime = ($('#GameInfo:first > tbody', html).first().children('tr:nth-child(6)').text().trim().replace('Start', '').trim().split(';')[0]).split(':');
      var gameStart = (parseInt(gameTime[0]) < 10) ? sprintf('%02f', parseInt(gameTime[0]) + 12) + ':' + gameTime[1].substring(0, gameTime[1].length - 3).trim() : sprintf('%02f', parseInt(gameTime[0])) + ':' + gameTime[1].substring(0, gameTime[1].length - 3).trim();

      var gamestartJS = new Date(gameDate + ' ' + gameStart);
      nhlgame['gamestart'] = gamestartJS.toISOString();

      var getEvents = $('tr.evenColor', html);
      var events = new Array();

      $(getEvents).each(function (rowIndex, rowValue) {
        var singleEvent = new Object();
        $(rowValue).children('td').each(function (colIndex, colValue) {
          switch (colIndex) {
            case 0:
              singleEvent['eventid'] = parseInt($(colValue).text());
            case 1:
              singleEvent['period'] = parseInt($(colValue).text());
              break;
            case 2:
              singleEvent['strength'] = ($(colValue).text() == " ") ? 'NA' : $(colValue).text();
              break;
            case 3:
              var ticks = new Object();
              var tick = $(colValue).html().replace('<br>', '|').split('|');
              ticks['elapsed'] = (parseInt(tick[0].split(':')[0]) * 60) + (parseInt(tick[0].split(':')[1]));
              ticks['remain'] = (parseInt(tick[1].split(':')[0]) * 60) + (parseInt(tick[1].split(':')[1]));
              singleEvent['time'] = ticks;
              if (singleEvent['period'] > 4 && ticks['elapsed'] == 0 && ticks['remain'] == 0)
                singleEvent['shootout'] = true;
              break;
            case 4:
              // Captures all Goal/Shot/Fenwick/Corsi events
              if (!singleEvent['shootout']) {
                switch ($(colValue).text()) {
                  case "GOAL":
                    singleEvent['goal'] = true;
                    singleEvent['shot'] = true;
                    singleEvent['ontarget'] = true;
                    if (singleEvent['strength'] == "EV") {
                      singleEvent['fenwick'] = true;
                      singleEvent['corsi'] = true;
                    }
                    break;
                  case "SHOT":
                    singleEvent['shot'] = true;
                    singleEvent['ontarget'] = true;
                    if (singleEvent['strength'] == "EV") {
                      singleEvent['fenwick'] = true;
                      singleEvent['corsi'] = true;
                    }
                    break;
                  case "MISS":
                    if (singleEvent['strength'] == "EV") {
                      singleEvent['fenwick'] = true;
                      singleEvent['corsi'] = true;
                    }
                    break;
                  case "BLOCK":
                    if (singleEvent['strength'] == "EV") {
                      singleEvent['corsi'] = true;
                    }
                    break;
                }
                singleEvent['eventtype'] = $(colValue).text();
              } else {
                switch ($(colValue).text()) {
                  case "SHOT":
                  case "MISS":
                  case "GOAL":
                    singleEvent['eventtype'] = "SO_" + $(colValue).text();
                    break;
                  default:
                    singleEvent['eventtype'] = $(colValue).text();
                    break;
                }

              }
              break;
            case 5:
              switch (singleEvent['eventtype']) {
                case "SO_GOAL":
                case "SO_SHOT":
                case "SO_MISS":
                case "SHOT":
                case "MISS":
                case "GOAL":
                  // This displays all information for Fenwick/Corsi events
                  singleEvent['eventfor'] = ($(colValue).text().substring(0, 3) == homeabbr) ? nhlgame['home'] : nhlgame['away'];
                  singleEvent['eventby'] = parseInt($(colValue).text().substring($(colValue).text().indexOf('#')).replace('#', '').split(' ')[0]);
                  singleEvent['zone'] = $(colValue).text().substring($(colValue).text().indexOf('. Zone'), $(colValue).text().indexOf('. Zone') - 3).toUpperCase();
                  singleEvent['distance'] = parseInt($(colValue).text().substring($(colValue).text().lastIndexOf(',')).replace(' ft.', '').replace(', ', ''));
                  singleEvent['shottype'] = $(colValue).text().split(',')[1].trim();
                  singleEvent['eventagainst'] = ($(colValue).text().substring(0, 3) != homeabbr) ? nhlgame['home'] : nhlgame['away'];
                  break;
                case "BLOCK":
                  // This displays all information for BLOCKED Corsi events
                  singleEvent['eventfor'] = ($(colValue).text().substring(0, 3) == homeabbr) ? nhlgame['home'] : nhlgame['away'];
                  singleEvent['eventby'] = parseInt($(colValue).text().substring($(colValue).text().indexOf('#')).replace('#', '').split(' ')[0]);
                  singleEvent['zone'] = $(colValue).text().substring($(colValue).text().indexOf('. Zone'), $(colValue).text().indexOf('. Zone') - 3).toUpperCase();
                  singleEvent['shottype'] = $(colValue).text().split(',')[1].trim();
                  singleEvent['eventagainst'] = ($(colValue).text().substring(0, 3) != homeabbr) ? nhlgame['home'] : nhlgame['away'];
                  singleEvent['blockedby'] = parseInt($(colValue).text().substring($(colValue).text().lastIndexOf('#')).replace('#', '').split(' ')[0]);
                  break;
                case "FAC":
                  // This displays information for Faceoffs. Because the faceoff is recorded as
                  // '<Team> won <zone> - <AWAY> #<NO> <PLAYER> vs <HOME> #<NO> <PLAYER>' the eventby
                  // needs to be adjusted to grab the correct player's number.
                  singleEvent['eventfor'] = ($(colValue).text().substring(0, 3) == homeabbr) ? nhlgame['home'] : nhlgame['away'];
                  if (($(colValue).text().substring(0, 3) != homeabbr))
                    singleEvent['eventby'] = parseInt($(colValue).text().substring($(colValue).text().indexOf('#')).replace('#', '').split(' ')[0]);
                  else
                    singleEvent['eventby'] = parseInt($(colValue).text().substring($(colValue).text().lastIndexOf('#')).replace('#', '').split(' ')[0]);
                  singleEvent['zone'] = $(colValue).text().substring($(colValue).text().indexOf('. Zone'), $(colValue).text().indexOf('. Zone') - 3).toUpperCase();
                  singleEvent['eventagainst'] = ($(colValue).text().substring(0, 3) != homeabbr) ? nhlgame['home'] : nhlgame['away'];
                  break;
                case "HIT":
                case "TAKE":
                case "GIVE":
                  // This displays information for Hits, Takeaways and Giveaways
                  singleEvent['eventfor'] = ($(colValue).text().substring(0, 3) == homeabbr) ? nhlgame['home'] : nhlgame['away'];
                  singleEvent['eventby'] = parseInt($(colValue).text().substring($(colValue).text().indexOf('#')).replace('#', '').split(' ')[0]);
                  singleEvent['zone'] = $(colValue).text().substring($(colValue).text().indexOf('. Zone'), $(colValue).text().indexOf('. Zone') - 3).toUpperCase();
                  singleEvent['eventagainst'] = ($(colValue).text().substring(0, 3) != homeabbr) ? nhlgame['home'] : nhlgame['away'];
                  break;
                case "PENL":
                  // This displays penalty information. I tried to include the actual penalty call but ran into problems with penalties
                  // that that were more than one word long (ie. cross checking would only display as checking)
                  singleEvent['eventfor'] = ($(colValue).text().substring(0, 3) == homeabbr) ? nhlgame['home'] : nhlgame['away'];
                  singleEvent['eventby'] = parseInt($(colValue).text().substring($(colValue).text().indexOf('#')).replace('#', '').split(' ')[0]);
                  singleEvent['zone'] = $(colValue).text().substring($(colValue).text().indexOf('. Zone'), $(colValue).text().indexOf('. Zone') - 3).toUpperCase();
                  singleEvent['drawnby'] = parseInt($(colValue).text().substring($(colValue).text().lastIndexOf('#')).replace('#', '').split(' ')[0]);
                  var penalty = $(colValue).text().substring($(colValue).text().lastIndexOf('(') + 1, $(colValue).text().lastIndexOf(')')).replace(' min', '');
                  singleEvent['pim'] = parseInt(penalty);
                  singleEvent['eventagainst'] = ($(colValue).text().substring(0, 3) != homeabbr) ? nhlgame['home'] : nhlgame['away'];
                  break;
              }
              singleEvent['description'] = $(colValue).text();
              break;
            case 6:
              var player = new Array();
              $(colValue).find('font').each(function (playerIndex, playerValue) {
                player.push(parseInt($(playerValue).text()));
              })
              singleEvent['away'] = player;
              break;
            case 7:
              var player = new Array();
              $(colValue).find('font').each(function (playerIndex, playerValue) {
                player.push(parseInt($(playerValue).text()));
              })
              singleEvent['home'] = player;
              break;
          }
          if (colIndex == 7)
            events.push(singleEvent);
        });
      });

      nhlgame['events'] = events;

      callback(nhlgame);
    });
  }

  var reportTOI = function (season, gametype, gameid, team, callback) {
    var page = (team === 'V') ? 'TV' : 'TH'
    var toiUrl = 'http://' + htmlReportsUrl + '/' + season + '/' + page + gametype + gameid + '.HTM';

    $.get(toiUrl, function (html) {
      html.replace(/\r?\n|\r/g, '').replace(/&nbsp;/g, ' ');

      var nhlgame = new Object();

      nhlgame['season'] = parseInt(season);
      nhlgame['gametype'] = gametype;
      nhlgame['gameid'] = gameid;

      var hometeam = $(($('#Home:first > tbody', html).first().children('tr:nth-child(3)').html()).replace('<br>', '|')).text().split('|')[0].trim();
      var awayteam = $(($('#Visitor:first > tbody', html).first().children('tr:nth-child(3)').html()).replace('<br>', '|')).text().split('|')[0].trim();

      var homeabbr;
      var gametimezone;

      teams.forEach(function (v, i) {
        if (v.name.toUpperCase() == hometeam) {
          nhlgame['home'] = v.teamID;
          homeabbr = v.TeamPXP;
          process.env.TZ = v.TimeZone;
        }
        if (v.name.toUpperCase() == awayteam) {
          nhlgame['away'] = v.teamID;
        }
      });

      // bit of a pain in the ass but this helps capture puck drop time
      var gameDate = $('#GameInfo:first > tbody', html).first().children('tr:nth-child(4)').text().trim();
      var gameTime = ($('#GameInfo:first > tbody', html).first().children('tr:nth-child(6)').text().trim().replace('Start', '').trim().split(';')[0]).split(':');
      var gameStart = (parseInt(gameTime[0]) < 10) ? sprintf('%02f', parseInt(gameTime[0]) + 12) + ':' + gameTime[1].substring(0, gameTime[1].length - 3).trim() : sprintf('%02f', parseInt(gameTime[0])) + ':' + gameTime[1].substring(0, gameTime[1].length - 3).trim();

      var gamestartJS = new Date(gameDate + ' ' + gameStart);
      nhlgame['gamestart'] = gamestartJS.toISOString();

      // Grab the table which sits on the last TR tag withing the first table under the class pageBreakAfter
      var toiTable = $($('div.pageBreakAfter > table:nth-child(1)', html).html().replace(/(\r\n|\n|\r)/gm, "")).last('tr');

      // Remove the period & game totals from the page
      $(toiTable).find('td[colspan="8"]').not('.playerHeading').remove();

      // Get the table with only the TOI values
      $(toiTable).each(function (toiIndex, toiValue) {

        var playerArray = new Array();

        // Finds each playerHeading class and only grabs the data between it and the next playerHeading class
        for (var i = 0; i < $('.playerHeading', toiValue).parent().length; i++) {
          var start = $('.playerHeading', toiValue).eq(i).parent();
          var end = $('.playerHeading', toiValue).eq(i + 1).parent();
          var eachToi = $(start).nextUntil($(end)).andSelf();

          var playerObject = new Object();
          var toiArray = new Array();

          $(eachToi).each(function (rowIndex, rowValue) {
            var toiPlayer = new Object();
            if ($(rowValue).text() != "" && rowIndex != 1) {
              $('td', rowValue).each(function (colIndex, colValue) {
                if (!$(colValue).hasClass('heading')) {
                  if ($(colValue).hasClass('playerHeading')) {
                    var playerInfo = $(colValue).text().replace(',', '').split(' ');
                    playerObject['jerseynum'] = parseInt(playerInfo[0]);
                    playerObject['lastname'] = playerInfo[1].toProperCase();
                    playerObject['firstname'] = playerInfo[2].toProperCase();
                  } else {
                    switch (colIndex) {
                      case 0:
                        toiPlayer['shift'] = parseInt($(colValue).text());
                        break;
                      case 1:
                        toiPlayer['period'] = ($(colValue).text() != 'OT') ? parseInt($(colValue).text()) : 4;
                        break;
                      case 2:
                        var updown = $(colValue).text().split('/')[0].trim();
                        var minsec = updown.split(':');
                        toiPlayer['start'] = parseInt(minsec[0] * 60) + parseInt(minsec[1]);
                        break;
                      case 3:
                        var updown = $(colValue).text().split('/')[0].trim();
                        var minsec = updown.split(':');
                        toiPlayer['end'] = parseInt(minsec[0] * 60) + parseInt(minsec[1]);
                        break;
                      case 4:
                        var minsec = $(colValue).text().split(':');
                        toiPlayer['duration'] = parseInt(minsec[0] * 60) + parseInt(minsec[1]);
                        break;
                      case 5:
                        toiArray.push(toiPlayer);
                        break;
                    }
                  }
                }
                playerObject['shifts'] = toiArray;
              });
            }
          });
          playerArray.push(playerObject);
        }
        callback(playerArray);
      });
    });
  }
}

String.prototype.toProperCase = function () {
  return this.replace(/\w\S*/g, function (txt) { return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase(); });
};

module.exports = ReportHandler;
