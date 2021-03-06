var async = require('async'),
    config = require('config'),
    events = require('events'),
    util = require('util'),
    path = require('path'),
    fs = require('fs'),
    log = require('./helpers/log')('steelmesh'),
    piper = require('piper'),
    meshEvents = piper('steelmesh'),
    nano = require('nano'),
    Apploader = require('./apploader'),
    SteelmeshMonitor = require('./monitor'),
    Watchdog = require('./watchdog'),
    PortAllocator = require('./allocator'),
    out = require('out'),
    sprechen = require('sprechen'),
    _ = require('underscore'),
    
    _configPath = path.resolve(__dirname, '../config');
    
function SteelmeshServer() {
    this.watchdog = new Watchdog();
    this.config = config;
    
    this.pathApps = path.resolve(__dirname, (config.paths || {}).apps || '../_apps');
    this.pathStatic = path.resolve(__dirname, (config.paths || {})['static'] || '../_static');
    this.appPrefix = config.appPrefix || 'app::';
    
    /*
    meshEvents.on('operations.restart', function(opts) {
        out('!{red}{0}', 'Restarting steelmesh');        
        opts = opts || {};
        if (opts.dashboard) {
            // Stop and start dashboard
            // TODO
        }
        
        // Stop and start apps
        // TODO
    });
    */
    
    process.on( 'SIGINT', function() {
      log( "Shutting down Steelmesh" );
      var shutdownHandlers = [];
      
      // Allow handlers to report that they require shutdown time
      function shutdownRegister(name, handler) {
          if (name && handler) {
              shutdownHandlers.push({name: name, handler: handler});
          }
      }
      
      meshEvents.emit('shutdown', shutdownRegister);
      
      // Process the shutdown handlers and shutdown when finished
      if (shutdownHandlers.length > 0) {
          log('Running shutdown handlers');
          async.forEach(
              shutdownHandlers, 
              function(handler, callback) {
                  log('Finishing - ' + handler.name);
                  handler.handler(callback);
              },
              function(err) {
                  log('Shutdown complete ' + (err ? err : ''));
                  process.exit();
              }
          );
      } else {
          log('Terminate immediately');
          // Exit immediately
          process.exit();
      }      
      
    });
};

util.inherits(SteelmeshServer, events.EventEmitter);

SteelmeshServer.prototype.bridgeEvents = function(callback) {
    async.forEach(
        config.bridges || [],
        function(bridge, itemCallback) {
            var handler,
                capturedException;
            
            try {
                handler = require('steelmesh-bridge-' + bridge);
            }
            catch (e) {
                capturedException = e;
            }
                
            if (typeof handler == 'function') {
                handler(steelmesh, piper, itemCallback);
            }
            else {
                log.warn('Unable to include the steelmesh ' + bridge + 
                    ' bridge, try npm install steelmesh-bridge-' + bridge + ' to enable', capturedException);
                    
                itemCallback();
            }
        },
        callback
    );
};

SteelmeshServer.prototype.connect = function(callback) {
    var server = this,
        couch = this.couch = nano(config.couchurl, config),
        db = this.db = couch.use(config.meshdb),
        attempt = 0,
        maxAttempts = 3;
    
    log('checking steelmesh db connection');
    function checkDb() {
        db.info(function(err, details) {
            if (err) {
                log('no database - attempting create');
                var adminCouch = (config.admin ? nano(config.admin.url, config) : couch);
                adminCouch.db.create(config.meshdb, function(err, details) {
                    if (err) {
                        log.error('error attempting creation', err);
                        attempt++;
                        if (attempt >= maxAttempts) {
                            callback(server.error('cannot_create_steelmesh'));
                        } else {
                            checkDb();
                        }                        
                    }
                    else {
                        callback(null, db);
                    }
                });
            }
            else {
                callback(err, details);
            }
        });
    }
    checkDb();
};

SteelmeshServer.prototype.initApp = function(opts) {
    var appId = (opts._id || '').slice(this.appPrefix.length),
        app = _.extend({}, opts, {
            id: opts.id || appId,
            basePath: path.join(this.pathApps, appId)
        });
        
    // if the application has a mountpoint, then update the basePath
    if (app.mountpoint) {
        app.basePath = path.join(this.pathApps, app.mountpoint);
    }
        
    return app;
};

SteelmeshServer.prototype.error = function(errorId) {
    var message = this.messages[errorId] || errorId;
    
    log.error(message);
    return new Error(message);
};

SteelmeshServer.prototype.loadApps = function(callback) {
    callback();
};

SteelmeshServer.prototype.loadMessages = function(callback) {
    var server = this;
    
    sprechen(path.join(_configPath, 'messages'), config.locale, function(messages) {
        server.messages = messages;
        callback();
    });
};

SteelmeshServer.prototype.on = meshEvents.on.bind(meshEvents);

// check that we have a steelmesh database
module.exports = function(opts) {
    var steelmesh = new SteelmeshServer(),
        apploader = new Apploader(steelmesh),
        monitor = new SteelmeshMonitor(steelmesh),
        allocator = new PortAllocator(steelmesh);
        
    meshEvents('status', 'initialized');
    
    async.series([
        // bridge events across to other processes if setup
        steelmesh.bridgeEvents.bind(steelmesh),
        
        // load the messages for the default locale
        steelmesh.loadMessages.bind(steelmesh),
        
        // connect to the couchserver
        steelmesh.connect.bind(steelmesh),
        
        // load new messages using the locale loaded from the config
        steelmesh.loadMessages.bind(steelmesh),
        
        // Start the port allocator
        allocator.start.bind(allocator),

        // start the monitor
        monitor.start.bind(monitor),

        // load the apps
        apploader.run.bind(apploader),
        
        // start the applications
        steelmesh.watchdog.startApps.bind(steelmesh.watchdog, steelmesh, apploader)
    ], function(err) {
        if (err) {
            out('!{red}{0}', err);
            process.exit();
        }
        else {
            out('!{green}steelmesh started');
            meshEvents('status', 'online');
        }
    });
    
    
    // return the server instance
    return steelmesh;
};

meshEvents.on('*', function() {
    log('captured event: ' + piper.eve.nt());
});



/*
process.on('uncaughtException', function(err) {
    log.error(err);
});
*/