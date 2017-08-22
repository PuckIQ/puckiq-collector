var argv = require('minimist')(process.argv.slice(2));

var MongoClient = require('mongodb').MongoClient;

var config = require('../config.js');
var dbUri = 'mongodb://' + config.dbUser + ':' + config.dbPass + '@' + config.dbUri + ':' + config.dbPort + '/' + config.dbName + '?slaveOk=true';

var getGameSheet = function (playerquery, strength, callback) {
  var arrStrength = strength.split('v');
  var hStrength = (playerquery.roster.homeaway == 'home') ? parseInt(arrStrength[0]) : parseInt(arrStrength[1]);
  var aStrength = (playerquery.roster.homeaway == 'away') ? parseInt(arrStrength[0]) : parseInt(arrStrength[1]);
  try {
    MongoClient.connect(dbUri, (err, db) => {
      var Collection = db.collection('nhlgamesheet');
      var results = Collection.aggregate([
        { $match: { _id: playerquery._id } },
        { $unwind: "$events" },
        { $unwind: "$events.onice" },
        {
          $match: {
            "events.onice.jerseynum": playerquery.roster.jerseynum,
            "events.onice.team": playerquery.roster.team,
            "events.homestrength": hStrength,
            "events.awaystrength": aStrength
          }
        }
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

var getGameRoster = function (gameid, callback) {
  try {
    MongoClient.connect(dbUri, (err, db) => {
      var Collection = db.collection('nhlgameroster');
      var results = Collection.aggregate([
        { $match: { _id: gameid } },
        { $unwind: "$roster" },
        { $match: { "roster.jerseynum": { $exists: true }, "roster.gameplayed": { $exists: true } } }
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

var addPlayerStats = function (playerevents, callback) {
  try {
    MongoClient.connect(dbUri, (err, db) => {
      var Collection = db.collection('nhlplayerevents');
      Collection.update({ gameid: playerevents.gameid, playerid: playerevents.playerid, situation: playerevents.situation }, playerevents, { upsert: true }, (err, docs) => {
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

getGameRoster(argv.gameid, (roster) => {
  roster.forEach((playerVal, PlayerIdx) => {
    getGameSheet(playerVal, argv.situation, (events) => {
      if (events.length > 0) {
        var cf = [], ca = [], ff = [], fa = [], shf = [], sha = [], gf = [], ga = [];
        var hit = [], fow = [], fol = [], pdr = [], ptk = [], to = [];
        var playerData = {
          gameid: playerVal._id,
          playerid: playerVal.roster.playerid,
          playerseasonid: playerVal.roster.playerseasonid,
          team: playerVal.roster.team,
          teamseasonid: playerVal.roster.teamseasonid,
          season: playerVal.season,
          situation: argv.situation
        }
        var actualevents = false;
        events.forEach((eventVal, eventIdx) => {
          if (playerVal.roster.jerseynum == eventVal.events.onice.jerseynum && playerVal.roster.team == eventVal.events.onice.team) {
            actualevents = true;
            switch (eventVal.events.eventtype) {
              case 'BLOCK':
                if (eventVal.events.eventfor == playerVal.roster.team) {
                  cf.push(eventVal.events.eventid);
                } else {
                  ca.push(eventVal.events.eventid);
                }
                break;
              case 'MISS':
                if (eventVal.events.eventfor == playerVal.roster.team) {
                  cf.push(eventVal.events.eventid);
                  ff.push(eventVal.events.eventid);
                } else {
                  ca.push(eventVal.events.eventid);
                  fa.push(eventVal.events.eventid);
                }
                break;
              case 'SHOT':
                if (eventVal.events.eventfor == playerVal.roster.team) {
                  cf.push(eventVal.events.eventid);
                  ff.push(eventVal.events.eventid);
                  shf.push(eventVal.events.eventid);
                } else {
                  ca.push(eventVal.events.eventid);
                  fa.push(eventVal.events.eventid);
                  sha.push(eventVal.events.eventid);
                }
                break;
              case 'GOAL':
                if (eventVal.events.eventfor == playerVal.roster.team) {
                  cf.push(eventVal.events.eventid);
                  ff.push(eventVal.events.eventid);
                  shf.push(eventVal.events.eventid);
                  gf.push(eventVal.events.eventid);
                } else {
                  ca.push(eventVal.events.eventid);
                  fa.push(eventVal.events.eventid);
                  sha.push(eventVal.events.eventid);
                  ga.push(eventVal.events.eventid);
                }
                break;
              case 'HIT':
                if (eventVal.events.eventfor == playerVal.roster.team && eventVal.events.eventby == playerVal.roster.jerseynum) {
                  hit.push(eventVal.events.eventid);
                }
                break;
              case 'FAC':
                if (eventVal.events.eventfor == playerVal.roster.team && eventVal.events.fow == playerVal.roster.jerseynum) {
                  fow.push(eventVal.events.eventid);
                }
                if (eventVal.events.eventagainst == playerVal.roster.team && eventVal.events.fol == playerVal.roster.jerseynum) {
                  fol.push(eventVal.events.eventid);
                }
                break;
              case 'PENL':
                if (eventVal.events.eventfor == playerVal.roster.team && eventVal.events.eventby == playerVal.roster.jerseynum) {
                  ptk.push(eventVal.events.eventid);
                }
                if (eventVal.events.eventagainst == playerVal.roster.team && eventVal.events.drawnby == playerVal.roster.jerseynum) {
                  pdr.push(eventVal.events.eventid);
                }
                break;
              case 'GIVE':
              case 'TAKE':
                break;
            }
          }
        });
        if (actualevents) {
          playerData['cf'] = cf;
          playerData['ca'] = ca;
          playerData['ff'] = ff;
          playerData['fa'] = fa;
          playerData['shf'] = shf;
          playerData['sha'] = sha;
          playerData['gf'] = gf;
          playerData['ga'] = ga;
          playerData['hit'] = hit;
          playerData['fow'] = fow;
          playerData['fol'] = fol;
          playerData['ptk'] = ptk;
          playerData['pdr'] = pdr;
          addPlayerStats(playerData, (data) => {
          });
        }
      }
    });
  });
});