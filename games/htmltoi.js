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

var getPlayerInfo = function (player, callback) {
  try {
    MongoClient.connect(dbUri, (err, db) => {
      var Collection = db.collection('nhlgameroster');
      var results = Collection.aggregate([
        { $match: { _id: parseInt(player.gameid) } },
        { $unwind: "$roster" },
        { $match: { "roster.jerseynum": player.jerseynum, "roster.team": player.team } }
      ]);

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

var addTOI = function (toi, callback) {
  MongoClient.connect(dbUri, (err, db) => {
    if (!err) {
      var Collection = db.collection('nhlgametoi');
      try {
        Collection.insert(toi, function (err, result) {
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

var getTOI = function (schedules, callback) {
  var baseUrl = 'http://www.nhl.com/scores/htmlreports/';
  var hv = ['TV', 'TH'];
  hv.forEach((homeaway) => { // Start Home/Away
    schedules.forEach((schedVal) => { // Start Schedules
      var urlBuilder = baseUrl + schedVal.season.toString() + '/' + homeaway + schedVal.htmlid + '.HTM';
      JSDOM.fromURL(urlBuilder).then(dom => { // Start JSDOM
        try { // Start Try/Catch
          var html = dom.serialize().replace(/\r?\n|\r/g, '').replace(/&nbsp;/g, ' ');
          var $ = require('jquery')(dom.window);

          // Grab the table which sits on the last TR tag withing the first table under the class pageBreakAfter
          var toiTable = $($('div.pageBreakAfter > table').html().replace(/(\r\n|\n|\r)/gm, "")).last('tr');

          // Remove the period & game totals from the page
          $(toiTable).find('td[colspan="8"]').not('.playerHeading').remove();

          // Get the table with only the TOI values
          $(toiTable).each(function (toiIndex, toiValue) { // jQuery Start Reading HTML Table

            var playerArray = new Array();

            // Finds each playerHeading class and only grabs the data between it and the next playerHeading class
            for (var i = 0; i < $('.playerHeading', toiValue).parent().length; i++) { // Start Loop Through Player Tables
              var start = $('.playerHeading', toiValue).eq(i).parent();
              var end = $('.playerHeading', toiValue).eq(i + 1).parent();
              var eachToi = $(start).nextUntil($(end)).addBack();

              var playerObject = new Object();
              var toiArray = new Array();

              $(eachToi).each(function (rowIndex, rowValue) { // jQuery Start Looping through Players and TOI
                var toiPlayer = new Object();
                if ($(rowValue).text() != "" && rowIndex != 1) { // Grab only relevant player info
                  $('td', rowValue).each(function (colIndex, colValue) { // jQuery Start loop through all Columns
                    if (!$(colValue).hasClass('heading')) { // Skip all Columns with "heading" class
                      if ($(colValue).hasClass('playerHeading')) {
                        var playerInfo = $(colValue).text().replace(',', '').split(' ');
                        playerObject['jerseynum'] = parseInt(playerInfo[0]);
                        playerObject['lastname'] = playerInfo[1].toProperCase();
                        playerObject['firstname'] = playerInfo[2].toProperCase();
                        playerObject['team'] = (homeaway == 'TH') ? schedVal.home : schedVal.away;
                        playerObject['gameid'] = schedVal._id;
                        playerObject['season'] = schedVal.season;
                        playerObject['teamseasonid'] = (homeaway == 'TH') ? schedVal.homeseasonid : schedVal.awayseasonid;
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
                    } // End Skip all Columns with "heading" class
                    playerObject['shifts'] = toiArray;
                  }); // jQuery End loop through all Columns
                } // End Grab only relevant player info
              }); // jQuery End Looping through Players and TOI
              playerArray.push(playerObject);
            } // End Loop Through Player Tables
            callback(playerArray);
          }); // jQuery End Reading HTML Table
        } catch (err) {
          callback(err);
        } // End Try/Catch
      }); // End JSDOM
    }); // End Schedules
  }); // End Home/Away
}


getSchedules({ season: argv.season, _id: { $gte: argv.gameid, $lt: argv.gameid + argv.increment } }, (schedules) => {
//getSchedules({ season: argv.season, _id: argv.gameid }, (schedules) => {
  getTOI(schedules, (toi) => {
    toi.forEach((toiVal) => {
      getPlayerInfo(toiVal, (player) => {
        toiVal['homeaway'] = player[0].roster.homeaway;
        toiVal['playerseasonid'] = player[0].roster.playerseasonid;
        toiVal['playerid'] = player[0].roster.playerid;
        toiVal['gamedate'] = player[0].gamedate;
        toiVal['gamestart'] = player[0].gamestart;
        addTOI(toiVal, (data) => {

        });
      });
    });
  });
});