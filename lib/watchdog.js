var async = require('async'),
    events = require('events'),
    util = require('util'),
    log = require('./helpers/log')('steelmesh-watchdog'),
    meshEvents = require('piper')('steelmesh'),
    appWorkers = {};

function Watchdog() {
    
}

util.inherits(Watchdog, events.EventEmitter);

Watchdog.prototype._startApp = function(app) {
    log('(re)starting app: ' + app.id);
    
    console.log(app.basePath);
    
    meshEvents.emit('app.ready.' + app.id, app);
};

Watchdog.prototype.startApps = function(apploader, callback) {
    var watchdog = this;
    
    // iterate through the apploader apps and start each one
    async.forEach(
        apploader.apps,

        function(app, itemCallback) {
            // once ready trigger the callback
            meshEvents.once('app.ready.' + app.id, function() {
                itemCallback();
            });
            
            watchdog._startApp(app);
        },

        function(err) {
            if (! err) {
                // bind event listeners
                meshEvents.on('app.load', watchdog._startApp.bind(this));
            }
            
            if (callback) {
                callback(err);
            }
        }
    );
};

module.exports = Watchdog;