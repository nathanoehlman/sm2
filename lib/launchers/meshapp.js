var express = require('express'),
    path = require('path'),
    reHandler = /(.*)\.(.*)$/;

function _parseRoutes(app) {
    var routeHandlers = [],
        match;
    
    app.routes.forEach(function(route) {
        // if the route is a string, then convert into an object
        if (typeof route == 'string') {
            var routeParts = route.split(/\s?=>\s?/);
            
            if (routeParts.length > 1) {
                route = {
                    path: routeParts[0],
                    handler: routeParts[1]
                };
            }
            else {
                return;
            } // if..else
        } // if
        
        // check for a route path
        match = reHandler.exec(route.handler);
        
        if (match) {
            var modulePath = path.resolve(app.basePath, 'lib', match[1] + '.js');
            
            try {
                var module = require(modulePath),
                    handlerFn = module[match[2]];
                    
                    /*
                // if the module has an init function
                // and the module has not yet been initialized, then initialize it now
                if (typeof module.init == 'function' && (! modInitialized[modulePath])) {
                    module.init(mesh, app);
                    modInitialized[modulePath] = true;
                }
                */

                // if we have a handler function, then handle the route
                if (handlerFn) {
                    routeHandlers.push({
                        method: route.method || 'GET',
                        path: route.path,
                        handler: handlerFn
                    });
                } // if
            }
            catch (e) {
                mesh.log.error('Could not load module: ' + modulePath, e);
            }
        } // if
    });
    
    return routeHandlers;
};

module.exports = function(steelmesh, watchdog, app, callback) {
    var instance = express.createServer();
        
    // use the router
    instance.use(express.router);

    // load the routes
    _parseRoutes(app).forEach(function(route) {
        instance[route.method.toLowerCase()](route.path, route.handler);
    });
    
    callback(null, instance);
};