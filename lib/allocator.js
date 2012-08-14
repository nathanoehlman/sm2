var config = require('config'),
    log = require('./helpers/log')('steelmesh-portallocator'),
    squirrel = require('squirrel');

function PortAllocator(steelmesh) {
    this.opts = config.allocator || {};
    this.steelmesh = steelmesh;
}

/**
  Start the port allocation service
 **/
PortAllocator.prototype.start = function(callback) {
    if (!!this.opts.enabled) {
        this._createServer(callback);
    } else {
        callback();
    }
}

/**
  Attempt to connect to seaport
 **/
PortAllocator.prototype._createServer = function(callback) {
    
    var allocator = this,
        opts = this.opts;
    
    // Get the seaport dependency
    log('Initializing seaport (make take a few minutes on first time)');
    squirrel('seaport', {allowInstall: true}, function(err, seaport) {
        if (err) return callback(err);
        
        var server = allocator.seaportServer = seaport.createServer();
        server.listen(opts.port || 9090);
        allocator.ports = seaport.connect('localhost', opts.port || 9090, opts.seaport);
        log('Port allocation service (seaport) listening on ' + opts.port || 9090);
        callback();
    });
        
}

module.exports = PortAllocator;