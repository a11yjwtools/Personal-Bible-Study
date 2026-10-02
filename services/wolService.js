/**
 * Asistente de sugerencias basado en la Watchtower ONLINE LIBRARY (wol.jw.org)
 * ---------------------------------------------------------------------------
 * Usa la misma clave de Gemini que el corrector (config.geminiApiKey o GEMINI_API_KEY).
 * Gemini busca en la WOL (Google Search grounding) y lee las páginas (URL context),
 * y devuelve comentarios breves, redactados con sus propias palabras, para añadir al apunte.
 *
 * Salvaguarda: el servidor comprueba en los metadatos de Gemini qué páginas se usaron
 * realmente. Si ninguna es de jw.org, no se devuelve ninguna sugerencia; y se descartan
 * las sugerencias respaldadas solo por otros sitios.
 *
 * Es independiente del corrector: no modifica aiService.js.
 */
const dbService = require('./dbService');
const { detectLanguage } = require('./aiService');

// Modelos a probar en orden (configurable con WOL_GEMINI_MODELS="modelo1,modelo2").
// Se priorizan los modelos Flash completos porque manejan mejor la búsqueda con herramientas.
const DEFAULT_MODELS = ['gemini-3.6-flash', 'gemini-flash-latest', 'gemini-3.5-flash-lite'];

const WOL = {
  es: { home: 'https://wol.jw.org/es/wol/h/r4/lp-s', search: 'https://wol.jw.org/es/wol/s/r4/lp-s?q=' },
  en: { home: 'https://wol.jw.org/en/wol/h/r1/lp-e', search: 'https://wol.jw.org/en/wol/s/r1/lp-e?q=' }
};

const REQUEST_TIMEOUT_MS = 90000;
let inFlight = false;

function getModels() {
  const fromEnv = (process.env.WOL_GEMINI_MODELS || '').split(',').map(s => s.trim()).filter(Boolean);
  return fromEnv.length ? fromEnv : DEFAULT_MODELS;
}

function getApiKey() {
  const config = dbService.getConfig() || {};
  return String(config.geminiApiKey || process.env.GEMINI_API_KEY || '').trim();
}

function isJwSource(str) {
  return /(^|[\/.\s])(wol\.)?jw\.org/i.test(String(str || ''));
}

function buildPrompt({ title, tags, context, focus, lang }) {
  const w = WOL[lang] || WOL.es;
  const theme = [title, tags].filter(Boolean).join(' — ');
  const searchUrl = w.search + encodeURIComponent((title || focus || '').slice(0, 80));

  if (lang === 'en') {
    return `You are a research assistant for a personal Bible study notebook. The student is writing notes and wants short comments to ADD to them, based ONLY on material from the Watchtower ONLINE LIBRARY (wol.jw.org).

STEPS:
1. Search ONLY the Watchtower ONLINE LIBRARY. Use searches like "site:wol.jw.org <topic>". You may also read: ${searchUrl} and ${w.home}
2. Read the most relevant articles, study notes, Insight entries or research guide entries.
3. Write 3 short comments (2-3 sentences each) that ENRICH what the student is writing right now: a supporting point, background or historical detail, a related scripture and how it applies, an illustration, or a practical application.

RULES:
- Base every comment strictly on what you actually read on wol.jw.org. Never use other websites. Never invent facts, quotes or references.
- Write in your own words. Do not copy sentences; at most a very short phrase.
- Do not repeat ideas the student already wrote.
- If you find nothing relevant on wol.jw.org, return [].
- Write in English.

OUTPUT: only a JSON array, no other text, no code fences:
[{"type":"point|background|scripture|illustration|application","text":"the comment","scripture":"Bible reference or empty","source":"short reference to the publication, e.g. w23.05 p. 10 par. 7, or the article title"}]

NOTE THEME: ${theme || '(untitled)'}

WHAT THE STUDENT IS WRITING NOW:
${focus || '(see recent notes)'}

RECENT NOTES (context, do not repeat):
${context || '(empty)'}`;
  }

  return `Eres un asistente de investigación para un cuaderno de estudio bíblico personal. El estudiante está escribiendo apuntes y quiere comentarios breves para AÑADIR a ellos, basados ÚNICAMENTE en material de la BIBLIOTECA EN LÍNEA Watchtower (wol.jw.org).

PASOS:
1. Busca SOLO en la Biblioteca en línea Watchtower. Usa búsquedas como "site:wol.jw.org <tema>". También puedes leer: ${searchUrl} y ${w.home}
2. Lee los artículos, notas de estudio, entradas de Perspicacia o de la Guía de estudio más relevantes.
3. Redacta 3 comentarios breves (2-3 frases cada uno) que ENRIQUEZCAN lo que el estudiante está escribiendo ahora: un punto de apoyo, un dato de contexto o histórico, un texto bíblico relacionado y cómo se aplica, una ilustración o una aplicación práctica.

REGLAS:
- Basa cada comentario estrictamente en lo que realmente leíste en wol.jw.org. Nunca uses otros sitios web. Nunca inventes datos, citas ni referencias.
- Redacta con tus propias palabras. No copies frases; como mucho una expresión muy corta.
- No repitas ideas que el estudiante ya escribió.
- Si no encuentras nada relevante en wol.jw.org, devuelve [].
- Escribe en español.

SALIDA: solo un arreglo JSON, sin otro texto ni bloques de código:
[{"type":"punto|contexto|texto|ilustracion|aplicacion","text":"el comentario","scripture":"cita bíblica o vacío","source":"referencia breve a la publicación, p. ej. w23.05 pág. 10 párr. 7, o el título del artículo"}]

TEMA DEL APUNTE: ${theme || '(sin título)'}

LO QUE EL ESTUDIANTE ESTÁ ESCRIBIENDO AHORA:
${focus || '(ver apuntes recientes)'}

APUNTES RECIENTES (contexto, no repetir):
${context || '(vacío)'}`;
}

