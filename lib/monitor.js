var util = require('util'),
    events = require('events');

function SteelmeshMonitor(server) {
    
}

util.inherits(SteelmeshMonitor, events.EventEmitter);

SteelmeshMonitor.prototype.start = function(callback) {
    callback();
};

module.exports = SteelmeshMonitor;