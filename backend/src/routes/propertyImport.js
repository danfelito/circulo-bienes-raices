const express = require('express');
const multer = require('multer');
const AdmZip = require('adm-zip');
const path = require('path');
const prisma = require('../config/db');
const { authMiddleware } = require('../config/auth');
const { uploadToCloudinary, deleteFromCloudinary } = require('../config/cloudinary');

const router = express.Router();

const MAX_FILES = 120;
const MAX_FILE_BYTES = 120 * 1024 * 1024;
const MAX_TOTAL_BYTES = 350 * 1024 * 1024;
const MAX_AI_IMAGE_BYTES = 6 * 1024 * 1024;
const MAX_AI_PDF_BYTES = 12 * 1024 * 1024;
const MAX_TEXT_CHARS = 120000;

const upload = multer({
  storage: multer.memoryStorage(),
  preservePath: true,
  limits: {
    files: MAX_FILES,
    fileSize: MAX_FILE_BYTES,
    fields: 20,
  },
});

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.heic', '.heif']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.m4v', '.webm', '.avi', '.mkv']);
const TEXT_EXTENSIONS = new Set(['.txt', '.md', '.csv', '.json', '.html', '.htm', '.xml']);
const DOCUMENT_EXTENSIONS = new Set(['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', ...TEXT_EXTENSIONS]);

const MIME_BY_EXTENSION = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.gif': 'image/gif', '.avif': 'image/avif', '.heic': 'image/heic', '.heif': 'image/heif',
  '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.m4v': 'video/x-m4v', '.webm': 'video/webm',
  '.avi': 'video/x-msvideo', '.mkv': 'video/x-matroska', '.pdf': 'application/pdf',
  '.txt': 'text/plain', '.md': 'text/markdown', '.csv': 'text/csv', '.json': 'application/json',
  '.html': 'text/html', '.htm': 'text/html', '.xml': 'application/xml', '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint', '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

const propertySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['draft', 'review'],
  properties: {
    draft: {
      type: 'object',
      additionalProperties: false,
      required: [
        'title', 'description', 'operation', 'type', 'price', 'currency', 'bedrooms', 'bathrooms',
        'area', 'lotArea', 'parking', 'yearBuilt', 'city', 'state', 'country', 'address', 'lat', 'lng',
        'features', 'status', 'featured', 'published', 'mainPhotoFilename',
      ],
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        operation: { type: 'string', enum: ['venta', 'renta'] },
        type: { type: 'string', enum: ['casa', 'departamento', 'terreno', 'oficina', 'local', 'bodega', 'rancho', 'otros'] },
        price: { type: ['number', 'null'] },
        currency: { type: 'string', enum: ['MXN', 'USD', 'COP', 'EUR'] },
        bedrooms: { type: ['integer', 'null'] },
        bathrooms: { type: ['number', 'null'] },
        area: { type: ['number', 'null'] },
        lotArea: { type: ['number', 'null'] },
        parking: { type: ['integer', 'null'] },
        yearBuilt: { type: ['integer', 'null'] },
        city: { type: 'string' },
        state: { type: 'string' },
        country: { type: 'string' },
        address: { type: 'string' },
        lat: { type: ['number', 'null'] },
        lng: { type: ['number', 'null'] },
        features: { type: 'array', items: { type: 'string' } },
        status: { type: 'string', enum: ['available', 'sold', 'rented', 'reserved'] },
        featured: { type: 'boolean' },
        published: { type: 'boolean' },
        mainPhotoFilename: { type: 'string' },
      },
    },
    review: {
      type: 'object',
      additionalProperties: false,
      required: ['confidence', 'missingFields', 'warnings', 'visualSummary'],
      properties: {
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        missingFields: { type: 'array', items: { type: 'string' } },
        warnings: { type: 'array', items: { type: 'string' } },
        visualSummary: { type: 'string' },
      },
    },
  },
};

const normalizeRelativePath = value => String(value || '')
  .replace(/\\/g, '/')
  .replace(/^\/+/, '')
  .split('/')
  .filter(segment => segment && segment !== '.' && segment !== '..')
  .join('/');

const extensionOf = name => path.extname(String(name || '')).toLowerCase();