/** Extrae el primer arreglo JSON del texto de Gemini (tolera ```json y texto alrededor). */
function parseSuggestions(text) {
  if (!text) return [];
  const clean = text.replace(/```json|```/gi, '').trim();
  const start = clean.indexOf('[');
  const end = clean.lastIndexOf(']');
  if (start === -1 || end <= start) return [];
  try {
    const arr = JSON.parse(clean.slice(start, end + 1));
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(s => s && typeof s.text === 'string' && s.text.trim().length > 10)
      .map(s => ({
        type: String(s.type || '').trim().slice(0, 30),
        text: s.text.trim().slice(0, 900),
        scripture: String(s.scripture || '').trim().slice(0, 120),
        source: String(s.source || '').trim().slice(0, 200)
      }))
      .slice(0, 5);
  } catch (e) {
    return [];
  }
}

/**
 * Comprueba en los metadatos qué fuentes usó Gemini.
 * - Si ninguna fuente es de jw.org → no hay sugerencias válidas.
 * - Si un fragmento de una sugerencia está respaldado solo por fuentes ajenas a jw.org → se descarta.
 */
function verifyAgainstSources(suggestions, candidate, rawText) {
  const gm = candidate.groundingMetadata || candidate.grounding_metadata || {};
  const chunks = gm.groundingChunks || gm.grounding_chunks || [];
  const supports = gm.groundingSupports || gm.grounding_supports || [];
  const ucm = candidate.urlContextMetadata || candidate.url_context_metadata || {};
  const urlMeta = ucm.urlMetadata || ucm.url_metadata || [];

  const chunkIsJw = chunks.map(c => {
    const web = c.web || c.retrievedContext || {};
    return isJwSource(web.uri) || isJwSource(web.title) || isJwSource(web.domain);
  });

  const jwFromSearch = chunkIsJw.filter(Boolean).length;
  const jwFromUrls = urlMeta.filter(u => {
    const url = u.retrievedUrl || u.retrieved_url || '';
    const status = String(u.urlRetrievalStatus || u.url_retrieval_status || '');
    return isJwSource(url) && /SUCCESS/i.test(status);
  }).length;

  const totalJw = jwFromSearch + jwFromUrls;
  if (totalJw === 0) {
    return { verified: [], jwSourceCount: 0, dropped: suggestions.length };
  }

  const verified = [];
  let dropped = 0;
  for (const s of suggestions) {
    const related = supports.filter(sup => {
      const segText = (sup.segment && sup.segment.text) || '';
      return segText.length > 15 && (s.text.includes(segText) || segText.includes(s.text.slice(0, 60)));
    });
    if (related.length > 0) {
      const anyJw = related.some(sup =>
        (sup.groundingChunkIndices || sup.grounding_chunk_indices || []).some(i => chunkIsJw[i])
      );
      if (!anyJw) { dropped++; continue; }
      verified.push({ ...s, verified: true });
    } else {
      // Sin vínculo directo a un fragmento (habitual cuando la respuesta es JSON);
      // se acepta porque la respuesta global sí se basó en páginas de jw.org.
      verified.push({ ...s, verified: false });
    }
  }
  return { verified, jwSourceCount: totalJw, dropped };
}

