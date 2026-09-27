#!/usr/bin/env node
// ===========================================================================
// Genera public/js/engine.js: la IA (preguntas, Rosco, corrección) y la
// consulta de textos bíblicos de services/ empaquetadas para el navegador,
// para que la app funcione sin servidor (GitHub Pages).
//   node tools/build-engine.js
// ===========================================================================
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8').replace(/^﻿/, '');

const modules = {
  './aiService': read('services/aiService.js'),
  './scriptureService': read('services/scriptureService.js')
};

let out = `// ARCHIVO GENERADO por tools/build-engine.js — no editar a mano.
// Fuente: services/aiService.js y services/scriptureService.js
(function () {
  'use strict';
  const GEMINI_KEY = 'ep_gemini_key';
  function getKey() { try { return localStorage.getItem(GEMINI_KEY) || ''; } catch (e) { return ''; } }
  function setKey(k) { try { if (k) localStorage.setItem(GEMINI_KEY, k); else localStorage.removeItem(GEMINI_KEY); } catch (e) {} }
  const process = { env: new Proxy({}, { get: (t, k) => (k === 'GEMINI_API_KEY' ? getKey() : undefined) }) };
  const shims = {
    https: {},
    './docParser': {
      cleanText: (text) => String(text || '')
        .replace(/\\r\\n/g, '\\n').replace(/\\r/g, '\\n').replace(/\\u0000/g, '')
        .replace(/\\n{3,}/g, '\\n\\n').trim()
    },
    './dbService': {
      getConfig: () => ({ geminiApiKey: getKey() }),
      updateConfig: (c) => { if (c && typeof c.geminiApiKey === 'string') setKey(c.geminiApiKey.trim()); return { geminiApiKey: getKey() }; }
    }
  };
  const cache = {};
  function require(name) {
    if (shims[name]) return shims[name];
    if (cache[name]) return cache[name].exports;
    const def = defs[name];
    if (!def) throw new Error('Módulo no disponible en el navegador: ' + name);
    const module = { exports: {} };
    cache[name] = module;
    def(module, module.exports, require, process);
    return module.exports;
  }
  const defs = {};
`;

for (const [name, src] of Object.entries(modules)) {
  out += `\n  defs[${JSON.stringify(name)}] = function (module, exports, require, process) {\n${src}\n  };\n`;
}

out += `
  window.EPEngine = {
    ai: require('./aiService'),
    scripture: require('./scriptureService'),
    getGeminiKey: getKey,
    setGeminiKey: setKey
  };
})();
`;

fs.writeFileSync(path.join(root, 'public/js/engine.js'), out);
console.log('public/js/engine.js generado (' + Math.round(out.length / 1024) + ' KB)');
