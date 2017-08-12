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

var addGameSheet = function (gamesheet, callback) {
  MongoClient.connect(dbUri, (err, db) => {
    if (!err) {
      var Collection = db.collection('nhlgamesheet');
      try {
        Collection.insert(gamesheet, function (err, result) {
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

var getGameSheets = function (schedules, callback) {
  var baseUrl = 'http://www.nhl.com/scores/htmlreports/';
  schedules.forEach((schedVal) => {
    var urlBuilder = baseUrl + schedVal.season.toString() + '/PL' + schedVal.htmlid + '.HTM';
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

        nhlgame['home'] = schedVal.home;
        nhlgame['homeseasonid'] = schedVal.homeseasonid;
        nhlgame['away'] = schedVal.away;
        nhlgame['awayseasonid'] = schedVal.awayseasonid;
        homeabbr = schedVal.homepxp;

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
                    singleEvent['eventforseasonid'] = ($(colValue).text().substring(0, 3) == homeabbr) ? nhlgame['homeseasonid'] : nhlgame['awayseasonid'];
                    singleEvent['eventby'] = parseInt($(colValue).text().substring($(colValue).text().indexOf('#')).replace('#', '').split(' ')[0]);
                    singleEvent['zone'] = $(colValue).text().substring($(colValue).text().indexOf('. Zone'), $(colValue).text().indexOf('. Zone') - 3).toUpperCase();
                    singleEvent['distance'] = parseInt($(colValue).text().substring($(colValue).text().lastIndexOf(',')).replace(' ft.', '').replace(', ', ''));
                    singleEvent['shottype'] = $(colValue).text().split(',')[1].trim();
                    singleEvent['eventagainst'] = ($(colValue).text().substring(0, 3) != homeabbr) ? nhlgame['home'] : nhlgame['away'];
                    singleEvent['eventagainstseasonid'] = ($(colValue).text().substring(0, 3) != homeabbr) ? nhlgame['homeseasonid'] : nhlgame['awayseasonid'];
                    break;
                  case "BLOCK":
                    // This displays all information for BLOCKED Corsi events
                    singleEvent['eventfor'] = ($(colValue).text().substring(0, 3) == homeabbr) ? nhlgame['home'] : nhlgame['away'];
                    singleEvent['eventforseasonid'] = ($(colValue).text().substring(0, 3) == homeabbr) ? nhlgame['homeseasonid'] : nhlgame['awayseasonid'];
                    singleEvent['eventby'] = parseInt($(colValue).text().substring($(colValue).text().indexOf('#')).replace('#', '').split(' ')[0]);
                    singleEvent['zone'] = $(colValue).text().substring($(colValue).text().indexOf('. Zone'), $(colValue).text().indexOf('. Zone') - 3).toUpperCase();
                    singleEvent['shottype'] = $(colValue).text().split(',')[1].trim();
                    singleEvent['eventagainst'] = ($(colValue).text().substring(0, 3) != homeabbr) ? nhlgame['home'] : nhlgame['away'];
                    singleEvent['eventagainstseasonid'] = ($(colValue).text().substring(0, 3) != homeabbr) ? nhlgame['homeseasonid'] : nhlgame['awayseasonid'];
                    singleEvent['blockedby'] = parseInt($(colValue).text().substring($(colValue).text().lastIndexOf('#')).replace('#', '').split(' ')[0]);
                    break;
                  case "FAC":
                    // This displays information for Faceoffs. Because the faceoff is recorded as
                    // '<Team> won <zone> - <AWAY> #<NO> <PLAYER> vs <HOME> #<NO> <PLAYER>' the eventby
                    // needs to be adjusted to grab the correct player's number.
                    singleEvent['eventfor'] = ($(colValue).text().substring(0, 3) == homeabbr) ? nhlgame['home'] : nhlgame['away'];
                    singleEvent['eventforseasonid'] = ($(colValue).text().substring(0, 3) == homeabbr) ? nhlgame['homeseasonid'] : nhlgame['awayseasonid'];
                    if (($(colValue).text().substring(0, 3) != homeabbr))
                      singleEvent['eventby'] = parseInt($(colValue).text().substring($(colValue).text().indexOf('#')).replace('#', '').split(' ')[0]);
                    else
                      singleEvent['eventby'] = parseInt($(colValue).text().substring($(colValue).text().lastIndexOf('#')).replace('#', '').split(' ')[0]);
                    singleEvent['zone'] = $(colValue).text().substring($(colValue).text().indexOf('. Zone'), $(colValue).text().indexOf('. Zone') - 3).toUpperCase();
                    singleEvent['eventagainst'] = ($(colValue).text().substring(0, 3) != homeabbr) ? nhlgame['home'] : nhlgame['away'];
                    singleEvent['eventagainstseasonid'] = ($(colValue).text().substring(0, 3) != homeabbr) ? nhlgame['homeseasonid'] : nhlgame['awayseasonid'];
                    break;
                  case "HIT":
                  case "TAKE":
                  case "GIVE":
                    // This displays information for Hits, Takeaways and Giveaways
                    singleEvent['eventfor'] = ($(colValue).text().substring(0, 3) == homeabbr) ? nhlgame['home'] : nhlgame['away'];
                    singleEvent['eventforseasonid'] = ($(colValue).text().substring(0, 3) == homeabbr) ? nhlgame['homeseasonid'] : nhlgame['awayseasonid'];
                    singleEvent['eventby'] = parseInt($(colValue).text().substring($(colValue).text().indexOf('#')).replace('#', '').split(' ')[0]);
                    singleEvent['zone'] = $(colValue).text().substring($(colValue).text().indexOf('. Zone'), $(colValue).text().indexOf('. Zone') - 3).toUpperCase();
                    singleEvent['eventagainst'] = ($(colValue).text().substring(0, 3) != homeabbr) ? nhlgame['home'] : nhlgame['away'];
                    singleEvent['eventagainstseasonid'] = ($(colValue).text().substring(0, 3) != homeabbr) ? nhlgame['homeseasonid'] : nhlgame['awayseasonid'];
                    break;
                  case "PENL":
                    // This displays penalty information. I tried to include the actual penalty call but ran into problems with penalties
                    // that that were more than one word long (ie. cross checking would only display as checking)
                    singleEvent['eventfor'] = ($(colValue).text().substring(0, 3) == homeabbr) ? nhlgame['home'] : nhlgame['away'];
                    singleEvent['eventforseasonid'] = ($(colValue).text().substring(0, 3) == homeabbr) ? nhlgame['homeseasonid'] : nhlgame['awayseasonid'];
                    singleEvent['eventby'] = parseInt($(colValue).text().substring($(colValue).text().indexOf('#')).replace('#', '').split(' ')[0]);
                    singleEvent['zone'] = $(colValue).text().substring($(colValue).text().indexOf('. Zone'), $(colValue).text().indexOf('. Zone') - 3).toUpperCase();
                    singleEvent['drawnby'] = parseInt($(colValue).text().substring($(colValue).text().lastIndexOf('#')).replace('#', '').split(' ')[0]);
                    var penalty = $(colValue).text().substring($(colValue).text().lastIndexOf('(') + 1, $(colValue).text().lastIndexOf(')')).replace(' min', '');
                    singleEvent['pim'] = parseInt(penalty);
                    singleEvent['eventagainst'] = ($(colValue).text().substring(0, 3) != homeabbr) ? nhlgame['home'] : nhlgame['away'];
                    singleEvent['eventagainstseasonid'] = ($(colValue).text().substring(0, 3) != homeabbr) ? nhlgame['homeseasonid'] : nhlgame['awayseasonid'];
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
      } catch (err) {
        console.log(err);
      }
    });
  });
};

getSchedules({ season: argv.season, _id: { $gte: argv.gameid, $lt: argv.gameid + 10 } }, (schedules) => {
  getGameSheets(schedules, (gamesheet) => {
    addGameSheet(gamesheet, (data) => {
      //console.log(argv.gameid);
    })
  });
});