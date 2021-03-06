const express = require('express');
const bodyParser = require('body-parser');
const expressLayouts = require('express-ejs-layouts');
const logger = require('./infrastructure/logger');
const https = require('https');
const fs = require('fs');
const path = require('path');
const config = require('./infrastructure/config');
const helmet = require('helmet');
const sanitization = require('login.dfe.sanitization');
const setupAppRoutes = require('./app/routes');
const csurf = require('csurf');

const app = express();
app.use(helmet({
  noCache: true,
  frameguard: {
    action: 'deny',
  },
}));

if (config.hostingEnvironment.env !== 'dev') {
  app.set('trust proxy', 1);
}

const csrf = csurf({
  cookie: {
    secure: true,
    httpOnly: true,
  },
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.set('view engine', 'ejs');
app.set('views', path.resolve(__dirname, 'app'));
app.use(expressLayouts);

setupAppRoutes(app, csrf);

if (config.hostingEnvironment.env === 'dev') {
  app.proxy = true;

  const options = {
    key: config.hostingEnvironment.sslKey,
    cert: config.hostingEnvironment.sslCert,
    requestCert: false,
    rejectUnauthorized: false,
  };
  const server = https.createServer(options, app);

  server.listen(config.hostingEnvironment.port, () => {
    logger.info(`Dev server listening on https://${config.hostingEnvironment.host}:${config.hostingEnvironment.port} with config:\n${JSON.stringify(config)}`);
  });
} else {
  app.listen(process.env.PORT, () => {
    logger.info(`Server listening on http://${config.hostingEnvironment.host}:${config.hostingEnvironment.port}`);
  });
}