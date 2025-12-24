const { createQueue } = require('../config/bull');

const mediaQueue = createQueue('media-processing');

mediaQueue.process(async (job) => {
  const { mediaId, action } = job.data;

  console.log(`Processing media job: ${action} for media ${mediaId}`);

  // Import here to avoid circular dependencies
  const Media = require('../modules/media/media.model');
  const { cloudinary } = require('../config/cloudinary');

  const media = await Media.findById(mediaId);
  if (!media) {
    throw new Error(`Media not found: ${mediaId}`);
  }

  switch (action) {
    case 'upload-to-cloud':
      // Upload local file to Cloudinary
      const uploadResult = await cloudinary.uploader.upload(media.localPath, { resource_type: 'auto' });

      // Update media record with cloud details
      await Media.findByIdAndUpdate(mediaId, {
        url: uploadResult.secure_url,
        public_id: uploadResult.public_id,
        format: uploadResult.format,
        type: uploadResult.resource_type || 'image',
        status: 'cloud',
      });

      // Remove local file
      try {
        require('fs').unlinkSync(media.localPath);
      } catch (e) {
        console.warn(`Failed to delete local file ${media.localPath}:`, e.message);
      }

      // Enqueue other jobs now that it's in cloud
      await mediaQueue.add({ mediaId, action: 'generate-thumbnail' });
      await mediaQueue.add({ mediaId, action: 'extract-metadata' });
      break;

    case 'generate-thumbnail':
      // Generate thumbnail using Cloudinary transformations
      const thumbnailUrl = cloudinary.url(media.public_id, {
        width: 300,
        height: 300,
        crop: 'fill',
        quality: 'auto',
      });
      await Media.findByIdAndUpdate(mediaId, { thumbnailUrl });
      break;

    case 'extract-metadata':
      // Extract metadata (this is a placeholder - Cloudinary already provides some)
      // In a real scenario, you might use a library like sharp or ffmpeg
      const metadata = {
        width: media.width || 0,
        height: media.height || 0,
        duration: media.duration || 0,
      };
      await Media.findByIdAndUpdate(mediaId, { metadata });
      break;

    default:
      throw new Error(`Unknown media action: ${action}`);
  }

  console.log(`Media processing completed for ${mediaId}`);
});

module.exports = mediaQueue;