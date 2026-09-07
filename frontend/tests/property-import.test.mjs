import assert from 'node:assert/strict';
import { File } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import { BlobWriter, TextReader, ZipWriter } from '@zip.js/zip.js';
import { buildInventory, expandZipFiles, readAnalysisDocuments, retry } from '../src/lib/propertyImport.js';
import { analyzePropertyDocuments, suggestPropertyTitle, parsePropertyNumber, validatePropertyDraft } from '../../shared/property-metadata.mjs';

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

const bodegaText = await readFile(new URL('./fixtures/bodega-readme.txt', import.meta.url), 'utf8');
const bodegaFiles = [
  new File([bodegaText.replaceAll('\n', '\r\n')], 'README.txt'),
  new File(['test image'], 'IMG-20250401-WA0002.jpg'),
];
const bodegaDocs = await readAnalysisDocuments(bodegaFiles);
const bodegaInventory = buildInventory(bodegaFiles);
const bodega = analyzePropertyDocuments(bodegaInventory, bodegaDocs);
assert.equal(bodega.draft.address, 'Libramiento Paso del Toro a Santa Fe');
assert.equal(bodega.draft.city, 'Medellín de Bravo');
assert.equal(bodega.draft.price, 35000000);
assert.equal(bodega.draft.area, 2000);
assert.equal(bodega.draft.lotArea, 2500);
assert.match(bodega.draft.description, /^Bodega nueva disponible/);
assert.doesNotMatch(bodega.draft.description, /property_id|published:|README/);
assert.match(suggestPropertyTitle(bodega.draft), /^Bodega de 2,000 m² con oficinas/);
assert.ok(suggestPropertyTitle(bodega.draft).length <= 65);
assert.deepEqual(validatePropertyDraft(bodega.draft), { missingFields: [], invalidFields: [] });
const conflictingDocs = [...bodegaDocs, { name: 'notas.txt', text: 'address: Dirección de la oficina\ncity: Boca del Río' }];
assert.equal(analyzePropertyDocuments(bodegaInventory, conflictingDocs).draft.address, '');
assert.equal(analyzePropertyDocuments(bodegaInventory, conflictingDocs, { sourceDocument: 'README.txt' }).draft.address, bodega.draft.address);
const plainFicha = analyzePropertyDocuments(bodegaInventory, [{ name: 'ficha.txt', text: 'Tipo: bodega\nDirección: Dirección exacta\n\nAmplia bodega para tu empresa.' }]);
assert.equal(plainFicha.draft.description, 'Amplia bodega para tu empresa.');
assert.equal(plainFicha.draft.address, 'Dirección exacta');
assert.equal(suggestPropertyTitle({ type: 'bodega', features: [], city: '' }), 'Bodega');
const docxWriter = new ZipWriter(new BlobWriter());
await docxWriter.add('[Content_Types].xml', new TextReader('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'));
await docxWriter.add('word/document.xml', new TextReader('<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Dirección: Libramiento Paso del Toro a Santa Fe</w:t></w:r></w:p></w:body></w:document>'));
const docx = new File([await docxWriter.close()], 'ficha.docx');
const docxDocs = await readAnalysisDocuments([docx]);
assert.match(docxDocs[0].text, /Dirección: Libramiento/);
assert.equal(analyzePropertyDocuments(bodegaInventory, docxDocs).draft.address, bodega.draft.address);
const importerSource = await readFile(new URL('../src/pages/admin/AdminPropertyImporter.jsx', import.meta.url), 'utf8');
assert.doesNotMatch(importerSource, /disabled=\{busy \|\| !requiredReady \|\| !readiness\.ready\}/);
assert.match(importerSource, /disabled=\{busy \|\| !requiredReady\}/);
console.log('Web importer tests passed: ZIP, README bodega, dirección, descripción, título, ficha seleccionada, DOCX y reintentos.');
