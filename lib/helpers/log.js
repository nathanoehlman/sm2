module.exports = function(section) {
    var debug = require('debug')(section);
    
    function _log(message) {
        debug(message);
    }
    
    // add severity level logging
    _log.error = function(message, error) {
        debug('error: ' + message, error);
        
        // if we have an error then extract the stack trace and record the exception
    };
    
    // add the warn level logging
    _log.warn = function(message, error) {
        debug('warn: ' + message, error);
    };
    
    return _log;
};