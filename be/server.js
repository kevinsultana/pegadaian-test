const app = require('./src/app');
const { PORT } = require('./src/config/env');

const server = app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`  PEGADAIAN SMART VAULT ENTERPRISE BACKEND SERVICE  `);
  console.log(`====================================================`);
  console.log(`Server running on : http://localhost:${PORT}`);
  console.log(`API Health Check  : http://localhost:${PORT}/api/health`);
  console.log(`Swagger API Docs  : http://localhost:${PORT}/api-docs`);
  console.log(`Environment       : ${process.env.NODE_ENV || 'development'}`);
  console.log(`====================================================\n`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});
