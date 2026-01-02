const express = require('express');
const path = require('path');

const app = express();

// Basic body parsers to ensure route handlers receive `req.body` even
// if loader initialization order differs (keeps app robust).
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '10mb' }));
app.use(express.urlencoded({ extended: false }));

// Serve static files from public/uploads
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Helpers
function useIf(fn) {
  if (typeof fn === 'function') app.use(fn);
}

// Core configuration
app.set('trust proxy', true);

// Analytics middleware
try {
  const { trackPageView, trackUserActivity } = require('./middlewares/analytics.middleware');
  app.use(trackPageView);
  app.use(trackUserActivity);
} catch (err) {
  console.warn('Analytics middleware not loaded:', err && err.message ? err.message : err);
}

// Health-check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Load and mount feature routes (fail-safe if a module is not present)
function safeMount(routePath, modulePath) {
  try {
    // resolve module relative to backend folder
    const r = require(modulePath);
    if (r && typeof r === 'function') app.use(routePath, r);
  } catch (err) {
    // ignore missing routes during app assembly
    console.warn(`Route not mounted (${routePath}): ${modulePath} — ${err && err.message ? err.message : err}`);
  }
}

// Public / API routes
safeMount('/api/pages', './modules/pages/page.routes');
safeMount('/api', './routes/me.routes');
safeMount('/api/auth', './modules/auth/auth.routes');
safeMount('/api/activity', './modules/activity-log/activity.routes');
safeMount('/api/media', './modules/media/media.routes');
safeMount('/api/departments', './modules/departments/department.routes');
safeMount('/api/menus', './modules/menu/menu.routes');
safeMount('/api/home-sections', './modules/home-sections/homeSection.routes');
safeMount('/api/users', './modules/users/user.routes');
safeMount('/api/workflows', './modules/workflows/workflow.routes');
safeMount('/api/notifications', './modules/notifications/notification.routes');
safeMount('/api/analytics', './modules/analytics/analytics.routes');
safeMount('/api/webhooks', './modules/webhooks/webhook.routes');

// API docs (OpenAPI)
try {
  const swaggerUi = require('swagger-ui-express');
  const YAML = require('yamljs');
  const openapi = YAML.load(path.join(__dirname, 'docs', 'openapi.yaml'));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi));
} catch (err) {
  console.warn('Swagger UI not mounted:', err && err.message ? err.message : err);
}

// 404 handler
app.use((req, res) => res.status(404).json({ message: 'Not Found' }));

// Error handler (must be last)
const errorHandler = require('./middlewares/error.middleware');
app.use(errorHandler);

module.exports = app;
