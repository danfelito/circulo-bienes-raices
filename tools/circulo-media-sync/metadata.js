'use strict';

const STATUS_MAP = new Map([
  ['available', 'available'], ['disponible', 'available'],
  ['reserved', 'reserved'], ['reservada', 'reserved'], ['reservado', 'reserved'],
  ['sold', 'sold'], ['vendida', 'sold'], ['vendido', 'sold'],
  ['rented', 'rented'], ['rentada', 'rented'], ['rentado', 'rented'],
]);

const decodeTextBuffer = buffer => {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) return buffer.subarray(2).toString('utf16le');
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    const source = buffer.subarray(2);
    const swapped = Buffer.alloc(source.length - (source.length % 2));
    for (let index = 0; index < swapped.length; index += 2) {
      swapped[index] = source[index + 1];
      swapped[index + 1] = source[index];
    }
    return swapped.toString('utf16le');
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer).replace(/^\uFEFF/, '');
  } catch {
    return new TextDecoder('windows-1252').decode(buffer).replace(/^\uFEFF/, '');
  }
};

const foldText = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('es-MX')
  .trim();

const normalizeMetadataKey = value => foldText(value).replace(/[\s-]+/g, '_');

const metadataValue = (metadata, ...keys) => {
  for (const key of keys) {
    if (metadata?.[key] !== undefined && metadata[key] !== null && metadata[key] !== '') return metadata[key];
  }
  const normalized = new Map(Object.entries(metadata || {}).map(([key, value]) => [normalizeMetadataKey(key), value]));
  for (const key of keys) {
    const value = normalized.get(normalizeMetadataKey(key));
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
};

const parseFlexibleNumber = value => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value === null || value === undefined || value === '') return null;
  let normalized = String(value).trim().replace(/[^0-9.,+-]/g, '');
  if (!normalized || !/[0-9]/.test(normalized)) return null;
  const commaIndex = normalized.lastIndexOf(',');
  const dotIndex = normalized.lastIndexOf('.');
  if (commaIndex !== -1 && dotIndex !== -1) {
    const decimalSeparator = commaIndex > dotIndex ? ',' : '.';
    normalized = normalized.split(decimalSeparator === ',' ? '.' : ',').join('');
    if (decimalSeparator === ',') normalized = normalized.replace(',', '.');
  } else {
    const separator = commaIndex !== -1 ? ',' : dotIndex !== -1 ? '.' : '';
    if (separator) {
      const parts = normalized.split(separator);
      const lastGroup = parts.at(-1);
      if (parts.length > 2 || lastGroup.length === 3) normalized = parts.join('');
      else if (separator === ',') normalized = normalized.replace(',', '.');
    }
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseCoordinate = (value, minimum, maximum) => {
  if (value === null || value === undefined || value === '') return null;
  const text = String(value).trim().replace(/[°\s]/g, '');
  if (text.includes(',') && text.includes('.')) throw new Error(`Coordenada ambigua: ${text}`);
  const parsed = Number(text.replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`La coordenada debe estar entre ${minimum} y ${maximum}`);
  }
  return parsed;
};

const parseLocalizedBoolean = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  const normalized = foldText(value);
  if (['true', '1', 'si', 'yes'].includes(normalized)) return true;
  if (['false', '0', 'no'].includes(normalized)) return false;
  throw new Error(`Valor booleano no válido: ${String(value).slice(0, 30)}`);
};

const draftFromReadme = (property, parsed) => {
  const m = parsed.metadata;
  const statusRaw = foldText(metadataValue(m, 'status', 'estado') || 'available');
  const operationRaw = foldText(metadataValue(m, 'operation', 'operacion', 'operación') || 'venta');
  const typeRaw = foldText(metadataValue(m, 'type', 'tipo') || 'otros');
  const publishedValue = metadataValue(m, 'published', 'publicada', 'publicado');
  const featuredValue = metadataValue(m, 'featured', 'destacada', 'destacado');
  const cover = String(metadataValue(m, 'cover', 'portada', 'main_photo') || '').replace(/\\/g, '/');
  return {
    title: String(metadataValue(m, 'title', 'titulo', 'título') || property.folderName).trim(),
    description: parsed.body || String(metadataValue(m, 'description', 'descripcion', 'descripción') || '').trim(),
    operation: operationRaw.includes('rent') || operationRaw.includes('alquil') ? 'renta' : 'venta',
    type: ['casa', 'departamento', 'terreno', 'oficina', 'local', 'bodega', 'rancho', 'otros'].includes(typeRaw) ? typeRaw : 'otros',
    price: parseFlexibleNumber(metadataValue(m, 'price', 'precio')),
    currency: String(metadataValue(m, 'currency', 'moneda') || 'MXN').trim().toUpperCase(),
    bedrooms: parseFlexibleNumber(metadataValue(m, 'bedrooms', 'recamaras', 'recámaras', 'habitaciones')),
    bathrooms: parseFlexibleNumber(metadataValue(m, 'bathrooms', 'banos', 'baños')),
    area: parseFlexibleNumber(metadataValue(m, 'construction_area', 'area', 'construccion', 'construcción')),
    lotArea: parseFlexibleNumber(metadataValue(m, 'land_area', 'lot_area', 'terreno')),
    parking: parseFlexibleNumber(metadataValue(m, 'parking', 'estacionamientos')),
    yearBuilt: parseFlexibleNumber(metadataValue(m, 'year_built', 'ano_construccion', 'año_construcción')),
    city: String(metadataValue(m, 'city', 'ciudad') || '').trim(),
    state: String(metadataValue(m, 'state', 'estado_region') || 'Veracruz').trim(),
    country: String(metadataValue(m, 'country', 'pais', 'país') || 'México').trim(),
    address: String(metadataValue(m, 'address', 'direccion', 'dirección') || '').trim(),
    lat: parseCoordinate(metadataValue(m, 'lat', 'latitude', 'latitud'), -90, 90),
    lng: parseCoordinate(metadataValue(m, 'lng', 'longitude', 'longitud'), -180, 180),
    features: parsed.features,
    status: STATUS_MAP.get(statusRaw) || 'available',
    featured: parseLocalizedBoolean(featuredValue, false),
    published: parseLocalizedBoolean(publishedValue, true),
    mainPhotoFilename: cover,
    updatedAt: String(metadataValue(m, 'updated_at', 'actualizada', 'actualizado') || new Date().toISOString()),
  };
};

module.exports = {
  STATUS_MAP,
  decodeTextBuffer,
  draftFromReadme,
  foldText,
  metadataValue,
  parseCoordinate,
  parseFlexibleNumber,
  parseLocalizedBoolean,
};
