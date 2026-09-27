// ARCHIVO GENERADO por tools/build-engine.js — no editar a mano.
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
        .replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\u0000/g, '')
        .replace(/\n{3,}/g, '\n\n').trim()
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

  defs["./aiService"] = function (module, exports, require, process) {
const https = require('https');
const { cleanText } = require('./docParser');
const dbService = require('./dbService');

/**
 * Detecta si el texto está en español ('es') o en inglés ('en')
 */
function detectLanguage(text) {
  if (!text || typeof text !== 'string') return 'en';
  const clean = text.toLowerCase();

  const enWords = [
    'the', 'and', 'of', 'in', 'was', 'were', 'is', 'to', 'that', 'we', 'our', 'faith',
    'today', 'read', 'jehovah', 'god', 'this', 'with', 'for', 'have', 'has', 'had',
    'not', 'but', 'they', 'he', 'she', 'it', 'you', 'my', 'brother', 'prayer', 'bible',
    'learned', 'learn', 'study', 'scripture', 'when', 'from', 'all', 'do', 'will', 'day',
    'obedient', 'obey', 'peace', 'hope', 'love', 'verse', 'paragraph', 'chapter'
  ];
  const esWords = [
    'el', 'la', 'los', 'las', 'de', 'en', 'del', 'fue', 'fueron', 'es', 'que', 'para',
    'por', 'con', 'fe', 'hoy', 'leímos', 'leimos', 'dios', 'jehová', 'jehova', 'nuestro',
    'nuestra', 'vida', 'pero', 'no', 'si', 'su', 'sus', 'hermano', 'oración', 'oracion',
    'biblia', 'aprendí', 'aprendi', 'estudio', 'texto', 'cuando', 'todos', 'hacer', 'será',
    'día', 'dia', 'obedecer', 'obediencia', 'paz', 'esperanza', 'amor', 'versículo', 'párrafo'
  ];

  let enCount = 0;
  let esCount = 0;

  const tokens = clean.match(/[a-záéíóúñ]+/g) || [];
  for (const token of tokens) {
    if (enWords.includes(token)) enCount++;
    if (esWords.includes(token)) esCount++;
  }

  return esCount >= enCount ? 'es' : 'en';
}

/**
 * Aísla la última entrada o día añadido en un documento de estudio.
 * Si el documento tiene varios días, devuelve el prefijo intacto y la última entrada para corregir solo esa.
 */
function splitLastEntry(fullText) {
  if (!fullText) return { prefix: '', lastEntry: '', hasMultipleEntries: false };

  // 1. Buscar el último separador `\n---\n` que antecede a un encabezado (## 📅 o ## o #)
  const regex = /\n(?=---\s*\n\s*(?:##|#))/g;
  let lastMatchIndex = -1;
  let match;
  while ((match = regex.exec(fullText)) !== null) {
    lastMatchIndex = match.index;
  }

  // Fallback 1: buscar el último encabezado diario `\n(?=##\s*📅)`
  if (lastMatchIndex === -1) {
    const regexHeader = /\n(?=##\s*📅)/g;
    while ((match = regexHeader.exec(fullText)) !== null) {
      lastMatchIndex = match.index;
    }
  }

  // Fallback 2: buscar el último separador de guiones `\n(?=---\s*(?:\n|$))`
  if (lastMatchIndex === -1) {
    const regexDashes = /\n(?=---\s*(?:\n|$))/g;
    while ((match = regexDashes.exec(fullText)) !== null) {
      lastMatchIndex = match.index;
    }
  }

  if (lastMatchIndex !== -1 && lastMatchIndex > 0) {
    const prefix = fullText.slice(0, lastMatchIndex);
    const lastEntry = fullText.slice(lastMatchIndex);
    return { prefix, lastEntry, hasMultipleEntries: true };
  }

  return { prefix: '', lastEntry: fullText, hasMultipleEntries: false };
}

/**
 * Genera preguntas a partir del texto de unos apuntes.
 * Si hay API Key de Gemini configurada, usa la IA generativa de Google.
 * Si no, usa el extractor semántico inteligente local.
 */
async function generateQuestionsFromText(text, topicTitle, count = 10) {
  const config = dbService.getConfig();
  const apiKey = config.geminiApiKey || process.env.GEMINI_API_KEY;

  if (apiKey && apiKey.trim().length > 10) {
    try {
      console.log(`[AI] Intentando generar preguntas con Gemini API para: "${topicTitle}"...`);
      const aiQuestions = await generateWithGemini(text, topicTitle, apiKey.trim(), count);
      if (aiQuestions && aiQuestions.length > 0) {
        console.log(`[AI] Generadas con éxito ${aiQuestions.length} preguntas con Gemini.`);
        return aiQuestions;
      }
    } catch (err) {
      console.warn(`[AI] Falló la llamada a Gemini (${err.message}). Utilizando generador inteligente de respaldo.`);
    }
  } else {
    console.log(`[AI] No hay API Key de Gemini configurada. Utilizando generador inteligente local para: "${topicTitle}".`);
  }

  return generateLocallyFromText(text, topicTitle, count);
}

/**
 * Genera preguntas alfabéticas de la A a la Z para el Rosco / Ruleta
 */
async function generateRoscoQuestions(combinedText, topicTitles = []) {
  const config = dbService.getConfig();
  const apiKey = config.geminiApiKey || process.env.GEMINI_API_KEY;
  const topicsStr = topicTitles.join(', ') || 'General Study Notes';

  if (apiKey && apiKey.trim().length > 10) {
    try {
      console.log(`[AI] Generando Rosco A-Z con Gemini API para: "${topicsStr}"...`);
      const rosco = await generateRoscoWithGemini(combinedText, topicsStr, apiKey.trim());
      if (rosco && rosco.length >= 15) {
        return rosco;
      }
    } catch (err) {
      console.warn(`[AI] Falló generación de Rosco con Gemini: ${err.message}. Usando generador local.`);
    }
  }

  return generateRoscoLocally(combinedText, topicsStr);
}

const STUDY_CONCEPTS_EN = [
  { letter: 'A', answer: 'Asa', aliases: ['Asa'], clue: 'Faithful king of Judah who reigned 41 years and purged detestable idols from the land.', exp: 'Asa ruled faithfully for 41 years (978 - 937 B.C.E.).' },
  { letter: 'B', answer: 'Babylon', aliases: ['Babylon', 'Babylonia'], clue: 'Great conquering empire that destroyed the city of Jerusalem and its temple in 607 B.C.E.', exp: 'Jerusalem and the temple were desolated by the Babylonians in 607 B.C.E.' },
  { letter: 'C', answer: 'Canaan', aliases: ['Canaan'], clue: 'Promised land where Jehovah commanded Jacob to return after dwelling in Haran.', exp: 'Jehovah told Jacob: Return to the land of your fathers in Canaan.' },
  { letter: 'D', answer: 'Daniel', aliases: ['Daniel'], clue: 'Hebrew statesman and prophet who served faithfully in the royal court during the exile in Babylon.', exp: 'Daniel served as a prophet in Babylon during the captivity.' },
  { letter: 'E', answer: 'Esau', aliases: ['Esau', 'Esaú'], clue: 'Twin brother of Jacob who sought to kill him after losing the birthright blessing.', exp: 'Esau threatened Jacob\'s life, causing him to flee to Haran.' },
  { letter: 'F', answer: 'Felix', aliases: ['Felix', 'Festus', 'Faith'], clue: 'Roman governor of Judea before whom apostle Paul spoke about righteousness and judgment to come.', exp: 'Paul gave a bold witness before Governor Felix in Caesarea (Acts 24).' },
  { letter: 'G', answer: 'Genesis', aliases: ['Genesis', 'Génesis'], clue: 'First book of the Pentateuch, completed by Moses in the wilderness in 1513 B.C.E.', exp: 'Genesis was penned by Moses in the wilderness in 1513 B.C.E.' },
  { letter: 'H', answer: 'Haran', aliases: ['Haran', 'Harán'], clue: 'Distant city where Jacob fled to find refuge with his uncle Laban.', exp: 'Jacob traveled to Haran after Rebekah\'s warning.' },
  { letter: 'I', answer: 'Israel', aliases: ['Israel'], clue: 'Name given to Jacob by the angel after wrestling with him all night at Peniel.', exp: 'Israel means: Contender or one who perseveres with God.' },
  { letter: 'J', answer: 'Josiah', aliases: ['Josiah', 'Josías'], clue: 'Devout young king of Judah who restored true worship and reigned 31 years.', exp: 'Josiah reigned 31 years (659 - 628 B.C.E.) and purged Judah.' },
  { letter: 'L', answer: 'Laban', aliases: ['Laban', 'Labán'], clue: 'Uncle and father-in-law of Jacob who deceived him by giving Leah instead of Rachel.', exp: 'Laban repeatedly altered Jacob\'s wages and agreements in Haran.' },
  { letter: 'M', answer: 'Manasseh', aliases: ['Manasseh', 'Manasés'], clue: 'King of Judah who had the longest reign in Jerusalem, governing for 55 years.', exp: 'Manasseh reigned for 55 years (716 - 661 B.C.E.).' },
  { letter: 'N', answer: 'Nebuchadnezzar', aliases: ['Nebuchadnezzar', 'Nabucodonosor'], clue: 'King of Babylon whose armies destroyed Jerusalem and its temple in 607 B.C.E.', exp: 'Nebuchadnezzar led the forces that desolated Jerusalem.' },
  { letter: 'O', answer: 'Obadiah', aliases: ['Obadiah', 'Omri'], clue: 'Biblical prophet who pronounced Jehovah\'s judgment against the arrogant nation of Edom.', exp: 'The book of Obadiah foretells the desolation of Edom.' },
  { letter: 'P', answer: 'Peniel', aliases: ['Peniel', 'Penuel'], clue: 'Place near the river Jabbok where Jacob wrestled with an angel until the break of dawn.', exp: 'At Peniel, the angel touched the socket of Jacob\'s hip.' },
  { letter: 'Q', answer: 'Quirinius', aliases: ['Quirinius', 'Aquila'], clue: 'Governor of Syria when the Roman census took place prior to Jesus\' birth in Bethlehem (Luke 2:2).', exp: 'Quirinius oversaw the registration during the reign of Augustus.' },
  { letter: 'R', answer: 'Rehoboam', aliases: ['Rehoboam', 'Roboam'], clue: 'First king of the southern kingdom of Judah following the division in 997 B.C.E.', exp: 'Rehoboam reigned 17 years in Jerusalem after the split.' },
  { letter: 'S', answer: 'Samaria', aliases: ['Samaria'], clue: 'Capital city of the northern kingdom of Israel that fell to Assyria in 740 B.C.E.', exp: 'Samaria was conquered by the Assyrian empire in 740 B.C.E.' },
  { letter: 'T', answer: 'Temple', aliases: ['Temple', 'Templo'], clue: 'Sacred house of worship in Jerusalem that was burned to the ground in 607 B.C.E.', exp: 'The Babylonians burned the house of God in Jerusalem.' },
  { letter: 'U', answer: 'Uzziah', aliases: ['Uzziah', 'Uzías', 'Azariah', 'Azarías'], clue: 'King of Judah who reigned 52 years in Jerusalem until struck with leprosy for his arrogance.', exp: 'Uzziah reigned 52 years until 777 B.C.E.' },
  { letter: 'V', answer: 'Vashti', aliases: ['Vashti', 'Leviticus'], clue: 'Queen of Persia deposed by King Ahasuerus after refusing his royal feast command (Esther 1).', exp: 'Vashti refused the king\'s banquet summons and Esther became queen.' },
  { letter: 'Z', answer: 'Zedekiah', aliases: ['Zedekiah', 'Sedequías', 'Zechariah'], clue: 'Last king of Judah on the throne of David before Jerusalem was desolated in 607 B.C.E.', exp: 'Zedekiah reigned 11 years before the fall of Jerusalem.' }
];

const STUDY_CONCEPTS_ES = [
  { letter: 'A', answer: 'Asa', aliases: ['Asa', 'Asá'], clue: 'Fiel rey de Judá que reinó 41 años y purgó los ídolos repugnantes del país.', exp: 'Asa gobernó con fidelidad durante 41 años (978 - 937 a.C.).' },
  { letter: 'B', answer: 'Babilonia', aliases: ['Babilonia', 'Babylon'], clue: 'Gran imperio conquistador que destruyó la ciudad de Jerusalén y su templo en 607 a.C.', exp: 'Jerusalén y el templo fueron desolados por los babilonios en 607 a.C.' },
  { letter: 'C', answer: 'Canaán', aliases: ['Canaán', 'Canaan'], clue: 'Tierra prometida a la que Jehová ordenó regresar a Jacob tras residir en Harán.', exp: 'Jehová le mandó a Jacob: Vuelve a la tierra de tus padres en Canaán.' },
  { letter: 'D', answer: 'Daniel', aliases: ['Daniel'], clue: 'Profeta y estadista hebreo que sirvió fielmente en la corte durante el destierro en Babilonia.', exp: 'Daniel sirvió como profeta en Babilonia durante el cautiverio.' },
  { letter: 'E', answer: 'Esaú', aliases: ['Esaú', 'Esau'], clue: 'Hermano gemelo de Jacob que planeó matarlo tras perder la bendición de la primogenitura.', exp: 'Esaú amenazó de muerte a Jacob, obligándolo a huir a Harán.' },
  { letter: 'F', answer: 'Faraón', aliases: ['Faraón', 'Pharaoh'], clue: 'Gobernante supremo de Egipto a quien el patriarca Jacob bendijo solemnemente en su vejez.', exp: 'Jacob se presentó ante Faraón y lo bendijo (Génesis 47:7).' },
  { letter: 'G', answer: 'Génesis', aliases: ['Génesis', 'Genesis'], clue: 'Primer libro del Pentateuco, completado por Moisés en el desierto en 1513 a.C.', exp: 'Génesis fue escrito por Moisés en el desierto en 1513 a.C.' },
  { letter: 'H', answer: 'Harán', aliases: ['Harán', 'Haran'], clue: 'Ciudad lejana adonde huyó Jacob para refugiarse en casa de su tío Labán.', exp: 'Jacob huyó a Harán tras la advertencia de su madre Rebeca.' },
  { letter: 'I', answer: 'Israel', aliases: ['Israel'], clue: 'Nombre que el ángel le otorgó a Jacob tras luchar con él toda la noche en Peniel.', exp: 'Israel significa: El que contiende o persevera con Dios.' },
  { letter: 'J', answer: 'Josías', aliases: ['Josías', 'Josiah'], clue: 'Joven y devoto rey de Judá que restauró la adoración verdadera y reinó 31 años.', exp: 'Josías reinó 31 años (659 - 628 a.C.) y purificó Judá y el templo.' },
  { letter: 'L', answer: 'Labán', aliases: ['Labán', 'Laban'], clue: 'Tío y suegro de Jacob que lo engañó dándole por esposa a Lea en lugar de Raquel.', exp: 'Labán cambió repetidamente las condiciones y el salario de Jacob en Harán.' },
  { letter: 'M', answer: 'Manasés', aliases: ['Manasés', 'Manasseh'], clue: 'Rey de Judá que tuvo el reinado más prolongado en Jerusalén, gobernando 55 años.', exp: 'Manasés reinó durante 55 años (716 - 661 a.C.).' },
  { letter: 'N', answer: 'Nabucodonosor', aliases: ['Nabucodonosor', 'Nebuchadnezzar'], clue: 'Rey de Babilonia cuyas tropas destruyeron Jerusalén y su templo en 607 a.C.', exp: 'Nabucodonosor dirigió las fuerzas que desolaron Jerusalén.' },
  { letter: 'O', answer: 'Oseas', aliases: ['Oseas', 'Hoshea', 'Hosea'], clue: 'Último rey del reino norteño de diez tribus de Israel antes de la conquista asiria.', exp: 'Oseas reinó 9 años hasta la caída de Samaria en 740 a.C.' },
  { letter: 'P', answer: 'Peniel', aliases: ['Peniel', 'Penuel'], clue: 'Lugar junto al río Jaboc donde Jacob luchó con un ángel hasta el rayar del alba.', exp: 'En Peniel, el ángel tocó la articulación de la cadera de Jacob.' },
  { letter: 'Q', answer: 'Querubines', aliases: ['Querubines', 'Querubin', 'Querubín', 'Raquel'], clue: 'Poderosas criaturas espirituales de alto rango que custodiaban el camino al árbol de la vida en Edén.', exp: 'Jehová colocó querubines y una espada llameante al este del jardín de Edén.' },
  { letter: 'R', answer: 'Roboam', aliases: ['Roboam', 'Rehoboam'], clue: 'Primer rey del reino sureño de Judá tras la división de la monarquía en 997 a.C.', exp: 'Roboam reinó 17 años en Jerusalén tras la división.' },
  { letter: 'S', answer: 'Samaria', aliases: ['Samaria'], clue: 'Ciudad capital del reino del norte de Israel que cayó ante Asiria en 740 a.C.', exp: 'Samaria fue conquistada por el imperio asirio en 740 a.C.' },
  { letter: 'T', answer: 'Templo', aliases: ['Templo', 'Temple'], clue: 'Sagrada edificación de adoración en Jerusalén que fue arrasada por fuego en 607 a.C.', exp: 'Los babilonios quemaron la casa de Dios en Jerusalén.' },
  { letter: 'U', answer: 'Uzías', aliases: ['Uzías', 'Uzziah', 'Azarías', 'Azariah'], clue: 'Rey de Judá que reinó 52 años en Jerusalén hasta enfermar de lepra por su altivez.', exp: 'Uzías (Azarías) reinó 52 años hasta 777 a.C.' },
  { letter: 'V', answer: 'Vasti', aliases: ['Vasti', 'Vashti', 'Levítico'], clue: 'Reina de Persia destituida por el rey Asuero tras negarse a comparecer ante los invitados del banquete real.', exp: 'La reina Vasti desobedeció la orden del rey y fue reemplazada por Ester.' },
  { letter: 'Z', answer: 'Zacarías', aliases: ['Zacarías', 'Zacarias', 'Zechariah', 'Zorobabel'], clue: 'Fiel profeta y sacerdote bíblico que animó al pueblo a reconstruir el templo de Jerusalén.', exp: 'El profeta Zacarías animó a Zorobabel y a los judíos repatriados.' }
];

/**
 * Valida, depura y asegura al 100% que cada pregunta y respuesta del Rosco coincida exactamente
 * con la letra asignada, sin discrepancias entre "Empieza por" / "Starts with" y "Contiene la" / "Contains".
 */
function sanitizeAndVerifyRosco(candidates, rawText, isEn) {
  const alphabet = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'Z'];
  const baseConcepts = isEn ? STUDY_CONCEPTS_EN : STUDY_CONCEPTS_ES;
  const verifiedList = [];
  const usedAnswers = new Set();

  alphabet.forEach(letter => {
    const letterUpper = letter.toUpperCase();
    const letterLower = letter.toLowerCase();

    // 1. Filtrar candidatos que correspondan a esta letra
    const matchingCandidates = Array.isArray(candidates)
      ? candidates.filter(c => c && (String(c.letter || '').toUpperCase() === letterUpper || !c.letter))
      : [];

    let selected = null;

    // Prioridad 1: Candidato que EMPIECE por la letra
    for (const c of matchingCandidates) {
      if (!c.answer || typeof c.answer !== 'string') continue;
      const ansTrim = c.answer.trim();
      const norm = ansTrim.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');
      if (!norm || usedAnswers.has(norm)) continue;

      if (norm[0].toUpperCase() === letterUpper) {
        const prefix = isEn ? `Starts with ${letterUpper}` : `Empieza por ${letterUpper}`;
        let clue = (c.question || c.clue || '').replace(/^(Empieza por|Contiene la|Contiene el|Contiene|Starts with|Contains)\s+([A-Za-zÁÉÍÓÚáéíóúñ]+)[:\s-]*/i, '').trim();
        if (!clue) clue = isEn ? `Key biblical term from the study notes.` : `Término bíblico clave de los apuntes.`;

        selected = {
          letter: letterUpper,
          prefix,
          question: `${prefix}: ${clue}`,
          answer: ansTrim,
          aliases: Array.isArray(c.aliases) && c.aliases.length > 0 ? c.aliases : [ansTrim],
          explanation: c.explanation || c.exp || (isEn ? 'Fact from the study notes.' : 'Dato extraído de los apuntes.')
        };
        break;
      }
    }

    // Prioridad 2: Si ningún candidato empieza, buscar en baseConcepts uno que EMPIECE por la letra
    if (!selected) {
      const baseStarts = baseConcepts.find(b => {
        const norm = b.answer.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');
        return norm[0].toUpperCase() === letterUpper && !usedAnswers.has(norm);
      });

      if (baseStarts) {
        const prefix = isEn ? `Starts with ${letterUpper}` : `Empieza por ${letterUpper}`;
        let clue = baseStarts.clue.replace(/^(Empieza por|Contiene la|Contiene el|Contiene|Starts with|Contains)\s+([A-Za-zÁÉÍÓÚáéíóúñ]+)[:\s-]*/i, '').trim();
        selected = {
          letter: letterUpper,
          prefix,
          question: `${prefix}: ${clue}`,
          answer: baseStarts.answer,
          aliases: baseStarts.aliases || [baseStarts.answer],
          explanation: baseStarts.exp
        };
      }
    }

    // Prioridad 3: Candidato que CONTENGA la letra
    if (!selected) {
      for (const c of matchingCandidates) {
        if (!c.answer || typeof c.answer !== 'string') continue;
        const ansTrim = c.answer.trim();
        const norm = ansTrim.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');
        if (!norm || usedAnswers.has(norm)) continue;

        if (norm.includes(letterLower)) {
          const prefix = isEn ? `Contains ${letterUpper}` : `Contiene la ${letterUpper}`;
          let clue = (c.question || c.clue || '').replace(/^(Empieza por|Contiene la|Contiene el|Contiene|Starts with|Contains)\s+([A-Za-zÁÉÍÓÚáéíóúñ]+)[:\s-]*/i, '').trim();
          if (!clue) clue = isEn ? `Key biblical term from the study notes.` : `Término bíblico clave de los apuntes.`;

          selected = {
            letter: letterUpper,
            prefix,
            question: `${prefix}: ${clue}`,
            answer: ansTrim,
            aliases: Array.isArray(c.aliases) && c.aliases.length > 0 ? c.aliases : [ansTrim],
            explanation: c.explanation || c.exp || (isEn ? 'Fact from the study notes.' : 'Dato extraído de los apuntes.')
          };
          break;
        }
      }
    }

    // Prioridad 4: Concepto base garantizado que CONTENGA la letra
    if (!selected) {
      const baseContains = baseConcepts.find(b => {
        const norm = b.answer.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');
        return norm.includes(letterLower) && !usedAnswers.has(norm);
      });

      if (baseContains) {
        const prefix = isEn ? `Contains ${letterUpper}` : `Contiene la ${letterUpper}`;
        let clue = baseContains.clue.replace(/^(Empieza por|Contiene la|Contiene el|Contiene|Starts with|Contains)\s+([A-Za-zÁÉÍÓÚáéíóúñ]+)[:\s-]*/i, '').trim();
        selected = {
          letter: letterUpper,
          prefix,
          question: `${prefix}: ${clue}`,
          answer: baseContains.answer,
          aliases: baseContains.aliases || [baseContains.answer],
          explanation: baseContains.exp
        };
      }
    }

    if (selected) {
      const normFinal = selected.answer.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');
      usedAnswers.add(normFinal);
      verifiedList.push(selected);
    }
  });

  return verifiedList;
}

/**
 * Genera Rosco con Gemini adaptando el idioma según las notas
 */
async function generateRoscoWithGemini(text, topicsStr, apiKey) {
  const isEn = detectLanguage(text) === 'en';
  const models = ['gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-flash-latest'];
  const truncatedText = text.slice(0, 35000);

  const prompt = isEn
    ? `Act as the host and writer of the TV game show "The Alphabet Wheel" (similar to Pasapalabra / El Rosco).
Based on the following study notes for "${topicsStr}", create an alphabetical trivia wheel from A to Z using standard letters [A, B, C, D, E, F, G, H, I, J, L, M, N, O, P, Q, R, S, T, U, V, Z].

MANDATORY LETTER RULES:
1. LANGUAGE REQUIREMENT: All questions, prefixes, answers, and explanations MUST BE ENTIRELY IN ENGLISH.
2. EXACT LETTER MATCHING:
   - If the answer STARTS with the letter: "prefix" MUST be "Starts with [Letter]", and "question" must begin with "Starts with [Letter]: [definition]".
   - If the answer only CONTAINS the letter (not first): "prefix" MUST be "Contains [Letter]", and "question" must begin with "Contains [Letter]: [definition]".
   - NEVER use an answer that does NOT contain or start with the assigned letter!
3. Each question must formulate a direct trivia definition about a real fact, person, place, or concept from the notes.
4. STRICTLY FORBIDDEN to ask "complete the statement: _____" or ask about headings/outlines.
5. "answer": The exact term or name in English.
6. "aliases": Array of accepted synonyms or variants (e.g. ["Josiah", "Josías"]).
7. "explanation": Concise fact or reference from the notes.

Return ONLY valid JSON:
[
  {
    "letter": "A",
    "prefix": "Starts with A",
    "question": "Starts with A: Faithful king of Judah who reigned 41 years...",
    "answer": "Asa",
    "aliases": ["Asa"],
    "explanation": "Asa reigned in Judah for 41 years."
  }
]

STUDY NOTES:
${truncatedText}`
    : `Actúa como el presentador y guionista del concurso televisivo "El Rosco / La Ruleta de la A a la Z" (estilo Pasapalabra).
Basándote en los siguientes apuntes de estudio sobre "${topicsStr}", crea una ruleta de preguntas alfabéticas con las letras [A, B, C, D, E, F, G, H, I, J, L, M, N, O, P, Q, R, S, T, U, V, Z].

REGLAS OBLIGATORIAS DE CONCORDANCIA DE LETRA:
1. REGLA DE IDIOMA: Como los apuntes están en español, todas las preguntas, prefijos, respuestas y explicaciones DEBEN ESTAR EN ESPAÑOL.
2. COINCIDENCIA EXACTA CON LA LETRA:
   - Si la respuesta EMPIEZA por la letra: "prefix" DEBE ser "Empieza por [Letra]", y "question" DEBE empezar por "Empieza por [Letra]: [definición]".
   - Si la respuesta únicamente CONTIENE la letra (no al principio): "prefix" DEBE ser "Contiene la [Letra]", y "question" DEBE empezar por "Contiene la [Letra]: [definición]".
   - QUEDA TERMINANTEMENTE PROHIBIDO usar una palabra que no contenga ni empiece por la letra indicada.
   - NUNCA pongas "Empieza por" si la palabra no empieza por esa letra.
3. Cada pregunta debe formular una DEFINICIÓN O PISTA DIRECTA DE CONCURSO sobre el dato del apunte.
4. QUEDA TERMINANTEMENTE PROHIBIDO formular preguntas de tipo "completa la afirmación: _______" o preguntar sobre encabezados, esquemas o partes.
5. "answer": La palabra o término exacto en español.
6. "aliases": Lista de sinónimos o variantes aceptadas (ej: ["Josías", "Josiah"]).
7. "explanation": Breve dato o cita del apunte.

Devuelve ÚNICAMENTE un JSON válido:
[
  {
    "letter": "A",
    "prefix": "Empieza por A",
    "question": "Empieza por A: Fiel rey de Judá que reinó 41 años...",
    "answer": "Asa",
    "aliases": ["Asa", "Asá"],
    "explanation": "Asa reinó en Judá durante 41 años."
  }
]

APUNTES:
${truncatedText}`;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, responseMimeType: "application/json" }
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) continue;
      const data = await response.json();
      let rawOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawOutput) continue;

      let cleaned = rawOutput.trim();
      if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');

      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed) && parsed.length >= 8) {
        // Validar y depurar rigurosamente las respuestas de Gemini
        const verified = sanitizeAndVerifyRosco(parsed, text, isEn);
        if (verified && verified.length >= 15) {
          return verified;
        }
      }
    } catch (e) {
      console.warn(`[Rosco Gemini] Error con modelo ${model}:`, e.message);
    }
  }

  throw new Error('No se pudo generar el Rosco con Gemini.');
}

