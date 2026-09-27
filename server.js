const path = require('path');
const fs = require('fs');
require('dotenv').config();
// La clave de Gemini guardada desde la app vive junto a los datos (volumen del NAS)
if (process.env.DATA_DIR) {
  require('dotenv').config({ path: path.join(path.resolve(process.env.DATA_DIR), '.env') });
}
const express = require('express');
const cors = require('cors');
const multer = require('multer');

const { extractTextFromFile, cleanText } = require('./services/docParser');
const dbService = require('./services/dbService');
const { generateQuestionsFromText, generateRoscoQuestions, improveNoteWithAI } = require('./services/aiService');
const { getScriptureText, parseScriptureRef } = require('./services/scriptureService');
const { createAuth } = require('./services/auth');
const pkg = require('./package.json');

const app = express();
const PORT = process.env.PORT || 3005;
const auth = createAuth(dbService.DATA_DIR);
app.set('trust proxy', true);
app.disable('x-powered-by');

// Configurar multer para subidas en la carpeta apuntes
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (!fs.existsSync(dbService.APUNTES_DIR)) {
      fs.mkdirSync(dbService.APUNTES_DIR, { recursive: true });
    }
    cb(null, dbService.APUNTES_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^\w\s\u00C0-\u017F-]/gi, '');
    const cleanFileName = `${base || 'apunte'}_${Date.now()}${ext}`;
    cb(null, cleanFileName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }
});

// CORS: la misma app servida desde otro origen (p. ej. GitHub Pages) puede
// hablar con el NAS si ese origen aparece en ALLOWED_ORIGINS.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map(o => o.trim().replace(/\/$/, '')).filter(Boolean);
// Chrome exige este permiso cuando una web pública (GitHub Pages) llama a una
// dirección privada (Tailscale / red de casa).
app.use((req, res, next) => {
  if (req.method === 'OPTIONS' && req.headers['access-control-request-private-network']) {
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
  }
  next();
});
app.use(cors({
  origin(origin, cb) {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(null, false);
  },
  allowedHeaders: ['Content-Type', 'Authorization'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  maxAge: 86400
}));
app.use(express.json({ limit: '15mb' }));
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders(res, filePath) {
    // El service worker y el HTML siempre se revalidan para recibir actualizaciones
    if (/(sw\.js|index\.html|manifest\.json)$/.test(filePath)) res.setHeader('Cache-Control', 'no-cache');
  }
}));

// ==========================================
// SALUD, INICIO DE SESIÓN Y SINCRONIZACIÓN
// ==========================================
app.get('/api/health', (req, res) => {
  res.json({ success: true, app: 'estudio-personal', version: pkg.version, authRequired: auth.enabled, time: new Date().toISOString() });
});

app.post('/api/auth/login', auth.loginHandler);

// Todo lo que está debajo requiere sesión (si APP_PASSWORD está definida)
app.use('/api', auth.middleware);

app.get('/api/auth/check', (req, res) => res.json({ success: true }));

