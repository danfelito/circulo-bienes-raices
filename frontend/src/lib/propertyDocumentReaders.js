import { BlobReader, ZipReader } from '@zip.js/zip.js';

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const MAX_TEXT_BYTES = 256 * 1024;
const checkText = text => {
  if (new TextEncoder().encode(text).byteLength > MAX_TEXT_BYTES) throw new Error('La ficha excede 256 KB de texto. Divide el documento por inmueble.');
  return text;
};

export async function readRichPropertyDocument(file, signal) {
  if (file.size > MAX_DOCUMENT_BYTES) throw new Error(`${file.name}: máximo 10 MB por documento.`);
  signal?.throwIfAborted();
  if (/\.docx$/i.test(file.name)) {
    // Bound decompression before Mammoth opens the document; never evaluate its HTML.
    const zip = new ZipReader(new BlobReader(file));
    try {
      const entries = await zip.getEntries();
      if (entries.length > 1000 || entries.reduce((total, entry) => total + entry.uncompressedSize, 0) > 32 * 1024 * 1024) {
        throw new Error(`${file.name}: el documento expandido excede el límite de lectura.`);
      }
    } finally { await zip.close(); }
    const { default: mammoth } = await import('mammoth/mammoth.browser.js');
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    signal?.throwIfAborted();
    return checkText(result.value);
  }
  const pdfjs = await import('pdfjs-dist/build/pdf.mjs');
  const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false, useSystemFonts: true });
  const abort = () => { task.destroy().catch(() => {}); };
  signal?.addEventListener('abort', abort, { once: true });
  try {
    signal?.throwIfAborted();
    const pdf = await task.promise;
    if (pdf.numPages > 30) throw new Error(`${file.name}: máximo 30 páginas por ficha.`);
    const pages = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      signal?.throwIfAborted();
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      let lastY;
      let text = '';
      for (const item of content.items) {
        if (!('str' in item)) continue;
        const y = item.transform?.[5];
        if (lastY !== undefined && y !== undefined && Math.abs(y - lastY) > 3 && !text.endsWith('\n')) text += '\n';
        text += item.str + (item.hasEOL ? '\n' : ' ');
        lastY = y;
      }
      pages.push(text);
      checkText(pages.join('\n\n'));
      page.cleanup();
    }
    const text = pages.join('\n\n').trim();
    if (!text) throw new Error(`${file.name}: el PDF es una imagen escaneada; agrega la ficha en TXT o Word para leer sus datos.`);
    return text;
  } finally {
    signal?.removeEventListener('abort', abort);
    await task.destroy();
  }
}
