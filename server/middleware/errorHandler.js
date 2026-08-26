import logger from '../utils/logger.js';
import { getUserIP } from './strictProxyGate.js';

// eslint-disable-next-line no-unused-vars -- next is required by Express error handler signature
const errorHandler = (err, req, res, _next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  const isProd = process.env.NODE_ENV === 'production';

  logger.error(`${statusCode} - ${err.message} - ${req.originalUrl} - ${req.method} - ${getUserIP(req)}${!isProd && err.stack ? `\n${err.stack}` : ''}`);

  // Handle MongoDB E11000 Duplicate Key Error (Unique Constraint Race Condition)
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || err.keyValue || {})[0] || 'field';
    const readableField = field === 'username' ? 'Username' : field === 'email' ? 'Email' : field;
    return res.status(400).json({
      message: `${readableField} is already taken`,
      stack: isProd ? null : err.stack,
    });
  }

  // Security: only expose err.message for OPERATIONAL errors (4xx) that
  // controllers raise intentionally ("Username is already taken", etc.).
  // Internal 5xx messages can leak driver text / file paths to clients.
  const clientMessage =
    statusCode < 500
      ? err.message
      : isProd
        ? 'Something went wrong on our end. Please try again later.'
        : err.message;

  res.status(statusCode).json({
    message: clientMessage,
    stack: isProd ? null : err.stack,
  });
};

export default errorHandler;
