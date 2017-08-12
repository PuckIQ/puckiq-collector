var argv = require('minimist')(process.argv.slice(2));
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

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
    console.log(err);
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
        console.log(err);
      }
    }
  });
};

var getRoster = function (schedules, callback) {
  var baseUrl = 'http://www.nhl.com/scores/htmlreports/';
  schedules.forEach((schedVal) => {
    var urlBuilder = baseUrl + schedVal.season.toString() + '/RO' + schedVal.htmlid + '.HTM';
    JSDOM.fromURL(urlBuilder).then(dom => {
      try {
        var html = dom.serialize().replace(/\r?\n|\r/g, '').replace(/&nbsp;/g, ' ');
        var $ = require('jquery')(dom.window);

        var nhlgame = new Object();
        var hm = new Object();
        var aw = new Object();

        nhlgame['season'] = schedVal.season;
        nhlgame['_id'] = schedVal._id;

        var hometeam = $(($('#Home > tbody', html).first().children('tr:nth-child(3)').html()).replace('<br>', '|')).text().split('|')[0].trim();
        var awayteam = $(($('#Visitor > tbody', html).first().children('tr:nth-child(3)').html()).replace('<br>', '|')).text().split('|')[0].trim();

        var homeabbr;
        var gametimezone;

        hm['team'] = schedVal.home;
        hm['seasonid'] = schedVal.homeseasonid;
        aw['team'] = schedVal.away;
        aw['seasonid'] = schedVal.awayseasonid;
        homeabbr = schedVal.homepxp;

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
          var lastName
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
                  var nameArr = indPlayer['name'].split(' ');
                  indPlayer['lastname'] = nameArr[nameArr.length - 1];
                  break;
              }
            });
            if (teamCount > 1)
              homeRoster.push(indPlayer);
            else
              awayRoster.push(indPlayer);
          }
        });

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
                  var nameArr = indPlayer['name'].split(' ');
                  indPlayer['lastname'] = nameArr[nameArr.length - 1];
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

        hm['roster'] = homeRoster;
        aw['roster'] = awayRoster;

        nhlgame['home'] = hm;
        nhlgame['away'] = aw;

        callback(nhlgame);
      } catch (err) {
        console.log(err);
      }
    });
  });
};

getSchedules({ season: argv.season, _id: { $gte: argv.gameid, $lt: argv.gameid + 100 } }, (schedules) => {
  getRoster(schedules, (roster) => {
    addRoster(roster, (data) => {
      console.log(argv.gameid);
    });
  });
});