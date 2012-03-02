var events = require('events'),
    util = require('util');

function Watchdog() {
    
}

util.inherits(Watchdog, events.EventEmitter);

Watchdog.prototype.startApps = function(apploader, callback) {
    callback();
};

module.exports = Watchdog;