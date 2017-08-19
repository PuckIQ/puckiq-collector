var argv = require('minimist')(process.argv.slice(2));
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

var https = require('https');

var MongoClient = require('mongodb').MongoClient;
var sprintf = require('sprintf-js').sprintf;

var config = require('../config.js');

var dbUri = 'mongodb://' + config.dbUser + ':' + config.dbPass + '@' + config.dbUri + ':' + config.dbPort + '/' + config.dbName + '?slaveOk=true';

String.prototype.toProperCase = function () {
  return this.replace(/\w\S*/g, function (txt) { return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase(); });
};

var getSchedules = function (query, callback) {
  try {
    MongoClient.connect(dbUri, (err, db) => {
      var Collection = db.collection('nhlschedule');
      var results = Collection.find(query);

      results.toArray((err, docs) => {
        if (!err)
          callback(docs);
        else
          callback(err);
        db.close();
      });
    });
  } catch (err) {
    callback(err);
  }
};

var addRoster = function (roster, callback) {
  MongoClient.connect(dbUri, (err, db) => {
    if (!err) {
      var Collection = db.collection('nhlgameroster');
      try {
        Collection.insert(roster, function (err, result) {
          if (!err)
            callback(result);
          else
            callback(err);
          db.close();
        });
      } catch (err) {
        callback(err);
      }
    }
  });
};

var getPlayerInfo = function (options, callback) {
  try {
    MongoClient.connect(dbUri, (err, db) => {
      var Collection = db.collection('nhlplayers');
      var results = Collection.find(options);

      results.toArray((err, document) => {
        if (!err)
          callback(document);
        else
          callback(err);
        db.close();
      });
    });
  } catch (err) {
    callback(err);
  }
};

var updatePlayerInfo = function (options, possible, callback) {
  try {
    MongoClient.connect(dbUri, (err, db) => {
      var Collection = db.collection('nhlplayers');
      var newposition = { possible: possible };
      Collection.updateOne(options, { $addToSet: newposition }, (err, data) => {
        if (!err)
          callback(data);
        else
          callback(err);
        db.close();
      });
    });
  } catch (err) {
    callback(err);
  }
}

