var util = require('util'),
    events = require('events');

/**
The SteelmeshMonitor process has the following responsibilities:

- monitoring couch for steelmesh application updates (via ChangeMachine)
- monitoring couch for application database updates (via ChangeMachine)

In previous versions of steelmesh the monitor process also took some responsibilty
for monitoring overall process and system health but this responsibility has now
been delegated to the Watchdog.
*/
function SteelmeshMonitor(server) {
    
}

util.inherits(SteelmeshMonitor, events.EventEmitter);

SteelmeshMonitor.prototype.start = function(callback) {
    callback();
};

module.exports = SteelmeshMonitor;