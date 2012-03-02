var util = require('util'),
    events = require('events');

function Apploader(server) {
}

Apploader.prototype.run = function(callback) {
    console.log('loading apps');
    callback();
};

module.exports = Apploader;