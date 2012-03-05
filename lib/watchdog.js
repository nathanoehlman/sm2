var async = require('async'),
    events = require('events'),
    util = require('util'),
    path = require('path'),
    log = require('./helpers/log')('steelmesh-watchdog'),
    meshEvents = require('piper')('steelmesh'),
    _ = require('underscore'),
    appWorkers = {};

function Watchdog() {
    this.apps = [];
}

util.inherits(Watchdog, events.EventEmitter);

Watchdog.prototype._createWorkers = function(app, steelmesh, callback) {
    var serverFile = path.join(app.basePath, 'server.js'),
        watchdog = this;
    
    // find the application files that exist
    path.exists(serverFile, function(exists) {
        var launcher;
        
        // if we have a server.js file then we have a custom standalone application
        if (exists) {
            launcher = require('./launchers/standalone');
        }
        // otherwise if we have application routes, then run the mesh app launcher
        else if (app.routes) {
            launcher = require('./launchers/meshapp');
        }
        // otherwise, use the noop launcher
        else {
            launcher = require('./launchers/noop');
        }
        
        // if we have a launcher, then run the application
        if (typeof launcher == 'function') {
            launcher.call(null, steelmesh, watchdog, app, function(err, instance) {
                /*
                if (instance) {
                    instance.listen(3000);
                }
                */
                
                // console.log(instance);
                callback(err);
            });
        }
        else {
            callback(new Error('No valid launcher found for app: ' + app.id));
        }
    });
};

Watchdog.prototype._startApp = function(steelmesh, app, callback) {
    // look to see if the application is already running
    var running = _.find(this.apps, function(item) {
            return item.id === app.id;
        }),
        
        tasks = [this._createWorkers.bind(this, app, steelmesh)];
        
    if (running) {
        tasks.unshift(this._shutdownApp.bind(this, running));
    }
        
    log('starting application: ' + app.id);
    async.series(tasks, function(err) {
        meshEvents.emit('app.ready.' + app.id, app);
        
        if (callback) {
            callback(err, app);
        }
    });
};

Watchdog.prototype._shutdownApp = function(instance, callback) {
    callback();
};

Watchdog.prototype.startApps = function(steelmesh, apploader, callback) {
    var watchdog = this;
    
    // iterate through the apploader apps and start each one
    async.forEach(
        apploader.apps,
        watchdog._startApp.bind(this, steelmesh),
        function(err) {
            if (! err) {
                // bind event listeners
                meshEvents.on('app.load', watchdog._startApp.bind(watchdog, steelmesh));
            }
            
            log('finished starting applications');
            if (callback) {
                callback(err);
            }
        }
    );
};

module.exports = Watchdog;