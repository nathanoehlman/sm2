var async = require('async'),
    events = require('events'),
    util = require('util'),
    path = require('path'),
    fs = require('fs'),
    debug = require('debug')('steelmesh'),
    supercomfy = require('supercomfy'),
    Apploader = require('./apploader'),
    SteelmeshMonitor = require('./monitor'),
    out = require('out'),
    sprechen = require('sprechen'),
    _ = require('underscore'),
    
    _configPath = path.resolve(__dirname, '../config'),
    
    DEFAULT_CONFIG = {
        url: 'http://localhost:5984/',
        dbname: 'steelmesh',
        locale: 'en_US'
    };
    
function SteelmeshServer() {
    this.config = {};
};

util.inherits(SteelmeshServer, events.EventEmitter);

SteelmeshServer.prototype.configure = function(opts, callback) {
    var server = this,
        configFile = path.join(_configPath, 'default.json');
        
    // read the config file
    debug('attempting to read configuration file: ' + configFile);
    fs.readFile(configFile, 'utf8', function(err, data) {
        if (err) {
            return callback(err);
        }
        else {
            try {
                server.config = _.extend(JSON.parse(data), opts);
            }
            catch (e) {
                return callback(e);
            }
            
            debug('config loaded successfully', server.config);
            return callback(null, server.config);
        }
    });
};


SteelmeshServer.prototype.connect = function(callback) {
    var server = this,
        config = _.defaults(this.config, DEFAULT_CONFIG),
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
    
    sprechen(path.join(_configPath, 'messages'), this.config.locale, function(messages) {
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
        
        // configure the server based on the contents of the JSON file
        server.configure.bind(server, opts),
        
        // connect to the couchserver
        server.connect.bind(server),
        
        // load new messages using the locale loaded from the config
        server.loadMessages.bind(server),

        // start the dashboard
        server.startDash.bind(server, opts),
        
        // load the apps
        apploader.run.bind(apploader),
        
        // start the monitor
        monitor.start.bind(monitor)
    ], function(err) {
        if (err) {
            out('!{red}{0}', err);
            process.exit();
        }
    });
    
    
    // return the server instance
    return server;
};