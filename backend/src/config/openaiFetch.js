const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const INSTALL_FLAG = Symbol.for('circulo.openaiFetchNormalizer');

const stripDataUrlPrefix = value => {
  if (typeof value !== 'string' || !value.startsWith('data:')) return value;
  const marker = ';base64,';
  const markerIndex = value.indexOf(marker);
  return markerIndex >= 0 ? value.slice(markerIndex + marker.length) : value;
};

const normalizeInputFiles = value => {
  if (Array.isArray(value)) return value.map(normalizeInputFiles);
  if (!value || typeof value !== 'object') return value;

  const normalized = {};
  for (const [key, child] of Object.entries(value)) {
    normalized[key] = normalizeInputFiles(child);
  }

  if (normalized.type === 'input_file' && typeof normalized.file_data === 'string') {
    normalized.file_data = stripDataUrlPrefix(normalized.file_data);
  }

  return normalized;
};

const installOpenAIFetchNormalizer = () => {
  if (globalThis[INSTALL_FLAG] || typeof globalThis.fetch !== 'function') return;

  const nativeFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input?.url;
    if (url !== OPENAI_RESPONSES_URL || typeof init.body !== 'string') {
      return nativeFetch(input, init);
    }

    try {
      const payload = JSON.parse(init.body);
      return nativeFetch(input, {
        ...init,
        body: JSON.stringify(normalizeInputFiles(payload)),
      });
    } catch {
      return nativeFetch(input, init);
    }
  };

  globalThis[INSTALL_FLAG] = true;
};

module.exports = { installOpenAIFetchNormalizer, normalizeInputFiles };
