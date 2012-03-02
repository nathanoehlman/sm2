var util = require('util'),
    events = require('events'),
    cm = require('changemachine'),
    debug = require('debug')('monitor');

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
    
}

util.inherits(SteelmeshMonitor, events.EventEmitter);

SteelmeshMonitor.prototype.start = function(callback) {
    callback();
};

/**
  Monitor Steelmesh for application updates
 **/
SteelmeshMonitor.prototype._monitorSteelmesh = function() {
    
    var restartTimer = 0,
        config = this.server.config,
        targetUrl = config.couchurl.replace(reTrailingSlash, '') + '/' + config.meshdb,
        opts = {
            type: 'couchdb',
            storage: _jsonStore
        },
        machine = new cm.Machine(targetUrl, opts);
        
    debug('attempting to monitor steelmesh @ ' + targetUrl);
    
    machine.on('process', function(item) {
        // only handle application changes
        if (item && item.id && item.id.slice(0, appPrefix.length) === appPrefix) {
            log.info('captured application update for app: ' + item.id);
            
            clearTimeout(restartTimer);
            restartTimer = setTimeout(function() {
                _messenger.send('steelmesh-restart', { dashboard: true });
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
  Watches for any application changes that have been
  registered by the application
 **/
SteelmeshMonitor.prototype._watchForChanges = function(app, dbUrls) {
    
    var allowCached = false;
    
    function attachMonitor(target, dbid, dbConfig) {
        var failedItems = [];
        
        log.debug('finding change listeners for db: ' + dbid);
        
        // TODO: load jobs from redis
        
        _apploader.loadPlugins(meshstub, app, dbConfig.changeListeners, allowCached, function(err, listeners) {
            // if we have some listeners, then listen for changes
            if (listeners && listeners.length > 0) {
                var machine = new cm.Machine(target, {
                        type: 'couchdb',
                        include_docs: true,
                        storage: _jsonStore
                    });

                // when we intercept process events, process the item
                log.debug('attempting monitoring: ' + target + ', for dbid: ' + dbid);
                machine.on('process', function(item) {
                    // reset the processors
                    var processors = [];
                    
                    // add the item data
                    item.dburl = target;
                    item.dbid = dbid;
                    
                    // iterate through the listeners
                    listeners.forEach(function(listener) {
                        var processor = typeof listener == 'function' ? listener(app, meshstub, item) : null;

                        // if we have a processor, then queue it
                        if (processor) {
                            processors.push(processor);
                        }
                    });

                    // if we have listeners, then process them
                    if (processors.length) {
                        async.parallel(processors, function(err) {
                            item.done({ error: err });
                        });
                    }
                    else {
                        item.skip();
                    }
                });
                
                machine.on('fail', function(item, err) {
                    // TODO: serialize item data
                    log.error('item failed: ' + item.id, err);
                    failedItems.push(item);
                });
                
                // create an auto retry mechanism for failed items
                cm.autoretry(machine, {
                    times: 3,
                    wait: 90000
                });

                // add to the list of active machines
                _activeMachines.push(machine);
            }
        });
    } // attachMonitor
    
    _.each(dbUrls, function(value, key) {
        attachMonitor(value, key,  (app.couchdb || {})[key] || {});
    });
    
    // flag allow cached to true
    allowCached = true;
}

module.exports = SteelmeshMonitor;