/**
 * Generador local de definiciones de Rosco A-Z
 * Basado fielmente en conceptos de estudio reales, sin huecos (_______) ni encabezados.
 * Bilingüe: genera en inglés o español según el idioma de los apuntes.
 */
function generateRoscoLocally(rawText, topicsStr) {
  const text = cleanText(rawText);
  const isEn = detectLanguage(text) === 'en';
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // Filtro de encabezados
  const isHeader = (str) => /^(part\s+\d+|chapter\s+\d+|capítulo|outline|table|kings\s+of\s+the|contemporary|chronology)/i.test(str.trim());

  // Extraer conceptos dinámicos adicionales de viñetas estructuradas
  const dynamicConcepts = [];
  lines.forEach(line => {
    if (isHeader(line)) return;
    const match = line.match(/^[-•*]?\s*([A-Za-zÁÉÍÓÚáéíóúñ]+(?:\s*\([^\)]+\))?):\s*(.+)$/i);
    if (match) {
      const term = match[1].replace(/\s*\([^\)]+\)/g, '').trim();
      let rawClue = match[2].trim();
      if (term.length >= 3 && rawClue.length >= 10 && !isHeader(term)) {
        let cleanClue = rawClue;
        if (!isEn) {
          cleanClue = cleanClue
            .replace(/reigned/gi, 'reinó')
            .replace(/years/gi, 'años')
            .replace(/months/gi, 'meses')
            .replace(/days/gi, 'días')
            .replace(/\bonly\b/gi, 'tan solo')
            .replace(/prophesied/gi, 'profetizó')
            .replace(/B\.C\.E\./gi, 'a.C.')
            .replace(/C\.E\./gi, 'd.C.')
            .replace(/Wicked king/gi, 'Rey malvado que')
            .replace(/Faithful king/gi, 'Fiel rey que')
            .replace(/Great religious reformer/gi, 'Gran reformador religioso y rey que')
            .replace(/Witnessed deliverance from Sennacherib/gi, 'presenció la salvación divina ante Senaquerib')
            .replace(/longest reign of any king in Jerusalem\. Later repented/gi, 'tuvo el reinado más largo en Jerusalén y luego se arrepintió')
            .replace(/Righteous young king and restorer of true worship/gi, 'Joven rey justo y restaurador de la adoración que')
            .replace(/Taken captive to Babylon/gi, 'llevado cautivo a Babilonia')
            .replace(/Last king on David's throne in Jerusalem/gi, 'Último rey sobre el trono de David en Jerusalén')
            .replace(/Last king of Israel/gi, 'Último rey del reino del norte de Israel')
            .replace(/Statesman and prophet in Babylon/gi, 'Profeta y estadista en Babilonia')
            .replace(/Major prophet in Jerusalem/gi, 'Gran profeta en Jerusalén')
            .replace(/to the Jewish exiles in Babylon/gi, 'a los cautivos judíos en Babilonia')
            .replace(/against Nineveh/gi, 'contra Nínive')
            .replace(/against Edom/gi, 'contra Edom')
            .replace(/\buntil\b/gi, 'hasta')
            .replace(/\bbefore\b/gi, 'antes del')
            .replace(/\bafter\b/gi, 'después del')
            .replace(/\bmonth\b/gi, 'mes')
            .replace(/que,\s*reinó/gi, 'que reinó');

          if (/^reinó/i.test(cleanClue)) {
            cleanClue = `Rey bíblico que ${cleanClue}`;
          } else if (/^profetizó/i.test(cleanClue)) {
            cleanClue = `Profeta bíblico que ${cleanClue}`;
          }
        } else {
          if (/^reigned/i.test(cleanClue)) {
            cleanClue = `Biblical king who ${cleanClue}`;
          } else if (/^prophesied/i.test(cleanClue)) {
            cleanClue = `Biblical prophet who ${cleanClue}`;
          }
        }

        dynamicConcepts.push({
          answer: term,
          aliases: [term],
          clue: cleanClue.slice(0, 140),
          exp: line
        });
      }
    }
  });

  const baseConcepts = isEn ? STUDY_CONCEPTS_EN : STUDY_CONCEPTS_ES;
  const allConcepts = [...dynamicConcepts, ...baseConcepts];
  return sanitizeAndVerifyRosco(allConcepts, rawText, isEn);
}

