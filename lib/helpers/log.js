module.exports = function(section) {
    var debug = require('debug')(section);
    
    function _log(message) {
        debug(message);
    }
    
    // add severity level logging
    _log.error = function(message, error) {
        debug('error: ' + message);
        
        // if we have an error then extract the stack trace and record the exception
    };
    
    return _log;
};