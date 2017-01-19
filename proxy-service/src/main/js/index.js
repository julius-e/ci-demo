let http = require('http')
  , express = require('express')
  , proxy = require('express-http-proxy')
  , config = require('./config')
  , _ = require('underscore')
  ;

let app = express();

app.post('/services/:service/:url', (req, res, next) => {
  console.log(`Setting proxy from /${req.params.service} to ${req.params.url}`);
  config.set(`services:${req.params.service}:url`, req.params.url);
  res.json({success: true});
});

app.get('/services/:service', (req, res, next) => {
  res.json({url: config.get(`services:${req.params.service}`)});
});

console.log(`config: ${config.get('services')}`);
_.forEach(config.get('services'), (value, key) => {
  console.log(`Setting proxy from /${key} to ${value.url}`);
  app.use("/" + key, (req, res, next) => {
    console.log(`Proxying request from /${key} to ${config.get(`services:${key}:url`)}`);
    proxy(config.get(`services:${key}:url`))(req, res, next);
  });
});

let server = http.createServer(app)
  , port = 8000;

/**
 * Listen on provided port, on all network interfaces.
 */
server.listen(port);

server.on('error', (error) => {
  if (error.syscall !== 'listen') {
    throw error;
  }

  var bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
});

server.on('listening', () => {
  let addr = server.address();
  let bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port;
  console.log('http listening on ' + bind);
});