/**
 * Llama a la API de Gemini (v1beta) adaptando el idioma automáticamente
 */
async function generateWithGemini(text, topicTitle, apiKey, count = 10) {
  const isEn = detectLanguage(text) === 'en';
  const models = ['gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-flash-latest'];
  const truncatedText = text.slice(0, 35000);

  const prompt = isEn
    ? `Act as an expert professor and question writer for an educational TV trivia competition (like "Saber y Ganar" / Jeopardy).
Based on the following study notes for the topic "${topicTitle}", generate exactly ${count} multiple-choice test questions focused on REAL CONCRETE FACTS to memorize and learn.

MANDATORY RULES:
1. LANGUAGE REQUIREMENT: Because the notes are in English, ALL questions, 4 options (A, B, C, D), and explanations MUST BE ENTIRELY IN ENGLISH.
2. Ask DIRECT questions about CONCRETE FACTS: names of kings, prophets, writers, key dates, places, durations of reign, and biblical events.
3. STRICTLY FORBIDDEN to ask "Which term completes the sentence: _____" or ask questions about document headings, outlines, tables, or sections (e.g. NEVER ask about "Part 1:", "Part 2:", etc.).
4. Exactly 4 answer options labeled "A", "B", "C", and "D". Only one option must be correct.
5. CRITICAL HOMOGENEITY RULE: All 4 options (A, B, C, D) MUST have identical length, grammatical structure, and level of detail. NEVER add parenthetical dates or explanations to the correct option unless all 4 options share the exact same format. If asking for a king, all 4 must be king names. If asking for a year, all 4 must be years.
6. Provide a clear, educational explanation citing the exact fact from the notes.
7. Return ONLY valid JSON with no markdown code fences:

[
  {
    "question": "Direct question about a concrete fact?",
    "options": {
      "A": "First option",
      "B": "Second option",
      "C": "Third option",
      "D": "Fourth option"
    },
    "correctAnswer": "A",
    "explanation": "Explanation with the exact fact from the notes.",
    "difficulty": "normal"
  }
]

STUDY NOTES FOR "${topicTitle}":
${truncatedText}`
    : `Actúa como un profesor y creador oficial de preguntas del concurso televisivo "Saber y Ganar".
A partir de los siguientes apuntes sobre el tema "${topicTitle}", genera exactamente ${count} preguntas de opción múltiple tipo test enfocadas en DATOS REALES para memorizar y aprender.

REGLAS OBLIGATORIAS:
1. REGLA DE IDIOMA: Como los apuntes están en español, todas las preguntas, opciones (A, B, C, D) y explicaciones DEBEN ESTAR TOTALMENTE EN ESPAÑOL.
2. Haz preguntas DIRECTAS sobre DATOS CONCRETOS: nombres de reyes, profetas, escritores, años, fechas clave, lugares, duraciones de reinado y causas/lecciones.
3. QUEDA TERMINANTEMENTE PROHIBIDO formular preguntas de tipo "¿Qué término completa la frase?" o preguntar por encabezados, esquemas o partes como "Part 1:", "Part 2:".
4. Cada pregunta debe tener exactamente 4 opciones de respuesta etiquetadas con "A", "B", "C" y "D". Solo una opción debe ser la correcta.
5. REGLA CRÍTICA DE HOMOGENEIDAD: Las 4 opciones (A, B, C, D) DEBEN tener EXACTAMENTE la misma longitud, estructura sintáctica y nivel de detalle. NUNCA agregues fechas entre paréntesis o explicaciones extra a la opción correcta que no estén en las otras 3 opciones. Si preguntas por un nombre, las 4 opciones deben ser solo nombres. Si preguntas por un año, las 4 deben ser solo años.
6. Incluye una explicación didáctica clara con el dato exacto de los apuntes.
7. Devuelve ÚNICAMENTE un JSON válido sin texto adicional, sin bloques de código markdown:

[
  {
    "question": "¿Pregunta directa sobre un dato concreto?",
    "options": {
      "A": "Primera opción",
      "B": "Segunda opción",
      "C": "Tercera opción",
      "D": "Cuarta opción"
    },
    "correctAnswer": "A",
    "explanation": "Explicación con el dato del apunte.",
    "difficulty": "normal"
  }
]

APUNTES DEL TEMA "${topicTitle}":
${truncatedText}`;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          responseMimeType: "application/json"
        }
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) continue;

      const data = await response.json();
      const rawOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawOutput) continue;

      let cleaned = rawOutput.trim();
      if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');

      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(item => ({
          question: item.question,
          options: item.options,
          correctAnswer: item.correctAnswer.toUpperCase(),
          explanation: item.explanation || (isEn ? 'Verified in the study notes.' : 'Respuesta verificada en los apuntes.'),
          difficulty: item.difficulty || 'normal'
        }));
      }
    } catch (e) {
      console.warn(`[Gemini] Falló intento con ${model}:`, e.message);
    }
  }

  throw new Error('No se pudo generar preguntas válidas con los modelos de Gemini disponibles.');
}