// Cambios desde una secuencia dada (los dispositivos descargan solo lo nuevo)
app.get('/api/sync/changes', (req, res) => {
  try {
    res.json({ success: true, ...dbService.getChangesSince(req.query.since) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Subida de los cambios hechos sin conexión
app.post('/api/sync/push', (req, res) => {
  try {
    const ops = Array.isArray(req.body && req.body.ops) ? req.body.ops.slice(0, 2000) : [];
    const results = dbService.applySyncOps(ops);
    res.json({ success: true, results, seq: dbService.loadDb().meta.seq });
  } catch (err) {
    console.error('[Sync] Error aplicando cambios:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

dbService.syncApuntesFolder().catch(err => console.error('Error al sincronizar apuntes:', err));

// ==========================================
// RUTAS DE NOTAS ESTILO NOTION & BÚSQUEDA
// ==========================================

// Obtener todas las notas (con filtros opcionales)
app.get('/api/notes', (req, res) => {
  try {
    const { category, subCategory, year, month, search } = req.query;
    const notes = dbService.getAllNotes({ category, subCategory, year, month, search });
    res.json({ success: true, notes });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Obtener una nota específica con sus preguntas
app.get('/api/notes/:id', (req, res) => {
  try {
    const note = dbService.getNoteById(req.params.id);
    if (!note) {
      return res.status(404).json({ success: false, error: 'Nota no encontrada.' });
    }
    res.json({ success: true, note });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Crear una nueva nota
app.post('/api/notes', (req, res) => {
  try {
    const newNote = dbService.createNote(req.body || {});
    res.status(201).json({ success: true, note: newNote, message: 'Nota creada con éxito.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Actualizar una nota existente
app.put('/api/notes/:id', (req, res) => {
  try {
    const updated = dbService.updateNote(req.params.id, req.body || {});
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Nota no encontrada.' });
    }
    res.json({ success: true, note: updated, message: 'Nota guardada con éxito.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Eliminar una nota
app.delete('/api/notes/:id', (req, res) => {
  try {
    const ok = dbService.deleteNote(req.params.id);
    if (!ok) {
      return res.status(404).json({ success: false, error: 'Nota no encontrada.' });
    }
    res.json({ success: true, message: 'Nota eliminada correctamente.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Obtener o inicializar el documento unificado de un mes (Daily Text Comments)
app.get('/api/notes/month/:year/:month', (req, res) => {
  try {
    const { year, month } = req.params;
    const monthDoc = dbService.getMonthDocument(year, month);
    res.json({ success: true, note: monthDoc });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Añadir un día estructurado a un documento mensual existente
app.post('/api/notes/month/:year/:month/day', (req, res) => {
  try {
    const { year, month } = req.params;
    const updatedDoc = dbService.appendDayToMonth(year, month, req.body || {});
    res.json({ success: true, note: updatedDoc, message: 'Día añadido al documento mensual.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Obtener documentos de una carpeta específica (ej: Bethel Talks, Spiritual Notes)
app.get('/api/notes/folder/:category', (req, res) => {
  try {
    const { category } = req.params;
    const subCategory = req.query.subCategory || '';
    const docs = dbService.getFolderDocuments(category, subCategory);
    res.json({ success: true, notes: docs, count: docs.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Obtener años disponibles
app.get('/api/years', (req, res) => {
  try {
    const years = dbService.getAvailableYears();
    res.json({ success: true, years });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Añadir un nuevo año
app.post('/api/years', (req, res) => {
  try {
    const { year } = req.body;
    if (!year) return res.status(400).json({ success: false, error: 'Debe especificar el año.' });
    const years = dbService.addAvailableYear(year);
    res.json({ success: true, years, message: `Año ${year} configurado correctamente.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// RUTAS DE CATEGORÍAS PERSONALIZADAS
// ==========================================

// Obtener todas las categorías y subcategorías
app.get('/api/categories', (req, res) => {
  try {
    const categories = dbService.getAllCategories();
    res.json({ success: true, categories });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Crear una nueva categoría o subcategoría
app.post('/api/categories', (req, res) => {
  try {
    const { name, icon, parentId } = req.body;
    const category = dbService.addCategory({ name, icon, parentId });
    res.json({ success: true, category });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Eliminar una categoría personalizada
app.delete('/api/categories/:id', (req, res) => {
  try {
    const deleted = dbService.deleteCategory(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, error: 'Categoría no encontrada' });
    res.json({ success: true, message: 'Categoría eliminada' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ==========================================
// RUTAS DE COPIA DE SEGURIDAD Y GITHUB
// ==========================================

// Descargar copia de seguridad completa del archivo JSON
app.get('/api/backup/download', (req, res) => {
  try {
    const dbPath = dbService.DB_PATH;
    if (!fs.existsSync(dbPath)) return res.status(404).send('Archivo de base de datos no encontrado');
    const now = new Date().toISOString().split('T')[0];
    res.download(dbPath, `estudio_personal_backup_${now}.json`);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Asistente de IA para notas (Corregir, Mejorar con Gemini y Track Changes)
app.post('/api/notes/:id/ai-assist', async (req, res) => {
  try {
    const note = dbService.getNoteById(req.params.id);
    const content = req.body.content || (note ? note.content : '');
    const action = req.body.action || 'improve';
    const title = req.body.title || (note ? note.title : 'Apunte');
    const apiKey = req.body.apiKey || '';

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, error: 'No hay texto que procesar.' });
    }

    const aiRes = await improveNoteWithAI(content, action, title, apiKey);
    res.json({
      success: true,
      action,
      original: content,
      result: aiRes.result,
      usedEngine: aiRes.usedEngine,
      geminiError: aiRes.geminiError,
      detectedLang: aiRes.detectedLang,
      isPartial: aiRes.isPartial
    });
  } catch (err) {
    console.error('Error en ai-assist:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Obtener estado de la clave de Gemini
app.get('/api/config/ai-status', (req, res) => {
  try {
    const config = dbService.getConfig() || {};
    const key = (config.geminiApiKey || process.env.GEMINI_API_KEY || '').trim();
    res.json({
      success: true,
      hasGeminiKey: key.length > 10,
      maskedKey: key.length > 8 ? `${key.substring(0, 4)}...${key.substring(key.length - 4)}` : ''
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Guardar clave de Gemini (se almacena de forma segura en .env)
app.post('/api/config/gemini-key', (req, res) => {
  try {
    const { apiKey } = req.body;
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 10) {
      return res.status(400).json({ success: false, error: 'Clave de API inválida.' });
    }
    const cleanKey = apiKey.trim();
    process.env.GEMINI_API_KEY = cleanKey;
    const envPath = path.join(process.env.DATA_DIR ? dbService.DATA_DIR : __dirname, '.env');
    fs.writeFileSync(envPath, `GEMINI_API_KEY=${cleanKey}\n`, { encoding: 'utf8', mode: 0o600 });
    dbService.updateConfig({ geminiApiKey: '' });
    res.json({ success: true, message: 'API Key de Gemini guardada de forma segura.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Generar preguntas de repaso para una nota directamente
app.post('/api/notes/:id/generate-questions', async (req, res) => {
  try {
    const note = dbService.getNoteById(req.params.id);
    if (!note) {
      return res.status(404).json({ success: false, error: 'Nota no encontrada.' });
    }

    const content = (note.content || '').trim();
    if (content.length < 25) {
      return res.status(400).json({
        success: false,
        error: 'El contenido de la nota es demasiado breve para extraer preguntas. Escribe unos párrafos más.'
      });
    }

    const count = parseInt(req.body.count || 8, 10);
    const questions = await generateQuestionsFromText(content, note.title, count);
    const saved = dbService.addQuestionsToTopic(note.id, questions);

    res.json({
      success: true,
      message: `Se han generado y vinculado ${saved.length} preguntas a esta nota.`,
      addedCount: saved.length,
      questions: saved
    });
  } catch (err) {
    console.error('Error generando preguntas para nota:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Buscador global rápido con lupa (🔍)
app.get('/api/search', (req, res) => {
  try {
    const query = req.query.q || '';
    const results = dbService.searchDatabase(query);
    res.json({ success: true, ...results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// RUTAS DE TEMAS Y JUEGO
// ==========================================

// 1. Obtener todos los temas
app.get('/api/topics', async (req, res) => {
  try {
    await dbService.syncApuntesFolder();
    const topics = dbService.getAllTopics();
    res.json({ success: true, topics });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 1.1 Sincronizar carpeta y auto-generar preguntas para temas nuevos
app.post('/api/topics/sync', async (req, res) => {
  try {
    const discovered = await dbService.syncApuntesFolder();
    const topics = dbService.getAllTopics();
    let generatedCount = 0;

    for (const topic of topics) {
      if ((topic.questionsCount || 0) === 0) {
        const filePath = path.join(dbService.APUNTES_DIR, topic.fileName);
        if (fs.existsSync(filePath)) {
          try {
            console.log(`[Auto-Sync] Generando preguntas iniciales para "${topic.title}"...`);
            const rawText = await extractTextFromFile(filePath);
            const cleaned = cleanText(rawText);
            if (cleaned && cleaned.length > 20) {
              const qs = await generateQuestionsFromText(cleaned, topic.title, 20);
              const saved = dbService.addQuestionsToTopic(topic.id, qs);
              generatedCount += saved.length;
            }
          } catch (e) {
            console.warn(`[Auto-Sync] No se pudieron generar preguntas para ${topic.title}:`, e.message);
          }
        }
      }
    }

    const updatedTopics = dbService.getAllTopics();
    res.json({
      success: true,
      message: `Sincronización completada. ${discovered.length} nuevos temas detectados y ${generatedCount} nuevas preguntas generadas.`,
      discoveredCount: discovered.length,
      generatedCount,
      topics: updatedTopics
    });
  } catch (err) {
    console.error('Error al sincronizar:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Subir nuevo archivo de apuntes
app.post('/api/upload', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No se ha proporcionado ningún archivo.' });
    }

    const filePath = req.file.path;
    const originalName = req.file.originalname;
    const ext = path.extname(originalName).toLowerCase();
    const title = path.basename(originalName, ext).replace(/[_-]+/g, ' ').trim();

    const rawText = await extractTextFromFile(filePath);
    const cleaned = cleanText(rawText);

    if (!cleaned || cleaned.length < 20) {
      return res.status(400).json({
        success: false,
        error: 'El archivo parece estar vacío o no contiene texto legible.'
      });
    }

    const db = dbService.loadDb();
    const topicId = 'topic_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const newTopic = {
      id: topicId,
      title,
      fileName: req.file.filename,
      originalFileName: originalName,
      fileExt: ext,
      fileSize: req.file.size,
      rawTextSnippet: cleaned.slice(0, 500),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.topics.push(newTopic);
    dbService.saveDb(db);

    console.log(`[Upload] Generando preguntas iniciales para "${title}"...`);
    const count = parseInt(req.body.count || 10, 10);
    const questions = await generateQuestionsFromText(cleaned, title, count);
    const savedQuestions = dbService.addQuestionsToTopic(topicId, questions);

    res.json({
      success: true,
      message: `Tema "${title}" creado con ${savedQuestions.length} preguntas guardadas.`,
      topic: {
        ...newTopic,
        questionsCount: savedQuestions.length
      },
      questionsCount: savedQuestions.length
    });
  } catch (err) {
    console.error('Error al procesar archivo subido:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Generar más preguntas para un tema existente
app.post('/api/topics/:id/generate', async (req, res) => {
  try {
    const topic = dbService.getTopicById(req.params.id);
    if (!topic) {
      return res.status(404).json({ success: false, error: 'Tema no encontrado.' });
    }

    const filePath = path.join(dbService.APUNTES_DIR, topic.fileName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'El archivo físico de apuntes no existe.' });
    }

    const rawText = await extractTextFromFile(filePath);
    const cleaned = cleanText(rawText);
    const count = parseInt(req.body.count || 8, 10);

    const questions = await generateQuestionsFromText(cleaned, topic.title, count);
    const saved = dbService.addQuestionsToTopic(topic.id, questions);

    res.json({
      success: true,
      message: `Se han añadido ${saved.length} nuevas preguntas al tema "${topic.title}".`,
      addedCount: saved.length
    });
  } catch (err) {
    console.error('Error al generar preguntas:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Ver preguntas de un tema
app.get('/api/topics/:id/questions', (req, res) => {
  try {
    const db = dbService.loadDb();
    const questions = db.questions.filter(q => q.topicId === req.params.id);
    res.json({ success: true, questions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Eliminar tema
app.delete('/api/topics/:id', (req, res) => {
  try {
    const ok = dbService.deleteTopic(req.params.id);
    if (!ok) return res.status(404).json({ success: false, error: 'No se encontró el tema.' });
    res.json({ success: true, message: 'Tema y sus preguntas eliminados correctamente.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Iniciar juego con hasta 5 temas (Fase 1)
app.post('/api/game/start', async (req, res) => {
  try {
    const { topicIds = [] } = req.body;

    if (!Array.isArray(topicIds) || topicIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Debes seleccionar al menos 1 tema para jugar.'
      });
    }

    if (topicIds.length > 5) {
      return res.status(400).json({
        success: false,
        error: 'El juego permite un máximo de 5 temas por partida.'
      });
    }

    const db = dbService.loadDb();
    for (const tid of topicIds) {
      const count = db.questions.filter(q => q.topicId === tid).length;
      if (count === 0) {
        const t = db.topics.find(x => x.id === tid);
        if (t) {
          let rawText = '';
          if (t.isNote) {
            const note = (db.notes || []).find(n => n.id === tid || n.id === t.noteId);
            if (note && note.content) rawText = note.content;
          } else if (t.fileName) {
            const filePath = path.join(dbService.APUNTES_DIR, t.fileName);
            if (fs.existsSync(filePath)) {
              try {
                rawText = await extractTextFromFile(filePath);
              } catch (e) {
                console.warn('Error leyendo archivo:', e.message);
              }
            }
          }

          if (rawText && rawText.length > 20) {
            try {
              const generated = await generateQuestionsFromText(rawText, t.title, 8);
              dbService.addQuestionsToTopic(t.id, generated);
            } catch (genErr) {
              console.warn(`No se pudieron autogenerar preguntas para ${t.title}:`, genErr.message);
            }
          }
        }
      }
    }

    const questions = dbService.getQuestionsByTopicIds(topicIds, 40);

    if (questions.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Los temas seleccionados aún no tienen preguntas disponibles. Genera preguntas primero.'
      });
    }

    const config = dbService.getConfig();
    const targetScore = config.targetScore || 100;
    const pointsPerQuestion = config.pointsPerQuestion || 5;

    res.json({
      success: true,
      questions,
      config: {
        targetScore,
        pointsPerQuestion
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Iniciar la Ruleta de la A a la Z (El Rosco)
app.post('/api/game/rosco', async (req, res) => {
  try {
    const { topicIds = [] } = req.body;
    const db = dbService.loadDb();
    
    let combinedText = '';
    const topicTitles = [];

    for (const tid of topicIds) {
      const topic = db.topics.find(t => t.id === tid);
      if (topic) {
        topicTitles.push(topic.title);
        if (topic.isNote) {
          const note = (db.notes || []).find(n => n.id === tid || n.id === topic.noteId);
          if (note && note.content) {
            combinedText += '\n\n' + note.content;
          }
        } else if (topic.fileName) {
          const filePath = path.join(dbService.APUNTES_DIR, topic.fileName);
          if (fs.existsSync(filePath)) {
            try {
              const raw = await extractTextFromFile(filePath);
              combinedText += '\n\n' + raw;
            } catch (e) {
              console.warn('Error leyendo apunte para rosco:', e.message);
            }
          }
        }
      }
    }

    if (!combinedText.trim()) {
      for (const n of (db.notes || [])) {
        if (n.content) {
          topicTitles.push(n.title);
          combinedText += '\n\n' + n.content;
        }
      }
      for (const t of db.topics) {
        if (!t.isNote && t.fileName) {
          topicTitles.push(t.title);
          const filePath = path.join(dbService.APUNTES_DIR, t.fileName);
          if (fs.existsSync(filePath)) {
            try {
              const raw = await extractTextFromFile(filePath);
              combinedText += '\n\n' + raw;
            } catch (e) {}
          }
        }
      }
    }

    const rosco = await generateRoscoQuestions(combinedText, topicTitles);
    res.json({
      success: true,
      rosco,
      timeLimitSeconds: 300 // 5 minutos por defecto
    });
  } catch (err) {
    console.error('Error al generar Rosco:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. Registrar acierto o fallo en una pregunta
app.post('/api/game/answer', (req, res) => {
  try {
    const { questionId, isCorrect } = req.body;
    if (questionId) {
      dbService.updateQuestionStat(questionId, Boolean(isCorrect));
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 9. Registrar fin de partida en el historial
app.post('/api/game/finish', (req, res) => {
  try {
    const summary = req.body;
    dbService.recordGame(summary);
    res.json({ success: true, message: 'Partida guardada en el historial.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 10. Configuración
app.get('/api/config', (req, res) => {
  try {
    const config = dbService.getConfig();
    const maskedKey = config.geminiApiKey 
      ? config.geminiApiKey.slice(0, 6) + '...' + config.geminiApiKey.slice(-4)
      : '';
    res.json({
      success: true,
      hasApiKey: Boolean(config.geminiApiKey && config.geminiApiKey.length > 10),
      maskedKey,
      targetScore: config.targetScore || 100,
      pointsPerQuestion: config.pointsPerQuestion || 5
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/config', (req, res) => {
  try {
    const { geminiApiKey, targetScore, pointsPerQuestion } = req.body;
    const payload = {};
    if (typeof geminiApiKey === 'string') payload.geminiApiKey = geminiApiKey.trim();
    if (targetScore) payload.targetScore = parseInt(targetScore, 10);
    if (pointsPerQuestion) payload.pointsPerQuestion = parseInt(pointsPerQuestion, 10);

    const updated = dbService.updateConfig(payload);
    res.json({
      success: true,
      message: 'Configuración actualizada con éxito.',
      hasApiKey: Boolean(updated.geminiApiKey && updated.geminiApiKey.length > 10),
      targetScore: updated.targetScore,
      pointsPerQuestion: updated.pointsPerQuestion
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// RUTA DE CONSULTA BÍBLICA (TNM / JW.ORG)
// ==========================================
app.get('/api/scripture', async (req, res) => {
  try {
    const { ref, lang } = req.query;
    if (!ref) {
      return res.status(400).json({ success: false, error: 'Falta el parámetro ref (cita bíblica).' });
    }

    const result = await getScriptureText(ref, lang);
    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.use('/api', (req, res) => res.status(404).json({ success: false, error: 'Ruta no encontrada.' }));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Errores no controlados: responder JSON en lugar de HTML
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[Server] Error:', err);
  res.status(err.status || 500).json({ success: false, error: err.message || 'Error interno' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('=====================================================');
  console.log(`📖  ESTUDIO PERSONAL v${pkg.version}`);
  console.log(`🌐  Servidor: http://localhost:${PORT}`);
  console.log(`💾  Datos: ${dbService.DATA_DIR}`);
  console.log(`📁  Apuntes: ${dbService.APUNTES_DIR}`);
  console.log(`🔒  Contraseña: ${auth.enabled ? 'activada' : 'DESACTIVADA (define APP_PASSWORD antes de abrirla a Internet)'}`);
  console.log('=====================================================');
});
