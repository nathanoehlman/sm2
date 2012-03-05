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
};

util.inherits(SteelmeshServer, events.EventEmitter);

SteelmeshServer.prototype.connect = function(callback) {
    var server = this,
        couch = this.couch = nano(config.url, config),
        db = this.db = couch.use(config.dbname);
    
    log('checking steelmesh db connection');
    db.info(function(err, details) {
        if (err) {
            log('no database - attempting create');
            couch.create(config.dbname, function(err, details) {
                if (err) {
                    log.error('error attempting creation', err);
                    callback(server.error('cannot_create_steelmesh'));
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

SteelmeshServer.prototype.startDash = function(opts, callback) {
    var server = this,
        dashboard;
    
    log('attempting to start dashboard');
    
    try {
        // attempt to get the dashboard
        dashboard = server.dashboard = require('steelmesh-dash');
    }
    catch (e) {
        log('error starting dashboard: ' + e);
    }
    
    // if we have a dashboard, then start it
    if (dashboard) {
        // update the config and log members of the dash
        dashboard.log = log;
        dashboard.config = config;
        
        // start the dashboard
        dashboard.start(this, callback);
    }
    else {
        callback();
    }
};

SteelmeshServer.prototype.on = meshEvents.on.bind(meshEvents);

// check that we have a steelmesh database
module.exports = function(opts) {
    var steelmesh = new SteelmeshServer(),
        apploader = new Apploader(steelmesh),
        monitor = new SteelmeshMonitor(steelmesh);
        
    meshEvents('status', 'initialized');
    
    async.series([
        // load the messages for the default locale
        steelmesh.loadMessages.bind(steelmesh),
        
        // connect to the couchserver
        steelmesh.connect.bind(steelmesh),
        
        // load new messages using the locale loaded from the config
        steelmesh.loadMessages.bind(steelmesh),

        // start the dashboard
        steelmesh.startDash.bind(steelmesh, opts),
        
        // start the monitor
        monitor.start.bind(monitor),

        // load the apps
        apploader.run.bind(apploader),
        
        // start the applications
        steelmesh.watchdog.startApps.bind(steelmesh.watchdog, apploader)
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