const categoryOf = file => {
  const extension = extensionOf(file.originalname);
  if ((file.mimetype || '').startsWith('image/') || IMAGE_EXTENSIONS.has(extension)) return 'image';
  if ((file.mimetype || '').startsWith('video/') || VIDEO_EXTENSIONS.has(extension)) return 'video';
  if (DOCUMENT_EXTENSIONS.has(extension)) return 'document';
  return 'other';
};

const isIgnoredFile = name => {
  const normalized = normalizeRelativePath(name);
  const base = path.basename(normalized).toLowerCase();
  return !normalized || normalized.startsWith('__MACOSX/') || base === '.ds_store' || base === 'thumbs.db' || base.startsWith('._');
};

const makeFile = ({ buffer, originalname, mimetype, size }) => {
  const relativePath = normalizeRelativePath(originalname);
  const extension = extensionOf(relativePath);
  return {
    buffer,
    originalname: relativePath || path.basename(originalname || 'archivo'),
    mimetype: mimetype || MIME_BY_EXTENSION[extension] || 'application/octet-stream',
    size: size ?? buffer.length,
  };
};

const expandUploadedFiles = uploadedFiles => {
  const expanded = [];
  let totalBytes = 0;

  const addFile = file => {
    if (isIgnoredFile(file.originalname)) return;
    if (expanded.length >= MAX_FILES) throw Object.assign(new Error(`La carpeta supera el máximo de ${MAX_FILES} archivos`), { statusCode: 413 });
    totalBytes += file.size;
    if (totalBytes > MAX_TOTAL_BYTES) throw Object.assign(new Error('La carpeta supera el límite total de 350 MB'), { statusCode: 413 });
    expanded.push(file);
  };

  for (const uploaded of uploadedFiles || []) {
    const extension = extensionOf(uploaded.originalname);
    if (extension !== '.zip') {
      addFile(makeFile(uploaded));
      continue;
    }

    let zip;
    try {
      zip = new AdmZip(uploaded.buffer);
    } catch {
      throw Object.assign(new Error(`No se pudo abrir el ZIP ${uploaded.originalname}`), { statusCode: 400 });
    }

    for (const entry of zip.getEntries()) {
      if (entry.isDirectory || isIgnoredFile(entry.entryName)) continue;
      const entrySize = Number(entry.header?.size || 0);
      if (entrySize > MAX_FILE_BYTES) {
        throw Object.assign(new Error(`El archivo ${entry.entryName} supera 120 MB`), { statusCode: 413 });
      }
      const buffer = entry.getData();
      addFile(makeFile({
        buffer,
        originalname: entry.entryName,
        mimetype: MIME_BY_EXTENSION[extensionOf(entry.entryName)],
        size: buffer.length,
      }));
    }
  }

  return expanded;
};

const buildInventory = files => {
  const counts = { images: 0, videos: 0, documents: 0, other: 0 };
  const media = [];

  for (const file of files) {
    const category = categoryOf(file);
    if (category === 'image') counts.images += 1;
    else if (category === 'video') counts.videos += 1;
    else if (category === 'document') counts.documents += 1;
    else counts.other += 1;

    media.push({
      name: path.basename(file.originalname),
      relativePath: file.originalname,
      category,
      mimetype: file.mimetype,
      size: file.size,
    });
  }

  return {
    counts,
    totalFiles: files.length,
    totalBytes: files.reduce((sum, file) => sum + file.size, 0),
    files: media,
  };
};

const extractTextDocuments = files => {
  const chunks = [];
  let characters = 0;

  for (const file of files) {
    if (!TEXT_EXTENSIONS.has(extensionOf(file.originalname))) continue;
    const remaining = MAX_TEXT_CHARS - characters;
    if (remaining <= 0) break;
    const text = file.buffer.toString('utf8').replace(/\u0000/g, '').trim();
    if (!text) continue;
    const excerpt = text.slice(0, Math.min(remaining, 30000));
    chunks.push(`\n--- ARCHIVO: ${file.originalname} ---\n${excerpt}`);
    characters += excerpt.length;
  }

  return chunks.join('\n');
};

