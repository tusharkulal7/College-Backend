const { createMediaFromUpload } = require('./media.service');
const { cloudinary } = require('../../config/cloudinary');
const { uploadSchema, signSchema } = require('./media.validation');

async function upload(req, res) {
  if (!req.file) return res.status(400).json({ message: 'file is required' });

  const { error, value } = uploadSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.message });

  try {
    const uploadedBy = req.user && req.user.id ? req.user.id : null;
    const departmentId = value.departmentId || null;
    const tags = value.tags || [];

    const media = await createMediaFromUpload({ filePath: req.file.path, filename: req.file.originalname, uploadedBy, departmentId, tags });
    res.status(201).json(media);
  } catch (err) {
    console.error('Media upload error:', err && err.message ? err.message : err);
    res.status(500).json({ message: 'Upload failed' });
  }
}

// Returns Cloudinary signature and timestamp for client direct uploads
function sign(req, res) {
  const { error, value } = signSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.message });

  try {
    const { folder, public_id, eager } = value;
    const timestamp = Math.floor(Date.now() / 1000);
    const paramsToSign = { timestamp };

    if (folder) paramsToSign.folder = folder;
    if (public_id) paramsToSign.public_id = public_id;
    if (eager) paramsToSign.eager = eager;

    // Use API secret from env to sign request server-side
    const signature = cloudinary.utils.api_sign_request(paramsToSign, process.env.CLOUDINARY_API_SECRET);

    // Always return apiKey/cloudName fields (explicit null when not configured)
    res.json({ signature, timestamp, apiKey: process.env.CLOUDINARY_API_KEY || null, cloudName: process.env.CLOUDINARY_CLOUD_NAME || null });
  } catch (err) {
    console.error('Sign error:', err && err.message ? err.message : err);
    res.status(500).json({ message: 'Could not generate signature' });
  }
}

module.exports = { upload, sign };
