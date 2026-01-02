require('dotenv').config({ path: __dirname + '/.env' });
const http = require('http');
const startLoaders = require('./loaders');
const app = require('./app');
const { disconnect: disconnectDb } = require('./config/database');
const logger = require('./config/logger');

const PORT = process.env.PORT || 5000;
let server;
let isShuttingDown = false;
const connections = new Set();
let loaders;

async function start() {
  try {
    loaders = await startLoaders();

    // Ensure default admin user exists (username/password from env or defaults)
    try {
      const mongoose = require('mongoose');
      const User = require('./modules/users/user.model');
      const bcrypt = require('bcrypt');
      const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
      const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'AdminPass123!';

      const existing = await User.findOne({ username: ADMIN_USERNAME });
      if (!existing) {
        const hashed = await bcrypt.hash(ADMIN_PASSWORD, 12);
        const adminUser = new User({
          username: ADMIN_USERNAME,
          password: hashed,
          firstName: 'Admin',
          lastName: 'User',
          roles: ['admin']
        });
        await adminUser.save();
        logger.info(`Created default admin user: ${ADMIN_USERNAME}`);
      } else {
        // ensure role contains admin
        if (!existing.roles || !existing.roles.includes('admin')) {
          existing.roles = Array.from(new Set([...(existing.roles || []), 'admin']));
          await existing.save();
          logger.info(`Updated existing user ${ADMIN_USERNAME} with admin role`);
        }
      }
    } catch (e) {
      logger.warn('Admin seeding failed:', e && e.message ? e.message : e);
    }

    // Support multiple `app` export shapes: express instance, factory returning an instance, or a bare request handler
    let requestHandler = app;
    if (typeof app === 'function' && app.prototype && app.prototype.use) {
      // likely an express app instance
      requestHandler = app;
    } else if (typeof app === 'function' && app.length === 0) {
      // factory that returns an app
      try {
        requestHandler = app();
      } catch (err) {
        // keep original app if calling fails
      }
    }

    // Initialize Express app with loaders
    loaders.express.init(requestHandler);

    // Create HTTP server for better control over connections
    server = http.createServer(requestHandler);

    // Initialize WebSocket server
    loaders.socket.init(server);

    server.on('connection', (socket) => {
      connections.add(socket);
      socket.on('close', () => connections.delete(socket));
    });

    server.listen(PORT, () => logger.info(`Server listening on port ${PORT}`));

    server.on('error', (err) => {
      logger.error('Server error:', err);
      shutdown(1);
    });

    // graceful shutdown handlers
    process.on('SIGINT', () => shutdown(0));
    process.on('SIGTERM', () => shutdown(0));

    process.on('uncaughtException', (err) => {
      logger.error('Uncaught exception:', err);
      shutdown(1);
    });

    process.on('unhandledRejection', (reason, p) => {
      logger.error('Unhandled Rejection at:', p, 'reason:', reason);
      shutdown(1);
    });
  } catch (err) {
    logger.error('Startup failed:', err);
    process.exit(1);
  }
}

function forceDestroyConnections() {
  for (const socket of connections) {
    try {
      socket.destroy();
    } catch (e) {
      // ignore
    }
  }
}

async function shutdown(exitCode = 0) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info('Shutting down gracefully...');

  // stop accepting new connections
  if (server && server.close) {
    server.close(async (err) => {
      if (err) logger.error('Error closing server:', err);
      // attempt to close socket connections and other cleanup
      try {
        if (loaders && loaders.socket && loaders.socket.close) {
          await loaders.socket.close();
        }
        if (disconnectDb && typeof disconnectDb === 'function') {
          await disconnectDb();
        }
      } catch (e) {
        logger.error('Error during shutdown cleanup:', e);
      }

      logger.info('Shutdown complete. Exiting.');
      process.exit(exitCode);
    });

    // after a grace period, forcibly destroy open connections
    setTimeout(() => {
      logger.warn('Forcing shutdown: destroying open connections');
      forceDestroyConnections();
      process.exit(1);
    }, Number(process.env.SHUTDOWN_TIMEOUT_MS || 10000));
  } else {
    process.exit(exitCode);
  }
}

// Start the server when this module is executed
start();

// Export for tests or external control if needed
module.exports = { start, shutdown };