/**
 * Generador local inteligente con soporte bilingüe completo
 */
function generateLocallyFromText(rawText, topicTitle, count = 10) {
  const text = cleanText(rawText);
  const isEn = detectLanguage(text) === 'en';
  const questions = [];
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // Filtro de encabezados y etiquetas de formato que NO son datos de estudio
  const isHeaderOrSection = (str) => {
    const s = str.trim().toLowerCase();
    return /^(part\s+\d+|capítulo\s+\d+|sección\s+\d+|outline|table|kings\s+of\s+the|contemporary\s+prophets|chronology|introduction|resumen|índice)/i.test(s);
  };

  // 1. Extractor de Libros Bíblicos (Escritores, Lugares, Fechas de finalización)
  const bookBlockRegex = /([1-3]?[A-Za-zÁÉÍÓÚáéíóúñ\s]+)\n+Writer:\s*([^\n]+)\n+Place Written:\s*([^\n]+)\n+Writing Completed:\s*([^\n]+)/gi;
  let bookMatch;
  while ((bookMatch = bookBlockRegex.exec(text)) !== null && questions.length < count) {
    const [_, bookName, writer, place, completedDate] = bookMatch;
    const cleanBook = bookName.trim();
    if (cleanBook.toLowerCase().includes('books of') || cleanBook.length < 3) continue;

    // Pregunta 1: Escritor
    if (questions.length < count && writer && writer.length > 2) {
      const writersPool = isEn
        ? ['Moses', 'Samuel', 'Jeremiah', 'Ezra', 'David', 'Solomon', 'Isaiah', 'Daniel', 'Paul', 'Luke', 'John', 'Peter']
        : ['Moisés', 'Samuel', 'Jeremías', 'Esdras', 'David', 'Salomón', 'Isaías', 'Daniel', 'Pablo', 'Lucas', 'Juan', 'Pedro'];
      const cleanWriter = writer.trim();
      const altWriters = writersPool.filter(w => !cleanWriter.toLowerCase().includes(w.toLowerCase())).slice(0, 3);
      const opts = [cleanWriter, ...altWriters];
      shuffle(opts);

      const qText = isEn
        ? `According to the study notes on "${topicTitle}", who was the writer of the book of ${cleanBook}?`
        : `Según los apuntes sobre "${topicTitle}", ¿quién fue el escritor del libro de ${cleanBook}?`;
      const expText = isEn
        ? `In the study notes: Book: ${cleanBook} | Writer: ${cleanWriter}`
        : `En los apuntes se indica: Libro: ${cleanBook} | Escritor: ${cleanWriter}`;

      questions.push({
        question: qText,
        options: { A: opts[0], B: opts[1], C: opts[2], D: opts[3] },
        correctAnswer: ['A', 'B', 'C', 'D'][opts.indexOf(cleanWriter)],
        explanation: expText,
        difficulty: 'normal'
      });
    }

    // Pregunta 2: Lugar de escritura
    if (questions.length < count && place && place.length > 2) {
      const placesPool = isEn
        ? ['In the wilderness', 'Jerusalem', 'Babylon', 'Rome', 'Egypt', 'Plains of Moab', 'Caesarea']
        : ['En el desierto', 'Jerusalén', 'Babilonia', 'Roma', 'Egipto', 'Llanuras de Moab', 'Cesarea'];
      const cleanPlace = place.trim();
      const altPlaces = placesPool.filter(p => !cleanPlace.toLowerCase().includes(p.toLowerCase())).slice(0, 3);
      const opts = [cleanPlace, ...altPlaces];
      shuffle(opts);

      const qText = isEn
        ? `Where was the Bible book of ${cleanBook} written or completed?`
        : `¿En qué lugar fue escrito o completado el libro bíblico de ${cleanBook}?`;
      const expText = isEn
        ? `In the study notes: Book: ${cleanBook} | Place Written: ${cleanPlace}`
        : `En los apuntes se registra: Libro: ${cleanBook} | Lugar de redacción: ${cleanPlace}`;

      questions.push({
        question: qText,
        options: { A: opts[0], B: opts[1], C: opts[2], D: opts[3] },
        correctAnswer: ['A', 'B', 'C', 'D'][opts.indexOf(cleanPlace)],
        explanation: expText,
        difficulty: 'normal'
      });
    }

    // Pregunta 3: Fecha de finalización
    if (questions.length < count && completedDate && completedDate.length > 2) {
      const cleanDate = completedDate.trim();
      const altDates = isEn
        ? ['1513 B.C.E.', '1473 B.C.E.', '1040 B.C.E.', '580 B.C.E.', '443 B.C.E.', 'c. 96 C.E.', 'c. 65 C.E.']
        : ['1513 a.C.', '1473 a.C.', '1040 a.C.', '580 a.C.', '443 a.C.', 'c. 96 d.C.', 'c. 65 d.C.'];
      const filteredDates = altDates.filter(d => !cleanDate.toLowerCase().includes(d.toLowerCase())).slice(0, 3);
      const opts = [cleanDate, ...filteredDates];
      shuffle(opts);

      const qText = isEn
        ? `In approximately what year was the writing of ${cleanBook} completed according to the study notes?`
        : `¿Hacia qué año o fecha se completó la redacción de ${cleanBook} según la tabla de los apuntes?`;
      const expText = isEn
        ? `In the study notes: Book: ${cleanBook} | Writing Completed: ${cleanDate}`
        : `En los apuntes figura: Libro: ${cleanBook} | Fecha completada: ${cleanDate}`;

      questions.push({
        question: qText,
        options: { A: opts[0], B: opts[1], C: opts[2], D: opts[3] },
        correctAnswer: ['A', 'B', 'C', 'D'][opts.indexOf(cleanDate)],
        explanation: expText,
        difficulty: 'normal'
      });
    }
  }

  // 2. Extractor de Reyes, Duraciones de Reinado y Sucesos Históricos
  for (let i = 0; i < lines.length && questions.length < count; i++) {
    const line = lines[i];
    if (isHeaderOrSection(line)) continue;

    // A) Reyes y duraciones: "- Hezekiah: Reigned 29 years..." o "reinó 40 años"
    const reignMatch = line.match(/^[-•*]?\s*([A-Za-zÁÉÍÓÚáéíóúñ\s()]+?):\s*.*?(?:reigned|reinó|gobernó)\s+(\d+\s*(?:years|años|months|meses|days|días))/i);
    if (reignMatch) {
      const name = reignMatch[1].trim();
      let duration = reignMatch[2].trim();
      if (isEn) {
        duration = duration.replace(/años/gi, 'years').replace(/meses/gi, 'months').replace(/días/gi, 'days');
      } else {
        duration = duration.replace(/years/gi, 'años').replace(/months/gi, 'meses').replace(/days/gi, 'días');
      }

      if (name.length > 2 && !isHeaderOrSection(name)) {
        const durationsPool = isEn
          ? ['40 years', '29 years', '16 years', '52 years', '55 years', '31 years', '2 years', '3 months', '7 days']
          : ['40 años', '29 años', '16 años', '52 años', '55 años', '31 años', '2 años', '3 meses', '7 días'];
        const altDurations = durationsPool.filter(d => d.toLowerCase() !== duration.toLowerCase()).slice(0, 3);
        const opts = [duration, ...altDurations];
        shuffle(opts);

        const qText = isEn
          ? `How long did ${name} reign or rule according to the chronological data in the notes?`
          : `¿Durante cuánto tiempo gobernó o reinó ${name} según los datos cronológicos de los apuntes?`;
        const expText = isEn
          ? `Study notes record: "${line}"`
          : `En los apuntes de estudio consta: "${line}"`;

        questions.push({
          question: qText,
          options: { A: opts[0], B: opts[1], C: opts[2], D: opts[3] },
          correctAnswer: ['A', 'B', 'C', 'D'][opts.indexOf(duration)],
          explanation: expText,
          difficulty: 'normal'
        });
        continue;
      }
    }

    // B) Fechas históricas claves: "- 607 B.C.E.: Jerusalem and its temple are destroyed..."
    const dateEventMatch = line.match(/^[-•*]?\s*(\d{3,4}(?:\s*(?:B\.C\.E\.|a\.C\.|C\.E\.|d\.C\.))?):\s*(.+)$/i);
    if (dateEventMatch) {
      let rawDate = dateEventMatch[1].trim();
      if (isEn) {
        rawDate = rawDate.replace(/a\.C\./gi, 'B.C.E.').replace(/d\.C\./gi, 'C.E.');
      } else {
        rawDate = rawDate.replace(/B\.C\.E\./gi, 'a.C.').replace(/C\.E\./gi, 'd.C.');
      }
      const eventText = dateEventMatch[2].trim();
      if (eventText.length > 15 && !isHeaderOrSection(eventText)) {
        const altYears = generateDistractorYears(rawDate, isEn);
        const opts = [rawDate, ...altYears];
        shuffle(opts);

        const qText = isEn
          ? `In what year do the notes place the following historical event?\n"${eventText.slice(0, 160)}"`
          : `¿En qué año sitúan los apuntes el siguiente acontecimiento histórico?\n"${eventText.slice(0, 160)}"`;
        const expText = isEn
          ? `Recorded in the notes: "${line}"`
          : `Registrado en los apuntes: "${line}"`;

        questions.push({
          question: qText,
          options: { A: opts[0], B: opts[1], C: opts[2], D: opts[3] },
          correctAnswer: ['A', 'B', 'C', 'D'][opts.indexOf(rawDate)],
          explanation: expText,
          difficulty: 'normal'
        });
        continue;
      }
    }

    // C) Profetas contemporáneos: "- Hosea: Prophesied in the northern kingdom..."
    const prophetMatch = line.match(/^[-•*]?\s*([A-Za-zÁÉÍÓÚáéíóúñ]+):\s*(?:Prophesied|Profetizó)\s+(?:in|en)\s+(.+)$/i);
    if (prophetMatch) {
      const prophetName = prophetMatch[1].trim();
      const details = prophetMatch[2].trim();
      const prophetsPool = isEn
        ? ['Isaiah', 'Jeremiah', 'Ezekiel', 'Daniel', 'Elijah', 'Elisha', 'Jonah', 'Amos']
        : ['Isaías', 'Jeremías', 'Ezequiel', 'Daniel', 'Elías', 'Eliseo', 'Jonás', 'Amos'];
      const altProphets = prophetsPool.filter(p => p.toLowerCase() !== prophetName.toLowerCase()).slice(0, 3);
      const opts = [prophetName, ...altProphets];
      shuffle(opts);

      const qText = isEn
        ? `Which prophet prophesied in ${details.slice(0, 100)} according to the notes?`
        : `¿Qué profeta profetizó en ${details.slice(0, 100)} según los apuntes?`;
      const expText = isEn
        ? `Recorded in the notes: "${line}"`
        : `En los apuntes figura: "${line}"`;

      questions.push({
        question: qText,
        options: { A: opts[0], B: opts[1], C: opts[2], D: opts[3] },
        correctAnswer: ['A', 'B', 'C', 'D'][opts.indexOf(prophetName)],
        explanation: expText,
        difficulty: 'normal'
      });
      continue;
    }
  }

  // 3. Extractor de hechos doctrinales / narrativos sustantivos
  const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 50 && !isHeaderOrSection(p));
  for (let i = 0; i < paragraphs.length && questions.length < count; i++) {
    const p = paragraphs[i];
    const sentences = p.split(/(?<=[.?!])\s+/).filter(s => s.length > 35 && !isHeaderOrSection(s));

    for (const s of sentences) {
      if (questions.length >= count) break;
      if (questions.some(q => q.explanation.includes(s.slice(0, 40)))) continue;

      // Buscar si contiene fecha o año en medio de la oración
      const yearInText = s.match(/\b(\d{3,4})\s*(?:a\.C\.|B\.C\.E\.|d\.C\.)/i);
      if (yearInText) {
        let yearStr = yearInText[0];
        if (isEn) {
          yearStr = yearStr.replace(/a\.C\./gi, 'B.C.E.').replace(/d\.C\./gi, 'C.E.');
        } else {
          yearStr = yearStr.replace(/B\.C\.E\./gi, 'a.C.').replace(/C\.E\./gi, 'd.C.');
        }
        const altYears = generateDistractorYears(yearStr, isEn);
        const opts = [yearStr, ...altYears];
        shuffle(opts);

        const qText = isEn
          ? `According to the notes on ${topicTitle}, in what year or date did this event occur?\n"${s.slice(0, 150)}"`
          : `Según los apuntes sobre ${topicTitle}, ¿en qué año o fecha se sitúa este hecho?\n"${s.slice(0, 150)}"`;
        const expText = isEn
          ? `Text from the study notes: "${s.slice(0, 180)}"`
          : `Texto de los apuntes: "${s.slice(0, 180)}"`;

        questions.push({
          question: qText,
          options: { A: opts[0], B: opts[1], C: opts[2], D: opts[3] },
          correctAnswer: ['A', 'B', 'C', 'D'][opts.indexOf(yearStr)],
          explanation: expText,
          difficulty: 'normal'
        });
        continue;
      }

      // Si es una afirmación narrativa con sujeto sustantivo
      const nameMatch = s.match(/\b([A-ZÁÉÍÓÚ][a-záéíóúñ]{3,})\b/);
      if (nameMatch && !['Para', 'Pero', 'Como', 'Este', 'Esta', 'Cuando', 'Donde', 'Todo', 'Then', 'When', 'After', 'Before', 'This', 'That', 'With', 'From'].includes(nameMatch[1])) {
        const keySubject = nameMatch[1];
        const trueStatement = s.trim();

        const qText = isEn
          ? `Regarding ${keySubject} in the study of "${topicTitle}", which of the following statements is ACCURATE according to the notes?`
          : `En relación con ${keySubject} en el estudio de "${topicTitle}", ¿cuál de las siguientes declaraciones es EXACTA según los apuntes?`;

        const opts = isEn
          ? [
            trueStatement,
            `It occurred contrary to what is recorded in the original records.`,
            `It does not relate to the historical events described in these notes.`,
            `It was an event assigned to a different period and omitted from the study.`
          ]
          : [
            trueStatement,
            `Ocurrió de forma contraria a lo que indican las fuentes originales de ${topicTitle}.`,
            `No se relaciona con los acontecimientos históricos descritos en estos apuntes.`,
            `Fue un hecho atribuido a otra época y descartado en el estudio.`
          ];
        shuffle(opts);

        questions.push({
          question: qText,
          options: { A: opts[0], B: opts[1], C: opts[2], D: opts[3] },
          correctAnswer: ['A', 'B', 'C', 'D'][opts.indexOf(trueStatement)],
          explanation: isEn ? `Study passage: "${s.slice(0, 180)}"` : `Fragmento de estudio: "${s.slice(0, 180)}"`,
          difficulty: 'normal'
        });
      }
    }
  }

  return questions;
}

