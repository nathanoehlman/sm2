var async = require('async'),
    events = require('events'),
    util = require('util'),
    appEvents = require('piper')('steelmesh.app'),
    appWorkers = {};

function Watchdog() {
    
}

util.inherits(Watchdog, events.EventEmitter);

Watchdog.prototype._reloadApp = function(id, data) {
    // if we have app workers for the application schedule them to be relieved from 
};

Watchdog.prototype._startApp = function(id, data) {
    appEvents.emit('ready.' + id, id, data);
};

Watchdog.prototype.startApps = function(apploader, callback) {
    var watchdog = this;
    
    // bind event listeners
    appEvents.on('reload', this._reloadApp.bind(this));
    
    // iterate through the apploader apps and start each one
    async.forEach(
        apploader.apps,

        function(app, itemCallback) {
            // once ready trigger the callback
            appEvents.once('ready.' + app.id, function() {
                itemCallback();
            });
            
            watchdog._startApp(app.id, app);
        },
        
        callback
    );
};

module.exports = Watchdog;