var async = require('async'),
    child_process = require('child_process'),
    events = require('events'),
    log = require('../helpers/log')('launcher-standalone'),
    piper = require('piper'),
    meshEvents = piper('steelmesh'),
    util = require('util');

/**
  The StandaloneApplication spawns a Node.js application in its own process,
  and then can communicate information to the process via the inbuilt communication
  channel
 **/
function StandaloneApplication(app, opts, callback) {

    var myself = this;
    
    // Check the options
    if (!opts || !opts.serverFile) {
        return callback('No server file available');
    }    
    this.app = app;
    this.opts = opts;
    this.child = null;    
    
    async.series([
            this._prepare.bind(this),
            this._start.bind(this)
        ],
        function(err) {
            if (err) {
                return callback(err);
            }
            callback(null, myself);
        }
    );
}
util.inherits(StandaloneApplication, events.EventEmitter);

/**
  Attempts to prepare the application (ie. install dependencies)
 **/
StandaloneApplication.prototype._prepare = function(callback) {
    // Check if we've got package data
    if (!this.opts.packageInfo) return callback();
    
    log('Installing NPM dependencies');
    child_process.exec(
        'npm install', 
        {
            cwd: this.app.basePath
        },
        function (err, stdout, stderr) {
            callback(err);
        }
    );
}

/**
  Launch the application
 **/
StandaloneApplication.prototype._start = function(callback) {
        
    this.child = child_process.fork(this.opts.serverFile, {cwd: this.app.basePath});
    this.child.on('message', this._handleMessage.bind(this));
    this.child.on('exit', this.emit.bind(this, 'exit'));
    
    callback();
    
}

/**
  Stop the application
 **/
StandaloneApplication.prototype.stop = function(callback) {
    if (this.child) {
        this.child.once('exit', function(code, signal) {
            callback();
        });
        this.child.kill();
    } else {
        callback();
    }
}

/**
  Handles a message from the child process
 **/
StandaloneApplication.prototype._handleMessage = function(message, handle) {
    
}

module.exports = function(steelmesh, watchdog, app, opts, callback) {
    return new StandaloneApplication(steelmesh, watchdog, app, opts, callback);
}