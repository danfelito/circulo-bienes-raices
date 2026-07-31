const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const uploadToCloudinary = (buffer, options = {}) => {
  return new Promise((resolve, reject) => {
    const isVideo = options.resource_type === 'video';
    const defaults = isVideo
      ? {
          folder: options.folder || 'circulo-bienes-raices',
          resource_type: 'video',
        }
      : {
          folder: options.folder || 'circulo-bienes-raices',
          resource_type: 'image',
          transformation: [
            { width: 1200, height: 800, crop: 'limit' },
            { quality: 'auto' },
            { fetch_format: 'auto' },
          ],
        };

    const uploadOptions = { ...defaults, ...options };
    if (uploadOptions.transformation === undefined) delete uploadOptions.transformation;

    const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });

    streamifier.createReadStream(buffer).pipe(stream);
  });
};

const parseStoredPublicId = storedPublicId => {
  const value = String(storedPublicId || '');
  if (value.startsWith('video:')) {
    return { publicId: value.slice('video:'.length), resourceType: 'video' };
  }
  return { publicId: value, resourceType: 'image' };
};

const deleteFromCloudinary = storedPublicId => {
  const { publicId, resourceType } = parseStoredPublicId(storedPublicId);
  if (!publicId) return Promise.resolve(null);
  return cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
};

module.exports = { uploadToCloudinary, deleteFromCloudinary, parseStoredPublicId };
