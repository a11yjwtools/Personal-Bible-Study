const https = require('https');

// Mapeo exhaustivo de los 66 libros de la Biblia con nombres y abreviaturas en español e inglés
const BIBLE_BOOKS = [
  { num: 1, es: 'Génesis', en: 'Genesis', abbr: ['gen', 'gén', 'ge', 'gn'] },
  { num: 2, es: 'Éxodo', en: 'Exodus', abbr: ['ex', 'exod', 'éx', 'éxo'] },
  { num: 3, es: 'Levítico', en: 'Leviticus', abbr: ['lev', 'le', 'lv'] },
  { num: 4, es: 'Números', en: 'Numbers', abbr: ['num', 'núm', 'nu', 'nm'] },
  { num: 5, es: 'Deuteronomio', en: 'Deuteronomy', abbr: ['deut', 'deu', 'dt', 'de'] },
  { num: 6, es: 'Josué', en: 'Joshua', abbr: ['jos', 'josh'] },
  { num: 7, es: 'Jueces', en: 'Judges', abbr: ['jue', 'juec', 'jdg', 'judg'] },
  { num: 8, es: 'Rut', en: 'Ruth', abbr: ['rut', 'ru', 'rth'] },
  { num: 9, es: '1 Samuel', en: '1 Samuel', abbr: ['1 sam', '1 sa', '1sm', '1s'] },
  { num: 10, es: '2 Samuel', en: '2 Samuel', abbr: ['2 sam', '2 sa', '2sm', '2s'] },
  { num: 11, es: '1 Reyes', en: '1 Kings', abbr: ['1 rey', '1 re', '1 kgs', '1 ki', '1kin', '1k'] },
  { num: 12, es: '2 Reyes', en: '2 Kings', abbr: ['2 rey', '2 re', '2 kgs', '2 ki', '2kin', '2k'] },
  { num: 13, es: '1 Crónicas', en: '1 Chronicles', abbr: ['1 crón', '1 cron', '1 cro', '1 cr', '1 chron', '1 ch'] },
  { num: 14, es: '2 Crónicas', en: '2 Chronicles', abbr: ['2 crón', '2 cron', '2 cro', '2 cr', '2 chron', '2 ch'] },
  { num: 15, es: 'Esdras', en: 'Ezra', abbr: ['esd', 'ezr', 'ezra'] },
  { num: 16, es: 'Nehemías', en: 'Nehemiah', abbr: ['neh', 'ne'] },
  { num: 17, es: 'Ester', en: 'Esther', abbr: ['est', 'esth'] },
  { num: 18, es: 'Job', en: 'Job', abbr: ['job', 'jb'] },
  { num: 19, es: 'Salmos', en: 'Psalms', abbr: ['sal', 'salm', 'ps', 'psa', 'psalm', 'psalms'] },
  { num: 20, es: 'Proverbios', en: 'Proverbs', abbr: ['prov', 'pro', 'prv', 'pr'] },
  { num: 21, es: 'Eclesiastés', en: 'Ecclesiastes', abbr: ['ecl', 'eccl', 'ecc', 'ec'] },
  { num: 22, es: 'El Cantar de los Cantares', en: 'Song of Solomon', abbr: ['cant', 'cnt', 'song', 'ss'] },
  { num: 23, es: 'Isaías', en: 'Isaiah', abbr: ['isa', 'is'] },
  { num: 24, es: 'Jeremías', en: 'Jeremiah', abbr: ['jer', 'jr'] },
  { num: 25, es: 'Lamentaciones', en: 'Lamentations', abbr: ['lam', 'la'] },
  { num: 26, es: 'Ezequiel', en: 'Ezekiel', abbr: ['ezeq', 'ezq', 'ezek', 'eze'] },
  { num: 27, es: 'Daniel', en: 'Daniel', abbr: ['dan', 'da', 'dn'] },
  { num: 28, es: 'Oseas', en: 'Hosea', abbr: ['os', 'hos', 'ho'] },
  { num: 29, es: 'Joel', en: 'Joel', abbr: ['jl', 'joe'] },
  { num: 30, es: 'Amós', en: 'Amos', abbr: ['am', 'amo'] },
  { num: 31, es: 'Abdías', en: 'Obadiah', abbr: ['abd', 'ob', 'oba'] },
  { num: 32, es: 'Jonás', en: 'Jonah', abbr: ['jon', 'jnh'] },
  { num: 33, es: 'Miqueas', en: 'Micah', abbr: ['miq', 'mic'] },
  { num: 34, es: 'Nahúm', en: 'Nahum', abbr: ['nah', 'na'] },
  { num: 35, es: 'Habacuc', en: 'Habakkuk', abbr: ['hab'] },
  { num: 36, es: 'Sofonías', en: 'Zephaniah', abbr: ['sof', 'zeph', 'zep'] },
  { num: 37, es: 'Ageo', en: 'Haggai', abbr: ['ag', 'hag'] },
  { num: 38, es: 'Zacarías', en: 'Zechariah', abbr: ['zac', 'zech', 'zec'] },
  { num: 39, es: 'Malaquías', en: 'Malachi', abbr: ['mal'] },
  { num: 40, es: 'Mateo', en: 'Matthew', abbr: ['mat', 'mateo', 'mt', 'matt', 'matthew'] },
  { num: 41, es: 'Marcos', en: 'Mark', abbr: ['mar', 'marcos', 'mr', 'mk', 'mark'] },
  { num: 42, es: 'Lucas', en: 'Luke', abbr: ['luc', 'lucas', 'lu', 'lk', 'luk', 'luke'] },
  { num: 43, es: 'Juan', en: 'John', abbr: ['jua', 'juan', 'jn', 'joh', 'john'] },
  { num: 44, es: 'Hechos', en: 'Acts', abbr: ['hec', 'hechos', 'ac', 'act', 'acts'] },
  { num: 45, es: 'Romanos', en: 'Romans', abbr: ['rom', 'ro', 'rm', 'romanos', 'romans'] },
  { num: 46, es: '1 Corintios', en: '1 Corinthians', abbr: ['1 cor', '1 co', '1cor', '1co', '1 corintios', '1 corinthians'] },
  { num: 47, es: '2 Corintios', en: '2 Corinthians', abbr: ['2 cor', '2 co', '2cor', '2co', '2 corintios', '2 corinthians'] },
  { num: 48, es: 'Gálatas', en: 'Galatians', abbr: ['gál', 'gal', 'ga', 'gálatas', 'galatians'] },
  { num: 49, es: 'Efesios', en: 'Ephesians', abbr: ['efe', 'ef', 'eph', 'ep', 'efesios', 'ephesians'] },
  { num: 50, es: 'Filipenses', en: 'Philippians', abbr: ['fil', 'flp', 'php', 'phil', 'filipenses', 'philippians'] },
  { num: 51, es: 'Colosenses', en: 'Colossians', abbr: ['col', 'cl', 'colosenses', 'colossians'] },
  { num: 52, es: '1 Tesalonicenses', en: '1 Thessalonians', abbr: ['1 tes', '1 th', '1thess', '1thes', '1tes', '1 tesalonicenses', '1 thessalonians'] },
  { num: 53, es: '2 Tesalonicenses', en: '2 Thessalonians', abbr: ['2 tes', '2 th', '2thess', '2thes', '2tes', '2 tesalonicenses', '2 thessalonians'] },
  { num: 54, es: '1 Timoteo', en: '1 Timothy', abbr: ['1 tim', '1 ti', '1tm', '1tim', '1 timoteo', '1 timothy'] },
  { num: 55, es: '2 Timoteo', en: '2 Timothy', abbr: ['2 tim', '2 ti', '2tm', '2tim', '2 timoteo', '2 timothy'] },
  { num: 56, es: 'Tito', en: 'Titus', abbr: ['tit', 'ti'] },
  { num: 57, es: 'Filemón', en: 'Philemon', abbr: ['flm', 'phm', 'philem'] },
  { num: 58, es: 'Hebreos', en: 'Hebrews', abbr: ['heb', 'he', 'hebreos', 'hebrews'] },
  { num: 59, es: 'Santiago', en: 'James', abbr: ['sant', 'stg', 'jas', 'jm', 'santiago', 'james'] },
  { num: 60, es: '1 Pedro', en: '1 Peter', abbr: ['1 ped', '1 pe', '1 pet', '1pt', '1ped', '1 pedro', '1 peter'] },
  { num: 61, es: '2 Pedro', en: '2 Peter', abbr: ['2 ped', '2 pe', '2 pet', '2pt', '2ped', '2 pedro', '2 peter'] },
  { num: 62, es: '1 Juan', en: '1 John', abbr: ['1 jua', '1 jn', '1 joh', '1jn', '1 juan', '1 john'] },
  { num: 63, es: '2 Juan', en: '2 John', abbr: ['2 jua', '2 jn', '2 joh', '2jn', '2 juan', '2 john'] },
  { num: 64, es: '3 Juan', en: '3 John', abbr: ['3 jua', '3 jn', '3 joh', '3jn', '3 juan', '3 john'] },
  { num: 65, es: 'Judas', en: 'Jude', abbr: ['jud', 'jde'] },
  { num: 66, es: 'Apocalipsis', en: 'Revelation', abbr: ['apoc', 'apo', 'ap', 'rev', 're', 'apocalipsis', 'revelation'] }
];

