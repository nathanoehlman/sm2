var util = require('util'),
    events = require('events'),
    cm = require('changemachine'),
    debug = require('debug')('monitor'),
    path = require('path'),
    piper = require('piper'),
    appEvents = piper('app'),
    _ = require('underscore'),
    _jsonStore = new cm.JsonStore(path.resolve(__dirname, '../changemachine.json')),
    appPrefix = 'app::',
    reTrailingSlash = /\/$/;

/**
# Steelmesh Monitor

The SteelmeshMonitor process has the following responsibilities:

- monitoring couch for steelmesh application updates (via ChangeMachine)
- monitoring couch for application database updates (via ChangeMachine)

In previous versions of steelmesh the monitor process also took some responsibilty
for monitoring overall process and system health but this responsibility has now
been delegated to the Watchdog.

## Monitoring Application DB Updates

As steelmesh is designed to function primarily as a Node + CouchDB application 
platform it provides first class support for dealing with the Couch updates interface. 
While listening for steelmesh application updates (against the `steelmesh` db) is done
automatically, updates against other application databases is only done when requested 
by an application.

An application can register to listen for updates through the `couchdb` section in the
application configuration, e.g.

```js
couchdb: {
    // specify the target db
    lbs: {
        autoCreate: true,
        onChange: '/lbs-change'
    }
}
```
*/
function SteelmeshMonitor(server) {
    
    this.server = server;
    this._watchers = {};
    
}

util.inherits(SteelmeshMonitor, events.EventEmitter);

SteelmeshMonitor.prototype.start = function(callback) {
    debug('starting monitor');
    this._monitorSteelmesh();
    this._monitorApps();
    callback();
};

/**
  Monitor Steelmesh for application updates
 **/
SteelmeshMonitor.prototype._monitorSteelmesh = function() {
    
    var restartTimer = 0,
        config = this.server.config,
        targetUrl = config.url.replace(reTrailingSlash, '') + '/' + config.dbname,
        opts = {
            type: 'couchdb',
            storage: _jsonStore
        },
        machine = new cm.Machine(targetUrl, opts),
        self = this;
        
    debug('attempting to monitor steelmesh @ ' + targetUrl);
    
    machine.on('process', function(item) {
        // only handle application changes
        if (item && item.id && item.id.slice(0, appPrefix.length) === appPrefix) {
            debug('captured application update for app: ' + item.id);
            
            clearTimeout(restartTimer);
            restartTimer = setTimeout(function() {
                self.emit('steelmesh-restart', { dashboard: true });
            }, 1000);
            
            // mark the item as done
            item.done();
        }
        // otherwise, skip the item
        else {
            item.skip();
        }
    });
} // _monitorSteelmesh

/**
  Begins the monitoring process for apps loaded by Steelmesh
 **/
SteelmeshMonitor.prototype._monitorApps = function() {
    
    var self = this;
    
    appEvents.on('load', function(app, dbUrls) {
        self._watchForChanges(app, dbUrls);
    });
    
    appEvents.on('unload', function(app) {
        
        debug('Unloading ' + app._id);
        // Remove the watchers
        var machines = self.watchers[app._id];
        _machines.forEach(function(machine) {
            machine.close();
        });
        
        delete self.watchers[app._id];
        debug(app._id + ' successfully unloaded.');
        
        appEvents.emit('detached.monitor', app);
        
    });
    
    debug('waiting for app load events');

} // _monitorApps

/**
  Watches for any application changes that have been
  registered by the application
 **/
SteelmeshMonitor.prototype._watchForChanges = function(app, appConfig) {
    
    debug('watching for changes for ' + app.id);
    
    var allowCached = false,
        self = this,
        dbs = appConfig.couchdb || {},
        watchers = [];
    
    function attachMonitor(dbid, dbConfig) {
        
        var failedItems = [],   
            url = self.server.config.url + dbid,
            machine = null;
        
        debug('monitoring ' + url);
        
        machine = new cm.Machine(url, {
                type: 'couchdb',
                include_docs: true,
                storage: _jsonStore
            });
            
        // Process any database changes
        machine.on('process', function(item) {
            
            // Only process changes if we have an onchange requirement
            if (dbConfig.onChange) {
                 // Send a request to the onChange url
                // mark as doneitem.done({ error: err });
            } else {
                item.skip();
            }
        });
        
        // Handle item failures
        machine.on('fail', function(item, err) {
            // TODO: serialize item data
            debug('item failed: ' + item.id, err);
            failedItems.push(item);
        });
        
        // create an auto retry mechanism for failed items
        cm.autoretry(machine, {
            times: 3,
            wait: 90000
        });

        // add to the list of active machines
        watchers.push(machine);
        
    } // attachMonitor
    
    _.each(dbs, function(value, key) {
        attachMonitor(key, value);
    });
    
    // Add the list of watchers for this app
    self._watchers[app.id] = watchers;
    
    // flag allow cached to true
    allowCached = true;
}

module.exports = SteelmeshMonitor;