// Mezcla un array en su sitio (Fisher-Yates). Faltaba y hacía fallar el generador local.
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function generateDistractorYears(baseYearStr, isEn = false) {
  const num = parseInt(baseYearStr, 10);
  if (isNaN(num)) {
    return isEn ? ['15th Century', '18th Century', '20th Century'] : ['Siglo XV', 'Siglo XVIII', 'Siglo XX'];
  }
  const isBCE = baseYearStr.toLowerCase().includes('a.c.') || baseYearStr.toLowerCase().includes('b.c.e');
  const suffix = isBCE ? (isEn ? ' B.C.E.' : ' a.C.') : (isEn ? ' C.E.' : ' d.C.');
  const diffs = [-10, 25, -50, 15, -100, 33];
  shuffle(diffs);
  return [
    Math.max(1, Math.abs(num + diffs[0])) + suffix,
    Math.max(1, Math.abs(num + diffs[1])) + suffix,
    Math.max(1, Math.abs(num + diffs[2])) + suffix
  ];
}

/**
 * Procesa y mejora notas usando IA (Gemini con respaldo local inteligente)
 * @param {string} content - Contenido de la nota
 * @param {string} action - 'correct' | 'improve' | 'summarize' | 'format_bible'
 * @param {string} noteTitle - Título de la nota
 */
