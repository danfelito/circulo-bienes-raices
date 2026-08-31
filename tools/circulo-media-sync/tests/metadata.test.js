'use strict';

const assert = require('node:assert/strict');
const {
  decodeTextBuffer,
  draftFromReadme,
  metadataValue,
  parseCoordinate,
  parseLocalizedBoolean,
} = require('../metadata');

const parsed = {
  metadata: {
    'TÍTULO': 'Cabaña en Venta en Lomas del Porvenir',
    Precio: '$800,000',
    CIUDAD: 'Lomas del Porvenir',
    Tipo: 'Terreno',
    País: 'México',
    publicada: 'sí',
    destacada: 'No',
    latitud: '19,1738',
    longitud: '-96.123',
    estado: 'disponible',
  },
  body: 'Descripción con ñ, acentos y 1,200 m².',
  features: ['Jardín', 'Vista al mar'],
};

const draft = draftFromReadme({ folderName: 'CI-VER-0002-Cabaña' }, parsed);
assert.equal(draft.title, 'Cabaña en Venta en Lomas del Porvenir');
assert.equal(draft.price, 800000);
assert.equal(draft.city, 'Lomas del Porvenir');
assert.equal(draft.type, 'terreno');
assert.equal(draft.country, 'México');
assert.equal(draft.published, true);
assert.equal(draft.featured, false);
assert.equal(draft.lat, 19.1738);
assert.equal(draft.lng, -96.123);
assert.equal(metadataValue({ 'AÑO-CONSTRUCCIÓN': 2020 }, 'ano_construccion'), 2020);
assert.equal(parseLocalizedBoolean('FALSE', true), false);
assert.throws(() => parseLocalizedBoolean('tal vez', true), /booleano no válido/);
assert.equal(parseCoordinate('-96.123', -180, 180), -96.123);
assert.throws(() => parseCoordinate('190', -180, 180), /entre -180 y 180/);

const sample = 'Cabaña en México';
assert.equal(decodeTextBuffer(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(sample, 'utf8')])), sample);
assert.equal(decodeTextBuffer(Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(sample, 'utf16le')])), sample);
const utf16beBody = Buffer.from(sample, 'utf16le');
for (let index = 0; index < utf16beBody.length; index += 2) {
  [utf16beBody[index], utf16beBody[index + 1]] = [utf16beBody[index + 1], utf16beBody[index]];
}
assert.equal(decodeTextBuffer(Buffer.concat([Buffer.from([0xfe, 0xff]), utf16beBody])), sample);
assert.equal(decodeTextBuffer(Buffer.from([0x43, 0x61, 0x62, 0x61, 0xf1, 0x61])), 'Cabaña');

console.log('Media Sync metadata tests passed: español, alias, booleanos, coordenadas y codificaciones.');
