var async = require('async'),
    events = require('events'),
    util = require('util'),
    piper = require('piper'),
    meshEvents = piper('steelmesh'),    
    squirrel = require('squirrel'),
    log = require('../helpers/log')('steelmesh-seamless'),
    launcher = require('../launcher'),
    _ = require('underscore');


/**
  The Seamless application scheme is an 'always up' model of application. It will
  keep the existing application running until such a time as an updated application is ready,
  and then switch over
 **/
function SeamlessScheme (steelmesh, watchdog, app) {    
    
    var scheme = this;
    
    this.steelmesh = steelmesh;
    this.watchdog = watchdog;
    this.app = app;
    this.old = [];
    this.current = null;
    
    // this.steelmesh.on('shutdown', this.stop.bind(this));
    
    meshEvents.on('app.load.' + this.app.id, this._startSeamlessly.bind(this));
    
    // Handle application updates (run the new version, stop the old)
    meshEvents.on('app.update.' + this.app.id, function(callback) { return callback(); } );
    
    // Handle steelmesh shutdowns
    meshEvents.on('shutdown', function(register) {
        if (scheme.current) {
            register(scheme.app.id + '::shutdown', scheme.stop.bind(scheme));
        }
    });
}
util.inherits(SeamlessScheme, events.EventEmitter);

/**
  Attempts to start the application instance.
 **/
SeamlessScheme.prototype._startNewInstance = function(callback) {
    
    var scheme = this;
    
    log('Start instance');
    // Launch the application instance
    launcher.startInstance(this.app, function(err, instance) {
        if (err) {
            return callback(err);
        }
        // Register events
        instance.on('exit', function() {
            scheme.instance = null;
            if (instance.state != 'stopping') {                
                log('Instance terminated unexpectedly - recovering...');
                return scheme._startSeamlessly();
            }            
            log('Instance exited');            
        });
        callback(err, instance);
    });
}

/**
  Starts the scheme
 **/
SeamlessScheme.prototype.start = function(callback) {
    this._startSeamlessly();
}

/**
  Handles the on load event
 **/
SeamlessScheme.prototype._startSeamlessly = function(app) {
    var scheme = this;
    
    // Allow the app definition to be updated
    if (app) {
        this.app = app;
    }
    
    log('_startSeamlessly');
    // Load any necessary plugins to attach
    this._preparePlugins(function() {
        // Start the application instance    
        scheme._startNewInstance(function(err, instance) {
            if (err) {
                meshEvents.emit('app.error.' + scheme.app.id, scheme.app, err);
                return;
            }                            

            if (scheme.plugins) {
                instance.plugins = [];
                scheme.plugins.forEach(function(plugin) {
                    try {
                        instance.plugins.push(plugin(instance));
                    } catch (err) {
                        log(err);
                    }                    
                });
            }
            
            // Listen for notification from the child
            instance.on('message.steelmesh.client.up', function(message, handle) {
                log('New application instance responding on port ' + message.port);
                scheme.stop(function() {
                });            
                meshEvents.emit('app.ready.' + scheme.app.id, scheme.app);
                scheme.current = instance;
            });

            // Allow for a child to prevent auto recovery
            instance.on('message.steelmesh.client.stop', function(message, handle) {
                instance.state = 'stopping';
            });      
        });
    });    
}

/**
  Prepares plugins for use
 **/
SeamlessScheme.prototype._preparePlugins = function(callback) {
    
    log('Preparing plugins');
    var meshConfig = this.app.steelmesh,
        scheme = this;    
    this.plugins = [];    
    if (meshConfig && meshConfig.plugins) {
        async.forEach(
            meshConfig.plugins,
            function(plugin, done) {
                log('Installing ' + plugin.plugin);
                squirrel(plugin.plugin, {allowInstall: true}, function(err, library) {
                    if (err) {
                        log(plugin.plugin + ' plugin could not be loaded. [' + err + ']');
                    } else {
                        log(plugin.plugin + ' available');
                        scheme.plugins.push(library.bind(library, scheme.steelmesh, plugin));
                    }
                    done();
                });
            },
            function(err) {
                log('Plugins prepared. ' + (err ? 'Error = [' + err + ']' : ''));
                callback();
            }
        );
    } else {
        callback();
    }
}

/**
  Stops the currently running instance
 **/
SeamlessScheme.prototype.stop = function(callback) {
    
    var scheme = this,
        instance = this.current;
    // Check if there is an instance to stop
    if (!instance) {
        return (callback ? callback() : null);
    }
    log('Stop running instance');
    this.old.push(instance);
    this.current = null;
    // Stops the instance
    instance.stop(function(code, signal) {
        delete instance;
        log('Old instance stopped');
        callback();
    });
}

module.exports = function(steelmesh, watchdog, app) {
    return new SeamlessScheme(steelmesh, watchdog, app);
}