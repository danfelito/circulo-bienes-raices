const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const isMediaSyncOptimizedTransformation = transformation => {
  if (!Array.isArray(transformation)) return false;
  return transformation.some(step => (
    step && typeof step === 'object' &&
    step.width === 2048 &&
    step.height === 2048 &&
    step.crop === 'limit'
  ));
};

const sanitizeIncomingTransformation = transformation => {
  if (!Array.isArray(transformation)) return transformation;

  return transformation
    .map(step => {
      if (!step || typeof step !== 'object' || Array.isArray(step)) return step;
      const sanitized = { ...step };

      // f_auto only makes sense at delivery time when a browser sends an Accept header.
      // Cloudinary explicitly advises against using it as an incoming upload transformation.
      if (sanitized.fetch_format === 'auto') delete sanitized.fetch_format;
      if (sanitized.format === 'auto') delete sanitized.format;

      return sanitized;
    })
    .filter(step => {
      if (!step || typeof step !== 'object' || Array.isArray(step)) return Boolean(step);
      return Object.keys(step).length > 0;
    });
};

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
          ],
        };

    const uploadOptions = { ...defaults, ...options };

    // Círculo Media Sync already converts its images locally to optimized WebP at max 2048 px.
    // Uploading those files with another incoming transformation wastes quota, adds a second
    // lossy encode and previously included f_auto in the signed upload request.
    if (!isVideo && isMediaSyncOptimizedTransformation(options.transformation)) {
      delete uploadOptions.transformation;
    } else if (uploadOptions.transformation === undefined) {
      delete uploadOptions.transformation;
    } else {
      const sanitized = sanitizeIncomingTransformation(uploadOptions.transformation);
      if (Array.isArray(sanitized) && sanitized.length === 0) delete uploadOptions.transformation;
      else uploadOptions.transformation = sanitized;
    }

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
