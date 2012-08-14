var util = require('util'),
    events = require('events'),
    cm = require('changemachine'),
    log = require('./helpers/log')('steelmesh-monitor'),
    path = require('path'),
    piper = require('piper'),
    request = require('request'),
    meshEvents = piper('steelmesh'),
    _ = require('underscore'),
    url = require('url'),
    _jsonStore = new cm.JsonStore(path.resolve(__dirname, '../changemachine.json')),
    reTrailingSlash = /\/$/,
    reStatusCodes = {
        pass: /^2.*$/,
        fail: /^5.*$/,
        abort: /^4.*$/
    };

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
function SteelmeshMonitor(steelmesh) {
    this.steelmesh = steelmesh;
    this._watchers = {};
}

util.inherits(SteelmeshMonitor, events.EventEmitter);

SteelmeshMonitor.prototype.start = function(callback) {
    log('starting monitor');
    this._monitorSteelmesh();
    this._monitorApps();
    callback();
};

/**
  Monitor Steelmesh for application updates
 **/
SteelmeshMonitor.prototype._monitorSteelmesh = function() {
    
    var restartTimer = 0,
        config = this.steelmesh.config,
        targetUrl = config.couchurl.replace(reTrailingSlash, '') + '/' + config.meshdb,
        opts = {
            type: 'couchdb',
            storage: _jsonStore,
            include_docs: true
        },
        machine = new cm.Machine(targetUrl, opts),
        steelmesh = this.steelmesh;
        
    log('attempting to monitor steelmesh @ ' + targetUrl);
    
    machine.on('process', function(item) {
        // only handle application changes
        if (item && item.id && item.id.slice(0, steelmesh.appPrefix.length) === steelmesh.appPrefix) {
            var eventPrefix = 'app.' + (item.deleted ? 'unload' : 'reload');
            log('captured application update (' + item.seq + ') for app: ' + item.id);
            log('firing ' + eventPrefix + '.' + item.id);
            // mark the item as done
            meshEvents.emit(eventPrefix + '.' + item.id, item.id, steelmesh.initApp(item.doc));
            item.done();
        }
        // otherwise, skip the item
        else {
            item.skip();
        }
    });
}; // _monitorSteelmesh

/**
  Begins the monitoring process for apps loaded by Steelmesh
 **/
SteelmeshMonitor.prototype._monitorApps = function() {
    
    var monitor = this;
    
    meshEvents.on('app.load', function(app) {
        monitor._watchForChanges(app);
    });
    
    meshEvents.on('app.unload', function(id, app) {
        
        log('Unloading ' + id);
        // Remove the watchers
        
        ((monitor._watchers || {})[id] || []).forEach(function(machine) {
            machine.close();
        });
        
        delete monitor._watchers[id];
        log(id + ' successfully unloaded.');
        
        meshEvents.emit('app.detached.monitor', app);
        
    });
    
    log('waiting for app load events');

}; // _monitorApps

/**
  Watches for any application changes that have been
  registered by the application
 **/
SteelmeshMonitor.prototype._watchForChanges = function(app) {
    
    log('watching for changes for ' + app.id);
    
    var allowCached = false,
        self = this,
        dbs = app.couchdb || {},
        watchers = [],
        config = self.steelmesh.config;
    
    function attachMonitor(dbid, dbConfig) {
        
        var failedItems = [],   
            dbUrl = self.steelmesh.config.couchurl + dbid,
            machine = null,
            changeUrl = (dbConfig.onChange) ? url.format({
                                    protocol: config.server.protocol || 'http',
                                    hostname: config.server.host || 'localhost',
                                    port: config.server.port || '6633',
                                    pathname: '/' + (app.mountpoint || '') + dbConfig.onChange
                                }) : null;
        
        log('monitoring ' + dbUrl + ' [changes to: ' + changeUrl + ']');
        machine = new cm.Machine(dbUrl, {
                type: 'couchdb',
                include_docs: true,
                storage: _jsonStore
            });
            
        // Process any database changes
        machine.on('process', function(item) {
            
            // Only process changes if we have an onchange requirement
            if (changeUrl) {
            
                // Send the request to the onchange endpoint
                request({
                       method: item.deleted === true ? 'DEL' : 'PUT',
                       url: changeUrl,
                       json: item.doc
                    }, function (err, response, body) {
                        if (err) return item.done({error: err});

                        if (reStatusCodes.pass.test(response.statusCode)) {
                            return item.done();
                        } else if (reStatusCodes.fail.test(response.statusCode)) {
                            return item.fail();
                        } else if (reStatusCodes.abort.test(response.statusCode)) {
                            // For the moment...
                            return item.skip();
                        }
                    }
                );
                
            } else {
                item.skip();
            }
        });
        
        // Handle item failures
        machine.on('fail', function(item, err) {
            // TODO: serialize item data
            log('item failed: ' + item.id, err);
            failedItems.push(item);
        });
        
        // create an auto retry mechanism for failed items
        cm.autoretry(machine, {
            times: 3,
            wait: 90000
        });

        // add to the list of active machines
        watchers.push(machine);
        
    }; // attachMonitor
    
    _.each(dbs, function(value, key) {
        attachMonitor(key, value);
    });
    
    // Add the list of watchers for this app
    self._watchers[app.id] = watchers;
    
    // flag allow cached to true
    allowCached = true;
};

module.exports = SteelmeshMonitor;