const net = require('net');
const port = process.env.PORT || '7777'


function server(callback) {
  // test with: telnet localhost 7777
  const server = net.createServer(callback);

  server.on('error', (err) => {
    throw err;
  });

  server.listen(port, () => {
    console.log('server bound', server.address());
  });
}


function client() {
  const client = net.createConnection({ port: 8124 }, () => {
    //'connect' listener
    console.log('connected to server!');
    client.write('world!\r\n');
  });
  client.on('data', (data) => {
    console.log(data.toString());
    client.end();
  });
  client.on('end', () => {
    console.log('disconnected from server');
  });  
}

module.exports = {
  server
};