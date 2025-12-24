module.exports = function requireRole(requiredRole) {
  if (!requiredRole) throw new Error('requireRole requires a role string');
  const normalized = String(requiredRole).toLowerCase();

  return function (req, res, next) {
    // not authenticated
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const rawRoles = req.user.roles || [];
    const roles = Array.isArray(rawRoles) ? rawRoles.map(r => String(r).toLowerCase()) : [String(rawRoles).toLowerCase()];

    if (!roles.includes(normalized)) return res.status(403).json({ message: 'Forbidden' });

    return next();
  };
};