const numberFromMatch = value => {
  if (!value) return null;
  const normalized = String(value).replace(/\s/g, '').replace(/,/g, '');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const fallbackDraft = (files, text) => {
  const firstDocumentLine = text.split(/\r?\n/).map(line => line.trim()).find(line => line && !line.startsWith('--- ARCHIVO'));
  const rootFolder = files[0]?.originalname?.split('/')[0] || '';
  const title = (firstDocumentLine || rootFolder || 'Nueva propiedad').slice(0, 140);
  const lower = `${text}\n${files.map(file => file.originalname).join('\n')}`.toLowerCase();
  const priceMatch = text.match(/(?:precio|valor|venta|renta)?\s*[:$]?\s*\$?\s*([\d][\d.,]{3,})\s*(mxn|usd|cop|eur|pesos|d[oó]lares)?/i);
  const bedroomMatch = lower.match(/(\d+)\s*(?:rec[aá]maras?|habitaciones?|dormitorios?)/i);
  const bathroomMatch = lower.match(/(\d+(?:\.5)?)\s*(?:baños?|sanitarios?)/i);
  const areaMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*m(?:2|²)\s*(?:de\s*)?(?:construcci[oó]n|construidos?)/i);
  const lotMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*m(?:2|²)\s*(?:de\s*)?(?:terreno|lote)/i);
  const parkingMatch = lower.match(/(\d+)\s*(?:estacionamientos?|cocheras?|garajes?)/i);
  const yearMatch = lower.match(/(?:año|construida|construido)\D{0,12}(19\d{2}|20\d{2})/i);
  const operation = /\brenta\b|\balquiler\b|\barrendamiento\b/.test(lower) ? 'renta' : 'venta';
  const types = ['departamento', 'terreno', 'oficina', 'local', 'bodega', 'rancho', 'casa'];
  const detectedType = types.find(type => lower.includes(type)) || 'otros';
  const features = [
    ['alberca', 'Alberca'], ['jardín', 'Jardín'], ['jardin', 'Jardín'], ['seguridad', 'Seguridad'],
    ['elevador', 'Elevador'], ['terraza', 'Terraza'], ['amueblado', 'Amueblado'], ['vista al mar', 'Vista al mar'],
    ['aire acondicionado', 'Aire acondicionado'], ['bodega', 'Bodega'], ['balcón', 'Balcón'], ['balcon', 'Balcón'],
  ].filter(([needle]) => lower.includes(needle)).map(([, label]) => label);
  const image = files.find(file => categoryOf(file) === 'image');

  return {
    draft: {
      title,
      description: text ? text.replace(/--- ARCHIVO:[^\n]+---/g, '').trim().slice(0, 3000) : '',
      operation,
      type: detectedType,
      price: numberFromMatch(priceMatch?.[1]),
      currency: /usd|d[oó]lares/.test(priceMatch?.[2] || '') ? 'USD' : /cop/.test(priceMatch?.[2] || '') ? 'COP' : 'MXN',
      bedrooms: bedroomMatch ? Number.parseInt(bedroomMatch[1], 10) : null,
      bathrooms: bathroomMatch ? numberFromMatch(bathroomMatch[1]) : null,
      area: areaMatch ? numberFromMatch(areaMatch[1].replace(',', '.')) : null,
      lotArea: lotMatch ? numberFromMatch(lotMatch[1].replace(',', '.')) : null,
      parking: parkingMatch ? Number.parseInt(parkingMatch[1], 10) : null,
      yearBuilt: yearMatch ? Number.parseInt(yearMatch[1], 10) : null,
      city: '', state: 'Veracruz', country: 'México', address: '', lat: null, lng: null,
      features: [...new Set(features)], status: 'available', featured: false, published: true,
      mainPhotoFilename: image ? path.basename(image.originalname) : '',
    },
    review: {
      confidence: 0.35,
      missingFields: ['price', 'city', 'address'].filter(field => !({ price: priceMatch?.[1], city: '', address: '' })[field]),
      warnings: ['La IA no está configurada; se aplicó una lectura básica por texto y nombres de archivo.'],
      visualSummary: '',
    },
  };
};