async function improveNoteWithAI(content, action = 'all', noteTitle = '', customApiKey = '') {
  if (!content || !content.trim()) {
    throw new Error('El contenido de la nota está vacío.');
  }

  // Si se envió una API key personalizada, guardarla en la configuración para uso futuro
  if (customApiKey && customApiKey.trim().length > 10) {
    dbService.updateConfig({ geminiApiKey: customApiKey.trim() });
  }

  const config = dbService.getConfig();
  const apiKey = (customApiKey && customApiKey.trim().length > 10) ? customApiKey.trim() : (config.geminiApiKey || process.env.GEMINI_API_KEY || '');

  // 1. Aislar únicamente la última entrada añadida para corregir exclusivamente esa
  const { prefix, lastEntry, hasMultipleEntries } = splitLastEntry(content);
  const targetText = lastEntry.trim();
  const lang = detectLanguage(targetText);

  let improvedEntry = '';
  let usedEngine = 'local';
  let geminiError = null;

  if (apiKey && apiKey.trim().length > 10) {
    try {
      console.log(`[AI-Note] Conectando con Google Gemini (${action}, idioma: ${lang}) para la última entrada de "${noteTitle}"...`);
      const result = await processNoteWithGemini(targetText, action, noteTitle, apiKey.trim(), lang);
      if (result && result.trim().length > 0) {
        improvedEntry = result.trim();
        usedEngine = 'gemini';
      }
    } catch (err) {
      console.warn(`[AI-Note] Falló llamada a Gemini (${err.message}). Utilizando asistente inteligente local.`);
      geminiError = err.message;
    }
  }

  if (!improvedEntry) {
    improvedEntry = processNoteLocally(targetText, action, noteTitle, lang);
    usedEngine = 'local';
  }

  // 2. Reconstruir el documento completo: las entradas anteriores quedan intactas, solo la última entrada se actualiza
  let finalResult = '';
  if (hasMultipleEntries && prefix) {
    finalResult = prefix.trimEnd() + '\n\n' + improvedEntry.trimStart();
  } else {
    finalResult = improvedEntry;
  }

  return {
    result: finalResult,
    usedEngine,
    geminiError,
    detectedLang: lang,
    isPartial: hasMultipleEntries
  };
}

async function processNoteWithGemini(content, action, noteTitle, apiKey, lang = 'es') {
  const models = ['gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-flash-latest'];
  
  let instructions = '';
  if (lang === 'en') {
    // Instrucciones y correcciones 100% en Inglés
    if (action === 'all' || action === 'improve') {
      instructions = `Act as a professional proofreader and editor for personal study notes in English.
Your primary task is to THOROUGHLY REVIEW AND CORRECT THE PROVIDED STUDY ENTRY IN ENGLISH:
1. STRICT LANGUAGE REQUIREMENT: The input text is in English. All corrections, vocabulary improvements, and wording MUST BE 100% IN ENGLISH. Do NOT translate to Spanish.
2. RIGOROUS SPELLING & GRAMMAR CORRECTION:
   - Actively review every sentence and word in this entry.
   - Correct spelling mistakes, typos, capitalization (Abraham, Jehovah, God, Jesus, Moses, Today, Scripture, etc.), punctuation, and grammatical agreement.
3. WRITING STYLE & CLARITY:
   - Polish phrasing for clarity and natural English while strictly preserving the student's personal voice, thoughts, and reflections.
4. STRUCTURE PRESERVATION:
   - Keep structural headers intact (e.g. "---", "## 📅 ...", "# ✍️ Title: ...").
   - Do NOT add artificial canned sections or pre-written application paragraphs that the student did not write.
5. DIRECT OUTPUT:
   - Return ONLY the final corrected and improved Markdown text, with no introductory chatter, explanations, or sign-offs.`;
    } else if (action === 'correct') {
      instructions = `Act as an English proofreader. Correct spelling, capitalization, and grammar in English. Keep all headings intact and return only the corrected text.`;
    } else if (action === 'summarize') {
      instructions = `Summarize the study entry in English highlighting key spiritual points in Markdown format.`;
    } else if (action === 'format_bible') {
      instructions = `Format the study entry in English cleanly with quote blocks for scriptures and bullet points. Return only Markdown.`;
    }
  } else {
    // Instrucciones y correcciones 100% en Español
    if (action === 'all' || action === 'improve') {
      instructions = `Actúa como un corrector ortográfico y redactor profesional de notas de estudio teocrático en español.
Tu labor principal es REVISAR Y CORREGIR MINUCIOSAMENTE LA ENTRADA DE ESTUDIO EN ESPAÑOL:
1. REQUISITO ESTRICTO DE IDIOMA: Como el texto está en español, todas las correcciones, vocabulario y mejoras DEBEN SER 100% EN ESPAÑOL.
2. CORRECCIÓN ORTOGRÁFICA Y GRAMATICAL RIGUROSA:
   - Revisa activamente cada frase y palabra del apunte.
   - Corrige errores ortográficos, tildes (ej: Jehová, Jesús, Moisés, Abraham, día, también, más, oración, corazón, qué, cómo, cuándo, etc.), mayúsculas iniciales y tras punto, y signos de interrogación o exclamación (añadiendo signos de apertura ¿ y ¡).
3. MEJORA DE REDACCIÓN Y ESTILO:
   - Pule la fluidez, coherencia y claridad de las frases sin alterar el sentido ni eliminar reflexiones personales del estudiante.
4. ESTRUCTURA Y ENCABEZADOS:
   - Conserva intactos los separadores ("---") y encabezados existentes como "## 📅 DÍA ...", "# ✍️ Título: ...", etc.
   - NO agregues párrafos artificiales genéricos si no forman parte de lo que el usuario escribió o reflexionó.
5. SALIDA DIRECTA:
   - Devuelve DIRECTAMENTE el texto final corregido y mejorado en Markdown, sin introducciones ("Aquí tienes..."), explicaciones ni despedidas.`;
    } else if (action === 'correct') {
      instructions = `Actúa como un corrector ortográfico y gramatical profesional en español.
Revisa y corrige minuciosamente la ortografía, todas las tildes faltantes, signos de puntuación (¿?, ¡!), mayúsculas y concordancia gramatical del siguiente texto.
REGLAS:
- Conserva el 100% de la información y la estructura original (encabezados, fechas, títulos y viñetas).
- No agregues introducciones ni explicaciones; devuelve únicamente el texto corregido.`;
    } else if (action === 'summarize') {
      instructions = `Resume el apunte destacando las ideas principales y lecciones espirituales prácticas en español. Devuelve directamente el texto formateado en Markdown.`;
    } else if (action === 'format_bible') {
      instructions = `Transforma el borrador en una nota limpia y estructurada en español con citas bíblicas en bloques de cita (> texto). Devuelve directamente el texto formateado.`;
    }
  }

  const prompt = `${instructions}

TÍTULO DEL APUNTE: ${noteTitle || 'Apunte de Estudio'}

CONTENIDO ORIGINAL:
${content.slice(0, 30000)}`;

  let lastErr = '';
  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.25 }
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const msg = errJson.error?.message || `HTTP ${response.status}`;
        console.warn(`[AI-Note] Error con modelo ${model}:`, msg);
        lastErr = msg;
        continue;
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text && text.trim().length > 0) {
        return text.trim();
      }
    } catch (e) {
      console.warn(`[AI-Note] Excepción con modelo ${model}:`, e.message);
      lastErr = e.message;
    }
  }

  throw new Error(lastErr || 'Gemini no devolvió respuesta para la nota.');
}

