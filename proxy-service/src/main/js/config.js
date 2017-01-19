let fs = require('fs')
  , nconf = require('nconf')
  , path = require('path')
  ;

let configFile = process.env.CONFIG_FILE || '../resources/config.json'
var configPath = path.join(__dirname, './', configFile);

console.log(`Loading config from ${configPath}`);

nconf.argv()
     .env()
     .file({ file: configPath });

nconf.env("__");

module.exports = nconf;