var async = require('async'),
    log = require('./helpers/log')('steelmesh-apploader'),
    attachmate = require('attachmate'),
    fstream = require('fstream'),
    config = require('config'),
    dbUrl = config.couchurl.replace(/\/$/, '') + '/' + config.meshdb,
    path = require('path'),
    util = require('util'),
    events = require('events'),
    nano = require('nano'),
    _ = require('underscore'),
    piper = require('piper'),
    rimraf = require('rimraf'),
    meshEvents = piper('steelmesh'),
    reProtected = /^\/(app\.js|package\.json|lib|node_modules|resources|views)/i;

function Apploader(steelmesh) {
    this.apps = [];
    this.steelmesh = steelmesh;
}

Apploader.prototype._refreshStatic = function(app, callback) {
    
    var srcPath = app.basePath,
        targetPath = path.join(this.steelmesh.pathStatic, path.basename(srcPath));
        
    log('copying ' + app.id + ' static resources: ' + srcPath + ' => ' + targetPath);
    path.exists(srcPath, function(exists) {
        if (! exists) {
            return callback();
        }
        
        // clean out the static files for the application, and then load
        rimraf(targetPath, function(err) {
            if (! err) {
                // read valid application files
                fstream.Reader({
                    type: 'Directory',
                    path: srcPath,

                    // copy only the files that exist outside of the protected areas
                    filter: function() {
                        return !reProtected.test(this.path.slice(srcPath.length));
                    }
                })

                .on('error', callback)

                // pipe them to the _static directory
                .pipe(fstream.Writer({
                    type: 'Directory',
                    path: targetPath
                }))

                .on('error', function(err) {
                    // TODO: handle this well...
                    log.error(err);
                })
                .on('end', callback);
            }
            else {
                callback(err);
            }
        });
    });
};

Apploader.prototype.load = function(db, dbid, app, callback) {
    var apploader = this,
        docUrl = dbUrl + '/' + dbid;
        
    log('synchronizing ' + docUrl + ' with local application cache (' + app.basePath + ')');
    async.series([
        // download the couch attachments to the _apps directory
        attachmate.download.bind(null, docUrl, app.basePath),
        
        // move static resources
        this._refreshStatic.bind(this, app)
    ], function(err) {
        if (!err) {
            log('finished synchronizing: ' + app.id);
            apploader.apps.push(app);
            
            // Emit the load event
            meshEvents.emit('app.load.' + app.id, app);
            log('app.load.' + app.id);
        }
        
        if (callback) {
            callback(err);
        }
    });
};

/**
  Cleans up the application resources for the application
  indicated by id'
 **/
Apploader.prototype.clean = function(id, callback) {
    var apploader = this,
        steelmesh = this.steelmesh,
        app = _.find(apploader.apps, function(item) {
            return item._id === id;
        });

    if (app) {
        async.parallel([
            rimraf.bind(null, app.basePath),
            rimraf.bind(null, path.join(steelmesh.pathStatic, path.basename(app.basePath)))
        ], function(err) {
            log('cleaned up application (' + id + ') resource files');
            if (callback) {
                callback(err);
            }
        });
    } else {
        if (callback) {
            callback();
        }
    }
}

Apploader.prototype.run = function(callback) {
    var apploader = this,
        db = nano(config.couchurl).use(config.meshdb),
        steelmesh = this.steelmesh,
        appPrefix = steelmesh.appPrefix;
        
    // listen for application updates
    meshEvents.on('app.reload', function(id, data) {
        log('update received for application ' + id);
        meshEvents('status', 'resyncing');
        
        meshEvents.emit('app.update.' + id, function(err) {
            if (err) {
                return log('Could not load - unable to unload existing application');
            }
            
            // Clean up the application
            apploader.clean(id, function() {
                // load the application
                apploader.load(db, id, data, function() {
                    meshEvents('status', 'online');
                });
            });
            
        });
    });

    meshEvents.on('app.unload', apploader.clean.bind(apploader));
            
    // list the applications
    db.list(function(err, res) {
        if (err) {
            callback(err);
        }
        else {
            // get only the application rows
            var rows = _.filter(res.rows, function(row) {
                return row.id.slice(0, appPrefix.length) === appPrefix;
            });
            
            meshEvents('status', 'loading');

            // initialise the list of stack apps
            async.forEach(
                rows,
                
                function(row, itemCallback) {
                    log('getting app details for appid: ' + row.id);
                    db.get(row.id, function(err, res) {
                        if (err) {
                            itemCallback(err);
                        }
                        else {
                            // remove the attachments from the list
                            delete res._attachments;
                            
                            // load the application
                            apploader.load(db, row.id, apploader.steelmesh.initApp(res), itemCallback);
                        }
                    });
                },
                
                function(err) {
                    log('finished application loading, err: ', err);
                    if (!err) {
                        meshEvents()
                    }
                    callback(err);
                }
            );
        }
    });
};

module.exports = Apploader;