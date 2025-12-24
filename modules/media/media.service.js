const Media = require('./media.model');
const { cloudinary } = require('../../config/cloudinary');
const fs = require('fs');
const path = require('path');

async function uploadFileToCloudinary(filePath, options = {}) {
  // Uploads a file to Cloudinary and returns the upload result
  const res = await cloudinary.uploader.upload(filePath, options);
  return res;
}

async function createMediaFromUpload({ filePath, filename, uploadedBy, departmentId, tags = [] }) {
  // Get file stats
  const stats = fs.statSync(filePath);
  const size = stats.size;

  // Determine file type (simple check)
  const ext = filename.split('.').pop().toLowerCase();
  let type = 'file';
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext)) type = 'image';
  else if (['mp4', 'avi', 'mov', 'wmv'].includes(ext)) type = 'video';
  else if (['mp3', 'wav', 'flac'].includes(ext)) type = 'audio';
  else if (ext === 'pdf') type = 'pdf';

  const doc = new Media({
    url: `/uploads/${path.basename(filePath)}`, // local url
    filename: filename,
    size: size,
    type: type,
    tags,
    uploadedBy,
    departmentId,
    localPath: filePath,
    status: 'local',
  });

  const savedMedia = await doc.save();

  // Enqueue background job to upload to cloud
  const mediaQueue = require('../../queues/media.queue');
  await mediaQueue.add({ mediaId: savedMedia._id, action: 'upload-to-cloud' });

  return savedMedia;
}

module.exports = { uploadFileToCloudinary, createMediaFromUpload };
