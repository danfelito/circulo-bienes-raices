// Deterministic extraction only. Source text is data, never instructions or code.
export const FIELD_LABELS = Object.freeze({
  propertyId: 'Referencia del README', title: 'Título', description: 'Descripción',
  operation: 'Operación', type: 'Tipo', price: 'Precio', currency: 'Moneda',
  bedrooms: 'Recámaras', bathrooms: 'Baños', area: 'Construcción', lotArea: 'Terreno',
  parking: 'Estacionamientos', yearBuilt: 'Año de construcción', city: 'Ciudad',
  state: 'Estado / provincia', country: 'País', address: 'Dirección', lat: 'Latitud',
  lng: 'Longitud', features: 'Características', status: 'Disponibilidad',
  featured: 'Destacada', published: 'Publicación', mainPhotoFilename: 'Portada',
});
const fold = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const keyOf = value => fold(value).replace(/[\s_-]+/g, '');
const aliases = {
  propertyId: ['property_id', 'sourceId', 'id_propiedad', 'referencia', 'codigo'],
  title: ['title', 'titulo'], description: ['description', 'descripcion'],
  operation: ['operation', 'operacion'], type: ['type', 'tipo', 'tipo_inmueble'],
  price: ['price', 'precio', 'valor'], currency: ['currency', 'moneda'],
  bedrooms: ['bedrooms', 'recamaras', 'habitaciones', 'dormitorios'],
  bathrooms: ['bathrooms', 'banos'], parking: ['parking', 'estacionamientos', 'cocheras'],
  area: ['area', 'construction_area', 'built_area', 'construccion', 'superficie_construida'],
  lotArea: ['lotArea', 'land_area', 'terreno', 'superficie_terreno'],
  yearBuilt: ['yearBuilt', 'year_built', 'ano_construccion'],
  city: ['city', 'ciudad', 'municipio'], state: ['state', 'estado', 'provincia'],
  country: ['country', 'pais'], address: ['address', 'direccion'],
  lat: ['lat', 'latitude', 'latitud'], lng: ['lng', 'longitude', 'longitud'],
  features: ['features', 'caracteristicas', 'amenidades', 'amenities'],
  status: ['status', 'estatus', 'disponibilidad'], featured: ['featured', 'destacada', 'destacado'],
  published: ['published', 'publicado', 'publicada'], mainPhotoFilename: ['cover', 'portada', 'mainPhotoFilename'],
};
const fieldsByKey = new Map(Object.entries(aliases).flatMap(([field, keys]) => keys.map(key => [keyOf(key), field])));
const enums = {
  operation: { venta: 'venta', sale: 'venta', renta: 'renta', alquiler: 'renta', rent: 'renta' },
  type: { casa: 'casa', house: 'casa', departamento: 'departamento', apartment: 'departamento',
    terreno: 'terreno', land: 'terreno', oficina: 'oficina', office: 'oficina', local: 'local',
    bodega: 'bodega', warehouse: 'bodega', rancho: 'rancho', ranch: 'rancho', otros: 'otros', other: 'otros' },
  status: { available: 'available', disponible: 'available', sold: 'sold', vendido: 'sold', vendida: 'sold',
    rented: 'rented', rentado: 'rented', rentada: 'rented', alquilado: 'rented', alquilada: 'rented',
    reserved: 'reserved', reservado: 'reserved', reservada: 'reserved' },
  currency: { mxn: 'MXN', usd: 'USD', cop: 'COP', eur: 'EUR' },
};
const numberFields = new Set(['price', 'bedrooms', 'bathrooms', 'area', 'lotArea', 'parking', 'yearBuilt', 'lat', 'lng']);
const integerFields = new Set(['bedrooms', 'parking', 'yearBuilt']);
const unquote = value => String(value ?? '').trim().replace(/^(["'])([\s\S]*)\1$/, '$2');
const fail = message => { throw Object.assign(new Error(message), { status: 422 }); };

export const emptyPropertyDraft = () => ({
  ...Object.fromEntries(Object.keys(FIELD_LABELS).map(field => [field, ''])),
  features: [], featured: false, published: false,
});

// Anchored to ONE value: never consumes the number on the next line.
export function parsePropertyNumber(raw, field) {
  if (typeof raw === 'number') return validNumber(raw, field) ? raw : null;
  let value = fold(unquote(raw));
  if (!value || /[\r\n]/.test(value)) return null;
  if (field === 'price') value = value.replace(/^(?:mxn|usd|cop|eur|us\$|\$)\s*/i, '')
    .replace(/\s*(?:mxn|usd|cop|eur|pesos|dolares|euros)$/i, '').trim();
  if (field === 'area' || field === 'lotArea') value = value.replace(/\s*(?:m²|m2|m\^2)$/i, '').trim();
  let multiplier = 1;
  if (field === 'price' && /\s*(?:millones?|mil)$/.test(value)) {
    multiplier = /millones?$/.test(value) ? 1e6 : 1e3;
    value = value.replace(/\s*(?:millones?|mil)$/, '').trim();
  }
  if (!/^-?\d[\d., ]*$/.test(value)) return null;
  if (value.includes(' ')) {
    if (!/^-?\d{1,3}(?: \d{3})+(?:[.,]\d{1,2})?$/.test(value)) return null;
    value = value.replaceAll(' ', '');
  }
  const both = value.includes(',') && value.includes('.');
  if (both) {
    const decimal = value.lastIndexOf(',') > value.lastIndexOf('.') ? ',' : '.';
    const grouping = decimal === ',' ? '.' : ',';
    const [whole, fraction, extra] = value.split(decimal);
    const groupPattern = grouping === '.' ? /^-?\d{1,3}(?:\.\d{3})+$/ : /^-?\d{1,3}(?:,\d{3})+$/;
    if (extra !== undefined || !groupPattern.test(whole) || !/^\d{1,2}$/.test(fraction)) return null;
    value = `${whole.replaceAll(grouping, '')}.${fraction}`;
  } else if (value.includes(',') || value.includes('.')) {
    const separator = value.includes(',') ? ',' : '.';
    const parts = value.split(separator);
    // Coordinates always use a decimal separator, never grouping.
    const grouped = !['lat', 'lng'].includes(field) && multiplier === 1
      && /^-?\d{1,3}$/.test(parts[0]) && parts.slice(1).every(part => /^\d{3}$/.test(part));
    if (grouped) value = parts.join('');
    else if (parts.length === 2 && /^\d+$/.test(parts[1])) value = parts.join('.');
    else return null;
  }
  const number = Number(value) * multiplier;
  return validNumber(number, field) ? number : null;
}

function validNumber(number, field) {
  if (!Number.isFinite(number) || Math.abs(number) > Number.MAX_SAFE_INTEGER) return false;
  if (field === 'lat') return Math.abs(number) <= 90;
  if (field === 'lng') return Math.abs(number) <= 180;
  if (number < 0 || (field === 'price' && number <= 0)) return false;
  if (integerFields.has(field) && !Number.isInteger(number)) return false;
  if (field === 'yearBuilt' && (number < 1000 || number > 2200)) return false;
  return true;
}

function csvRows(text) {
  const first = text.split(/\r?\n/)[0];
  const delimiter = first.includes(';') ? ';' : ',';
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i += 1; }
      else quoted = !quoted;
    } else if (c === delimiter && !quoted) { row.push(cell); cell = ''; }
    else if (c === '\n' && !quoted) { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (quoted) fail('El CSV tiene comillas sin cerrar. Corrige el archivo antes de analizar.');
  if (cell || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); }
  return rows.filter(cells => cells.some(value => value.trim()));
}

function documentEntries(document) {
  const text = String(document.text || '').replace(/^\uFEFF/, '');
  const entries = [];
  const add = (key, value, line) => entries.push({ field: fieldsByKey.get(keyOf(key)), key, value, line });
  if (/\.json$/i.test(document.name)) {
    let record;
    try { record = JSON.parse(text); } catch { fail(`${document.name}: JSON no válido.`); }
    if (Array.isArray(record)) {
      if (record.length !== 1) fail('Carga una sola propiedad por importación; el JSON contiene varios registros o está vacío.');
      [record] = record;
    }
    if (!record || typeof record !== 'object' || Array.isArray(record)) fail(`${document.name}: se esperaba una ficha JSON.`);
    Object.entries(record).forEach(([key, value]) => add(key, value, null));
  } else if (/\.csv$/i.test(document.name)) {
    const rows = csvRows(text);
    if (rows.length !== 2) fail('El CSV debe tener encabezados y una sola propiedad. Separa las fichas.');
    if (rows[0].length !== rows[1].length) fail('El CSV tiene un número de columnas inconsistente.');
    rows[0].forEach((key, index) => add(key, rows[1][index], 2));
  } else {
    const lines = text.split(/\r?\n/);
    const frontmatter = lines[0]?.trim() === '---';
    const end = frontmatter ? lines.findIndex((line, i) => i > 0 && line.trim() === '---') : -1;
    if (frontmatter && end < 0) fail(`${document.name}: falta cerrar el bloque de metadatos con ---`);
    let current = null;
    for (let index = frontmatter ? 1 : 0; index < (end > 0 ? end : lines.length); index += 1) {
      const line = lines[index];
      const match = line.match(/^\s*(?:\*\*)?([\p{L}_][\p{L}\d _-]{0,70}?)(?:\*\*)?\s*[:=]\s*(.*)$/u);
      if (match) { add(match[1].trim(), match[2], index + 1); current = entries.at(-1); }
      else if (current?.field === 'features' && /^\s*-\s+/.test(line)) {
        if (!Array.isArray(current.value)) current.value = current.value ? [current.value] : [];
        current.value.push(line.replace(/^\s*-\s+/, '').trim());
      } else if (current?.field === 'description' && /^\s+\S/.test(line)) {
        current.value = `${current.value === '|' || current.value === '>' ? '' : current.value}\n${line.trim()}`.trim();
      } else if (line.trim()) current = null;
    }
    if (end > 0 && !entries.some(entry => entry.field === 'description')) {
      const body = lines.slice(end + 1).join('\n').trim();
      // Do not promote a contact section or unrecognized key/value lines to public copy.
      if (body && !/^[\s#*\-]*[\p{L}_][\p{L}\d _-]{0,70}\s*[:=]/mu.test(body)) add('description', body, end + 2);
    }
  }
  return entries;
}

function parseDocument(document) {
  const draft = {}, sources = {}, warnings = [], invalid = new Set();
  for (const entry of documentEntries(document)) {
    const { field, key, line } = entry;
    if (!field) continue; // Allowlist: owner/contact/internal metadata never become public fields.
    const raw = entry.value;
    if (raw === null || raw === undefined || raw === '') continue;
    let value;
    if (field === 'features') {
      let values = raw;
      if (!Array.isArray(values) && String(values).trim().startsWith('[')) {
        try { values = JSON.parse(values); } catch { values = String(values).replace(/^\[|\]$/g, '').split(','); }
      }
      if (!Array.isArray(values)) values = String(values).split(/[,;\n]/);
      value = [...new Set(values.filter(item => typeof item === 'string').map(unquote).filter(Boolean))].slice(0, 100);
    } else if (numberFields.has(field)) value = parsePropertyNumber(raw, field);
    else if (enums[field]) value = enums[field][fold(unquote(raw))] ?? null;
    else if (field === 'published' || field === 'featured') {
      const boolean = fold(unquote(raw));
      value = ['true', '1', 'si', 'yes'].includes(boolean) ? true : ['false', '0', 'no'].includes(boolean) ? false : null;
    } else value = typeof raw === 'string' || typeof raw === 'number' ? unquote(raw) : null;
    if (value === null) { invalid.add(field); warnings.push(`${FIELD_LABELS[field]}: formato no válido en ${document.name}; completa o corrige el campo.`); continue; }
    if (Object.hasOwn(draft, field) && JSON.stringify(draft[field]) !== JSON.stringify(value)) {
      invalid.add(field); warnings.push(`${FIELD_LABELS[field]} tiene valores contradictorios en ${document.name}; el campo se dejó vacío.`);
    } else { draft[field] = value; sources[field] = { file: document.name, line, key }; }
  }
  for (const field of invalid) { delete draft[field]; delete sources[field]; }
  return { document, draft, sources, warnings };
}

export function validatePropertyDraft(draft, { requireDetails = true } = {}) {
  const required = ['title', 'description', 'price', 'city'];
  if (requireDetails) required.push('operation', 'type', 'currency', 'state', 'country', 'status');
  const missingFields = required.filter(field => draft?.[field] === null || draft?.[field] === undefined || String(draft[field]).trim() === '');
  const invalidFields = [];
  for (const field of numberFields) {
    const value = draft?.[field];
    if (value === '' || value === null || value === undefined) continue;
    if (!['number', 'string'].includes(typeof value) || !validNumber(Number(value), field)) invalidFields.push(field);
  }
  for (const [field, values] of Object.entries(enums)) {
    if (draft?.[field] && !Object.values(values).includes(draft[field])) invalidFields.push(field);
  }
  if ((draft?.lat !== '' && draft?.lat != null) !== (draft?.lng !== '' && draft?.lng != null)) invalidFields.push('lat', 'lng');
  return { missingFields, invalidFields: [...new Set(invalidFields)] };
}

export function analyzePropertyDocuments(inventory, documents) {
  const readmes = documents.filter(item => /(?:^|\/)readme\.(txt|md)$/i.test(item.name));
  const parents = new Set(readmes.map(item => item.name.split('/').slice(0, -1).join('/')));
  if (parents.size > 1) fail('Hay README en carpetas de distintas propiedades. Carga una sola carpeta por importación.');
  const parsed = documents.map(parseDocument);
  const identifiers = new Set(parsed.map(item => item.draft.propertyId).filter(Boolean));
  if (identifiers.size > 1) fail('Los documentos contienen distintas referencias de propiedad. Separa las fichas antes de continuar.');
  // Prefer README, then a structured ficha. Never assemble a property from unrelated documents.
  const primary = parsed.find(item => readmes.includes(item.document))
    || parsed.find(item => Object.keys(item.draft).length);
  const draft = { ...emptyPropertyDraft(), ...primary?.draft, published: false };
  const sources = { ...primary?.sources };
  const warnings = parsed.flatMap(item => item.warnings);
  const conflicts = new Set();
  if (!primary) warnings.push('No se encontraron campos reconocibles. Completa la ficha manualmente.');
  for (const other of parsed.filter(item => item !== primary && Object.keys(item.draft).length)) {
    warnings.push(`${other.document.name}: no se combinaron sus datos con la ficha principal.`);
    for (const [field, value] of Object.entries(other.draft)) {
      if (Object.hasOwn(primary.draft, field) && JSON.stringify(primary.draft[field]) !== JSON.stringify(value)) conflicts.add(field);
    }
  }
  for (const field of conflicts) {
    draft[field] = emptyPropertyDraft()[field]; delete sources[field];
    warnings.push(`${FIELD_LABELS[field]} difiere entre documentos. Confirma el dato correcto.`);
  }
  if (primary?.draft.published === true) warnings.push('El README pide publicar. Por seguridad, debes marcar la publicación manualmente.');
  if (draft.propertyId) warnings.push('La referencia del README es informativa: este importador crea una ficha nueva, no actualiza otra existente.');
  const images = (inventory.media || inventory.files).filter(item => item.category === 'image');
  const cover = draft.mainPhotoFilename.replaceAll('\\', '/').replace(/^\.\//, '');
  const parent = primary?.document.name.split('/').slice(0, -1).join('/');
  const candidates = images.filter(item => item.path === cover || item.path === `${parent ? `${parent}/` : ''}${cover}`);
  if (cover && candidates.length === 1) draft.mainPhotoFilename = candidates[0].path;
  else {
    draft.mainPhotoFilename = images[0]?.path || '';
    delete sources.mainPhotoFilename;
    warnings.push(cover ? 'La portada indicada no coincide con una foto única; revisa la selección.' : 'Portada provisional: selecciona la fotografía principal.');
  }
  const { missingFields, invalidFields } = validatePropertyDraft(draft);
  return { draft, ai: { used: false, model: null }, review: {
    method: 'structured-metadata', sourceDocument: primary?.document.name || null,
    sources, missingFields, invalidFields, warnings: [...new Set(warnings)],
    visualSummary: 'Lectura de datos escritos; sin IA externa, fotografías ni PDF. Los campos no proporcionados quedan vacíos.',
  } };
}
