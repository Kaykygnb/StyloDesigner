import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNode, makeDoc, defaultFill } from '../src/model.js';
import { imageAssetCatalog } from '../src/image-assets.js';

test('inventário de imagens deriva nome, dimensões e usos sem devolver o data URL', () => {
  const doc = makeDoc();
  doc.assets.foto = 'data:image/png;base64,AAAA';
  doc.assets.orfa = 'data:image/webp;base64,BBBB';
  doc.assets.texto = 'não é uma imagem';
  const foto = createNode('rect', { name: 'Foto do hero', fill: { ...defaultFill(), type: 'image', assetId: 'foto', natW: 1280, natH: 720 } });
  const copia = createNode('rect', { name: 'Card de projeto', fill: { ...defaultFill(), type: 'image', assetId: 'foto', natW: 1280, natH: 720 } });
  doc.pages[0].children.push(foto, copia);

  const assets = imageAssetCatalog(doc);
  assert.equal(assets.length, 2);
  assert.deepEqual(assets[0], {
    id: 'foto', name: 'Foto do hero', format: 'png', kb: 1, width: 1280, height: 720,
    usageCount: 2,
    usedBy: [
      { layer: 'Foto do hero', page: 'Página 1', w: 1280, h: 720 },
      { layer: 'Card de projeto', page: 'Página 1', w: 1280, h: 720 },
    ],
  });
  assert.equal(assets[1].usageCount, 0);
  assert.equal(assets[1].name, 'Imagem 2');
  assert.equal('dataUrl' in assets[0], false);
});