// Caché en memoria para evitar llamadas redundantes a wol.jw.org
// Clave: `${lang}_${bookNum}_${chapter}` -> HTML
const chapterHtmlCache = new Map();

// Normalizar texto para comparación sin tildes ni puntos
function normalizeString(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,]/g, '')
    .trim();
}

/**
 * Parsea una referencia bíblica como "Matthew 4:5", "Mateo 4:5-7", "Matt. 4:5, 6", "1 Cor. 13:4"
 */
function parseScriptureRef(refStr) {
  if (!refStr || typeof refStr !== 'string') return null;

  const trimmed = refStr.trim().replace(/\s+/g, ' ');
  // Regex general: (Nombre o Abreviatura del libro) (Capítulo):(Versículo o rango)
  const match = trimmed.match(/^([1-3]?\s*[A-Za-zÁÉÍÓÚáéíóúÑñ.]+?)\s+(\d+)\s*[:.]\s*(\d+)(?:\s*[-–—]\s*(\d+)|\s*,\s*(\d+))?/i);

  if (!match) return null;

  const rawBook = match[1].trim();
  const chapter = parseInt(match[2], 10);
  const startVerse = parseInt(match[3], 10);
  const endVerse = match[4] ? parseInt(match[4], 10) : (match[5] ? parseInt(match[5], 10) : startVerse);

  // Buscar el libro en BIBLE_BOOKS
  const normBook = normalizeString(rawBook);
  let detectedLang = 'es';
  let matchedBook = null;

  for (const b of BIBLE_BOOKS) {
    const esNorm = normalizeString(b.es);
    const enNorm = normalizeString(b.en);

    if (normBook === esNorm) {
      matchedBook = b;
      detectedLang = 'es';
      break;
    }
    if (normBook === enNorm) {
      matchedBook = b;
      detectedLang = 'en';
      break;
    }

    // Comprobar abreviaturas
    for (const ab of b.abbr) {
      if (normBook === normalizeString(ab)) {
        matchedBook = b;
        if (['matt', 'joh', 'psa', 'ps', 'rev', 'luk', 'mk', 'acts', 'romans', 'hebrews', 'james', 'peter'].includes(ab.toLowerCase())) {
          detectedLang = 'en';
        } else if (['mat', 'jua', 'sal', 'apoc', 'luc', 'mar', 'hec', 'romanos', 'hebreos', 'stg', 'ped'].includes(ab.toLowerCase())) {
          detectedLang = 'es';
        }
        break;
      }
    }
    if (matchedBook) break;
  }

  if (!matchedBook) return null;

  // Formato canónico de la cita
  const bookName = detectedLang === 'en' ? matchedBook.en : matchedBook.es;
  const citation = (endVerse && endVerse !== startVerse)
    ? `${bookName} ${chapter}:${startVerse}-${endVerse}`
    : `${bookName} ${chapter}:${startVerse}`;

  return {
    bookNum: matchedBook.num,
    bookName,
    bookEn: matchedBook.en,
    bookEs: matchedBook.es,
    chapter,
    startVerse,
    endVerse,
    detectedLang,
    rawRef: trimmed,
    citation
  };
}

