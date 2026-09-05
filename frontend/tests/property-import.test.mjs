import assert from 'node:assert/strict';
import { File } from 'node:buffer';
import { BlobWriter, TextReader, ZipWriter } from '@zip.js/zip.js';
import { buildInventory, expandZipFiles, readAnalysisDocuments, retry } from '../src/lib/propertyImport.js';
import { analyzePropertyDocuments, parsePropertyNumber, validatePropertyDraft } from '../../shared/property-metadata.mjs';

const zipWriter = new ZipWriter(new BlobWriter('application/zip'));
await zipWriter.add('expediente/fachada.jpg', new TextReader('imagen simulada'));
await zipWriter.add('expediente/README.txt', new TextReader('Título: Casa con jardín'));
const zipBlob = await zipWriter.close();
const expanded = await expandZipFiles([new File([zipBlob], 'expediente.zip', { type: 'application/zip' })]);
assert.deepEqual(expanded.map(file => file.relativePath), ['expediente/fachada.jpg', 'expediente/README.txt']);
const inventory = buildInventory(expanded);
assert.equal(inventory.counts.images, 1);
assert.equal(inventory.counts.documents, 1);

const readme = `property_id: CI-VER-0001
title: Casa en Real Mandinga
description: Casa de dos niveles con jardín
operation: venta
type: casa
price: 1900000
currency: MXN
bedrooms: 3
bathrooms: 2.5
construction_area: 220
land_area: 280
parking: 2
year_built: 2018
city: Alvarado
state: Veracruz
country: México
status: available
published: true
features:
  - Jardín
  - Terraza
cover: fachada.jpg`;
const parsed = analyzePropertyDocuments(inventory, [{ name: 'expediente/README.txt', text: readme }]);
assert.deepEqual({
  propertyId: parsed.draft.propertyId, title: parsed.draft.title, operation: parsed.draft.operation,
  type: parsed.draft.type, price: parsed.draft.price, currency: parsed.draft.currency,
  bedrooms: parsed.draft.bedrooms, bathrooms: parsed.draft.bathrooms, area: parsed.draft.area,
  lotArea: parsed.draft.lotArea, parking: parsed.draft.parking, yearBuilt: parsed.draft.yearBuilt,
  city: parsed.draft.city, status: parsed.draft.status, features: parsed.draft.features,
  cover: parsed.draft.mainPhotoFilename, published: parsed.draft.published,
}, {
  propertyId: 'CI-VER-0001', title: 'Casa en Real Mandinga', operation: 'venta',
  type: 'casa', price: 1900000, currency: 'MXN', bedrooms: 3, bathrooms: 2.5,
  area: 220, lotArea: 280, parking: 2, yearBuilt: 2018, city: 'Alvarado',
  status: 'available', features: ['Jardín', 'Terraza'], cover: 'expediente/fachada.jpg', published: false,
});
assert.equal(parsed.ai.used, false);
assert.deepEqual(validatePropertyDraft(parsed.draft), { missingFields: [], invalidFields: [] });
assert.ok(parsed.review.warnings.some(warning => warning.includes('seguridad')));
assert.equal(parsePropertyNumber('$2,500,000', 'price'), 2500000);
assert.equal(parsePropertyNumber('2.5 millones', 'price'), 2500000);
assert.equal(parsePropertyNumber('2,5 millones', 'price'), 2500000);
assert.equal(parsePropertyNumber('2,500,000\n3 recámaras', 'price'), null);

const documentedMinimum = analyzePropertyDocuments(inventory, [{ name: 'README.txt', text: `property_id: CI-VER-0001
title: Casa en Real Mandinga
operation: venta
type: casa
price: 1900000
currency: MXN
city: Alvarado
state: Veracruz
country: México
status: available
published: true
owner_email: privado@example.com` }]);
assert.equal(documentedMinimum.draft.title, 'Casa en Real Mandinga');
assert.equal(documentedMinimum.draft.price, 1900000);
assert.equal(documentedMinimum.draft.owner_email, undefined);
assert.deepEqual(documentedMinimum.review.missingFields, ['description']);

const jsonDraft = analyzePropertyDocuments(inventory, [{ name: 'ficha.json', text: JSON.stringify({
  titulo: 'Departamento Centro', descripcion: 'Vista panorámica', operacion: 'renta', tipo: 'departamento',
  precio: '18,500', moneda: 'MXN', ciudad: 'Veracruz', estado: 'Veracruz', pais: 'México', estatus: 'disponible',
}) }]);
assert.equal(jsonDraft.draft.price, 18500);
assert.equal(jsonDraft.draft.operation, 'renta');
assert.equal(jsonDraft.draft.type, 'departamento');

const csvDraft = analyzePropertyDocuments(inventory, [{ name: 'ficha.csv', text:
  'title,description,operation,type,price,currency,city,state,country,status\n"Casa, con jardín",Descripción,venta,casa,"2,100,000",MXN,Alvarado,Veracruz,México,available' }]);
assert.equal(csvDraft.draft.title, 'Casa, con jardín');
assert.equal(csvDraft.draft.price, 2100000);

const noMerge = analyzePropertyDocuments(inventory, [
  { name: 'README.txt', text: 'title: Ficha principal\nprice: 1000000' },
  { name: 'notas.txt', text: 'city: Otra ciudad\ndescription: Texto de otra ficha' },
]);
assert.equal(noMerge.draft.city, '');
assert.ok(noMerge.review.warnings.some(warning => warning.includes('no se combinaron')));

assert.throws(() => analyzePropertyDocuments(inventory, [
  { name: 'casa-a/README.txt', text: 'title: A' },
  { name: 'casa-b/README.txt', text: 'title: B' },
]), /una sola carpeta/i);

const utf16Bytes = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('title: Casa UTF16', 'utf16le')]);
const decoded = await readAnalysisDocuments([new File([utf16Bytes], 'README.txt')]);
assert.match(decoded[0].text, /Casa UTF16/);

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
