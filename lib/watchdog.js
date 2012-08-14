var async = require('async'),
    events = require('events'),
    fs = require('fs'),
    util = require('util'),
    path = require('path'),
    log = require('./helpers/log')('steelmesh-watchdog'),
    meshEvents = require('piper')('steelmesh'),
    _ = require('underscore'),
    appWorkers = {};

function Watchdog() {
    this.apps = {};
}

util.inherits(Watchdog, events.EventEmitter);

/**
  Read the package.json file for a given application
 **/
Watchdog.prototype._readPackageFile = function(app, callback) {
    var packageFile = path.join(app.basePath, 'package.json');
    
    // Check if it exists
    path.exists(packageFile, function(exists) {
       if (!exists) return callback();       
       
       // Read the file
       fs.readFile(packageFile, 'utf-8', function(err, data) {
           if (err) {
              return callback(err);
           }
           var result;
           try {
               console.log(data);
               result = JSON.parse(data);
               callback(null, result);
           } catch (ex) {
               callback(ex);
           }               
       });
    });
}

/**
  This causes the watchdog to attempt to load the application config,
  determine what scheme to use, and then start the scheme (which will
  then )
 **/
Watchdog.prototype._startScheme = function(steelmesh, app, callback) {
    log('start scheme');
    var watchdog = this,
        id = app.id;
    
    if (this.apps[id]) {
        return callback('Scheme already started');
    }    
    
    // Read the package.json file
    log('reading package file');
    this._readPackageFile(app, function(err, packageInfo) {
        if (err) {
            log('Unable to read package.json file [' + err + ']');
        } 
        app.config = packageInfo || {};
        var schemeType = 'oneonly',
            scheme;
        if (app.config.steelmesh && app.config.steelmesh.scheme) {
            schemeType = app.config.steelmesh.scheme;
        }
        
        try {
            scheme = require('./schemes/' + schemeType)(steelmesh, watchdog, app);
            log('loaded scheme ' + schemeType + ' for ' + id);
        } catch (ex) {
            var msg = 'Unable to load scheme ' + schemeType + ' [' + ex + ']';
            log(msg);
            return callback(msg)
        }        
        
        watchdog.apps[id] = scheme;
        scheme.start(callback);
    });
    
}

Watchdog.prototype.startApps = function(steelmesh, apploader, callback) {
    var watchdog = this;
    
    // iterate through the apploader apps and start each one
    async.forEach(
        apploader.apps,
        watchdog._startScheme.bind(watchdog, steelmesh),
        function(err) {
            if (! err) {
                // bind event listeners
                meshEvents.on('app.load', watchdog._startScheme.bind(watchdog, steelmesh));
            }
            
            log('finished starting applications');
            if (callback) {
                callback(err);
            }
        }
    );
};

module.exports = Watchdog;