var getRoster = function (schedules, callback) {
  var baseUrl = 'http://www.nhl.com/scores/htmlreports/';
  schedules.forEach((schedVal) => {
    var urlBuilder = baseUrl + schedVal.season.toString() + '/RO' + schedVal.htmlid + '.HTM';
    JSDOM.fromURL(urlBuilder).then(dom => {
      try {
        var html = dom.serialize().replace(/\r?\n|\r/g, '').replace(/&nbsp;/g, ' ');
        var $ = require('jquery')(dom.window);

        var nhlgame = new Object();

        nhlgame['season'] = schedVal.season;
        nhlgame['_id'] = schedVal._id;

        var hometeam = $(($('#Home > tbody', html).first().children('tr:nth-child(3)').html()).replace('<br>', '|')).text().split('|')[0].trim();
        var awayteam = $(($('#Visitor > tbody', html).first().children('tr:nth-child(3)').html()).replace('<br>', '|')).text().split('|')[0].trim();

        var getTeamRosters = $('#Scratches', html).siblings().html().replace(/(\r\n|\n|\r)/gm, "");
        var getTeamScratches = $('#Scratches', html).html().replace(/(\r\n|\n|\r)/gm, "");

        var getTeamCoaches = $('#HeadCoaches', html).html().replace(/(\r\n|\n|\r)/gm, "");
        var getGameOfficials = $('#Scratches', html).siblings('tr[valign="top"]').html().replace(/(\r\n|\n|\r)/gm, "");

        // Parse through all of the officials
        var rosters = new Array();
        $('tr', getGameOfficials).each(function (OfficialIndex, OfficialValue) {
          if (OfficialIndex >= 2 && OfficialIndex <= 5) {
            var official = new Object();
            if ($('td', OfficialValue).attr('align') == 'left') {
              var numcount = $(OfficialValue).text().replace('#', '').indexOf(' ');
              var off = $(OfficialValue).text().replace('#', '').split(' ');
              official['jerseynum'] = parseInt(off[0]);
              official['name'] = $(OfficialValue).text().substring(numcount + 2, $(OfficialValue).text().length);
              official['referee'] = true;
              official['official'] = true;
              rosters.push(official);
            } else {
              var numcount = $(OfficialValue).text().replace('#', '').indexOf(' ');
              var off = $(OfficialValue).text().replace('#', '').split(' ');
              official['jerseynum'] = parseInt(off[0]);
              official['name'] = $(OfficialValue).text().substring(numcount + 2, $(OfficialValue).text().length);
              official['linesman'] = true;
              official['official'] = true;
              rosters.push(official);
            }
          }
        });

        // Parse through all of the rosters to make home & away splits easier
        // If you can find a simpler way of doing this please modify between *ROSTER*
        /* ROSTER */
        var playersAll = new Array();
        $('table', getTeamRosters).each(function (EachTableI, EachTableV) {
          $('tr', EachTableV).each(function (EachRowI, EachRowV) {
            var singlePlayer = new Object();
            if ($('td:first', EachRowV).text() != '#') {
              $('td', EachRowV).each(function (EachColI, EachColV) {
                switch (EachColI) {
                  case 0:
                    singlePlayer['jerseynum'] = parseInt($(EachColV).text());
                    break;
                  case 1:
                    singlePlayer['pos'] = $(EachColV).text();
                    break;
                  case 2:
                    singlePlayer['name'] = $(EachColV).text().toProperCase().replace('  (A)', '').replace('  (C)', '');
                    var nameArr = singlePlayer['name'].split(' ');
                    singlePlayer['lastname'] = nameArr[nameArr.length - 1].split('-')[0];
                    break;
                }
              });
              if (EachTableI > 0) {
                singlePlayer['team'] = schedVal.home;
                singlePlayer['teamseasonid'] = schedVal.homeseasonid;
                singlePlayer['gameplayed'] = true;
                singlePlayer['homeaway'] = 'home'
              } else {
                singlePlayer['team'] = schedVal.away;
                singlePlayer['teamseasonid'] = schedVal.awayseasonid;
                singlePlayer['gameplayed'] = true;
                singlePlayer['homeaway'] = 'away'
              }
              playersAll.push(singlePlayer);
            }
          });
        });

        // Add the scratches to the game report
        $('table', getTeamScratches).each(function (EachTableI, EachTableV) {
          $('tr', EachTableV).each(function (EachroI, EachroV) {
            if ($(EachroV).text().trim() != "") {
              var singlePlayer = new Object();
              if ($('td:first', EachroV).text().trim() != '#') {
                $('td', EachroV).each(function (EachColI, EachColV) {
                  switch (EachColI) {
                    case 0:
                      singlePlayer['jerseynum'] = parseInt($(EachColV).text());
                      break;
                    case 1:
                      singlePlayer['pos'] = $(EachColV).text();
                      break;
                    case 2:
                      singlePlayer['name'] = $(EachColV).text().toProperCase().replace('  (A)', '').replace('  (C)', '');
                      var nameArr = singlePlayer['name'].split(' ');
                      singlePlayer['lastname'] = nameArr[nameArr.length - 1].split('-')[0];
                      singlePlayer['scratched'] = true;
                      break;
                  }
                });
                if (EachTableI > 0) {
                  singlePlayer['team'] = schedVal.home;
                  singlePlayer['teamseasonid'] = schedVal.homeseasonid;
                  singlePlayer['homeaway'] = 'home'
                } else {
                  singlePlayer['team'] = schedVal.away;
                  singlePlayer['teamseasonid'] = schedVal.awayseasonid;
                  singlePlayer['homeaway'] = 'away'
                }
                playersAll.push(singlePlayer);
              }
            }
          });
        });

        // Add coaches to the teams
        var homeCoach, awayCoach;
        var coachCount = 0;
        $('tr', getTeamCoaches).each(function (CoachIndex, CoachValue) {
          var indCoach = new Object();
          var tempCoach = $(CoachValue).text().toProperCase();
          if (CoachIndex > 0) {
            indCoach['name'] = tempCoach;
            indCoach['team'] = schedVal.home;
            indCoach['teamseasonid'] = schedVal.homeseasonid;
            indCoach['coach'] = true;
            rosters.push(indCoach);
          } else {
            indCoach['name'] = tempCoach;
            indCoach['team'] = schedVal.away;
            indCoach['teamseasonid'] = schedVal.awayseasonid;
            indCoach['coach'] = true;
            rosters.push(indCoach);
          }
          coachCount++;
        });

        var playerCount = 0
        playersAll.forEach((v, i) => {
          var q1 = {
            lastName: { $regex: new RegExp(v.lastname, 'i') },
            teamabbr: v.team,
            teamseasonid: v.teamseasonid
          };
          getPlayerInfo(q1, (d1) => {
            playerCount++;

            var playerData;
            if (d1.length > 1) {
              d1.forEach((dv, di) => {
                //console.log(v.name + ' : ' + dv.fullName);
                if (v.name.toUpperCase() === dv.fullName.toUpperCase())
                  playerData = dv;
              });
            } else {
              playerData = d1[0];
            }

            if (playerData != null) {
              //var playerData = d1[0];
              v['playerseasonid'] = playerData._id;
              v['playerid'] = playerData.playerid;
              rosters.push(v);
              var possible = playerData.possible;
              if (possible.indexOf(v.pos) < 0) {
                updatePlayerInfo(q1, v.pos, (u1) => {
                  console.log('UPDATED: [ ' + schedVal._id + ' ] ' + v.name + ' (' + v.pos + '), ' + v.team + ', ' + v.teamseasonid);
                });
              }
            }

            if(playerData == null && v.gameplayed == true) {
              console.log('!IMPORTANT - PLAYER RECORD MISSING: [ ' + schedVal._id + ' ] ' + v.name + ' (' + v.pos + '), ' + v.team + ', ' + v.teamseasonid);
            }

            if (playersAll.length === playerCount) {
              nhlgame['roster'] = rosters;
              callback(nhlgame);
            }
          });
        });
      } catch (err) {
        callback(err);
      }
    });
  });
};

getSchedules({ season: argv.season, _id: { $gte: argv.gameid, $lt: argv.gameid + argv.increment } }, (schedules) => {
  //getSchedules({ season: argv.season, _id: argv.gameid }, (schedules) => {
  getRoster(schedules, (roster) => {
    addRoster(roster, (data) => {

    });
  });
});