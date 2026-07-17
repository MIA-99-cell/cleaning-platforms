const { verifyToken } = require('../utils/auth');
const { sendError } = require('../utils/response');

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return sendError(res, 'Access denied. No token provided.', 401);
  }

  try {
    const token = authHeader.split(' ')[1];
    req.user = verifyToken(token);
    next();
  } catch {
    return sendError(res, 'Invalid or expired token.', 401);
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return sendError(res, 'Access denied. Insufficient permissions.', 403);
  }
  next();
};

const tenantScope = (req, res, next) => {
  if (req.user.role === 'super_admin') {
    req.tenantId = req.query.tenant_id ? parseInt(req.query.tenant_id, 10) : null;
    return next();
  }
  if (req.user.role === 'tenant') {
    req.tenantId = req.user.id;
    return next();
  }
  if (req.user.role === 'cleaner' || req.user.role === 'customer') {
    req.tenantId = req.user.tenantId;
    return next();
  }
  return sendError(res, 'Access denied.', 403);
};

module.exports = { authenticate, authorize, tenantScope };
