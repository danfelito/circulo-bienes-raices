import assert from 'node:assert/strict';
import { File } from 'node:buffer';
import { BlobWriter, TextReader, ZipWriter } from '@zip.js/zip.js';
import { buildInventory, expandZipFiles, retry } from '../src/lib/propertyImport.js';

const zipWriter = new ZipWriter(new BlobWriter('application/zip'));
await zipWriter.add('expediente/fachada.jpg', new TextReader('imagen simulada'));
await zipWriter.add('expediente/README.txt', new TextReader('Título: Casa con jardín'));
const zipBlob = await zipWriter.close();
const expanded = await expandZipFiles([new File([zipBlob], 'expediente.zip', { type: 'application/zip' })]);
assert.deepEqual(expanded.map(file => file.relativePath), ['expediente/fachada.jpg', 'expediente/README.txt']);
const inventory = buildInventory(expanded);
assert.equal(inventory.counts.images, 1);
assert.equal(inventory.counts.documents, 1);

const unsafeWriter = new ZipWriter(new BlobWriter('application/zip'));
await unsafeWriter.add('../escape.jpg', new TextReader('no debe salir'));
const unsafeBlob = await unsafeWriter.close();
await assert.rejects(
  expandZipFiles([new File([unsafeBlob], 'unsafe.zip', { type: 'application/zip' })]),
  /(ruta no segura|unsafe filename)/i,
);

let attempts = 0;
const recovered = await retry(async () => {
  attempts += 1;
  if (attempts < 3) throw new Error('fallo simulado');
  return 'ok';
}, { attempts: 3 });
assert.equal(recovered, 'ok');
assert.equal(attempts, 3);

const controller = new AbortController();
controller.abort();
await assert.rejects(retry(async () => 'no', { signal: controller.signal }), error => error.name === 'AbortError');

console.log('Web importer tests passed: ZIP seguro, inventario, cancelación y reintentos.');
