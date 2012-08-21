var log = require('./helpers/log')('steelmesh-launcher'),
    path = require('path');

/**
  This will attempt to identify from the application the required 
  launcher to use, and start the application using it, before calling
  the callback with an error status, and handle to the application
 **/
exports.startInstance = function(app, callback) {
        
    var serverFile = path.join(app.basePath, 'server.js');
        
    // Allow the package.json to override the application base file
    if (app && app.main) {
        serverFile = path.join(app.basePath, app.main);
    }
        
    // find the application files that exist
    path.exists(serverFile, function(exists) {
        
        var launcher;
        // if we have a server.js file, or a defined 'main' file, then use the standalone launcher
        if (exists) {
            log('Launching standalone instance');
            launcher = require('./launchers/standalone');
        }
        // otherwise if we have application routes, then run the mesh app launcher
        else if (app.routes) {
            try {
                launcher = require('steelmesh-runner');
            }
            catch (e) {
                log.warn('Unable to load the steelmesh runner for running application', e);
            }
        }
        // otherwise, use the noop launcher
        else {
            launcher = require('./launchers/noop');
        }

        // if we have a launcher, then run the application
        if (typeof launcher == 'function') {
            launcher.call(null, app, {serverFile: serverFile, packageInfo: app.config}, callback);
        }
        else {
            callback(new Error('No valid launcher found for app: ' + app.id));
        }
    });
}
