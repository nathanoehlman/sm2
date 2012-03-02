var async = require('async'),
    debug = require('debug')('apploader'),
    attachmate = require('attachmate'),
    fstream = require('fstream'),
    config = require('config'),
    dbUrl = config.url.replace(/\/$/, '') + '/' + config.dbname,
    path = require('path'),
    pathApps = path.resolve(__dirname, '../_apps'),
    pathStatic = path.resolve(__dirname, '../_static'),
    util = require('util'),
    events = require('events'),
    supercomfy = require('supercomfy'),
    _ = require('underscore'),
    reProtected = /^\/[^\/]*\/(app\.js|package\.json|lib|node_modules|resources|views)/i,
    _appPrefix = 'app::';

function Apploader() {
    this.apps = [];
}

Apploader.prototype._refreshStatic = function(callback) {
    // read valid application files
    fstream.Reader({
        type: 'Directory',
        path: pathApps,

        // copy only the files that exist outside of the protected areas
        filter: function() {
            return !reProtected.test(this.path.slice(pathApps.length));
        }
    })
    
    .on('error', callback)
    
    // pipe them to the _static directory
    .pipe(fstream.Writer({
        type: 'Directory',
        path: pathStatic
    }))
    
    .on('error', callback)
    .on('end', callback);
};

Apploader.prototype.load = function(db, item, callback) {
    debug('synchronizing application "' + item.id + '" with local application cache');
    async.series([
        /*
        // download the couch attachments to the _apps directory
        attachmate.download.bind(
            null,
            dbUrl + '/' + item.id,
            path.resolve(__dirname, '../_apps/' + item.id.slice(_appPrefix.length))
        ),
        */
        
        // move static resources
        this._refreshStatic.bind(this)
    ], callback);
};

Apploader.prototype.run = function(callback) {
    var apploader = this,
        db = supercomfy(config.url).use(config.dbname);
    
    // list the applications
    db.list(function(err, res) {
        if (err) {
            callback(err);
        }
        else {
            // get only the application rows
            var rows = _.filter(res.rows, function(row) {
                return row.id.slice(0, _appPrefix.length) === _appPrefix;
            });
            
            // initialise the list of stack apps
            async.forEach(
                rows,
                
                function(row, itemCallback) {
                    debug('getting app details for appid: ' + row.id);
                    db.get(row.id, function(err, res) {
                        if (err) {
                            itemCallback(err);
                        }
                        else {
                            apploader.load(db, row, itemCallback);
                        }
                    });
                },
                
                function(err) {
                    console.log('finished load, err: ', err);
                    callback(err);
                }
            );

            // If no apps available, signal ready
            if (rows.length <= 0) {
                callback(null);
            }
        }
    });
};

module.exports = Apploader;