/**
 * Consulta y extrae el texto oficial de la Traducción del Nuevo Mundo (NWT) desde wol.jw.org
 */
async function fetchFromWol(bookNum, chapter, startVerse, endVerse, lang = 'es') {
  const isEs = lang === 'es';
  const lp = isEs ? 'lp-s' : 'lp-e';
  const langPath = isEs ? 'es' : 'en';
  const rNum = isEs ? 'r4' : 'r1';
  const cacheKey = `${lang}_${bookNum}_${chapter}`;

  let html = chapterHtmlCache.get(cacheKey);

  if (!html) {
    const url = `https://wol.jw.org/${langPath}/wol/b/${rNum}/${lp}/nwt/${bookNum}/${chapter}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept-Language': isEs ? 'es-ES,es;q=0.9,en;q=0.8' : 'en-US,en;q=0.9'
      }
    });

    if (!res.ok) {
      throw new Error(`WOL respondió con código HTTP ${res.status}`);
    }

    html = await res.text();
    // Guardar en caché (limitar a 100 capítulos en memoria)
    if (chapterHtmlCache.size > 100) {
      const firstKey = chapterHtmlCache.keys().next().value;
      chapterHtmlCache.delete(firstKey);
    }
    chapterHtmlCache.set(cacheKey, html);
  }

  const versesResult = [];
  const ev = Math.max(startVerse, endVerse || startVerse);

  for (let v = startVerse; v <= ev; v++) {
    const regex = new RegExp(`id="v${bookNum}-${chapter}-${v}-\\d+"[^>]*>([\\s\\S]*?)<\\/span>`, 'gi');
    let m;
    let parts = [];

    while ((m = regex.exec(html)) !== null) {
      let raw = m[1];
      raw = raw.replace(/<a[^>]*class="vl[^"]*"[^>]*>.*?<\/a>/gi, '');
      raw = raw.replace(/<[^>]+>/g, '');
      raw = raw.replace(/[\*\+]/g, '');
      raw = raw.replace(/\s+/g, ' ').trim();
      if (raw) parts.push(raw);
    }

    if (parts.length > 0) {
      versesResult.push({
        verseNum: v,
        text: parts.join(' ')
      });
    }
  }

  if (versesResult.length === 0) {
    throw new Error(`No se encontró el versículo ${chapter}:${startVerse} en el capítulo obtenido`);
  }

  const fullText = versesResult.map(v => (versesResult.length > 1 ? `${v.verseNum} ${v.text}` : v.text)).join(' ');

  return {
    verses: versesResult,
    text: fullText,
    source: 'wol.jw.org'
  };
}

/**
 * Respaldo con Gemini AI para obtener la cita oficial de la Traducción del Nuevo Mundo
 */
async function fetchWithGeminiFallback(parsed, lang) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Sin clave de API de Gemini configurada para respaldo.');
  }

  const targetLang = lang === 'en' ? 'English (New World Translation / NWT)' : 'Spanish (Traducción del Nuevo Mundo / TNM)';
  const prompt = `Devuelve únicamente el texto literal exacto de la cita bíblica "${parsed.citation}" según la ${targetLang} de los testigos de Jehová (jw.org).
No incluyas explicaciones, ni comentarios, ni introducciones, ni comillas. Solo el texto bíblico literal.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1 }
    })
  });

  const data = await res.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const text = rawText.trim().replace(/^"|"$/g, '');

  if (!text) {
    throw new Error('Respaldo de IA no generó texto.');
  }

  return {
    verses: [{ verseNum: parsed.startVerse, text }],
    text,
    source: 'gemini_nwt_fallback'
  };
}

