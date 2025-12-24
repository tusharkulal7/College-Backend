const {
  verifyWebhookSignature,
  processWebhook,
  listWebhooks,
  register,
  login,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword
} = require('./auth.service');
const {
  webhookSchema,
  listSchema,
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema
} = require('./auth.validation');

async function webhook(req, res) {
  const signature = req.headers['clerk-signature'] || req.headers['svix-signature'];
  const secret = process.env.CLERK_WEBHOOK_SECRET;

  try {
    const isValid = await verifyWebhookSignature(req.body, signature, secret);
    if (!isValid) return res.status(401).json({ message: 'Invalid signature' });

    const { error, value } = webhookSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    await processWebhook(value.type, value.data);
    res.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ message: 'Webhook processing failed' });
  }
}

async function list(req, res) {
  const { error, value } = listSchema.validate(req.query);
  if (error) return res.status(400).json({ message: error.message });

  const webhooks = await listWebhooks(value);
  res.json(webhooks);
}

async function registerUser(req, res) {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const result = await register(value);
    res.status(201).json(result);
  } catch (err) {
    console.error('Register error:', err);
    res.status(400).json({ message: err.message });
  }
}

async function loginUser(req, res) {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const result = await login(value);
    res.json(result);
  } catch (err) {
    console.error('Login error:', err);
    res.status(401).json({ message: err.message });
  }
}

async function refreshUserToken(req, res) {
  try {
    const { error, value } = refreshTokenSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const result = await refreshToken(value.refreshToken);
    res.json(result);
  } catch (err) {
    console.error('Refresh token error:', err);
    res.status(401).json({ message: err.message });
  }
}

async function logoutUser(req, res) {
  try {
    const result = await logout();
    res.json(result);
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ message: 'Logout failed' });
  }
}

async function forgotUserPassword(req, res) {
  try {
    const { error, value } = forgotPasswordSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const result = await forgotPassword(value.email);
    res.json(result);
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ message: 'Failed to process request' });
  }
}

async function resetUserPassword(req, res) {
  try {
    const { error, value } = resetPasswordSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const result = await resetPassword(value.email, value.otp, value.password);
    res.json(result);
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(400).json({ message: err.message });
  }
}

module.exports = {
  webhook,
  list,
  registerUser,
  loginUser,
  refreshUserToken,
  logoutUser,
  forgotUserPassword,
  resetUserPassword
};