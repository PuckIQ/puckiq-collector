var request = require('request');
var cheerio = require('cheerio');
var playbyplay = require('./games/playbyplay');
var schedule = require('./games/schedule');
var players = require('./games/players');
var util = require('util');

var pxp = new playbyplay(request, cheerio);
var sched = new schedule(request);
var player = new players(request, cheerio);

/*pxp.playbyplay('20142015','02','0002', function(e) {
  console.log(util.inspect(e, false, null));
});*/

/*sched.seasonschedule('20142015', function(e) {
  console.log(util.inspect(e, false, null));
})*/

player.playerpage('8470621', function(e) {
  console.log(util.inspect(e, false, null));
})