/**
 * Función principal: Obtiene el texto bíblico según la cita solicitada
 */
async function getScriptureText(refStr, requestedLang) {
  const parsed = parseScriptureRef(refStr);
  if (!parsed) {
    return {
      success: false,
      error: `No se reconoció ninguna cita bíblica válida en: "${refStr}"`
    };
  }

  const lang = requestedLang || parsed.detectedLang || 'es';
  const citation = (parsed.endVerse && parsed.endVerse !== parsed.startVerse)
    ? `${lang === 'en' ? parsed.bookEn : parsed.bookEs} ${parsed.chapter}:${parsed.startVerse}-${parsed.endVerse}`
    : `${lang === 'en' ? parsed.bookEn : parsed.bookEs} ${parsed.chapter}:${parsed.startVerse}`;

  try {
    // 1. Intentar obtener de wol.jw.org
    const wolData = await fetchFromWol(parsed.bookNum, parsed.chapter, parsed.startVerse, parsed.endVerse, lang);
    return {
      success: true,
      citation,
      bookName: lang === 'en' ? parsed.bookEn : parsed.bookEs,
      bookNum: parsed.bookNum,
      chapter: parsed.chapter,
      startVerse: parsed.startVerse,
      endVerse: parsed.endVerse,
      lang,
      text: wolData.text,
      translation: lang === 'en' ? 'New World Translation (NWT)' : 'Traducción del Nuevo Mundo (TNM)',
      source: wolData.source
    };
  } catch (wolErr) {
    console.warn(`Aviso: Consulta a wol.jw.org para "${citation}" no completada (${wolErr.message}). Intentando respaldo...`);
    try {
      // 2. Respaldo inteligente con Gemini si está configurado
      const geminiData = await fetchWithGeminiFallback(parsed, lang);
      return {
        success: true,
        citation,
        bookName: lang === 'en' ? parsed.bookEn : parsed.bookEs,
        bookNum: parsed.bookNum,
        chapter: parsed.chapter,
        startVerse: parsed.startVerse,
        endVerse: parsed.endVerse,
        lang,
        text: geminiData.text,
        translation: lang === 'en' ? 'New World Translation (NWT)' : 'Traducción del Nuevo Mundo (TNM)',
        source: geminiData.source
      };
    } catch (fallbackErr) {
      return {
        success: false,
        citation,
        error: `No se pudo obtener el texto de ${citation}: ${wolErr.message}`
      };
    }
  }
}

module.exports = {
  BIBLE_BOOKS,
  parseScriptureRef,
  getScriptureText
};
