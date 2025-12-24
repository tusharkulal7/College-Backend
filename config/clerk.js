// Clerk configuration helpers (no business logic) — provides thin HTTP client and token verification utilities.
const axios = require('axios');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

const CLERK_API_BASE = process.env.CLERK_API_BASE || 'https://api.clerk.dev/v1';
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const CLERK_PUBLISHABLE_KEY = process.env.CLERK_PUBLISHABLE_KEY;
const JWKS_URI = process.env.CLERK_JWKS_URI || 'https://api.clerk.dev/.well-known/jwks';

const clerkApi = axios.create({
  baseURL: CLERK_API_BASE,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// JWKS client used to verify Clerk-issued JWTs.
const jwks = jwksClient({
  jwksUri: JWKS_URI,
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 10 * 60 * 1000, // 10m
});

function getSigningKey(header, callback) {
  if (!header || !header.kid) return callback(new Error('Missing kid in token header'));
  jwks.getSigningKey(header.kid, function (err, key) {
    if (err) return callback(err);
    try {
      const signingKey = key.getPublicKey ? key.getPublicKey() : key.rsaPublicKey;
      callback(null, signingKey);
    } catch (e) {
      callback(e);
    }
  });
}

/**
 * Verify a Clerk JWT (e.g., session token or OIDC token) using JWKS.
 * Returns the decoded token payload on success or throws an error on failure.
 */
function verifyToken(token, options = {}) {
  return new Promise((resolve, reject) => {
    if (!token) return reject(new Error('No token provided'));

    jwt.verify(token, getSigningKey, options, (err, decoded) => {
      if (err) return reject(err);
      resolve(decoded);
    });
  });
}

/**
 * Convenience helper: verify token then fetch corresponding Clerk user profile.
 * Returns the Clerk user object fetched via Clerk REST API.
 */
async function getUserFromToken(token) {
  const decoded = await verifyToken(token);
  const userId = decoded && decoded.sub;
  if (!userId) throw new Error('Token is missing `sub` claim');
  return getUserById(userId);
}

async function getUserById(userId) {
  if (!CLERK_SECRET_KEY) throw new Error('CLERK_SECRET_KEY is not set');

  const res = await clerkApi.get(`/users/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}` },
  });
  return res.data;
}

function isValidSecretKey(key) {
  return Boolean(key && CLERK_SECRET_KEY && key === CLERK_SECRET_KEY);
}

module.exports = {
  // constants
  JWKS_URI,
  CLERK_API_BASE,
  CLERK_SECRET_KEY,
  CLERK_PUBLISHABLE_KEY,

  // HTTP helper
  getUserById,

  // Token helpers
  verifyToken,
  getUserFromToken,
  isValidSecretKey,
};
