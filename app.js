var htmlreports = require('./games/htmlreports');
var util = require('util');

var reports = new htmlreports();

reports.toi('20152016', '02', '0775', 'V', function(e) {
  console.log(util.inspect(e, false, null));
});

reports.toi('20152016', '02', '0775', 'H', function(e) {
  console.log(util.inspect(e, false, null));
});

reports.roster('20152016', '02', '0775', function(e) {
  console.log(util.inspect(e, false, null));
});

reports.playbyplay('20152016', '02', '0775', function(e) {
  console.log(util.inspect(e, false, null));
});
