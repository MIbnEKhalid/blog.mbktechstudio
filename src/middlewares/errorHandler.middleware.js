/**
 * 404 Not Found handler – must be registered after all routes.
 */
export function notFoundHandler(req, res) {
  res.status(404).render('error.handlebars', { message: 'Page not found', code: 404 });
}

/**
 * Global error handler – must be registered last with four parameters.
 */
export function errorHandler(err, req, res, next) {
  console.error('Unhandled error:', err);
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  res.status(status).render('error.handlebars', { message, code: status });
}
