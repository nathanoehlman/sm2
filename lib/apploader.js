var async = require('async'),
    log = require('./helpers/log')('steelmesh-apploader'),
    attachmate = require('attachmate'),
    fstream = require('fstream'),
    config = require('config'),
    dbUrl = config.url.replace(/\/$/, '') + '/' + config.dbname,
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

Apploader.prototype._refreshStatic = function(appId, callback) {
    
    var srcPath = path.join(this.steelmesh.pathApps, appId),
        targetPath = path.join(this.steelmesh.pathStatic, appId);
        
    log('copying ' + appId + ' static resources: ' + srcPath + ' => ' + targetPath);
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
        
    
    meshEvents('status', 'loading');

    log('synchronizing ' + docUrl + ' with local application cache (' + app.basePath + ')');
    async.series([
        // download the couch attachments to the _apps directory
        attachmate.download.bind(null, docUrl, app.basePath),
        
        // move static resources
        this._refreshStatic.bind(this, app.id)
    ], function(err) {
        if (!err) {
            log('finished synchronizing: ' + app.id);
            apploader.apps.push(app);
            
            // Emit the load event
            meshEvents.emit('app.load', app);
        }
        
        if (callback) {
            callback(err);
        }
    });
};

Apploader.prototype.run = function(callback) {
    var apploader = this,
        db = nano(config.url).use(config.dbname),
        appPrefix = this.steelmesh.appPrefix;
    
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
                    callback(err);
                }
            );

            // If no apps available, signal ready
            if (rows.length <= 0) {
                callback(null);
            }
        }
    });
    
    // listen for application updates
    meshEvents.on('app.reload', function(id, data) {
        console.log(arguments);
        
        // load the application
        apploader.load(db, id, apploader.steelmesh.initApp(data));
    });
};

module.exports = Apploader;