const extractResponseText = payload => {
  if (typeof payload.output_text === 'string') return payload.output_text;
  for (const item of payload.output || []) {
    for (const content of item.content || []) {
      if (content.type === 'output_text' && typeof content.text === 'string') return content.text;
    }
  }
  return '';
};

const analyzeWithOpenAI = async (files, inventory, extractedText) => {
  if (!process.env.OPENAI_API_KEY) return null;

  const warnings = [];
  const content = [{
    type: 'input_text',
    text: `Analiza este expediente inmobiliario y prepara una ficha profesional en español.\n\nREGLAS OBLIGATORIAS:\n- Extrae únicamente hechos respaldados por documentos, nombres de archivo o imágenes.\n- No inventes precio, ubicación, medidas, recámaras, baños ni amenidades. Usa null o cadena vacía cuando no exista evidencia.\n- Las imágenes sirven para describir espacios y elegir la fotografía principal, no para inferir datos legales o financieros.\n- Redacta una descripción comercial clara, precisa y sin afirmaciones engañosas.\n- Señala contradicciones, fotos borrosas, duplicadas, verticales, capturas de pantalla o materiales que no correspondan al inmueble.\n- El campo mainPhotoFilename debe coincidir exactamente con el nombre de una imagen del inventario.\n\nINVENTARIO:\n${inventory.files.map(file => `${file.category}: ${file.relativePath} (${file.mimetype}, ${file.size} bytes)`).join('\n')}\n\nTEXTO EXTRAÍDO:\n${extractedText || '(sin texto legible)'}`,
  }];

  const imageFiles = files.filter(file => categoryOf(file) === 'image').slice(0, 10);
  for (const file of imageFiles) {
    if (file.size > MAX_AI_IMAGE_BYTES || !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype)) {
      warnings.push(`La imagen ${file.originalname} no se envió a la IA por tamaño o formato; sí podrá publicarse si Cloudinary la admite.`);
      continue;
    }
    content.push({ type: 'input_text', text: `Imagen: ${path.basename(file.originalname)}` });
    content.push({ type: 'input_image', image_url: `data:${file.mimetype};base64,${file.buffer.toString('base64')}`, detail: 'auto' });
  }

  const pdfFiles = files.filter(file => extensionOf(file.originalname) === '.pdf').slice(0, 2);
  for (const file of pdfFiles) {
    if (file.size > MAX_AI_PDF_BYTES) {
      warnings.push(`El PDF ${file.originalname} no se envió a la IA porque supera 12 MB.`);
      continue;
    }
    content.push({
      type: 'input_file',
      filename: path.basename(file.originalname),
      file_data: `data:application/pdf;base64,${file.buffer.toString('base64')}`,
    });
  }

  const model = process.env.OPENAI_PROPERTY_MODEL || 'gpt-5';
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      instructions: 'Eres un analista inmobiliario y editor de catálogos. Tu prioridad es la exactitud factual y la calidad de presentación.',
      input: [{ role: 'user', content }],
      text: {
        format: {
          type: 'json_schema',
          name: 'property_import_analysis',
          strict: true,
          schema: propertySchema,
        },
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI respondió ${response.status}: ${detail.slice(0, 300)}`);
  }

  const payload = await response.json();
  const outputText = extractResponseText(payload);
  if (!outputText) throw new Error('La IA no devolvió un resultado estructurado');
  const result = JSON.parse(outputText);
  result.review.warnings = [...(result.review.warnings || []), ...warnings];
  return { result, model, responseId: payload.id || null };
};

const uniqueSlug = async title => {
  const base = String(title || 'propiedad')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'propiedad';
  let candidate = base;
  let suffix = 2;
  while (await prisma.property.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    candidate = `${base}-${suffix++}`;
  }
  return candidate;
};

const nullableNumber = value => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const nullableInteger = value => {
  const parsed = nullableNumber(value);
  return parsed === null ? null : Math.round(parsed);
};

const sanitizeDraft = async draft => {
  const allowedOperation = draft.operation === 'renta' ? 'renta' : 'venta';
  const allowedTypes = new Set(['casa', 'departamento', 'terreno', 'oficina', 'local', 'bodega', 'rancho', 'otros']);
  const allowedStatuses = new Set(['available', 'sold', 'rented', 'reserved']);
  const title = String(draft.title || '').trim().slice(0, 180);
  const description = String(draft.description || '').trim().slice(0, 12000);
  const city = String(draft.city || '').trim().slice(0, 120);
  const price = nullableNumber(draft.price);

  if (!title) throw Object.assign(new Error('El título es obligatorio'), { statusCode: 400 });
  if (!description) throw Object.assign(new Error('La descripción es obligatoria'), { statusCode: 400 });
  if (!city) throw Object.assign(new Error('La ciudad es obligatoria'), { statusCode: 400 });
  if (price === null || price <= 0) throw Object.assign(new Error('El precio debe ser mayor que cero'), { statusCode: 400 });

  const features = Array.isArray(draft.features)
    ? [...new Set(draft.features.map(value => String(value).trim()).filter(Boolean))].slice(0, 80)
    : [];

  return {
    title,
    slug: await uniqueSlug(title),
    description,
    operation: allowedOperation,
    type: allowedTypes.has(draft.type) ? draft.type : 'otros',
    price,
    currency: ['MXN', 'USD', 'COP', 'EUR'].includes(draft.currency) ? draft.currency : 'MXN',
    bedrooms: nullableInteger(draft.bedrooms),
    bathrooms: nullableNumber(draft.bathrooms),
    area: nullableNumber(draft.area),
    lotArea: nullableNumber(draft.lotArea),
    parking: nullableInteger(draft.parking),
    yearBuilt: nullableInteger(draft.yearBuilt),
    city,
    state: String(draft.state || 'Veracruz').trim().slice(0, 120),
    country: String(draft.country || 'México').trim().slice(0, 120),
    address: String(draft.address || '').trim().slice(0, 300) || null,
    lat: nullableNumber(draft.lat),
    lng: nullableNumber(draft.lng),
    features: features.length ? JSON.stringify(features) : null,
    status: allowedStatuses.has(draft.status) ? draft.status : 'available',
    featured: Boolean(draft.featured),
    published: false,
  };
};

const orderedMediaFiles = (files, mediaOrder = []) => {
  const media = files.filter(file => ['image', 'video'].includes(categoryOf(file)));
  const rank = new Map(mediaOrder.map((name, index) => [String(name), index]));
  return media.sort((a, b) => {
    const aName = path.basename(a.originalname);
    const bName = path.basename(b.originalname);
    const aRank = rank.has(aName) ? rank.get(aName) : Number.MAX_SAFE_INTEGER;
    const bRank = rank.has(bName) ? rank.get(bName) : Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;
    if (categoryOf(a) !== categoryOf(b)) return categoryOf(a) === 'image' ? -1 : 1;
    return a.originalname.localeCompare(b.originalname, 'es', { numeric: true });
  });
};

router.post('/analyze', authMiddleware, upload.array('files', MAX_FILES), async (req, res) => {
  try {
    const files = expandUploadedFiles(req.files);
    if (!files.length) return res.status(400).json({ error: 'No se recibieron archivos' });

    const inventory = buildInventory(files);
    const extractedText = extractTextDocuments(files);
    let analysis = fallbackDraft(files, extractedText);
    let ai = { enabled: Boolean(process.env.OPENAI_API_KEY), used: false, model: null, responseId: null };

    if (process.env.OPENAI_API_KEY) {
      try {
        const openAI = await analyzeWithOpenAI(files, inventory, extractedText);
        analysis = openAI.result;
        ai = { enabled: true, used: true, model: openAI.model, responseId: openAI.responseId };
      } catch (error) {
        console.error('Property import AI analysis error:', error);
        analysis.review.warnings.push(`La lectura con IA falló y se usó el análisis básico: ${error.message}`);
      }
    }

    const requiredMissing = [];
    if (!analysis.draft.title) requiredMissing.push('title');
    if (!analysis.draft.description) requiredMissing.push('description');
    if (!analysis.draft.price) requiredMissing.push('price');
    if (!analysis.draft.city) requiredMissing.push('city');
    if (!inventory.counts.images) requiredMissing.push('photos');
    analysis.review.missingFields = [...new Set([...(analysis.review.missingFields || []), ...requiredMissing])];

    res.json({
      ...analysis,
      inventory,
      ai,
      limits: { maxFiles: MAX_FILES, maxFileBytes: MAX_FILE_BYTES, maxTotalBytes: MAX_TOTAL_BYTES },
    });
  } catch (error) {
    console.error('Analyze property folder error:', error);
    res.status(error.statusCode || 500).json({ error: error.message || 'No se pudo analizar la carpeta' });
  }
});

router.post('/publish', authMiddleware, upload.array('files', MAX_FILES), async (req, res) => {
  let property = null;
  const uploadedAssets = [];

  try {
    const files = expandUploadedFiles(req.files);
    if (!files.length) return res.status(400).json({ error: 'No se recibieron archivos' });

    let draft;
    try {
      draft = JSON.parse(req.body.draft || '{}');
    } catch {
      return res.status(400).json({ error: 'El borrador no tiene un formato válido' });
    }

    const mediaOrder = Array.isArray(draft.mediaOrder) ? draft.mediaOrder : [];
    const mainPhotoFilename = String(draft.mainPhotoFilename || '');
    const mediaFiles = orderedMediaFiles(files, mediaOrder);
    const imageFiles = mediaFiles.filter(file => categoryOf(file) === 'image');
    const videoFiles = mediaFiles.filter(file => categoryOf(file) === 'video');

    if (!imageFiles.length) return res.status(400).json({ error: 'Se requiere al menos una fotografía para publicar la propiedad' });
    if (imageFiles.length > 50) return res.status(400).json({ error: 'Máximo 50 fotografías por propiedad' });
    if (videoFiles.length > 8) return res.status(400).json({ error: 'Máximo 8 videos por propiedad' });

    const propertyData = await sanitizeDraft(draft);
    property = await prisma.property.create({ data: propertyData });

    let order = 0;
    const hasNamedMain = imageFiles.some(file => path.basename(file.originalname) === mainPhotoFilename);

    for (const file of mediaFiles) {
      const category = categoryOf(file);
      if (!['image', 'video'].includes(category)) continue;
      const isVideo = category === 'video';
      const result = await uploadToCloudinary(file.buffer, {
        folder: `circulo-bienes-raices/${property.id}`,
        resource_type: isVideo ? 'video' : 'image',
        transformation: isVideo ? undefined : [
          { width: 1800, height: 1200, crop: 'limit' },
          { quality: 'auto:good' },
          { fetch_format: 'auto' },
        ],
      });

      const storedPublicId = isVideo ? `video:${result.public_id}` : result.public_id;
      uploadedAssets.push(storedPublicId);
      const baseName = path.basename(file.originalname);
      const isMain = !isVideo && (hasNamedMain ? baseName === mainPhotoFilename : order === 0);

      if (isMain) {
        await prisma.photo.updateMany({ where: { propertyId: property.id }, data: { isMain: false } });
      }

      await prisma.photo.create({
        data: {
          url: result.secure_url,
          publicId: storedPublicId,
          alt: isVideo ? `Video de ${property.title}` : `${property.title} - ${baseName.replace(/[-_]/g, ' ').replace(/\.[^.]+$/, '')}`,
          order,
          isMain,
          propertyId: property.id,
        },
      });
      order += 1;
    }

    const published = draft.published !== false;
    property = await prisma.property.update({
      where: { id: property.id },
      data: { published },
      include: { photos: { orderBy: { order: 'asc' } } },
    });

    res.status(201).json({
      property,
      summary: {
        images: imageFiles.length,
        videos: videoFiles.length,
        published,
      },
    });
  } catch (error) {
    console.error('Publish property folder error:', error);
    for (const publicId of uploadedAssets.reverse()) {
      try { await deleteFromCloudinary(publicId); } catch (cleanupError) { console.error('Cloudinary cleanup error:', cleanupError); }
    }
    if (property?.id) {
      try { await prisma.property.delete({ where: { id: property.id } }); } catch (cleanupError) { console.error('Property cleanup error:', cleanupError); }
    }
    res.status(error.statusCode || 500).json({ error: error.message || 'No se pudo publicar la propiedad' });
  }
});

module.exports = router;
