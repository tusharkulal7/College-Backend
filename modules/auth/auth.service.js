const ClerkWebhook = require('./auth.model');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const User = require('../users/user.model'); // Assuming user model exists
const redisService = require('../../services/redis.service');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;

async function verifyWebhookSignature(body, signature, secret) {
  if (!secret) throw new Error('Webhook secret not configured');
  const expectedSignature = crypto.createHmac('sha256', secret).update(JSON.stringify(body), 'utf8').digest('hex');
  return signature === `sha256=${expectedSignature}`;
}

async function processWebhook(eventType, data) {
  // Log the webhook event
  const webhook = new ClerkWebhook({ eventType, data });
  await webhook.save();

  // Handle specific events
  switch (eventType) {
    case 'user.created':
      // Handle user creation
      console.log('User created:', data.id);
      break;
    case 'user.updated':
      // Handle user update
      console.log('User updated:', data.id);
      break;
    case 'user.deleted':
      // Handle user deletion
      console.log('User deleted:', data.id);
      break;
    default:
      console.log('Unhandled webhook event:', eventType);
  }

  return { processed: true };
}

async function listWebhooks({ limit = 20, skip = 0 } = {}) {
  return ClerkWebhook.find().sort({ createdAt: -1 }).skip(skip).limit(limit);
}

// JWT Auth functions
async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

function generateAccessToken(user) {
  return jwt.sign(
    { userId: user._id, email: user.email, roles: user.roles },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
}

function generateRefreshToken(user) {
  return jwt.sign(
    { userId: user._id },
    JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
}

async function register(userData) {
  const { email, password, firstName, lastName } = userData;

  // Check if user exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new Error('User already exists');
  }

  // Hash password
  const hashedPassword = await hashPassword(password);

  // Create user
  const user = new User({
    email,
    password: hashedPassword,
    firstName,
    lastName,
    roles: ['user'] // default role
  });

  await user.save();

  // Generate tokens
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  return {
    user: {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.roles
    },
    accessToken,
    refreshToken
  };
}

async function login(credentials) {
  const { email, password } = credentials;

  // Find user
  const user = await User.findOne({ email });
  if (!user) {
    throw new Error('Invalid credentials');
  }

  // Check password
  const isValidPassword = await comparePassword(password, user.password);
  if (!isValidPassword) {
    throw new Error('Invalid credentials');
  }

  // Generate tokens
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  return {
    user: {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.roles
    },
    accessToken,
    refreshToken
  };
}

async function refreshToken(refreshToken) {
  try {
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) {
      throw new Error('User not found');
    }

    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    };
  } catch (error) {
    throw new Error('Invalid refresh token');
  }
}

async function logout() {
  // In a real implementation, you might want to blacklist tokens
  // For now, just return success
  return { message: 'Logged out successfully' };
}

async function forgotPassword(email) {
  const user = await User.findOne({ email });
  if (!user) {
    // Don't reveal if user exists
    return { message: 'If the email exists, a reset link has been sent' };
  }

  // Generate OTP (6-digit)
  const otp = crypto.randomInt(100000, 999999).toString();

  // Store OTP in Redis with 10 minutes TTL
  await redisService.storeOTP(email, otp, 600);

  // In a real app, send email with OTP
  // For now, just log it (in production, email it)
  console.log(`OTP for ${email}: ${otp}`);

  return { message: 'If the email exists, an OTP has been sent' };
}

async function resetPassword(email, otp, newPassword) {
  // Verify OTP from Redis
  const storedOtp = await redisService.getOTP(email);
  if (!storedOtp || storedOtp !== otp) {
    throw new Error('Invalid or expired OTP');
  }

  // Find user
  const user = await User.findOne({ email });
  if (!user) {
    throw new Error('User not found');
  }

  // Update password
  const hashedPassword = await hashPassword(newPassword);
  user.password = hashedPassword;
  await user.save();

  // Delete the used OTP
  await redisService.deleteOTP(email);

  return { message: 'Password reset successfully' };
}

module.exports = {
  verifyWebhookSignature,
  processWebhook,
  listWebhooks,
  register,
  login,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword
};