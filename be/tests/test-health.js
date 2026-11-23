const app = require('../src/app');
const http = require('http');

const server = http.createServer(app);

server.listen(5099, async () => {
  try {
    const res = await fetch('http://localhost:5099/api/health');
    const data = await res.json();

    if (data.status !== 'ONLINE') {
      throw new Error('Health check status was not ONLINE');
    }

    console.log('✔ Express API Health Check passed!');
    server.close();
    process.exit(0);
  } catch (err) {
    console.error('Test error:', err);
    server.close();
    process.exit(1);
  }
});
