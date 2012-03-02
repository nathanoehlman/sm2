var async = require('async'),
    config = require('config'),
    events = require('events'),
    util = require('util'),
    path = require('path'),
    fs = require('fs'),
    debug = require('debug')('steelmesh'),
    meshEvents = require('piper')('steelmesh'),
    supercomfy = require('supercomfy'),
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
};

util.inherits(SteelmeshServer, events.EventEmitter);

SteelmeshServer.prototype.connect = function(callback) {
    var server = this,
        couch = this.couch = supercomfy(config.url, config),
        db = this.db = couch.use(config.dbname);
    
    debug('checking steelmesh db connection');
    db.info(function(err, details) {
        if (err) {
            debug('no database - attempting create');
            couch.create(config.dbname, function(err, details) {
                if (err) {
                    debug('error attempting creation', err);
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

SteelmeshServer.prototype.error = function(errorId) {
    var message = this.messages[errorId] || errorId;
    
    debug('error: ' + message);
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
    var server = this;
    
    try {
        require('steelmesh-dash').start(this, opts, function(err, dashboard) {
            if (! err) {
                server.dashboard = dashboard;
            }
            
            callback(err, dashboard);
        });
    }
    catch (e) {
        callback();
    }
};

// check that we have a steelmesh database
module.exports = function(opts) {
    var server = new SteelmeshServer(),
        apploader = new Apploader(server),
        monitor = new SteelmeshMonitor(server);
    
    async.series([
        // load the messages for the default locale
        server.loadMessages.bind(server),
        
        // connect to the couchserver
        server.connect.bind(server),
        
        // load new messages using the locale loaded from the config
        server.loadMessages.bind(server),

        // start the dashboard
        server.startDash.bind(server, opts),
        
        // start the monitor
        monitor.start.bind(monitor),

        // load the apps
        apploader.run.bind(apploader),
        
        // start the applications
        server.watchdog.startApps.bind(server.watchdog, apploader)
    ], function(err) {
        if (err) {
            out('!{red}{0}', err);
            process.exit();
        }
    });
    
    
    // return the server instance
    return server;
};