async function callGemini(model, apiKey, prompt, tools) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    tools,
    generationConfig: { temperature: 0.3 }
  };
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  if (!response.ok) {
    const errJson = await response.json().catch(() => ({}));
    const err = new Error(errJson.error?.message || `HTTP ${response.status}`);
    err.status = response.status;
    throw err;
  }
  return response.json();
}

/**
 * @param {{title?:string, tags?:string, context?:string, focus?:string}} input
 */
async function suggestFromWol(input = {}) {
  const apiKey = getApiKey();
  if (apiKey.length <= 10) {
    const e = new Error('Falta la clave de Gemini. Configúrala con el botón de Gemini del editor.');
    e.code = 'NO_KEY';
    throw e;
  }
  if (inFlight) {
    const e = new Error('Ya hay una búsqueda en curso. Espera unos segundos.');
    e.code = 'BUSY';
    throw e;
  }

  const title = String(input.title || '').slice(0, 200);
  const tags = String(input.tags || '').slice(0, 200);
  const focus = String(input.focus || '').slice(-1500);
  const context = String(input.context || '').slice(-3000);
  if ((focus + context).trim().length < 20 && !title.trim()) {
    const e = new Error('Escribe un poco más para poder buscar sugerencias.');
    e.code = 'TOO_SHORT';
    throw e;
  }

  const lang = detectLanguage(`${title} ${focus} ${context}`);
  const prompt = buildPrompt({ title, tags, context, focus, lang });

  // Primero búsqueda + lectura de páginas; si el modelo no admite ambas herramientas, solo búsqueda.
  const toolSets = [
    [{ google_search: {} }, { url_context: {} }],
    [{ google_search: {} }]
  ];

  inFlight = true;
  let lastErr = '';
  let nonJwAttempts = 0;
  try {
    for (const model of getModels()) {
      for (const tools of toolSets) {
        try {
          const data = await callGemini(model, apiKey, prompt, tools);
          const candidate = data.candidates?.[0];
          if (!candidate) { lastErr = 'Gemini no devolvió respuesta.'; continue; }

          const text = (candidate.content?.parts || []).map(p => p.text || '').join('');
          const parsed = parseSuggestions(text);
          const { verified, jwSourceCount, dropped } = verifyAgainstSources(parsed, candidate, text);

          if (jwSourceCount > 0 || parsed.length === 0) {
            console.log(`[WOL] ${model}: ${verified.length} sugerencias (fuentes jw.org: ${jwSourceCount}, descartadas: ${dropped})`);
            return {
              lang,
              model,
              suggestions: verified,
              jwSourceCount,
              dropped,
              message: verified.length === 0
                ? (lang === 'en'
                    ? 'No relevant material from the Watchtower ONLINE LIBRARY was found for this passage.'
                    : 'No se encontró material relevante de la Biblioteca en línea para este fragmento.')
                : ''
            };
          }
          // Hubo sugerencias pero sin fuentes de jw.org: no se muestran. Probar siguiente opción.
          lastErr = 'Las sugerencias no estaban respaldadas por páginas de wol.jw.org.';
          console.warn(`[WOL] ${model}: respuesta sin fuentes de jw.org, se descarta.`);
          nonJwAttempts++;
          if (nonJwAttempts >= 2) {
            const e = new Error(lastErr);
            e.code = 'NO_WOL_SOURCES';
            throw e;
          }
          break;
        } catch (e) {
          if (e.code === 'NO_WOL_SOURCES') throw e;
          lastErr = e.message;
          console.warn(`[WOL] Error con ${model} (${tools.length === 2 ? 'búsqueda+URL' : 'búsqueda'}):`, e.message);
          // 400 suele indicar herramienta no admitida → probar solo búsqueda; otros errores → siguiente modelo
          if (e.status !== 400) break;
        }
      }
    }
  } finally {
    inFlight = false;
  }

  const e = new Error(lastErr || 'No se pudieron obtener sugerencias de la WOL.');
  e.code = 'FAILED';
  throw e;
}

module.exports = { suggestFromWol, parseSuggestions, verifyAgainstSources, buildPrompt };