/**
 * Diccionario y reglas de corrección ortográfica en español
 */
const SPANISH_SPELL_RULES = [
  // Deidades y términos sagrados
  [/\bjehova\b/gi, 'Jehová'],
  [/\bjesus\b/gi, 'Jesús'],
  [/\bcristo\b/gi, 'Cristo'],
  [/\bsenor\b/gi, 'Señor'],
  [/\bdios\b/gi, 'Dios'],
  [/\bbiblia\b/gi, 'Biblia'],
  [/\bespiritu\b/gi, 'espíritu'],
  [/\bespiritus\b/gi, 'espíritus'],
  [/\bapostol\b/gi, 'apóstol'],
  [/\bapostoles\b/gi, 'apóstoles'],
  [/\bprofecia\b/gi, 'profecía'],
  [/\bprofecias\b/gi, 'profecías'],

  // Personajes bíblicos
  [/\bmoises\b/gi, 'Moisés'],
  [/\babrahan\b/gi, 'Abrahán'],
  [/\babraham\b/gi, 'Abrahán'],
  [/\bisaac\b/gi, 'Isaac'],
  [/\bjacob\b/gi, 'Jacob'],
  [/\bjose\b/gi, 'José'],
  [/\bsalomon\b/gi, 'Salomón'],
  [/\bjosias\b/gi, 'Josías'],
  [/\besau\b/gi, 'Esaú'],
  [/\blaban\b/gi, 'Labán'],
  [/\braquel\b/gi, 'Raquel'],
  [/\bjerusalen\b/gi, 'Jerusalén'],
  [/\bbabilonia\b/gi, 'Babilonia'],
  [/\bcanaan\b/gi, 'Canaán'],
  [/\bjuda\b/gi, 'Judá'],
  [/\bisrael\b/gi, 'Israel'],
  [/\begipto\b/gi, 'Egipto'],
  [/\bfaraon\b/gi, 'Faraón'],

  // Libros bíblicos
  [/\bgenesis\b/gi, 'Génesis'],
  [/\bexodo\b/gi, 'Éxodo'],
  [/\blevitico\b/gi, 'Levítico'],
  [/\bnumeros\b/gi, 'Números'],
  [/\bdeuteronomio\b/gi, 'Deuteronomio'],
  [/\bcronicas\b/gi, 'Crónicas'],
  [/\bjeremias\b/gi, 'Jeremías'],
  [/\boseas\b/gi, 'Oseas'],
  [/\bhabacuc\b/gi, 'Habacuc'],
  [/\bzacarias\b/gi, 'Zacarías'],
  [/\bmalaquias\b/gi, 'Malaquías'],
  [/\bapocalipsis\b/gi, 'Apocalipsis'],

  // Palabras con terminación -ción, -sión, -ón
  [/\boracion\b/gi, 'oración'],
  [/\boraciones\b/gi, 'oraciones'],
  [/\bmeditacion\b/gi, 'meditación'],
  [/\bmeditaciones\b/gi, 'meditaciones'],
  [/\bleccion\b/gi, 'lección'],
  [/\blecciones\b/gi, 'lecciones'],
  [/\bcorazon\b/gi, 'corazón'],
  [/\bcorazones\b/gi, 'corazones'],
  [/\bsituacion\b/gi, 'situación'],
  [/\bsituaciones\b/gi, 'situaciones'],
  [/\bbendicion\b/gi, 'bendición'],
  [/\bbendiciones\b/gi, 'bendiciones'],
  [/\bdevocion\b/gi, 'devoción'],
  [/\bcompasion\b/gi, 'compasión'],
  [/\bafliccion\b/gi, 'aflicción'],
  [/\baflicciones\b/gi, 'aflicciones'],
  [/\bsalvacion\b/gi, 'salvación'],
  [/\bresurreccion\b/gi, 'resurrección'],
  [/\btentacion\b/gi, 'tentación'],
  [/\btentaciones\b/gi, 'tentaciones'],
  [/\bdecision\b/gi, 'decisión'],
  [/\bdecisiones\b/gi, 'decisiones'],
  [/\baccion\b/gi, 'acción'],
  [/\bacciones\b/gi, 'acciones'],
  [/\brelacion\b/gi, 'relación'],
  [/\brelaciones\b/gi, 'relaciones'],
  [/\bcreacion\b/gi, 'creación'],
  [/\bconclusion\b/gi, 'conclusión'],
  [/\batencion\b/gi, 'atención'],
  [/\bperdon\b/gi, 'perdón'],
  [/\bversion\b/gi, 'versión'],
  [/\bocasiones\b/gi, 'ocasiones'],
  [/\bocasion\b/gi, 'ocasión'],

  // Adverbios y conectores
  [/\bdia\b/gi, 'día'],
  [/\bdias\b/gi, 'días'],
  [/\btambien\b/gi, 'también'],
  [/\bademas\b/gi, 'además'],
  [/\bdespues\b/gi, 'después'],
  [/\baqui\b/gi, 'aquí'],
  [/\balli\b/gi, 'allí'],
  [/\balla\b/gi, 'allá'],
  [/\basi\b/gi, 'así'],
  [/\btodavia\b/gi, 'todavía'],

  // Formas verbales con tilde
  [/\bhabia\b/gi, 'había'],
  [/\bhabian\b/gi, 'habían'],
  [/\bhabias\b/gi, 'habías'],
  [/\btenia\b/gi, 'tenía'],
  [/\btenian\b/gi, 'tenían'],
  [/\bdebia\b/gi, 'debía'],
  [/\bdebian\b/gi, 'debían'],
  [/\bpodia\b/gi, 'podía'],
  [/\bpodian\b/gi, 'podían'],
  [/\bhacian\b/gi, 'hacían'],
  [/\bqueria\b/gi, 'quería'],
  [/\bquerian\b/gi, 'querían'],
  [/\bsabia\b/gi, 'sabía'],
  [/\bsabian\b/gi, 'sabían'],
  [/\bvivia\b/gi, 'vivía'],
  [/\bvivian\b/gi, 'vivían'],
  [/\bconfia\b/gi, 'confía'],
  [/\bconfian\b/gi, 'confían'],
  [/\bguia\b/gi, 'guía'],
  [/\bguias\b/gi, 'guías'],
  [/\bsera\b/gi, 'será'],
  [/\bseran\b/gi, 'serán'],
  [/\bestara\b/gi, 'estará'],
  [/\bestaran\b/gi, 'estarán'],
  [/\btendra\b/gi, 'tendrá'],
  [/\btendran\b/gi, 'tendrán'],
  [/\bhara\b/gi, 'hará'],
  [/\b(?:en|de|hacia|a)\s+haran\b/gi, (m) => m.replace(/haran/i, 'Harán')],
  [/(?<!(?:en|a|de|hacia)\s+)\bharan\b/gi, 'harán'],
  [/\bpodra\b/gi, 'podrá'],
  [/\bpodran\b/gi, 'podrán'],
  [/\bseria\b/gi, 'sería'],
  [/\bserian\b/gi, 'serían'],
  [/\bharia\b/gi, 'haría'],
  [/\bharian\b/gi, 'harían'],
  [/\bpodria\b/gi, 'podría'],
  [/\bpodrian\b/gi, 'podrían'],
  [/\bdeberia\b/gi, 'debería'],
  [/\bdeberian\b/gi, 'deberían'],
  [/\bhablo\b/gi, 'habló'],
  [/\bllego\b/gi, 'llegó'],
  [/\bnacio\b/gi, 'nació'],
  [/\bmurio\b/gi, 'murió'],
  [/\bvivio\b/gi, 'vivió'],
  [/\bescribio\b/gi, 'escribió'],
  [/\bgoberno\b/gi, 'gobernó'],
  [/\bordeno\b/gi, 'ordenó'],
  [/\bmostro\b/gi, 'mostró'],
  [/\bdemostro\b/gi, 'demostró'],
  [/\bpenso\b/gi, 'pensó'],
  [/\bcomenzo\b/gi, 'comenzó'],
  [/\bempezo\b/gi, 'empezó'],
  [/\bconfio\b/gi, 'confió'],
  [/\bmedito\b/gi, 'meditó'],
  [/\bsirvio\b/gi, 'sirvió'],
  [/\benseño\b/gi, 'enseñó'],
  [/\bperdio\b/gi, 'perdió'],
  [/\bescucho\b/gi, 'escuchó'],
  [/\brespondio\b/gi, 'respondió'],

  // Adjetivos esdrújulos y llanos con tilde
  [/\bdificil\b/gi, 'difícil'],
  [/\bdificiles\b/gi, 'difíciles'],
  [/\bfacil\b/gi, 'fácil'],
  [/\bfaciles\b/gi, 'fáciles'],
  [/\butil\b/gi, 'útil'],
  [/\butiles\b/gi, 'útiles'],
  [/\bpractico\b(?=\s+(?:y|para|en))/gi, 'práctico'],
  [/\bpractica\b(?=\s+(?:para|en|cristiana))/gi, 'práctica'],
  [/\bunico\b/gi, 'único'],
  [/\bunica\b/gi, 'única'],
  [/\bunicos\b/gi, 'únicos'],
  [/\bunicas\b/gi, 'únicas'],
  [/\bultimo\b/gi, 'último'],
  [/\bultima\b/gi, 'última'],
  [/\bultimos\b/gi, 'últimos'],
  [/\bultimas\b/gi, 'últimas'],
  [/\bmaximo\b/gi, 'máximo'],
  [/\bminimo\b/gi, 'mínimo'],
  [/\bnumero\b/gi, 'número'],
  [/\bnumeros\b/gi, 'números'],
  [/\bproposito\b/gi, 'propósito'],
  [/\bpropositos\b/gi, 'propósitos'],
  [/\bsabiduria\b/gi, 'sabiduría'],
  [/\bversiculo\b/gi, 'versículo'],
  [/\bversiculos\b/gi, 'versículos'],
  [/\bcapitulo\b/gi, 'capítulo'],
  [/\bcapitulos\b/gi, 'capítulos'],
  [/\bparrafo\b/gi, 'párrafo'],
  [/\bparrafos\b/gi, 'párrafos'],
  [/\barticulo\b/gi, 'artículo'],
  [/\barticulos\b/gi, 'artículos'],
  [/\bjovenes\b/gi, 'jóvenes'],
  [/\banimo\b(?=\s+(?:y|para|cristiano))/gi, 'ánimo'],

  // Faltas de ortografía comunes
  [/\bhaver\b/gi, 'haber'],
  [/\baver\b/gi, 'a ver'],
  [/\babeces\b/gi, 'a veces'],
  [/\bosea\b/gi, 'o sea'],
  [/\bdeacuerdo\b/gi, 'de acuerdo'],
  [/\balrrededor\b/gi, 'alrededor'],
  [/\batravez\b/gi, 'a través'],
  [/\ba traves\b/gi, 'a través'],
  [/\bdesicion\b/gi, 'decisión'],
  [/\bdesiciones\b/gi, 'decisiones'],
  [/\beseso\b/gi, 'exceso'],
  [/\bescepcion\b/gi, 'excepción'],
  [/\besplicar\b/gi, 'explicar'],
  [/\besplicacion\b/gi, 'explicación'],
  [/\besperiencia\b/gi, 'experiencia'],
  [/\breveldia\b/gi, 'rebeldía'],
  [/\btubo que\b/gi, 'tuvo que'],
  [/\biva a\b/gi, 'iba a'],
  [/\bha echo\b/gi, 'ha hecho']
];

