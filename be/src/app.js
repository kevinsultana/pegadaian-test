const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const { CORS_ORIGIN } = require('./config/env');
const routes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middlewares/error.middleware');

const app = express();

// Disable etag to prevent 304 Not Modified caching issues on dynamic state
app.set('etag', false);

// Middlewares
app.use(
  cors({
    origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN.split(','),
    credentials: true,
  })
);
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Swagger Interactive Documentation
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Pegadaian Smart Vault - API Docs',
  })
);

// Redirect /docs to /api-docs
app.get('/docs', (req, res) => res.redirect('/api-docs'));

// API Root
app.use('/api', routes);

// Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
