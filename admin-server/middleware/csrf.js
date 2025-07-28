// middleware/csrf.js
const csurf = require('csurf');

const csrfProtection = csurf({ cookie: false });

const csrfMiddleware = (req, res, next) => {
  if (
    req.path === '/login' ||
    req.path === '/moders/moder-login' ||
    req.path === '/moders/csrf-token'
  ) {
    return next();
  }
  return csrfProtection(req, res, next);
};

module.exports = csrfMiddleware;