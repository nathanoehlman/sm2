var async = require('async'),
    events = require('events'),
    util = require('util'),
    log = require('../helpers/log')('steelmesh-oneonly'),
    launcher = require('../launcher'),
    _ = require('underscore');


/**
  The OneOnly application scheme is the traditional method of handling
  Steelmesh application updates. When an application is updated, any existing
  instance of the application running under the Steelmesh instance is shutdown,
  and a new one started to replace it
 **/
function OneOnlyScheme (steelmesh, watchdog, app) {    
    this.steelmesh = steelmesh;
    this.watchdog = watchdog;
    this.app = app;
    this.instance = null;
}
util.inherits(OneOnlyScheme, events.EventEmitter);

/**
  Starts the scheme (ie. load the initial instance of the application 
  and respond to update events)
 **/
OneOnlyScheme.prototype.start = function(callback) {
    
    var scheme = this,
        tasks = [this._startInstance.bind(this)];
    
    // Add a task to stop the existing instance first if required    
    if (this.instance) {
        tasks.unshift(this.stop.bind(this));
    }
        
    // Run the startup tasks
    log('starting application: ' + this.app.id);
    async.series(tasks, function(err) {
        meshEvents.emit('app.ready.' + this.app.id, this.app);
        
        if (callback) {
            callback(null, app);
        }
    });
    
    this.steelmesh.on('shutdown', this.stop.bind(this));
}

/**
  Attempts to start the application instance.
 **/
OneOnlyScheme.prototype._startInstance = function(callback) {
    
    if (this.instance) {
        return callback('Instance already running');
    }
    
    var scheme = this;
    
    log('Start instance');
    // Launch the application instance
    launcher.startInstance(this.app, function(err, instance) {
        if (err) {
            return log('Could not start instance [' + err + ']');
        }
        scheme.instance = instance;
        // Register events
        instance.on('exit', function() {
            log('Instance exited');
            scheme.instance = null;
        });
    });
}

/**
  Stops the currently running instance
 **/
OneOnlyScheme.prototype.stop = function(callback) {
    
    var scheme = this;
    log('Stop instance');
    // Check if there is an instance to stop
    if (!this.instance) {
        return callback();
    }
    // Stops the instance
    this.instance.stop(function(code, signal) {
        log('Stopped');
        scheme.instance = null;
        callback();
    });
}

module.exports = function(steelmesh, watchdog, app) {
    return new OneOnlyScheme(steelmesh, watchdog, app);
}