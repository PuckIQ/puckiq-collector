var request = require('request');
var cheerio = require('cheerio');
var playbyplay = require('./games/playbyplay');
var schedule = require('./games/schedule');
var players = require('./games/players');
var util = require('util');

var pxp = new playbyplay(request, cheerio);
var sched = new schedule(request);
var player = new players(request, cheerio);
