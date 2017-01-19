let http = require('http')
  , express = require('express')
  , handlers = require('./handlers');

let app = express();

app.get("/:userId", handlers.get);

let server = http.createServer(app)
  , port = 8080;

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