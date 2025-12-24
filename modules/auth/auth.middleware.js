const jwt = require('jsonwebtoken');
const clerk = require('../../config/clerk');
const jwksClient = require('jwks-rsa');

const JWKS_URI = process.env.CLERK_JWKS_URI || 'https://api.clerk.dev/.well-known/jwks';
const jwks = jwksClient({
  jwksUri: JWKS_URI,
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 10 * 60 * 1000, // 10m
});

function getKey(header, callback) {
  if (!header || !header.kid) return callback(new Error('Missing kid in token header'));
  jwks.getSigningKey(header.kid, function (err, key) {
    if (err) return callback(err);
    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
}

module.exports = async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader) return res.status(401).json({ message: 'Missing Authorization header' });

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ message: 'Invalid Authorization format' });

  const token = parts[1];

  try {
    // Verify token signature using JWKS
    const decoded = await new Promise((resolve, reject) => {
      jwt.verify(token, getKey, {}, (err, decoded) => {
        if (err) return reject(err);
        resolve(decoded);
      });
    });

    const userId = decoded && decoded.sub;
    if (!userId) return res.status(401).json({ message: 'Invalid token (missing sub)' });

    const user = await clerk.getUserById(userId);

    const rawRoles = (user.public_metadata && user.public_metadata.roles) || [];
    const normalize = (r) => String(r || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const roles = Array.isArray(rawRoles) ? rawRoles.map(normalize) : [normalize(rawRoles)];

    req.user = {
      id: user.id,
      email: (user.email_addresses && user.email_addresses[0] && user.email_addresses[0].email_address) || null,
      firstName: user.first_name || null,
      lastName: user.last_name || null,
      // both raw and normalized roles are useful
      rolesRaw: rawRoles,
      roles: Array.from(new Set(roles)),
      raw: user,
    };

    return next();
  } catch (err) {
    console.error('Auth verification error:', err && err.message ? err.message : err);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};