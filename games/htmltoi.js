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
      } catch (err) {
        console.log(err);
      }
    });
  });
};