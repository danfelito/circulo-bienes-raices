const crypto = require('crypto');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const assertConfigured = () => {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    throw new Error('Cloudinary no está configurado');
  }
};

const uploadToCloudinary = (buffer, options = {}) => {
  assertConfigured();
  const resolvedOptions = { ...options };

  // Version explicit public IDs so a failed database update never overwrites
  // or deletes the image referenced by the previous property version.
  if (resolvedOptions.public_id) {
    resolvedOptions.public_id = `${resolvedOptions.public_id}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    resolvedOptions.overwrite = false;
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'image',
        folder: resolvedOptions.folder || 'circulo-bienes-raices',
        transformation: [
          { width: 1600, height: 1200, crop: 'limit' },
          { quality: 'auto' },
          { fetch_format: 'auto' },
        ],
        ...resolvedOptions,
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      },
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
};

const deleteFromCloudinary = async (publicId) => {
  if (!publicId) return null;
  assertConfigured();
  return cloudinary.uploader.destroy(publicId, { invalidate: true, resource_type: 'image' });
};

module.exports = { uploadToCloudinary, deleteFromCloudinary };