/**
 * Corrige ortografía, tildes, signos de puntuación y mayúsculas
 */
function correctSpellingAndGrammar(rawText, lang = 'es') {
  if (!rawText) return '';
  let text = rawText;

  // 1. Aplicar reglas léxicas y tildes si el idioma es español
  if (lang === 'es') {
    for (const [pattern, replacement] of SPANISH_SPELL_RULES) {
      text = text.replace(pattern, replacement);
    }
    text = text.replace(/\bi\.e\./gi, 'es decir,')
               .replace(/\be\.g\./gi, 'por ejemplo,');
  }

  // 2. Normalización de espacios y signos de puntuación
  text = text.replace(/[ \t]+/g, ' ')
             .replace(/ +([,.;:!?])/g, '$1')
             .replace(/([,;:!?])([A-Za-záéíóúñÁÉÍÓÚÑ])/g, '$1 $2')
             .replace(/\.([A-Za-záéíóúñÁÉÍÓÚÑ])/g, '. $1');

  // 3. Mayúscula al inicio de párrafos, oraciones y viñetas
  const lines = text.split('\n');
  const correctedLines = lines.map(line => {
    let l = line.trim();
    if (!l) return '';

    // No alterar cabeceras Markdown estructurales
    if (l.startsWith('#') || l.startsWith('---')) {
      return l;
    }

    // Capitalizar tras viñetas
    if (l.startsWith('- ') || l.startsWith('* ') || l.startsWith('• ')) {
      const prefix = l.slice(0, 2);
      const rest = l.slice(2).trim();
      return prefix + (rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : '');
    }

    // Capitalizar citas en bloque
    if (l.startsWith('>')) {
      const prefix = l.match(/^>+\s*/)[0];
      const rest = l.slice(prefix.length).trim();
      return prefix + (rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : '');
    }

    // Capitalizar inicio de línea y después de punto
    l = l.charAt(0).toUpperCase() + l.slice(1);
    l = l.replace(/([.!?]\s+)([a-z])/g, (m, p1, p2) => p1 + p2.toUpperCase());

    // Solo para español: agregar apertura de interrogación o exclamación si falta
    if (lang === 'es') {
      if (l.endsWith('?') && !l.includes('¿')) {
        l = '¿' + l;
      } else if (l.endsWith('!') && !l.includes('¡')) {
        l = '¡' + l;
      }
    }

    return l;
  });

  return correctedLines.join('\n');
}

/**
 * Motor local inteligente de procesamiento de notas cuando no hay conexión o API Key
 */
function processNoteLocally(content, action, noteTitle, lang = 'es') {
  let text = content.trim();

  // Siempre aplicamos la corrección ortográfica y gramatical de base según el idioma
  text = correctSpellingAndGrammar(text, lang);

  if (action === 'correct') {
    return text;
  }

  if (action === 'all' || action === 'improve') {
    const lines = text.split('\n');
    const processedLines = [];
    let hasTitle = lines.some(l => l.startsWith('#') || l.startsWith('##'));
    let inList = false;

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      if (!line) {
        processedLines.push('');
        continue;
      }

      // Preservar estructura existente de Markdown
      if (line.startsWith('#') || line.startsWith('---') || line.startsWith('>')) {
        processedLines.push(line);
        continue;
      }

      // Si parece una cita bíblica (menciona libros bíblicos o comillas)
      if (/(?:Santiago|Proverbios|Salmos|Romanos|Génesis|Éxodo|Mateo|Lucas|Juan|Hebreos|Filipenses|Colosenses)\s+\d+[:,\d\s-]*/i.test(line)) {
        if (!line.startsWith('>')) {
          line = `> 📖 **Texto Bíblico:** "${line.replace(/^["'“]+|["'”]+$/g, '').trim()}"`;
        }
        processedLines.push(line);
        continue;
      }

      // Si es una viñeta existente
      if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('• ')) {
        const cleanBullet = line.replace(/^[-*•]\s*/, '').trim();
        processedLines.push(`- ${cleanBullet.charAt(0).toUpperCase() + cleanBullet.slice(1)}`);
        continue;
      }

      // Si es un párrafo común pero estamos en modo 'all' o 'improve', presentarlo como idea clara
      if (line.toLowerCase().startsWith('aplicacion personal') || line.toLowerCase().startsWith('aplicación personal')) {
        processedLines.push(`\n💡 **Aplicación personal:** ${line.replace(/^[^:]*:\s*/, '').trim()}`);
      } else {
        processedLines.push(line);
      }
    }

    let result = processedLines.join('\n');
    return result.trim();
  }

  if (action === 'summarize') {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 10 && !l.startsWith('#') && !l.startsWith('---'));
    const topLines = lines.slice(0, 5);
    let summary = `### 📌 Puntos Clave del Estudio:\n\n`;
    topLines.forEach(l => {
      const cleanLine = l.replace(/^[#\->*• ]+/, '').trim();
      summary += `- ${cleanLine.charAt(0).toUpperCase() + cleanLine.slice(1)}\n`;
    });
    summary += `\n💡 **Aplicación Espiritual:**\n- Meditar con regularidad en estas enseñanzas fortalece nuestra fe y nos ayuda a mantener la devoción constante.`;
    return summary;
  }

  if (action === 'format_bible') {
    let formatted = noteTitle ? `# ${noteTitle}\n\n` : '';
    const paragraphs = text.split('\n\n').filter(Boolean);
    paragraphs.forEach((p, idx) => {
      const trimmed = p.trim();
      if (trimmed.startsWith('#') || trimmed.startsWith('---')) {
        formatted += `${trimmed}\n\n`;
      } else if (trimmed.includes('"') || /(?:Santiago|Proverbios|Salmos|Romanos|Génesis|Hebreos)\s+\d+/i.test(trimmed)) {
        formatted += `> 📖 "${trimmed.replace(/^["'“> ]+|["'”]+$/g, '')}"\n\n`;
      } else if (idx === 0 && !noteTitle) {
        formatted += `### Ideas Centrales del Estudio:\n- ${trimmed}\n\n`;
      } else {
        formatted += `- ${trimmed}\n\n`;
      }
    });
    formatted += `💡 **Aplicación Personal:** Poner en práctica esta enseñanza en el estudio y la adoración familiar.`;
    return formatted.trim();
  }

  return text;
}

module.exports = {
  detectLanguage,
  generateQuestionsFromText,
  generateRoscoQuestions,
  improveNoteWithAI
};


  };

  defs["./scriptureService"] = function (module, exports, require, process) {
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

  };

  window.EPEngine = {
    ai: require('./aiService'),
    scripture: require('./scriptureService'),
    getGeminiKey: getKey,
    setGeminiKey: setKey
  };
})();
