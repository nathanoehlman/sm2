var config = require('config'),
    util = require('util'),
    events = require('events'),
    supercomfy = require('supercomfy');

function Apploader() {
}

Apploader.prototype.run = function(callback) {
    console.log('loading apps');
    callback();
};

module.exports = Apploader;