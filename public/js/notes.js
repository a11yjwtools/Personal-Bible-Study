// ==========================================================================
// NOTION ESPIRITUAL - GESTOR DE APUNTES, CALIGRAFÍA, DÍAS E IA
// ==========================================================================

(function () {
  const MONTHS_LIST = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const DAYS_OF_WEEK = [
    'Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'
  ];

  const EMOJI_PALETTE = [
    '🌅', '📖', '🏛️', '🎤', '🎓', '🌐', '💡', '✍️', '📜', '🛡️',
    '👑', '🕊️', '🦁', '🐑', '⭐', '🌿', '🔥', '🏆', '💎', '⛪',
    '❤️', '🙏', '⚓', '📚', '🔖', '🌱', '☀️', '✨', '🎯', '💭'
  ];

  const notesState = {
    notes: [],
    categories: [],
    collapsedSections: JSON.parse(localStorage.getItem('study_collapsed_sections') || '{}'),
    availableYears: [2025, 2026, 2027, 2028],
    activeNoteId: null,
    currentFilter: {
      category: 'daily_text',
      subCategory: '',
      year: new Date().getFullYear(),
      month: MONTHS_LIST[new Date().getMonth()]
    },
    theme: 'dark',
    searchQuery: '',
    searchResults: null,
    searchMatchedNotes: [],
    searchCurrentIndex: -1,
    saveTimeout: null,
    isSaving: false,
    activeTab: 'notion',
    fontSize: 1.125, // rem
    isSidebarCollapsed: false
  };

  // Elementos DOM
  const dom = {
    // Pestañas principales, Tema y Pantalla Completa
    btnTabNotion: document.getElementById('btnTabNotion'),
    btnTabGame: document.getElementById('btnTabGame'),
    notionSection: document.getElementById('notionSection'),
    gameSection: document.getElementById('gameSection'),
    notionSidebar: document.getElementById('notionSidebar'),
    btnToggleFullscreen: document.getElementById('btnToggleFullscreen'),
    fullscreenIcon: document.getElementById('fullscreenIcon'),
    fullscreenText: document.getElementById('fullscreenText'),
    btnToggleTheme: document.getElementById('btnToggleTheme'),
    themeToggleIcon: document.getElementById('themeToggleIcon'),
    themeToggleText: document.getElementById('themeToggleText'),

    // Buscador y Limpieza Rápida (✕)
    globalSearchInput: document.getElementById('globalSearchInput'),
    btnSearchClear: document.getElementById('btnSearchClear'),
    searchModal: document.getElementById('searchModal'),
    btnCloseSearch: document.getElementById('btnCloseSearch'),
    modalSearchInput: document.getElementById('modalSearchInput'),
    btnModalSearchClear: document.getElementById('btnModalSearchClear'),
    searchQueryDisplay: document.getElementById('searchQueryDisplay'),
    searchResultsList: document.getElementById('searchResultsList'),
    searchCountBadge: document.getElementById('searchCountBadge'),

    // Barra Flotante de Navegación de Referencias
    searchNavBanner: document.getElementById('searchNavBanner'),
    searchNavQueryText: document.getElementById('searchNavQueryText'),
    searchNavIndexText: document.getElementById('searchNavIndexText'),
    searchNavTotalCount: document.getElementById('searchNavTotalCount'),
    btnSearchNavPrev: document.getElementById('btnSearchNavPrev'),
    btnSearchNavNext: document.getElementById('btnSearchNavNext'),
    btnSearchNavReturn: document.getElementById('btnSearchNavReturn'),
    btnSearchNavClose: document.getElementById('btnSearchNavClose'),

    // Sidebar de Notion
    btnSidebarMainAction: document.getElementById('btnSidebarMainAction') || document.getElementById('btnOpenNewDayModal'),
    btnOpenNewDayModal: document.getElementById('btnOpenNewDayModal'),
    btnOpenNewYearModal: document.getElementById('btnOpenNewYearModal'),
    yearsPillsContainer: document.getElementById('yearsPillsContainer'),
    sidebarTree: document.getElementById('sidebarTree'),
    notesListContainer: document.getElementById('notesListContainer'),
    currentCategoryTitle: document.getElementById('currentCategoryTitle'),
    notesCountBadge: document.getElementById('notesCountBadge'),
    btnSidebarGenerateQuestions: document.getElementById('btnSidebarGenerateQuestions'),
    btnSidebarViewQuestions: document.getElementById('btnSidebarViewQuestions'),
    sidebarQuestionsCount: document.getElementById('sidebarQuestionsCount'),

    // Editor y Hoja de Papel
    emptyEditorPlaceholder: document.getElementById('emptyEditorPlaceholder'),
    activeEditorContainer: document.getElementById('activeEditorContainer'),
    paperSheetContainer: document.getElementById('paperSheetContainer'),
    activeDayHeaderBanner: document.getElementById('activeDayHeaderBanner'),
    noteBreadcrumbs: document.getElementById('noteBreadcrumbs'),
    saveStatusText: document.getElementById('saveStatusText'),
    btnToggleSidebar: document.getElementById('btnToggleSidebar'),
    btnPlayNoteGame: document.getElementById('btnPlayNoteGame'),
    btnPlayNoteRosco: document.getElementById('btnPlayNoteRosco'),
    btnDeleteNote: document.getElementById('btnDeleteNote'),

    // Cabecera interactiva del apunte
    noteIconBtn: document.getElementById('noteIconBtn'),
    noteTitleInput: document.getElementById('noteTitleInput'),
    noteDateInput: document.getElementById('noteDateInput'),
    noteCategorySelect: document.getElementById('noteCategorySelect'),
    noteSubCategorySelect: document.getElementById('noteSubCategorySelect'),
    noteYearInput: document.getElementById('noteYearInput'),
    noteMonthSelect: document.getElementById('noteMonthSelect'),
    noteTagsInput: document.getElementById('noteTagsInput'),

    // Controles de Estudio y Caligrafía
    fontFamilySelector: document.getElementById('fontFamilySelector'),
    paperStyleSelector: document.getElementById('paperStyleSelector'),
    btnFontInc: document.getElementById('btnFontInc'),
    btnFontDec: document.getElementById('btnFontDec'),
    btnToolbarAddEntry: document.getElementById('btnToolbarAddEntry'),
    noteRichEditor: document.getElementById('noteRichEditor'),
    noteTextarea: document.getElementById('noteTextarea'),

    // Asistente IA & Control de Cambios (Track Changes)
    btnRunAiAssist: document.getElementById('btnRunAiAssist'),
    aiDiffPanel: document.getElementById('aiDiffPanel'),
    aiDiffTitle: document.getElementById('aiDiffTitle'),
    aiDiffContent: document.getElementById('aiDiffContent'),
    aiChangesCount: document.getElementById('aiChangesCount'),
    aiEngineBadge: document.getElementById('aiEngineBadge'),
    btnApplyAiChanges: document.getElementById('btnApplyAiChanges'),
    btnDiscardAiChanges: document.getElementById('btnDiscardAiChanges'),
    btnCopyAiChanges: document.getElementById('btnCopyAiChanges'),

    // Modal Gemini API Key
    geminiKeyPromptModal: document.getElementById('geminiKeyPromptModal'),
    geminiKeyPromptForm: document.getElementById('geminiKeyPromptForm'),
    geminiPromptKeyInput: document.getElementById('geminiPromptKeyInput'),
    btnCloseGeminiKeyPrompt: document.getElementById('btnCloseGeminiKeyPrompt'),
    btnCancelGeminiPrompt: document.getElementById('btnCancelGeminiPrompt'),

    // Preguntas asociadas
    noteQuestionsContainer: document.getElementById('noteQuestionsContainer'),
    noteQuestionsList: document.getElementById('noteQuestionsList'),
    btnGenerateQuestionsFromNote: document.getElementById('btnGenerateQuestionsFromNote'),
    btnToggleNoteQuestions: document.getElementById('btnToggleNoteQuestions'),
    noteQuestionsCountBadge: document.getElementById('noteQuestionsCountBadge'),
    btnBottomToggleQuestions: document.getElementById('btnBottomToggleQuestions'),
    bottomQuestionsCountPill: document.getElementById('bottomQuestionsCountPill'),
    bottomQuestionsArrowText: document.getElementById('bottomQuestionsArrowText'),
    btnCloseNoteQuestionsPanel: document.getElementById('btnCloseNoteQuestionsPanel'),

    // Modales auxiliares
    emojiPickerModal: document.getElementById('emojiPickerModal'),
    emojiGrid: document.getElementById('emojiGrid'),

    // Barra de Herramientas Integrada y Plegable
    paperToolbar: document.getElementById('paperToolbar'),
    btnToggleToolbarCollapse: document.getElementById('btnToggleToolbarCollapse'),

    // Modal de Consulta e Inserción Bíblica
    scriptureLookupModal: document.getElementById('scriptureLookupModal'),
    scriptureLookupForm: document.getElementById('scriptureLookupForm'),
    scriptureLookupInput: document.getElementById('scriptureLookupInput'),
    btnSearchScriptureLookup: document.getElementById('btnSearchScriptureLookup'),
    scriptureLookupPreviewBox: document.getElementById('scriptureLookupPreviewBox'),
    scriptureLookupRefBadge: document.getElementById('scriptureLookupRefBadge'),
    scriptureLookupSourceBadge: document.getElementById('scriptureLookupSourceBadge'),
    scriptureLookupTextPreview: document.getElementById('scriptureLookupTextPreview'),
    btnCloseScriptureLookupModal: document.getElementById('btnCloseScriptureLookupModal'),
    btnCancelScriptureLookup: document.getElementById('btnCancelScriptureLookup'),
    btnCloseEmojiPicker: document.getElementById('btnCloseEmojiPicker'),

    // Modal Nuevo Día (Documento Mensual)
    newDayModal: document.getElementById('newDayModal'),
    newDayForm: document.getElementById('newDayForm'),
    newDayDateInput: document.getElementById('newDayDateInput'),
    newDayCalculatedInfo: document.getElementById('newDayCalculatedInfo'),
    newDayTitleInput: document.getElementById('newDayTitleInput'),
    newDayScriptureInput: document.getElementById('newDayScriptureInput'),
    newDayPreviewHeading: document.getElementById('newDayPreviewHeading'),
    newDayModalTitle: document.getElementById('newDayModalTitle'),
    newDayModalDesc: document.getElementById('newDayModalDesc'),
    btnCloseNewDayModal: document.getElementById('btnCloseNewDayModal'),
    btnCancelNewDay: document.getElementById('btnCancelNewDay'),

    // Modal Nuevo Documento en Carpeta (Base de Datos)
    newFolderDocModal: document.getElementById('newFolderDocModal'),
    newFolderDocForm: document.getElementById('newFolderDocForm'),
    folderDocCategoryInput: document.getElementById('folderDocCategoryInput'),
    folderDocSubCategoryInput: document.getElementById('folderDocSubCategoryInput'),
    folderDocTitleInput: document.getElementById('folderDocTitleInput'),
    folderDocDateInput: document.getElementById('folderDocDateInput'),
    folderDocIconSelect: document.getElementById('folderDocIconSelect'),
    folderDocSpeakerInput: document.getElementById('folderDocSpeakerInput'),
    folderDocTagsInput: document.getElementById('folderDocTagsInput'),
    folderDocModalTitle: document.getElementById('folderDocModalTitle'),
    folderDocModalDesc: document.getElementById('folderDocModalDesc'),
    btnCloseFolderDocModal: document.getElementById('btnCloseFolderDocModal'),
    btnCancelFolderDoc: document.getElementById('btnCancelFolderDoc'),

    // Modal Nuevo Año
    newYearModal: document.getElementById('newYearModal'),
    newYearForm: document.getElementById('newYearForm'),
    newYearNumberInput: document.getElementById('newYearNumberInput'),
    btnCloseNewYearModal: document.getElementById('btnCloseNewYearModal'),
    btnCancelNewYear: document.getElementById('btnCancelNewYear'),

    // Modal Nueva Categoría o Subcategoría
    btnOpenNewCategoryModal: document.getElementById('btnOpenNewCategoryModal'),
    newCategoryModal: document.getElementById('newCategoryModal'),
    btnCloseCategoryModal: document.getElementById('btnCloseCategoryModal'),
    btnCancelCategoryModal: document.getElementById('btnCancelCategoryModal'),
    newCategoryForm: document.getElementById('newCategoryForm'),
    newCategoryTypeSelect: document.getElementById('newCategoryTypeSelect'),
    parentCategoryWrapper: document.getElementById('parentCategoryWrapper'),
    parentCategorySelect: document.getElementById('parentCategorySelect'),
    newCategoryNameInput: document.getElementById('newCategoryNameInput'),
    newCategoryIconInput: document.getElementById('newCategoryIconInput'),

    // Respaldo y GitHub
    btnSyncGitHub: document.getElementById('btnSyncGitHub'),
    gitSyncStatusText: document.getElementById('gitSyncStatusText'),

    // PWA & Sincronización Automática
    btnInstallApp: document.getElementById('btnInstallApp'),
    syncToast: document.getElementById('syncToast'),
    syncToastIcon: document.getElementById('syncToastIcon'),
    syncToastText: document.getElementById('syncToastText')
  };

  let pendingAiResult = '';

  // Inicialización
  window.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    initFullscreen();
    initEmojiPicker();
    initStudyPreferences();
    initEventListeners();
    initPwaInstall();
    await fetchAvailableYears();
    await fetchCategories();
    await fetchNotes();

    // Reabrir el último apunte o, si no hay, el documento del mes actual
    let lastNoteId = null;
    try { lastNoteId = localStorage.getItem('study_last_note'); } catch (e) { /* ignorar */ }
    if (lastNoteId && notesState.notes.some(n => n.id === lastNoteId)) {
      selectNote(lastNoteId);
    } else {
      await loadAndSelectMonthDocument(notesState.currentFilter.year, notesState.currentFilter.month);
    }

    renderYearPills();
    renderSidebarTree();
    updateSidebarMainActionBtn();
    renderNotesList();

    // Refrescar la vista cuando llegan cambios desde GitHub
    window.addEventListener('ep:remote-changes', handleRemoteChanges);
  });

  // ==========================================
  // CAMBIOS RECIBIDOS DE OTRO DISPOSITIVO (vía GitHub)
  // ==========================================
  let pendingRemoteRefresh = false;

  function isEditingNow() {
    const active = document.activeElement;
    const editing = active && dom.paperSheetContainer && dom.paperSheetContainer.contains(active);
    return Boolean(editing || notesState.saveTimeout && dom.saveStatusText && dom.saveStatusText.classList.contains('status-editing'));
  }

  async function handleRemoteChanges(e) {
    const detail = (e && e.detail) || {};
    if (detail.categoriesChanged) {
      await fetchAvailableYears();
      await fetchCategories();
    }
    await fetchNotes();
    const activeId = notesState.activeNoteId;
    if (!activeId) return;
    if ((detail.deleted || []).includes(activeId)) {
      showToastNotification('Este apunte se eliminó en otro dispositivo.', 'warning');
      showEmptyPlaceholder();
      return;
    }
    if ((detail.changed || []).includes(activeId)) {
      if (isEditingNow()) {
        pendingRemoteRefresh = true;
      } else {
        selectNote(activeId, { keepScroll: true });
        showToastNotification('Apunte actualizado con cambios de otro dispositivo.', 'info');
      }
    } else if (detail.countsChanged) {
      const n = notesState.notes.find(x => x.id === activeId);
      if (n && dom.sidebarQuestionsCount) dom.sidebarQuestionsCount.textContent = n.questionsCount || 0;
    }
  }

  document.addEventListener('focusout', () => {
    if (!pendingRemoteRefresh) return;
    setTimeout(() => {
      if (pendingRemoteRefresh && !isEditingNow() && notesState.activeNoteId) {
        pendingRemoteRefresh = false;
        selectNote(notesState.activeNoteId, { keepScroll: true });
      }
    }, 1500);
  });

  // ==========================================
  // PWA (APLICACIÓN INSTALABLE DE ESCRITORIO)
  // ==========================================

  let deferredInstallPrompt = null;

  function initPwaInstall() {
    // Registrar el Service Worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        const hadController = !!navigator.serviceWorker.controller; // false en la primera visita
        navigator.serviceWorker.register('sw.js')
          .then(reg => {
            // Avisar cuando hay una versión nueva de la app lista
            reg.addEventListener('updatefound', () => {
              const nw = reg.installing;
              if (!nw) return;
              nw.addEventListener('statechange', () => {
                if (nw.state === 'activated' && hadController) {
                  showToastNotification('Hay una versión nueva de la app. Recarga la página para usarla.', 'info', 8000);
                }
              });
            });
          })
          .catch(err => console.warn('[PWA] Service Worker aviso:', err));
      });
    }

    // Capturar evento de instalación de Windows / Chrome / Edge
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      if (dom.btnInstallApp) {
        dom.btnInstallApp.style.display = 'inline-flex';
      }
    });

    if (dom.btnInstallApp) {
      dom.btnInstallApp.addEventListener('click', async () => {
        if (!deferredInstallPrompt) {
          showToastNotification('Para instalarla, usa el botón de instalar de la barra de direcciones (Chrome/Edge) o "Añadir a pantalla de inicio" (Safari).', 'info', 6000);
          return;
        }
        deferredInstallPrompt.prompt();
        const choiceResult = await deferredInstallPrompt.userChoice;
        if (choiceResult && choiceResult.outcome === 'accepted') {
          console.log('[PWA] El usuario aceptó instalar la app');
          dom.btnInstallApp.style.display = 'none';
        }
        deferredInstallPrompt = null;
      });
    }

    window.addEventListener('appinstalled', () => {
      console.log('[PWA] Aplicación instalada con éxito');
      if (dom.btnInstallApp) dom.btnInstallApp.style.display = 'none';
      showToastNotification('Aplicación instalada.', 'success');
    });
  }

  // ================================================================
  // SINCRONIZACIÓN AUTOMÁTICA DE APUNTES AL INICIAR LA APLICACIÓN
  // ================================================================

  function showToastNotification(message, type = 'info', durationMs = 4500) {
    // Compatibilidad con llamadas antiguas que pasaban un emoji como tipo
    const kind = ['info', 'success', 'warning', 'error'].includes(type) ? type : 'info';
    if (typeof window.showAppToast === 'function') window.showAppToast(message, kind, durationMs);
  }

  // ==========================================
  // GESTIÓN DE TEMA (MODO DÍA / MODO NOCHE)
  // ==========================================

  function initTheme() {
    const current = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    applyTheme(current, { persist: false });
  }

  function applyTheme(theme, { persist = true } = {}) {
    notesState.theme = theme;
    document.documentElement.dataset.theme = theme;
    document.body.classList.toggle('theme-light', theme === 'light');
    const use = dom.themeToggleIcon ? dom.themeToggleIcon.querySelector('use') : null;
    if (use) use.setAttribute('href', theme === 'light' ? '#i-moon' : '#i-sun');
    if (dom.themeToggleText) dom.themeToggleText.textContent = theme === 'light' ? 'Modo oscuro' : 'Modo claro';
    if (dom.btnToggleTheme) dom.btnToggleTheme.title = theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro';
    const meta = document.querySelectorAll('meta[name="theme-color"]');
    meta.forEach(m => m.setAttribute('content', theme === 'light' ? '#faf9f7' : '#141414'));
    if (persist) {
      try { localStorage.setItem('study_theme', theme); } catch (e) { /* ignorar */ }
    }
  }

  function toggleTheme() {
    applyTheme(notesState.theme === 'light' ? 'dark' : 'light');
  }

  // ==========================================
  // PREFERENCIAS DE ESTUDIO (CALIGRAFÍA Y PAPEL)
  // ==========================================

  // ==========================================
  // PANTALLA COMPLETA AUTOMÁTICA Y NAVEGACIÓN
  // ==========================================

  function initFullscreen() {
    updateFullscreenUI();
    document.addEventListener('fullscreenchange', updateFullscreenUI);
    if (!document.documentElement.requestFullscreen && dom.btnToggleFullscreen) {
      dom.btnToggleFullscreen.style.display = 'none';
    }
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        localStorage.setItem('study_auto_fullscreen', 'enabled');
      }).catch(err => {
        console.warn('Pantalla completa no disponible:', err.message);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => {
          localStorage.setItem('study_auto_fullscreen', 'disabled');
        }).catch(err => console.warn(err.message));
      }
    }
  }

  function updateFullscreenUI() {
    const isFull = !!document.fullscreenElement;
    const fsUse = dom.fullscreenIcon ? dom.fullscreenIcon.querySelector('use') : null;
    if (fsUse) fsUse.setAttribute('href', isFull ? '#i-minimize' : '#i-maximize');
    if (dom.fullscreenText) dom.fullscreenText.textContent = isFull ? 'Ver URL' : 'Pantalla Completa';
    if (dom.btnToggleFullscreen) {
      dom.btnToggleFullscreen.title = isFull ? 'Salir de pantalla completa' : 'Pantalla completa';
      dom.btnToggleFullscreen.classList.toggle('active', isFull);
    }
  }

  // ==========================================
  // PREFERENCIAS DE ESTUDIO (CALIGRAFÍA Y PAPEL)
  // ==========================================

  function initStudyPreferences() {
    const fonts = ['serif', 'system', 'kalam', 'caveat', 'patrick'];
    const papers = ['paper-clean', 'paper-warm-parchment', 'paper-ruled', 'paper-grid'];
    let savedFont = localStorage.getItem('study_font_v3') || 'serif';
    let savedPaper = localStorage.getItem('study_paper') || 'paper-clean';
    if (!fonts.includes(savedFont)) savedFont = 'serif';
    if (!papers.includes(savedPaper)) savedPaper = 'paper-clean';
    const savedSize = parseFloat(localStorage.getItem('study_font_size_v3') || '1.125');

    notesState.fontSize = isNaN(savedSize) ? 1.125 : savedSize;

    if (dom.fontFamilySelector) dom.fontFamilySelector.value = savedFont;
    if (dom.paperStyleSelector) dom.paperStyleSelector.value = savedPaper;

    applyFontFamily(savedFont);
    applyPaperStyle(savedPaper);
    applyFontSize(notesState.fontSize);
  }

  function applyFontFamily(fontKey) {
    const targets = [dom.noteRichEditor, dom.noteTextarea, dom.noteTitleInput].filter(Boolean);
    targets.forEach(el => {
      el.classList.remove('font-kalam', 'font-patrick', 'font-caveat', 'font-system', 'font-serif');
      el.classList.add(`font-${fontKey}`);
    });

    localStorage.setItem('study_font_v3', fontKey);
  }

  function applyPaperStyle(styleKey) {
    const targets = [dom.paperSheetContainer, dom.activeEditorContainer].filter(Boolean);
    targets.forEach(el => {
      el.classList.remove(
        'paper-clean', 'paper-warm-parchment', 'paper-ruled', 'paper-clean-ivory', 'paper-grid', 'paper-dark'
      );
      el.classList.add(styleKey);
    });
    localStorage.setItem('study_paper', styleKey);
  }

  function applyFontSize(size) {
    notesState.fontSize = Math.round(Math.max(0.875, Math.min(2.2, size)) * 1000) / 1000;
    if (dom.noteRichEditor) {
      dom.noteRichEditor.style.fontSize = `${notesState.fontSize}rem`;
    }
    if (dom.noteTextarea) {
      dom.noteTextarea.style.fontSize = `${notesState.fontSize}rem`;
    }
    localStorage.setItem('study_font_size_v3', notesState.fontSize);
  }

  // ==========================================
  // CONVERTIDORES VISUALES MARKDOWN ↔ HTML ENRIQUECIDO
  // ==========================================

  function markdownToRichHtml(md) {
    if (!md) return '<p><br></p>';

    const lines = md.split('\n');
    const out = [];
    let inList = false;

    function closeList() {
      if (inList) {
        out.push('</ul>');
        inList = false;
      }
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Línea horizontal
      if (line.trim() === '---' || line.trim() === '***') {
        closeList();
        out.push('<hr>');
        continue;
      }

      // Separador de Día (## 📅 DÍA ...)
      const dayMatch = line.match(/^##\s*📅\s*(.*)$/i);
      if (dayMatch) {
        closeList();
        out.push(`<div class="paper-day-banner"><span>📅</span> ${escapeHtml(dayMatch[1].trim())}</div>`);
        continue;
      }

      // Encabezado 3 (### ...)
      const h3Match = line.match(/^###\s+(.*)$/);
      if (h3Match) {
        closeList();
        out.push(`<h3>${formatInlineMarkdown(h3Match[1].trim())}</h3>`);
        continue;
      }

      // Encabezado 1 (# ...)
      const h1Match = line.match(/^#\s+(.*)$/);
      if (h1Match) {
        closeList();
        out.push(`<h1 class="paper-h1">${formatInlineMarkdown(h1Match[1].trim())}</h1>`);
        continue;
      }

      // Encabezado 2 (## ...)
      const h2Match = line.match(/^##\s+(.*)$/);
      if (h2Match) {
        closeList();
        out.push(`<h2 class="paper-h2">${formatInlineMarkdown(h2Match[1].trim())}</h2>`);
        continue;
      }

      // Versículo Bíblico (> 📖 ...)
      const scriptureMatch = line.match(/^>\s*📖\s*(.*)$/i);
      if (scriptureMatch) {
        closeList();
        out.push(`<div class="paper-scripture-box"><span class="scripture-icon">📖</span> ${formatInlineMarkdown(scriptureMatch[1].trim())}</div>`);
        continue;
      }

      // Punto clave / Destacado (> 💡 ...)
      const calloutMatch = line.match(/^>\s*💡\s*(.*)$/i);
      if (calloutMatch) {
        closeList();
        out.push(`<div class="paper-callout-box">💡 ${formatInlineMarkdown(calloutMatch[1].trim())}</div>`);
        continue;
      }

      // Cita genérica (> ...)
      const quoteMatch = line.match(/^>\s*(.*)$/);
      if (quoteMatch) {
        closeList();
        out.push(`<blockquote>${formatInlineMarkdown(quoteMatch[1].trim())}</blockquote>`);
        continue;
      }

      // Viñetas (- ... o * ...)
      const bulletMatch = line.match(/^[-*]\s+(.*)$/);
      if (bulletMatch) {
        if (!inList) {
          out.push('<ul class="paper-bullet-list">');
          inList = true;
        }
        out.push(`<li>${formatInlineMarkdown(bulletMatch[1].trim())}</li>`);
        continue;
      } else {
        closeList();
      }

      // Párrafo normal (las líneas en blanco solo separan párrafos)
      if (!line.trim()) {
        continue;
      } else {
        out.push(`<p>${formatInlineMarkdown(line)}</p>`);
      }
    }

    closeList();
    return out.length ? out.join('\n') : '<p><br></p>';
  }

  function formatInlineMarkdown(str) {
    if (!str) return '';
    let res = escapeHtml(str);
    // **negrita**
    res = res.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // *cursiva*
    res = res.replace(/\*(.*?)\*/g, '<em>$1</em>');
    return res;
  }

  function richHtmlToMarkdown(html) {
    if (!html) return '';

    const temp = document.createElement('div');
    temp.innerHTML = html;

    function processNode(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) {
        return '';
      }

      const tag = node.tagName.toLowerCase();

      // Banners de día
      if (node.classList.contains('paper-day-banner')) {
        const txt = node.textContent.replace(/^[📅\s]+/, '').trim();
        return `\n## 📅 ${txt}\n`;
      }

      // Bloques de versículos bíblicos
      if (node.classList.contains('paper-scripture-box')) {
        let content = '';
        node.childNodes.forEach(child => {
          if (child.classList && child.classList.contains('scripture-icon')) return;
          content += processNode(child);
        });
        const cleanContent = content.replace(/^[📖\s]+/, '').trim();
        return `\n> 📖 ${cleanContent}\n`;
      }

      // Bloques de llamado / punto clave
      if (node.classList.contains('paper-callout-box')) {
        let content = '';
        node.childNodes.forEach(child => {
          content += processNode(child);
        });
        const cleanContent = content.replace(/^[💡\s]+/, '').trim();
        return `\n> 💡 ${cleanContent}\n`;
      }

      if (tag === 'h1') {
        const text = Array.from(node.childNodes).map(processNode).join('').trim();
        return `\n# ${text}\n`;
      }

      if (tag === 'h3') {
        const text = Array.from(node.childNodes).map(processNode).join('').trim();
        return `\n### ${text}\n`;
      }

      if (tag === 'h2') {
        const text = Array.from(node.childNodes).map(processNode).join('').trim();
        return `\n## ${text}\n`;
      }

      if (tag === 'blockquote') {
        const text = Array.from(node.childNodes).map(processNode).join('').trim();
        return `\n> ${text}\n`;
      }

      if (tag === 'ul' || tag === 'ol') {
        let listText = '\n';
        node.childNodes.forEach(li => {
          if (li.nodeType === Node.ELEMENT_NODE && li.tagName.toLowerCase() === 'li') {
            const itemText = Array.from(li.childNodes).map(processNode).join('').trim();
            listText += `- ${itemText}\n`;
          }
        });
        return listText + '\n';
      }

      if (tag === 'hr') {
        return '\n---\n';
      }

      if (tag === 'strong' || tag === 'b') {
        const text = Array.from(node.childNodes).map(processNode).join('');
        return `**${text}**`;
      }

      if (tag === 'em' || tag === 'i') {
        const text = Array.from(node.childNodes).map(processNode).join('');
        return `*${text}*`;
      }

      if (tag === 'p' || tag === 'div') {
        const text = Array.from(node.childNodes).map(processNode).join('').trim();
        if (!text || text === '\n') {
          return '\n';
        }
        return `\n${text}\n`;
      }

      if (tag === 'br') {
        return '\n';
      }

      return Array.from(node.childNodes).map(processNode).join('');
    }

    let md = Array.from(temp.childNodes).map(processNode).join('');
    md = md.replace(/\n{3,}/g, '\n\n').trim();
    return md;
  }

  // ==========================================
  // GESTIÓN DE CATEGORÍAS PERSONALIZADAS (API)
  // ==========================================

  async function fetchCategories() {
    try {
      const res = await fetch('/api/categories');
      const data = await res.json();
      if (data.success && Array.isArray(data.categories)) {
        notesState.categories = data.categories;
        updateCategorySelects();
      }
    } catch (err) {
      console.warn('Error al cargar categorías:', err.message);
    }
  }

  function updateCategorySelects() {
    const mainSelect = dom.noteCategorySelect;
    const parentSelect = dom.parentCategorySelect;

    if (mainSelect) {
      const currentVal = mainSelect.value;
      let html = '';
      notesState.categories.forEach(c => {
        html += `<option value="${c.id}">${c.icon || '📁'} ${escapeHtml(c.name)}</option>`;
        if (Array.isArray(c.subCategories) && c.subCategories.length > 0) {
          c.subCategories.forEach(sc => {
            html += `<option value="${sc.id}">&nbsp;&nbsp;↳ ${sc.icon || '📂'} ${escapeHtml(sc.name)}</option>`;
          });
        }
      });
      mainSelect.innerHTML = html;
      if (currentVal && Array.from(mainSelect.options).some(o => o.value === currentVal)) {
        mainSelect.value = currentVal;
      }
    }

    if (parentSelect) {
      // Solo categorías principales pueden ser padre
      parentSelect.innerHTML = notesState.categories.map(c => 
        `<option value="${c.id}">${c.icon || '📁'} ${escapeHtml(c.name)}</option>`
      ).join('');
    }
  }

  function openNewCategoryModal(parentId = null) {
    if (!dom.newCategoryModal) return;
    updateCategorySelects();
    if (parentId) {
      if (dom.newCategoryTypeSelect) dom.newCategoryTypeSelect.value = 'sub';
      if (dom.parentCategoryWrapper) dom.parentCategoryWrapper.style.display = 'block';
      if (dom.parentCategorySelect) dom.parentCategorySelect.value = parentId;
      if (dom.newCategoryNameInput) dom.newCategoryNameInput.placeholder = 'ej: Reuniones Especiales, Asambleas...';
      if (dom.newCategoryIconInput) dom.newCategoryIconInput.value = '📂';
    } else {
      if (dom.newCategoryTypeSelect) dom.newCategoryTypeSelect.value = 'main';
      if (dom.parentCategoryWrapper) dom.parentCategoryWrapper.style.display = 'none';
      if (dom.newCategoryNameInput) dom.newCategoryNameInput.placeholder = 'ej: Asambleas, Proverbios, Familia...';
      if (dom.newCategoryIconInput) dom.newCategoryIconInput.value = '📁';
    }
    if (dom.newCategoryNameInput) dom.newCategoryNameInput.value = '';
    dom.newCategoryModal.classList.add('active');
    setTimeout(() => {
      if (dom.newCategoryNameInput) dom.newCategoryNameInput.focus();
    }, 120);
  }

  async function createNewCategory({ name, icon, parentId }) {
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, icon, parentId })
      });
      const data = await res.json();
      if (data.success) {
        await fetchCategories();
        renderSidebarTree();
        if (dom.newCategoryModal) dom.newCategoryModal.classList.remove('active');
      } else {
        showToastNotification(data.error || 'No se pudo crear la categoría.', 'error');
      }
    } catch (err) {
      console.error('Error al crear categoría:', err);
      showToastNotification('No se pudo crear la categoría.', 'error');
    }
  }

  async function deleteCategoryById(catId) {
    if (!confirm('¿Estás seguro de eliminar esta categoría personalizada?')) return;
    try {
      const res = await fetch(`/api/categories/${encodeURIComponent(catId)}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        await fetchCategories();
        renderSidebarTree();
      } else {
        showToastNotification(data.error || 'No se pudo eliminar.', 'error');
      }
    } catch (err) {
      console.error('Error al eliminar categoría:', err);
    }
  }

  // ==========================================
  // GESTIÓN DE AÑOS (API)
  // ==========================================

  async function fetchAvailableYears() {
    try {
      const res = await fetch('/api/years');
      const data = await res.json();
      if (data.success && Array.isArray(data.years)) {
        notesState.availableYears = data.years;
      }
    } catch (err) {
      console.warn('Error al cargar años:', err.message);
    }
  }

  async function addNewYear(year) {
    const num = parseInt(year, 10);
    if (isNaN(num) || num < 1950 || num > 2100) {
      showToastNotification('Introduce un año válido de 4 cifras (ej.: 2027).', 'warning');
      return;
    }

    try {
      const res = await fetch('/api/years', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: num })
      });
      const data = await res.json();
      if (data.success && data.years) {
        notesState.availableYears = data.years;
        notesState.currentFilter.year = num;
        notesState.currentFilter.category = 'daily_text';
        renderYearPills();
        renderSidebarTree();
        renderNotesList();
        dom.newYearModal.classList.remove('active');
        showToastNotification(`Año ${num} añadido.`, 'success');
      }
    } catch (err) {
      console.error('Error al añadir año:', err);
      showToastNotification('No se pudo añadir el año.', 'error');
    }
  }

  function renderYearPills() {
    if (!dom.yearsPillsContainer) return;
    dom.yearsPillsContainer.innerHTML = '';

    notesState.availableYears.forEach(year => {
      const isSelected = notesState.currentFilter.year === year && notesState.currentFilter.category === 'daily_text';
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = `year-pill ${isSelected ? 'active' : ''}`;
      pill.textContent = year;
      pill.addEventListener('click', () => {
        notesState.currentFilter.category = 'daily_text';
        notesState.currentFilter.year = year;
        renderYearPills();
        renderSidebarTree();
        renderNotesList();
      });
      dom.yearsPillsContainer.appendChild(pill);
    });
  }

  // ==========================================
  // CARGA Y PERSISTENCIA DE NOTAS (API)
  // ==========================================

  async function fetchNotes() {
    try {
      const res = await fetch('/api/notes');
      const data = await res.json();
      if (data.success) {
        notesState.notes = data.notes || [];

        // Extraer años que existan en notas y añadirlos a la lista de años
        notesState.notes.forEach(n => {
          if (n.year && !notesState.availableYears.includes(Number(n.year))) {
            notesState.availableYears.push(Number(n.year));
          }
        });
        notesState.availableYears.sort((a, b) => a - b);

        renderYearPills();
        renderSidebarTree();
        renderNotesList();
      }
    } catch (err) {
      console.error('Error al cargar notas:', err);
    }
  }

  // Subcarpeta a conservar al guardar (sirve para eventos y carpetas personalizadas)
  function resolveSubCategory(note, category) {
    if (category === 'events') return dom.noteSubCategorySelect ? dom.noteSubCategorySelect.value : (note.subCategory || '');
    if (category === 'daily_text') return '';
    const cat = notesState.categories.find(c => c.id === category);
    if (cat && note.subCategory && (cat.subCategories || []).some(sc => sc.id === note.subCategory)) return note.subCategory;
    return '';
  }

  async function saveActiveNoteNow() {
    if (!notesState.activeNoteId) return;

    const note = notesState.notes.find(n => n.id === notesState.activeNoteId);
    if (!note) return;

    const dateVal = dom.noteDateInput.value || new Date().toISOString().split('T')[0];
    const dateParsed = parseDateDetails(dateVal);

    const currentMarkdown = dom.noteRichEditor 
      ? richHtmlToMarkdown(dom.noteRichEditor.innerHTML) 
      : (dom.noteTextarea ? dom.noteTextarea.value : '');

    if (dom.noteTextarea) {
      dom.noteTextarea.value = currentMarkdown;
    }

    // Protección contra vaciado accidental de un apunte con contenido
    if (!currentMarkdown.trim() && note.content && note.content.trim().length > 40) {
      console.warn('Protección activa: se evita sobreescribir nota existente con contenido vacío.');
      updateSaveStatus('Guardado', 'saved');
      return;
    }

    const updatedData = {
      title: dom.noteTitleInput.value.trim() || 'Entrada diaria sin título',
      date: dateVal,
      icon: dom.noteIconBtn.textContent.trim() || '📝',
      category: dom.noteCategorySelect.value,
      subCategory: resolveSubCategory(note, dom.noteCategorySelect.value),
      year: dom.noteYearInput ? parseInt(dom.noteYearInput.value, 10) : (dateParsed.year || new Date().getFullYear()),
      month: dom.noteMonthSelect ? dom.noteMonthSelect.value : (dateParsed.month || MONTHS_LIST[new Date().getMonth()]),
      day: dateParsed.day,
      tags: dom.noteTagsInput.value.split(',').map(t => t.trim()).filter(Boolean),
      content: currentMarkdown
    };

    updateSaveStatus('Guardando…', 'saving');

    try {
      const res = await fetch(`/api/notes/${note.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
      });
      const data = await res.json();
      if (data.success) {
        Object.assign(note, data.note);
        updateSaveStatus('Guardado', 'saved');
        renderNotesList();
        renderSidebarTree();
        updateBreadcrumbs(note);
        updateDayHeaderBanner(note);

        if (typeof window.refreshGameTopics === 'function') {
          window.refreshGameTopics();
        }
      } else {
        updateSaveStatus('Error al guardar', 'error');
      }
    } catch (err) {
      console.error('Error al guardar nota:', err);
      updateSaveStatus('Error al guardar', 'error');
    }
  }

  function scheduleAutoSave() {
    updateSaveStatus('Editando…', 'editing');
    clearTimeout(notesState.saveTimeout);
    notesState.saveTimeout = setTimeout(() => {
      notesState.saveTimeout = null;
      saveActiveNoteNow();
    }, 700);
  }

  function updateSaveStatus(text, type) {
    if (!dom.saveStatusText) return;
    dom.saveStatusText.textContent = text;
    dom.saveStatusText.className = `save-status-badge status-${type}`;
  }

  // ================================================================
  // DOCUMENTOS MENSUALES, ÍNDICE DE DÍAS Y CARPETAS BASE DE DATOS
  // ================================================================

  // Extraer los días registrados en el texto de un documento mensual
  function parseDaysFromMonthContent(content) {
    if (!content) return [];
    // Reconocer encabezados que contengan el día (ej: ## 📅 DÍA 18 • Fecha: ...)
    const regex = /##\s*📅[^\n]*?(?:DÍA\s*(\d+)|\b(\d{1,2})\s+de\s+[a-záéíóú]+)[^\n]*/gi;
    const days = [];
    let match;
    while ((match = regex.exec(content)) !== null) {
      const dayNum = parseInt(match[1] || match[2], 10);
      const startPos = match.index;
      const chunk = content.slice(startPos, startPos + 450);
      const lines = chunk.split('\n');
      let title = '';

      // Buscar línea de título destacada inmediatamente posterior
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        if (line.match(/^#+\s*(?:✍️\s*)?(?:Título:\s*)?/i)) {
          title = line.replace(/^#+\s*(?:✍️\s*)?(?:Título:\s*)?/i, '').trim();
          if (title) break;
        } else if (line.match(/^(?:✍️\s*)?Título:\s*/i)) {
          title = line.replace(/^(?:✍️\s*)?Título:\s*/i, '').trim();
          if (title) break;
        } else if (line.length > 3 && !line.startsWith('>') && !line.startsWith('-') && !line.startsWith('*') && !line.startsWith('#')) {
          title = line;
          break;
        }
      }

      // Fallback si el título estuviese dentro del mismo encabezado
      if (!title) {
        const headerText = match[0];
        if (headerText.includes('•')) {
          const parts = headerText.split('•');
          title = parts[parts.length - 1].replace(/^(?:Fecha:\s*)?/, '').trim();
        }
      }

      days.push({
        day: dayNum,
        header: match[0],
        title: title || `Apuntes del día ${dayNum}`,
        index: startPos
      });
    }
    days.sort((a, b) => a.day - b.day);
    return days;
  }

  // Desplazar suavemente el cursor y scroll del editor hacia un día específico
  async function scrollToDayInEditor(dayNum, targetYear, targetMonth) {
    const y = targetYear || notesState.currentFilter.year || new Date().getFullYear();
    const m = targetMonth || notesState.currentFilter.month || MONTHS_LIST[new Date().getMonth()];
    const monthDocId = `daily_text_${y}_${m}`;

    if (notesState.activeNoteId !== monthDocId) {
      await loadAndSelectMonthDocument(y, m);
    }

    const performScroll = () => {
      if (dom.noteRichEditor) {
        const banners = dom.noteRichEditor.querySelectorAll('.paper-day-banner, h2');
        for (const b of banners) {
          if (b.textContent.includes(`DÍA ${dayNum}`) || b.textContent.includes(`${dayNum} de`)) {
            b.scrollIntoView({ behavior: 'smooth', block: 'center' });
            b.classList.add('day-jump-flash');
            setTimeout(() => b.classList.remove('day-jump-flash'), 1200);
            return;
          }
        }
      }

      if (!dom.noteTextarea) return;
      const text = dom.noteTextarea.value;
      const pattern1 = new RegExp(`##\\s*📅[^\\n]*?DÍA\\s*${dayNum}\\b`, 'i');
      let match = pattern1.exec(text);
      if (!match) {
        const pattern2 = new RegExp(`##\\s*📅[^\\n]*?\\b${dayNum}\\s+de\\b`, 'i');
        match = pattern2.exec(text);
      }
      if (match) {
        const pos = match.index;
        dom.noteTextarea.focus();
        dom.noteTextarea.setSelectionRange(pos, pos + match[0].length);

        const textBefore = text.slice(0, pos);
        const lineCount = textBefore.split('\n').length;
        const totalLines = text.split('\n').length;
        const ratio = lineCount / Math.max(1, totalLines);
        dom.noteTextarea.scrollTop = ratio * (dom.noteTextarea.scrollHeight - dom.noteTextarea.clientHeight);

        dom.noteTextarea.classList.add('day-jump-flash');
        setTimeout(() => dom.noteTextarea.classList.remove('day-jump-flash'), 1000);
      }
    };

    setTimeout(performScroll, 60);
  }

  // Cargar y seleccionar el documento mensual de Daily Text
  async function loadAndSelectMonthDocument(year, month) {
    const numYear = Number(year) || new Date().getFullYear();
    const mName = month || MONTHS_LIST[new Date().getMonth()];
    const docId = `daily_text_${numYear}_${mName}`;

    let monthDoc = notesState.notes.find(n => 
      n.id === docId || 
      (n.category === 'daily_text' && Number(n.year) === numYear && n.month === mName && n.isMonthDoc)
    );

    if (monthDoc) {
      selectNote(monthDoc.id);
      renderNotesList();
      return;
    }

    try {
      const res = await fetch(`/api/notes/month/${numYear}/${encodeURIComponent(mName)}`);
      const data = await res.json();
      if (data.success && data.note) {
        const existingIdx = notesState.notes.findIndex(n => n.id === data.note.id);
        if (existingIdx >= 0) {
          notesState.notes[existingIdx] = data.note;
        } else {
          notesState.notes.unshift(data.note);
        }
        selectNote(data.note.id);
        renderNotesList();
      }
    } catch (err) {
      console.error('Error cargando documento mensual:', err);
    }
  }

  // Actualizar el botón principal superior del sidebar según la sección activa
  function updateSidebarMainActionBtn() {
    if (!dom.btnSidebarMainAction) return;
    const f = notesState.currentFilter;
    let label = 'Nuevo apunte';
    let title = 'Crear un apunte nuevo';
    if (f.category === 'daily_text') {
      const m = f.month || 'el mes';
      label = `Añadir día · ${m}`;
      title = `Añadir una entrada diaria al documento de ${m}`;
    } else {
      const eventNames = { bethel_talks: 'Bethel Talks', annual_meeting: 'Annual Meeting', gilead_meeting: 'Gilead Meeting', others: 'Otros eventos' };
      let name = 'Documentos';
      if (f.category === 'events') {
        const evCat = notesState.categories.find(c => c.id === 'events');
        const custom = evCat && (evCat.subCategories || []).find(sc => sc.id === f.subCategory);
        name = custom ? custom.name : (eventNames[f.subCategory] || 'Eventos');
      } else if (f.category === 'spiritual_notes') {
        name = 'Spiritual Notes';
      } else if (f.category && f.category !== 'all') {
        const catObj = notesState.categories.find(c => c.id === f.category);
        if (catObj) {
          name = catObj.name;
          const subObj = f.subCategory && (catObj.subCategories || []).find(sc => sc.id === f.subCategory);
          if (subObj) name = subObj.name;
        }
      }
      if (f.category !== 'all') {
        label = `Nuevo en ${name}`;
        title = `Añadir un documento a ${name}`;
      }
    }
    dom.btnSidebarMainAction.innerHTML = '<svg class="i"><use href="#i-plus"/></svg><span></span>';
    dom.btnSidebarMainAction.querySelector('span').textContent = label;
    dom.btnSidebarMainAction.title = title;
  }

  // Manejador del clic en el botón principal superior del sidebar
  function handleMainSidebarActionClick() {
    const f = notesState.currentFilter;
    if (f.category === 'daily_text') {
      openNewDayPrompt();
    } else {
      openNewFolderDocPrompt();
    }
  }

  // Manejador para añadir una nueva entrada/párrafo dentro del apunte abierto actualmente
  function handleAddEntryClick() {
    if (!notesState.activeNoteId) return;
    const note = notesState.notes.find(n => n.id === notesState.activeNoteId);
    if (!note) return;

    if (note.category === 'daily_text' || note.isMonthDoc) {
      openNewDayPrompt();
      return;
    }

    const now = new Date();
    const dateFormatted = now.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    const newEntryHtml = `
      <hr>
      <div class="paper-day-banner"><span>✍️</span> Nueva entrada • ${dateFormatted}</div>
      <p><br></p>
    `;

    if (dom.noteRichEditor) {
      dom.noteRichEditor.insertAdjacentHTML('beforeend', newEntryHtml);
      const lastP = dom.noteRichEditor.lastElementChild;
      if (lastP) {
        lastP.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(lastP);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
        dom.noteRichEditor.focus();
      }
      if (dom.noteTextarea) {
        dom.noteTextarea.value = richHtmlToMarkdown(dom.noteRichEditor.innerHTML);
      }
      scheduleAutoSave();
    }
  }

  // Actualizar vista previa del encabezado de la entrada en el modal
  function updateNewDayPreview() {
    if (!dom.newDayDateInput) return;
    const dateVal = dom.newDayDateInput.value;
    const details = parseDateDetails(dateVal);
    const titleVal = (dom.newDayTitleInput && dom.newDayTitleInput.value.trim()) || 'Título de la Entrada';

    if (dom.newDayCalculatedInfo) {
      dom.newDayCalculatedInfo.textContent = `${details.weekday}, ${details.day} de ${details.month} de ${details.year}`;
    }
    if (dom.newDayPreviewHeading) {
      dom.newDayPreviewHeading.innerHTML = `
        <div class="preview-day">Día ${details.day} · ${details.weekday}, ${details.day} de ${details.month} de ${details.year}</div>
        <div class="preview-title">${escapeHtml(titleVal)}</div>
      `;
    }
  }

  // Abrir modal para añadir un día al documento mensual activo
  function openNewDayPrompt() {
    const currentMonth = notesState.currentFilter.month || MONTHS_LIST[new Date().getMonth()];
    const currentYear = notesState.currentFilter.year || new Date().getFullYear();
    const monthIdx = MONTHS_LIST.indexOf(currentMonth);

    const docId = `daily_text_${currentYear}_${currentMonth}`;
    const monthDoc = notesState.notes.find(n => n.id === docId || (n.category === 'daily_text' && Number(n.year) === currentYear && n.month === currentMonth));
    const existingDays = parseDaysFromMonthContent(monthDoc ? monthDoc.content : '');

    let nextDayNum = 1;
    if (existingDays.length > 0) {
      const maxDay = Math.max(...existingDays.map(d => d.day));
      nextDayNum = Math.min(31, maxDay + 1);
    } else {
      const today = new Date();
      if (today.getFullYear() === currentYear && today.getMonth() === monthIdx) {
        nextDayNum = today.getDate();
      }
    }

    const mm = String((monthIdx >= 0 ? monthIdx : 8) + 1).padStart(2, '0');
    const dd = String(nextDayNum).padStart(2, '0');
    const suggestedDate = `${currentYear}-${mm}-${dd}`;

    dom.newDayDateInput.value = suggestedDate;
    dom.newDayTitleInput.value = '';
    dom.newDayTitleInput.placeholder = 'Ej.: La perseverancia de Job';
    dom.newDayScriptureInput.value = '';

    if (dom.newDayModalTitle) {
      dom.newDayModalTitle.textContent = `Nueva entrada · ${currentMonth} ${currentYear}`;
    }

    updateNewDayPreview();

    dom.newDayModal.classList.add('active');
    setTimeout(() => {
      dom.newDayTitleInput.focus();
    }, 120);
  }

  // Insertar un nuevo día en el documento mensual
  async function handleCreateNewDay(e) {
    e.preventDefault();

    const dateVal = dom.newDayDateInput.value;
    const details = parseDateDetails(dateVal);
    const rawTitle = dom.newDayTitleInput.value.trim();
    const scripture = dom.newDayScriptureInput.value.trim();
    const title = rawTitle || `Entrada del ${details.day} de ${details.month}`;

    const currentYear = details.year;
    const currentMonth = details.month;

    try {
      const res = await fetch(`/api/notes/month/${currentYear}/${encodeURIComponent(currentMonth)}/day`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          day: details.day,
          title,
          scripture,
          weekday: details.weekday,
          date: dateVal
        })
      });
      const data = await res.json();
      if (data.success && data.note) {
        const idx = notesState.notes.findIndex(n => n.id === data.note.id);
        if (idx >= 0) {
          notesState.notes[idx] = data.note;
        } else {
          notesState.notes.unshift(data.note);
        }

        notesState.currentFilter.category = 'daily_text';
        notesState.currentFilter.year = currentYear;
        notesState.currentFilter.month = currentMonth;

        selectNote(data.note.id);
        renderSidebarTree();
        renderNotesList();
        dom.newDayModal.classList.remove('active');

        setTimeout(() => {
          scrollToDayInEditor(details.day);
        }, 120);

        if (window.soundEngine && typeof window.soundEngine.playClick === 'function') {
          window.soundEngine.playClick();
        }
      }
    } catch (err) {
      console.error('Error al insertar día en documento mensual:', err);
      showToastNotification('No se pudo añadir el día al documento mensual.', 'error');
    }
  }

  // Abrir modal para crear un documento en una carpeta (Bethel Talks, Annual Meeting, Spiritual Notes)
  function openNewFolderDocPrompt() {
    const f = notesState.currentFilter;
    const cat = (f.category && f.category !== 'daily_text' && f.category !== 'all') ? f.category : 'events';
    const subCat = (cat === 'events') ? (f.subCategory || 'bethel_talks') : '';

    dom.folderDocCategoryInput.value = cat;
    dom.folderDocSubCategoryInput.value = subCat;

    const names = {
      bethel_talks: 'Bethel Talks',
      annual_meeting: 'Annual Meeting',
      gilead_meeting: 'Gilead Meeting',
      others: 'Otros Eventos'
    };

    let folderName = 'Documento';
    let defaultIcon = '📄';

    if (cat === 'events') {
      folderName = names[subCat] || 'Eventos';
      defaultIcon = subCat === 'bethel_talks' ? '🎤' : subCat === 'annual_meeting' ? '🌐' : subCat === 'gilead_meeting' ? '🎓' : '🏛️';
    } else if (cat === 'spiritual_notes') {
      folderName = 'Spiritual Notes';
      defaultIcon = '💡';
    } else {
      const catObj = notesState.categories.find(c => c.id === cat);
      if (catObj) {
        folderName = catObj.name;
        defaultIcon = catObj.icon || '📁';
        if (subCat && Array.isArray(catObj.subCategories)) {
          const subObj = catObj.subCategories.find(sc => sc.id === subCat);
          if (subObj) {
            folderName = `${catObj.name} › ${subObj.name}`;
            defaultIcon = subObj.icon || defaultIcon;
          }
        }
      }
    }

    if (dom.folderDocModalTitle) {
      dom.folderDocModalTitle.textContent = `Nuevo documento · ${folderName}`;
    }
    if (dom.folderDocModalDesc) {
      dom.folderDocModalDesc.textContent = `Se guardará en ${folderName} y se sincronizará con GitHub.`;
    }

    dom.folderDocIconSelect.value = defaultIcon;
    dom.folderDocDateInput.value = new Date().toISOString().split('T')[0];
    dom.folderDocTitleInput.value = '';
    dom.folderDocSpeakerInput.value = '';
    dom.folderDocTagsInput.value = '';

    dom.newFolderDocModal.classList.add('active');
    setTimeout(() => {
      dom.folderDocTitleInput.focus();
    }, 120);
  }

  // Guardar un nuevo documento en la carpeta correspondiente
  async function handleCreateFolderDoc(e) {
    e.preventDefault();

    const cat = dom.folderDocCategoryInput.value;
    const subCat = dom.folderDocSubCategoryInput.value;
    const title = dom.folderDocTitleInput.value.trim() || 'Nuevo Documento';
    const dateVal = dom.folderDocDateInput.value || new Date().toISOString().split('T')[0];
    const details = parseDateDetails(dateVal);
    const icon = dom.folderDocIconSelect.value || '📄';
    const speaker = dom.folderDocSpeakerInput.value.trim();
    const tags = dom.folderDocTagsInput.value.split(',').map(t => t.trim()).filter(Boolean);

    let initialContent = `## 📅 Fecha: ${details.weekday}, ${details.day} de ${details.month} de ${details.year}\n# ✍️ Título: ${title}\n\n`;
    if (speaker) {
      initialContent += `**👤 Orador / Fuente:** ${speaker}\n\n`;
    }
    initialContent += `### Puntos Principales del Estudio:\n- \n- \n\n💡 **Aplicación práctica:**\n`;

    const payload = {
      title,
      date: dateVal,
      category: cat,
      subCategory: subCat,
      icon,
      tags,
      content: initialContent
    };

    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success && data.note) {
        notesState.notes.unshift(data.note);

        notesState.currentFilter.category = cat;
        notesState.currentFilter.subCategory = subCat;

        renderSidebarTree();
        renderNotesList();
        selectNote(data.note.id);
        dom.newFolderDocModal.classList.remove('active');

        setTimeout(() => {
          if (dom.noteRichEditor) dom.noteRichEditor.focus();
        }, 150);

        if (window.soundEngine && typeof window.soundEngine.playClick === 'function') {
          window.soundEngine.playClick();
        }
      }
    } catch (err) {
      console.error('Error creando documento en carpeta:', err);
      showToastNotification('No se pudo crear el documento.', 'error');
    }
  }

  async function deleteCurrentNote() {
    if (!notesState.activeNoteId) return;
    const note = notesState.notes.find(n => n.id === notesState.activeNoteId);
    if (!note) return;

    if (!confirm(`¿Eliminar "${note.title}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/notes/${note.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        notesState.notes = notesState.notes.filter(n => n.id !== note.id);
        notesState.activeNoteId = null;
        renderSidebarTree();
        renderNotesList();

        if (notesState.notes.length > 0) {
          selectNote(notesState.notes[0].id);
        } else {
          showEmptyPlaceholder();
        }

        if (typeof window.refreshGameTopics === 'function') {
          window.refreshGameTopics();
        }
      }
    } catch (err) {
      console.error('Error al eliminar nota:', err);
      showToastNotification('No se pudo eliminar la nota.', 'error');
    }
  }

  // ==========================================
  // SELECCIÓN Y APERTURA DE APUNTE EN EL CUADERNO
  // ==========================================

  function selectNote(noteId, opts = {}) {
    try {
      const note = notesState.notes.find(n => n.id === noteId);
      if (!note) return;

      // Guardar lo que se estuviera escribiendo en el apunte anterior
      if (notesState.saveTimeout && notesState.activeNoteId && notesState.activeNoteId !== note.id) {
        clearTimeout(notesState.saveTimeout);
        notesState.saveTimeout = null;
        saveActiveNoteNow();
      }
      const prevScroll = opts.keepScroll ? window.scrollY : 0;

      notesState.activeNoteId = note.id;
      try { localStorage.setItem('study_last_note', note.id); } catch (e) { /* ignorar */ }

      if (dom.emptyEditorPlaceholder) dom.emptyEditorPlaceholder.style.display = 'none';
      if (dom.activeEditorContainer) dom.activeEditorContainer.style.display = 'block';
      if (dom.aiDiffPanel) dom.aiDiffPanel.style.display = 'none';
      if (dom.paperToolbar) dom.paperToolbar.style.display = 'flex';

      // Rellenar cabecera interactiva
      if (dom.noteIconBtn) dom.noteIconBtn.textContent = note.icon || '📝';
      if (dom.noteTitleInput) dom.noteTitleInput.value = note.title || '';
      if (dom.noteDateInput) dom.noteDateInput.value = note.date || new Date().toISOString().split('T')[0];
      if (dom.noteCategorySelect) dom.noteCategorySelect.value = note.category || 'daily_text';
      if (dom.noteTagsInput) dom.noteTagsInput.value = (note.tags || []).join(', ');

      const rawContent = note.content || '';
      if (dom.noteRichEditor) {
        dom.noteRichEditor.innerHTML = markdownToRichHtml(rawContent);
      }
      if (dom.noteTextarea) {
        dom.noteTextarea.value = rawContent;
        dom.noteTextarea.scrollTop = 0;
      }

      updateCategorySelectorsUI(note);
      updateBreadcrumbs(note);
      updateDayHeaderBanner(note);
      updateSaveStatus('Guardado', 'saved');

      // Actualizar contador de preguntas en el menú lateral
      if (dom.sidebarQuestionsCount) {
        dom.sidebarQuestionsCount.textContent = note.questionsCount || 0;
      }

      // Sincronizar filtro y listas laterales para que coincidan con la categoría del apunte
      // (en "Todos los apuntes" se mantiene la lista completa)
      if (notesState.currentFilter.category === 'all') {
        // no cambiar el filtro
      } else if (note.category === 'events') {
        notesState.currentFilter.category = 'events';
        if (note.subCategory) notesState.currentFilter.subCategory = note.subCategory;
      } else if (note.category === 'spiritual_notes') {
        notesState.currentFilter.category = 'spiritual_notes';
      } else if (note.category === 'daily_text') {
        notesState.currentFilter.category = 'daily_text';
        if (note.year) notesState.currentFilter.year = Number(note.year);
        if (note.month) notesState.currentFilter.month = note.month;
      } else if (note.category) {
        notesState.currentFilter.category = note.category;
        if (note.subCategory) notesState.currentFilter.subCategory = note.subCategory;
      }
      updateSidebarMainActionBtn();
      renderNotesList();

      // Resaltar en la lista lateral y en el árbol
      document.querySelectorAll('.note-list-item').forEach(el => {
        el.classList.toggle('active', el.dataset.id === note.id);
      });
      document.querySelectorAll('.tree-leaf-item').forEach(el => {
        el.classList.toggle('active', el.dataset.id === note.id);
      });

      // Mostrar el principio del documento (o conservar la posición al refrescar)
      window.scrollTo({ top: prevScroll, behavior: 'auto' });
      if (dom.noteRichEditor) {
        dom.noteRichEditor.setAttribute('contenteditable', 'true');
      }

      // Si hay una búsqueda activa, sincronizar la barra de navegación de referencias
      if (notesState.searchQuery && notesState.searchMatchedNotes.length > 0) {
        const sIdx = notesState.searchMatchedNotes.findIndex(n => n.id === note.id);
        if (sIdx >= 0) {
          notesState.searchCurrentIndex = sIdx;
        }
        showSearchNavBanner();
      }
    } catch (err) {
      console.error('Error al seleccionar nota:', err);
    }
  }

  // Exponer al ámbito global para poder abrir notas desde Concurso y Repaso
  window.openNoteFromExternal = function(noteId) {
    switchToTab('notion');
    selectNote(noteId);
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 150);
  };

  function showEmptyPlaceholder() {
    dom.emptyEditorPlaceholder.style.display = 'flex';
    dom.activeEditorContainer.style.display = 'none';
    if (dom.paperToolbar) dom.paperToolbar.style.display = 'none';
    notesState.activeNoteId = null;
  }

  function updateCategorySelectorsUI(note) {
    const cat = dom.noteCategorySelect.value;
    const subCatContainer = document.getElementById('subCategoryWrapper');
    const monthWrapper = document.getElementById('monthWrapper');

    if (cat === 'daily_text') {
      subCatContainer.style.display = 'none';
      monthWrapper.style.display = 'inline-flex';
      if (dom.noteYearInput) dom.noteYearInput.value = note.year || new Date().getFullYear();
      if (dom.noteMonthSelect) dom.noteMonthSelect.value = note.month || MONTHS_LIST[new Date().getMonth()];
    } else if (cat === 'events') {
      subCatContainer.style.display = 'inline-flex';
      monthWrapper.style.display = 'none';
      if (dom.noteSubCategorySelect) dom.noteSubCategorySelect.value = note.subCategory || 'bethel_talks';
    } else {
      subCatContainer.style.display = 'none';
      monthWrapper.style.display = 'none';
    }
  }

  function updateBreadcrumbs(note) {
    let catText = 'Notas';
    let subText = '';

    if (note.category === 'daily_text') {
      catText = 'Daily Text';
      subText = `${note.month || ''} ${note.year || ''}`.trim();
    } else if (note.category === 'events') {
      catText = 'Events';
      const eventNames = { bethel_talks: 'Bethel Talks', annual_meeting: 'Annual Meeting', gilead_meeting: 'Gilead Meeting', others: 'Others' };
      const evCat = notesState.categories.find(c => c.id === 'events');
      const custom = evCat && (evCat.subCategories || []).find(sc => sc.id === note.subCategory);
      subText = custom ? custom.name : (eventNames[note.subCategory] || '');
    } else if (note.category === 'spiritual_notes') {
      catText = 'Spiritual Notes';
      const spCat = notesState.categories.find(c => c.id === 'spiritual_notes');
      const custom = spCat && (spCat.subCategories || []).find(sc => sc.id === note.subCategory);
      if (custom) subText = custom.name;
    } else {
      const catObj = notesState.categories.find(c => c.id === note.category);
      if (catObj) {
        catText = catObj.name;
        const subObj = note.subCategory && (catObj.subCategories || []).find(x => x.id === note.subCategory);
        if (subObj) subText = subObj.name;
      }
    }

    const sep = '<svg class="i crumb-sep"><use href="#i-chevron-right"/></svg>';
    dom.noteBreadcrumbs.innerHTML = `
      <span class="crumb-cat">${escapeHtml(catText)}</span>
      ${subText ? `${sep}<span class="crumb-sub">${escapeHtml(subText)}</span>` : ''}
      ${sep}<span class="crumb-title">${escapeHtml(note.title || 'Sin título')}</span>
    `;
  }

  function updateDayHeaderBanner(note) {
    if (!dom.activeDayHeaderBanner) return;
    const details = parseDateDetails(note.date);
    const longDate = `${details.weekday}, ${details.day} de ${details.month} de ${details.year}`;
    let label;
    if (note.category === 'daily_text') {
      const days = parseDaysFromMonthContent(note.content || '');
      label = `Cuaderno mensual · ${note.month || ''} ${note.year || ''} · ${days.length} ${days.length === 1 ? 'día' : 'días'}`;
    } else if (note.category === 'events') {
      const eventNames = { bethel_talks: 'Discurso de Betel', annual_meeting: 'Reunión anual', gilead_meeting: 'Graduación de Galaad', others: 'Evento especial' };
      label = `${eventNames[note.subCategory] || 'Evento'} · ${longDate}`;
    } else if (note.category === 'spiritual_notes') {
      label = `Perla espiritual · ${longDate}`;
    } else {
      const catObj = notesState.categories.find(c => c.id === note.category);
      label = `${catObj ? catObj.name : 'Documento'} · ${longDate}`;
    }
    dom.activeDayHeaderBanner.textContent = label;
  }

  // ==========================================
  // RENDERIZADO DEL ÁRBOL JERÁRQUICO LATERAL
  // ==========================================

  function renderSidebarTree() {
    const notes = notesState.notes;
    const selectedYear = notesState.currentFilter.year || new Date().getFullYear();

    // Contadores
    const countDailyYear = notes.filter(n => n.category === 'daily_text' && Number(n.year) === selectedYear).length;

    const countEvents = notes.filter(n => n.category === 'events').length;
    const bethelNotes = notes.filter(n => n.category === 'events' && n.subCategory === 'bethel_talks');
    const annualNotes = notes.filter(n => n.category === 'events' && n.subCategory === 'annual_meeting');
    const gileadNotes = notes.filter(n => n.category === 'events' && n.subCategory === 'gilead_meeting');
    const otherNotes = notes.filter(n => n.category === 'events' && n.subCategory === 'others');

    // Subcategorías personalizadas dentro de eventos
    const eventsCategoryObj = notesState.categories.find(c => c.id === 'events');
    const customEventSubs = (eventsCategoryObj && Array.isArray(eventsCategoryObj.subCategories))
      ? eventsCategoryObj.subCategories.filter(s => !['bethel_talks', 'annual_meeting', 'gilead_meeting', 'others'].includes(s.id))
      : [];

    const spiritualNotes = notes.filter(n => n.category === 'spiritual_notes');
    const countSpiritual = spiritualNotes.length;

    // Subcategorías personalizadas dentro de notas espirituales
    const spiritualCategoryObj = notesState.categories.find(c => c.id === 'spiritual_notes');
    const customSpiritualSubs = (spiritualCategoryObj && Array.isArray(spiritualCategoryObj.subCategories))
      ? spiritualCategoryObj.subCategories
      : [];

    // Categorías principales personalizadas
    const customMainCategories = notesState.categories.filter(
      c => !['daily_text', 'events', 'spiritual_notes'].includes(c.id) && !c.parentId
    );

    const isAllActive = notesState.currentFilter.category === 'all';
    const isDailyActive = notesState.currentFilter.category === 'daily_text';
    const isEventsActive = notesState.currentFilter.category === 'events';
    const isSpiritualActive = notesState.currentFilter.category === 'spiritual_notes';

    // Estados de colapso de cada sección
    const isDailyCollapsed = notesState.collapsedSections['daily'] === true;
    const isEventsCollapsed = notesState.collapsedSections['events'] === true;
    const isSpiritualCollapsed = notesState.collapsedSections['spiritual'] === true;

    let customCategoriesHtml = '';
    customMainCategories.forEach(cat => {
      const isCatActive = notesState.currentFilter.category === cat.id;
      const isCatCollapsed = notesState.collapsedSections[cat.id] === true;
      const subCats = Array.isArray(cat.subCategories) ? cat.subCategories : [];
      const directNotes = notes.filter(n => n.category === cat.id && (!n.subCategory || !subCats.some(s => s.id === n.subCategory)));
      const totalCatNotes = notes.filter(n => n.category === cat.id || subCats.some(s => s.id === n.subCategory || s.id === n.category)).length;

      customCategoriesHtml += `
        <!-- Categoría Personalizada: ${escapeHtml(cat.name)} -->
        <div class="tree-group">
          <div class="tree-item tree-group-header ${isCatActive ? 'active' : ''}" data-action="filter-custom-cat" data-cat="${cat.id}">
            <span class="tree-expander" data-toggle-section="${cat.id}" title="Minimizar / Desplegar">${isCatCollapsed ? '<svg class="i"><use href="#i-chevron-right"/></svg>' : '<svg class="i"><use href="#i-chevron-down"/></svg>'}</span>
            <span class="tree-icon">${cat.icon || '📁'}</span>
            <span class="tree-label">${escapeHtml(cat.name)}</span>
            <span class="tree-badge">${totalCatNotes}</span>
            <button class="tree-action-btn btn-add" data-action="add-subcat" data-parent="${cat.id}" title="Añadir subcategoría a ${escapeHtml(cat.name)}"><svg class="i"><use href="#i-plus"/></svg></button>
            <button class="tree-action-btn btn-del" data-action="del-cat" data-id="${cat.id}" title="Eliminar categoría"><svg class="i"><use href="#i-x"/></svg></button>
          </div>
          <div id="cat_${cat.id}_SubContainer" class="tree-subgroup ${isCatCollapsed ? 'is-collapsed' : ''}">
            ${subCats.map(sub => {
              const isSubActive = isCatActive && notesState.currentFilter.subCategory === sub.id;
              const subNotes = notes.filter(n => (n.category === cat.id && n.subCategory === sub.id) || n.category === sub.id);
              return `
                <div class="tree-sub-item ${isSubActive ? 'active' : ''}" data-action="filter-custom-sub" data-parent="${cat.id}" data-sub="${sub.id}">
                  <span class="tree-icon">${sub.icon || '📂'}</span>
                  <span class="tree-label">${escapeHtml(sub.name)}</span>
                  ${subNotes.length > 0 ? `<span class="tree-badge">${subNotes.length}</span>` : ''}
                  <button class="tree-action-btn btn-del" data-action="del-cat" data-id="${sub.id}" title="Eliminar subcategoría"><svg class="i"><use href="#i-x"/></svg></button>
                </div>
                ${subNotes.length > 0 ? `
                  <div class="tree-subgroup" style="padding-left: 12px; margin-bottom: 4px;">
                    ${subNotes.map(n => `
                      <div class="tree-leaf-item ${n.id === notesState.activeNoteId ? 'active' : ''}" data-action="open-note" data-id="${n.id}" title="${escapeHtml(n.title)}">
                        <span class="tree-icon">${n.icon || sub.icon || '📄'}</span>
                        <span class="tree-label">${escapeHtml(n.title)}</span>
                      </div>
                    `).join('')}
                  </div>
                ` : ''}
              `;
            }).join('')}

            ${directNotes.map(n => `
              <div class="tree-leaf-item ${n.id === notesState.activeNoteId ? 'active' : ''}" data-action="open-note" data-id="${n.id}" title="${escapeHtml(n.title)}">
                <span class="tree-icon">${n.icon || cat.icon || '📄'}</span>
                <span class="tree-label">${escapeHtml(n.title)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    });

    dom.sidebarTree.innerHTML = `
      <!-- Ver todos los apuntes -->
      <div class="tree-item ${isAllActive ? 'active' : ''}" data-action="filter-all">
        <span class="tree-icon tree-icon-svg"><svg class="i"><use href="#i-file"/></svg></span>
        <span class="tree-label">Todos los apuntes</span>
        <span class="tree-badge">${notes.length}</span>
      </div>

      <!-- Daily Text Comments (Organizado por Año y Meses con Días desplegables) -->
      <div class="tree-group">
        <div class="tree-item tree-group-header ${isDailyActive ? 'active' : ''}" data-action="toggle-daily">
          <span class="tree-expander" data-toggle-section="daily" title="Minimizar / Desplegar">${isDailyCollapsed ? '<svg class="i"><use href="#i-chevron-right"/></svg>' : '<svg class="i"><use href="#i-chevron-down"/></svg>'}</span>
          <span class="tree-icon">🌅</span>
          <span class="tree-label">Daily Text <span class="tree-year">${selectedYear}</span></span>
          <span class="tree-badge">${countDailyYear}</span>
        </div>
        <div id="dailyMonthsContainer" class="tree-subgroup ${isDailyCollapsed ? 'is-collapsed' : ''}">
          ${MONTHS_LIST.map(m => {
            const isSelectedMonth = isDailyActive && notesState.currentFilter.month === m;
            const monthDoc = notes.find(n => n.category === 'daily_text' && Number(n.year) === selectedYear && n.month === m);
            const days = monthDoc ? parseDaysFromMonthContent(monthDoc.content || '') : [];
            return `
              <div class="tree-sub-item ${isSelectedMonth ? 'active' : ''}" 
                   data-action="filter-month" data-month="${m}">
                <span class="tree-icon tree-icon-svg"><svg class="i"><use href="#i-calendar"/></svg></span>
                <span class="tree-label">${m}</span>
                ${days.length > 0 ? `<span class="tree-badge day-count-highlight">${days.length}</span>` : ''}
              </div>
              ${(isSelectedMonth && days.length > 0) ? `
                <div class="tree-subgroup tree-days-subgroup" style="padding-left: 12px; margin: 2px 0 6px;">
                  ${days.map(d => `
                    <div class="tree-leaf-item" data-action="jump-day" data-day="${d.day}" title="Día ${d.day}: ${escapeHtml(d.title)}">
                      <span class="tree-icon">📅</span>
                      <span class="tree-label">Día ${d.day} • ${escapeHtml(d.title)}</span>
                    </div>
                  `).join('')}
                </div>
              ` : ''}
            `;
          }).join('')}
        </div>
      </div>

      <!-- Events -->
      <div class="tree-group">
        <div class="tree-item tree-group-header ${isEventsActive ? 'active' : ''}" data-action="toggle-events">
          <span class="tree-expander" data-toggle-section="events" title="Minimizar / Desplegar">${isEventsCollapsed ? '<svg class="i"><use href="#i-chevron-right"/></svg>' : '<svg class="i"><use href="#i-chevron-down"/></svg>'}</span>
          <span class="tree-icon">🏛️</span>
          <span class="tree-label">Events</span>
          <span class="tree-badge">${countEvents}</span>
          <button class="tree-action-btn btn-add" data-action="add-subcat" data-parent="events" title="Añadir subcategoría a Eventos"><svg class="i"><use href="#i-plus"/></svg></button>
        </div>
        <div id="eventsSubContainer" class="tree-subgroup ${isEventsCollapsed ? 'is-collapsed' : ''}">
          <div class="tree-sub-item ${isEventsActive && notesState.currentFilter.subCategory === 'bethel_talks' ? 'active' : ''}" 
               data-action="filter-events" data-sub="bethel_talks">
            <span class="tree-icon">🎤</span>
            <span class="tree-label">Bethel Talks</span>
            ${bethelNotes.length > 0 ? `<span class="tree-badge">${bethelNotes.length}</span>` : ''}
          </div>
          ${bethelNotes.length > 0 ? `
            <div class="tree-subgroup" style="padding-left: 12px; margin-bottom: 4px;">
              ${bethelNotes.map(n => `
                <div class="tree-leaf-item ${n.id === notesState.activeNoteId ? 'active' : ''}" data-action="open-note" data-id="${n.id}" title="${escapeHtml(n.title)}">
                  <span class="tree-icon">${n.icon || '🎤'}</span>
                  <span class="tree-label">${escapeHtml(n.title)}</span>
                </div>
              `).join('')}
            </div>
          ` : ''}

          <div class="tree-sub-item ${isEventsActive && notesState.currentFilter.subCategory === 'annual_meeting' ? 'active' : ''}" 
               data-action="filter-events" data-sub="annual_meeting">
            <span class="tree-icon">🌐</span>
            <span class="tree-label">Annual Meeting</span>
            ${annualNotes.length > 0 ? `<span class="tree-badge">${annualNotes.length}</span>` : ''}
          </div>
          ${annualNotes.length > 0 ? `
            <div class="tree-subgroup" style="padding-left: 12px; margin-bottom: 4px;">
              ${annualNotes.map(n => `
                <div class="tree-leaf-item ${n.id === notesState.activeNoteId ? 'active' : ''}" data-action="open-note" data-id="${n.id}" title="${escapeHtml(n.title)}">
                  <span class="tree-icon">${n.icon || '🌐'}</span>
                  <span class="tree-label">${escapeHtml(n.title)}</span>
                </div>
              `).join('')}
            </div>
          ` : ''}

          <div class="tree-sub-item ${isEventsActive && notesState.currentFilter.subCategory === 'gilead_meeting' ? 'active' : ''}" 
               data-action="filter-events" data-sub="gilead_meeting">
            <span class="tree-icon">🎓</span>
            <span class="tree-label">Gilead Meeting</span>
            ${gileadNotes.length > 0 ? `<span class="tree-badge">${gileadNotes.length}</span>` : ''}
          </div>
          ${gileadNotes.length > 0 ? `
            <div class="tree-subgroup" style="padding-left: 12px; margin-bottom: 4px;">
              ${gileadNotes.map(n => `
                <div class="tree-leaf-item ${n.id === notesState.activeNoteId ? 'active' : ''}" data-action="open-note" data-id="${n.id}" title="${escapeHtml(n.title)}">
                  <span class="tree-icon">${n.icon || '🎓'}</span>
                  <span class="tree-label">${escapeHtml(n.title)}</span>
                </div>
              `).join('')}
            </div>
          ` : ''}

          <div class="tree-sub-item ${isEventsActive && notesState.currentFilter.subCategory === 'others' ? 'active' : ''}" 
               data-action="filter-events" data-sub="others">
            <span class="tree-icon">📂</span>
            <span class="tree-label">Others</span>
            ${otherNotes.length > 0 ? `<span class="tree-badge">${otherNotes.length}</span>` : ''}
          </div>
          ${otherNotes.length > 0 ? `
            <div class="tree-subgroup" style="padding-left: 12px; margin-bottom: 4px;">
              ${otherNotes.map(n => `
                <div class="tree-leaf-item ${n.id === notesState.activeNoteId ? 'active' : ''}" data-action="open-note" data-id="${n.id}" title="${escapeHtml(n.title)}">
                  <span class="tree-icon">${n.icon || '📂'}</span>
                  <span class="tree-label">${escapeHtml(n.title)}</span>
                </div>
              `).join('')}
            </div>
          ` : ''}

          ${customEventSubs.map(sub => {
            const isSubActive = isEventsActive && notesState.currentFilter.subCategory === sub.id;
            const subNotes = notes.filter(n => n.category === 'events' && n.subCategory === sub.id);
            return `
              <div class="tree-sub-item ${isSubActive ? 'active' : ''}" 
                   data-action="filter-events" data-sub="${sub.id}">
                <span class="tree-icon">${sub.icon || '📂'}</span>
                <span class="tree-label">${escapeHtml(sub.name)}</span>
                ${subNotes.length > 0 ? `<span class="tree-badge">${subNotes.length}</span>` : ''}
                <button class="tree-action-btn btn-del" data-action="del-cat" data-id="${sub.id}" title="Eliminar subcategoría"><svg class="i"><use href="#i-x"/></svg></button>
              </div>
              ${subNotes.length > 0 ? `
                <div class="tree-subgroup" style="padding-left: 12px; margin-bottom: 4px;">
                  ${subNotes.map(n => `
                    <div class="tree-leaf-item ${n.id === notesState.activeNoteId ? 'active' : ''}" data-action="open-note" data-id="${n.id}" title="${escapeHtml(n.title)}">
                      <span class="tree-icon">${n.icon || sub.icon || '🎤'}</span>
                      <span class="tree-label">${escapeHtml(n.title)}</span>
                    </div>
                  `).join('')}
                </div>
              ` : ''}
            `;
          }).join('')}
        </div>
      </div>

      <!-- Spiritual Notes -->
      <div class="tree-group">
        <div class="tree-item tree-group-header ${isSpiritualActive ? 'active' : ''}" data-action="filter-spiritual">
          <span class="tree-expander" data-toggle-section="spiritual" title="Minimizar / Desplegar">${isSpiritualCollapsed ? '<svg class="i"><use href="#i-chevron-right"/></svg>' : '<svg class="i"><use href="#i-chevron-down"/></svg>'}</span>
          <span class="tree-icon">💡</span>
          <span class="tree-label">Spiritual Notes</span>
          <span class="tree-badge">${countSpiritual}</span>
          <button class="tree-action-btn btn-add" data-action="add-subcat" data-parent="spiritual_notes" title="Añadir subcategoría a Notas Espirituales"><svg class="i"><use href="#i-plus"/></svg></button>
        </div>
        <div id="spiritualSubContainer" class="tree-subgroup ${isSpiritualCollapsed ? 'is-collapsed' : ''}">
          ${customSpiritualSubs.map(sub => {
            const isSubActive = isSpiritualActive && notesState.currentFilter.subCategory === sub.id;
            const subNotes = notes.filter(n => n.category === 'spiritual_notes' && n.subCategory === sub.id);
            return `
              <div class="tree-sub-item ${isSubActive ? 'active' : ''}" data-action="filter-spiritual" data-sub="${sub.id}">
                <span class="tree-icon">${sub.icon || '📂'}</span>
                <span class="tree-label">${escapeHtml(sub.name)}</span>
                ${subNotes.length > 0 ? `<span class="tree-badge">${subNotes.length}</span>` : ''}
                <button class="tree-action-btn btn-del" data-action="del-cat" data-id="${sub.id}" title="Eliminar subcategoría"><svg class="i"><use href="#i-x"/></svg></button>
              </div>
              ${subNotes.length > 0 ? `
                <div class="tree-subgroup" style="padding-left: 12px; margin-bottom: 4px;">
                  ${subNotes.map(n => `
                    <div class="tree-leaf-item ${n.id === notesState.activeNoteId ? 'active' : ''}" data-action="open-note" data-id="${n.id}" title="${escapeHtml(n.title)}">
                      <span class="tree-icon">${n.icon || sub.icon || '📜'}</span>
                      <span class="tree-label">${escapeHtml(n.title)}</span>
                    </div>
                  `).join('')}
                </div>
              ` : ''}
            `;
          }).join('')}

          ${spiritualNotes.filter(n => !n.subCategory || !customSpiritualSubs.some(s => s.id === n.subCategory)).map(n => `
            <div class="tree-leaf-item ${n.id === notesState.activeNoteId ? 'active' : ''}" data-action="open-note" data-id="${n.id}" title="${escapeHtml(n.title)}">
              <span class="tree-icon">${n.icon || '📜'}</span>
              <span class="tree-label">${escapeHtml(n.title)}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Categorías Personalizadas Adicionales -->
      ${customCategoriesHtml}
    `;

    // Expansión / Colapso de secciones en el árbol lateral
    dom.sidebarTree.querySelectorAll('.tree-expander').forEach(exp => {
      exp.addEventListener('click', (e) => {
        e.stopPropagation();
        const section = exp.dataset.toggleSection;
        if (section) {
          notesState.collapsedSections[section] = !notesState.collapsedSections[section];
          try {
            localStorage.setItem('study_collapsed_sections', JSON.stringify(notesState.collapsedSections));
          } catch (err) {}
          renderSidebarTree();
        }
      });
    });

    // Añadir subcategoría contextual
    dom.sidebarTree.querySelectorAll('[data-action="add-subcat"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const parentId = btn.dataset.parent;
        openNewCategoryModal(parentId);
      });
    });

    // Eliminar categoría o subcategoría personalizada
    dom.sidebarTree.querySelectorAll('[data-action="del-cat"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const catId = btn.dataset.id;
        deleteCategoryById(catId);
      });
    });

    // Delegación de clics en los elementos del árbol
    dom.sidebarTree.querySelectorAll('.tree-item, .tree-sub-item, .tree-leaf-item').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = el.dataset.action;
        if (action === 'open-note') {
          selectNote(el.dataset.id);
        } else if (action === 'jump-day') {
          scrollToDayInEditor(el.dataset.day);
        } else if (action === 'filter-all') {
          setFilter({ category: 'all', subCategory: '', month: '' });
        } else if (action === 'toggle-daily') {
          setFilter({ category: 'daily_text', subCategory: '', month: notesState.currentFilter.month || MONTHS_LIST[new Date().getMonth()] });
        } else if (action === 'filter-month') {
          setFilter({ category: 'daily_text', subCategory: '', month: el.dataset.month });
        } else if (action === 'toggle-events') {
          setFilter({ category: 'events', subCategory: '', month: '' });
        } else if (action === 'filter-events') {
          setFilter({ category: 'events', subCategory: el.dataset.sub || '', month: '' });
        } else if (action === 'filter-spiritual') {
          setFilter({ category: 'spiritual_notes', subCategory: el.dataset.sub || '', month: '' });
        } else if (action === 'filter-custom-cat') {
          setFilter({ category: el.dataset.cat, subCategory: '', month: '' });
        } else if (action === 'filter-custom-sub') {
          setFilter({ category: el.dataset.parent, subCategory: el.dataset.sub, month: '' });
        }
      });
    });
  }

  function setFilter(newFilter) {
    notesState.currentFilter = { ...notesState.currentFilter, ...newFilter };
    updateSidebarMainActionBtn();
    renderYearPills();
    renderSidebarTree();

    if (notesState.currentFilter.category === 'daily_text') {
      const targetMonth = notesState.currentFilter.month || MONTHS_LIST[new Date().getMonth()];
      const targetYear = notesState.currentFilter.year || new Date().getFullYear();
      loadAndSelectMonthDocument(targetYear, targetMonth);
    } else if (notesState.currentFilter.category === 'events') {
      const sub = notesState.currentFilter.subCategory;
      const docs = notesState.notes.filter(n => n.category === 'events' && (!sub || n.subCategory === sub));
      if (docs.length > 0) {
        selectNote(docs[0].id);
      } else {
        showEmptyPlaceholder();
      }
      renderNotesList();
    } else if (notesState.currentFilter.category === 'spiritual_notes') {
      const sub = notesState.currentFilter.subCategory;
      const docs = notesState.notes.filter(n => n.category === 'spiritual_notes' && (!sub || n.subCategory === sub));
      if (docs.length > 0) {
        selectNote(docs[0].id);
      } else {
        showEmptyPlaceholder();
      }
      renderNotesList();
    } else if (notesState.currentFilter.category !== 'all') {
      const catId = notesState.currentFilter.category;
      const sub = notesState.currentFilter.subCategory;
      const docs = notesState.notes.filter(n => (n.category === catId || (sub && n.category === sub)) && (!sub || n.subCategory === sub || n.category === sub));
      if (docs.length > 0) {
        selectNote(docs[0].id);
      } else {
        showEmptyPlaceholder();
      }
      renderNotesList();
    } else {
      if (notesState.notes.length > 0) {
        selectNote(notesState.notes[0].id);
      } else {
        showEmptyPlaceholder();
      }
      renderNotesList();
    }
  }

  // ================================================================
  // RENDERIZADO DE LA LISTA LATERAL (ÍNDICE DE DÍAS O BASE DE DATOS)
  // ================================================================

  function renderNotesList() {
    const f = notesState.currentFilter;
    dom.notesListContainer.innerHTML = '';

    if (f.category === 'daily_text') {
      // -------------------------------------------------------------
      // MODO DOCUMENTO MENSUAL (Daily Text Comments)
      // -------------------------------------------------------------
      const numYear = f.year || new Date().getFullYear();
      const mName = f.month || MONTHS_LIST[new Date().getMonth()];
      const docId = `daily_text_${numYear}_${mName}`;

      const monthDoc = notesState.notes.find(n => 
        n.id === docId || 
        (n.category === 'daily_text' && Number(n.year) === Number(numYear) && n.month === mName)
      );

      const days = parseDaysFromMonthContent(monthDoc ? monthDoc.content : '');

      if (dom.currentCategoryTitle) dom.currentCategoryTitle.textContent = `${mName} ${numYear}`;
      if (dom.notesCountBadge) dom.notesCountBadge.textContent = `${days.length}`;

      if (days.length === 0) {
        dom.notesListContainer.innerHTML = `
          <div class="empty-notes-notice">
            <p><strong>${escapeHtml(mName)} ${numYear}</strong> aún no tiene entradas.</p>
            <p class="muted">Cada mes es un documento continuo con un apartado por día.</p>
            <button id="btnQuickAddDay" class="btn-secondary btn-sm" type="button"><svg class="i"><use href="#i-plus"/></svg>Añadir el primer día</button>
          </div>
        `;
        const btnQuick = document.getElementById('btnQuickAddDay');
        if (btnQuick) btnQuick.addEventListener('click', openNewDayPrompt);
        return;
      }

      // Encabezado del índice de días
      const headerItem = document.createElement('div');
      headerItem.className = 'day-index-header-bar';
      headerItem.innerHTML = `
        <span class="day-index-label">Índice del mes</span>
        <button id="btnQuickAddDaySmall" class="link-btn" type="button" title="Añadir un día">+ Día</button>
      `;
      dom.notesListContainer.appendChild(headerItem);
      const btnQuickSmall = headerItem.querySelector('#btnQuickAddDaySmall');
      if (btnQuickSmall) btnQuickSmall.addEventListener('click', openNewDayPrompt);

      // Renderizar tarjetas de índice de cada día
      days.forEach(d => {
        const item = document.createElement('div');
        item.className = 'note-list-item day-index-card';
        item.dataset.day = d.day;
        item.title = `Ir al día ${d.day}`;

        item.innerHTML = `
          <span class="daily-badge-pill">${d.day}</span>
          <span class="day-index-title">${escapeHtml(d.title)}</span>
        `;

        item.addEventListener('click', () => {
          scrollToDayInEditor(d.day);
          document.querySelectorAll('.day-index-card').forEach(el => el.classList.remove('active'));
          item.classList.add('active');
        });

        dom.notesListContainer.appendChild(item);
      });

    } else {
      // -------------------------------------------------------------
      // MODO BASE DE DATOS DE CARPETA (Events, Spiritual Notes, Todos)
      // -------------------------------------------------------------
      let filtered = [...notesState.notes];
      let filterTitle = 'Todos los Apuntes';

      if (f.category === 'events') {
        filtered = filtered.filter(n => n.category === 'events');
        if (f.subCategory) {
          filtered = filtered.filter(n => n.subCategory === f.subCategory);
          const names = {
            bethel_talks: 'Bethel Talks',
            annual_meeting: 'Annual Meeting',
            gilead_meeting: 'Gilead Meeting',
            others: 'Otros Eventos'
          };
          const evCat = notesState.categories.find(c => c.id === 'events');
          const customSub = (evCat && evCat.subCategories) ? evCat.subCategories.find(s => s.id === f.subCategory) : null;
          filterTitle = customSub ? customSub.name : (names[f.subCategory] || 'Eventos');
        } else {
          filterTitle = 'Todos los Eventos';
        }
      } else if (f.category === 'spiritual_notes') {
        filtered = filtered.filter(n => n.category === 'spiritual_notes');
        if (f.subCategory) {
          filtered = filtered.filter(n => n.subCategory === f.subCategory);
          const spCat = notesState.categories.find(c => c.id === 'spiritual_notes');
          const customSub = (spCat && spCat.subCategories) ? spCat.subCategories.find(s => s.id === f.subCategory) : null;
          filterTitle = customSub ? `Spiritual Notes › ${customSub.name}` : 'Spiritual Notes';
        } else {
          filterTitle = 'Spiritual Notes';
        }
      } else if (f.category !== 'all') {
        const catObj = notesState.categories.find(c => c.id === f.category);
        filtered = filtered.filter(n => n.category === f.category);
        if (f.subCategory) {
          filtered = filtered.filter(n => n.subCategory === f.subCategory);
          if (catObj && Array.isArray(catObj.subCategories)) {
            const subObj = catObj.subCategories.find(s => s.id === f.subCategory);
            filterTitle = subObj ? `${catObj.name} › ${subObj.name}` : catObj.name;
          } else {
            filterTitle = catObj ? catObj.name : f.category;
          }
        } else {
          filterTitle = catObj ? catObj.name : f.category;
        }
      }

      // Ordenar por fecha descendente
      filtered.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));

      if (dom.currentCategoryTitle) dom.currentCategoryTitle.textContent = filterTitle;
      if (dom.notesCountBadge) dom.notesCountBadge.textContent = `${filtered.length}`;

      if (filtered.length === 0) {
        dom.notesListContainer.innerHTML = `
          <div class="empty-notes-notice">
            <p>No hay documentos en <strong>${escapeHtml(filterTitle)}</strong>.</p>
            <button id="btnQuickCreateFolderDoc" class="btn-secondary btn-sm" type="button"><svg class="i"><use href="#i-plus"/></svg>Crear documento</button>
          </div>
        `;
        const btnQuick = document.getElementById('btnQuickCreateFolderDoc');
        if (btnQuick) btnQuick.addEventListener('click', openNewFolderDocPrompt);
        return;
      }

      filtered.forEach(note => {
        const isActive = note.id === notesState.activeNoteId;
        const details = parseDateDetails(note.date);

        const cleanSnippet = (note.content || '')
          .replace(/[#*>_~`]/g, '')
          .replace(/(✍️|📅|📖|💡)\s*/gu, '')
          .replace(/(Fecha|Título):\s*/g, '')
          .replace(/\n+/g, ' ')
          .slice(0, 95);

        const item = document.createElement('div');
        item.className = `note-list-item folder-doc-card ${isActive ? 'active' : ''}`;
        item.dataset.id = note.id;

        item.innerHTML = `
          <div class="note-item-header">
            <span class="note-item-icon">${note.icon || '📄'}</span>
            <span class="note-item-title">${escapeHtml(note.title || 'Sin título')}</span>
          </div>
          <div class="note-item-snippet">${escapeHtml(cleanSnippet || 'Sin contenido todavía')}</div>
          <div class="note-item-footer">
            <span class="note-item-date">${details.day} ${details.month.slice(0, 3).toLowerCase()} ${details.year}</span>
            ${note.questionsCount > 0 ? `<span class="note-item-qbadge">${note.questionsCount} preguntas</span>` : ''}
          </div>
        `;

        item.addEventListener('click', () => {
          selectNote(note.id);
        });

        dom.notesListContainer.appendChild(item);
      });
    }
  }

  // ==========================================
  // BUSCADOR GLOBAL CON LUPA (🔍), LIMPIEZA Y NAVEGACIÓN
  // ==========================================

  function updateSearchClearButtons() {
    const val1 = (dom.globalSearchInput ? dom.globalSearchInput.value : '').trim();
    const val2 = (dom.modalSearchInput ? dom.modalSearchInput.value : '').trim();
    const hasText = (val1.length > 0) || (val2.length > 0);

    if (dom.btnSearchClear) dom.btnSearchClear.style.display = hasText ? 'flex' : 'none';
    if (dom.btnModalSearchClear) dom.btnModalSearchClear.style.display = hasText ? 'flex' : 'none';
  }

  function clearSearch() {
    if (dom.globalSearchInput) dom.globalSearchInput.value = '';
    if (dom.modalSearchInput) dom.modalSearchInput.value = '';

    notesState.searchQuery = '';
    notesState.searchResults = null;
    notesState.searchMatchedNotes = [];
    notesState.searchCurrentIndex = -1;

    updateSearchClearButtons();
    hideSearchNavBanner();

    if (dom.searchQueryDisplay) dom.searchQueryDisplay.textContent = 'Escribe para buscar...';
    if (dom.searchCountBadge) dom.searchCountBadge.textContent = '0 resultados';
    if (dom.searchResultsList) {
      dom.searchResultsList.innerHTML = '<p class="empty-hint">Escribe para buscar en todos tus apuntes.</p>';
    }

    if (dom.searchModal && dom.searchModal.classList.contains('active')) {
      if (dom.modalSearchInput) dom.modalSearchInput.focus();
    } else {
      if (dom.globalSearchInput) dom.globalSearchInput.focus();
    }
  }

  async function executeGlobalSearch(query) {
    const term = (query || '').trim();
    notesState.searchQuery = term;

    // Sincronizar ambos campos de texto
    if (dom.globalSearchInput && dom.globalSearchInput.value !== term) {
      dom.globalSearchInput.value = term;
    }
    if (dom.modalSearchInput && dom.modalSearchInput.value !== term) {
      dom.modalSearchInput.value = term;
    }
    updateSearchClearButtons();

    if (!term) {
      if (dom.searchResultsList) {
        dom.searchResultsList.innerHTML = '<p class="empty-hint">Escribe para buscar en todos tus apuntes.</p>';
      }
      if (dom.searchCountBadge) dom.searchCountBadge.textContent = '0 resultados';
      notesState.searchMatchedNotes = [];
      notesState.searchCurrentIndex = -1;
      hideSearchNavBanner();
      return;
    }

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`);
      const data = await res.json();
      if (data.success) {
        notesState.searchResults = data;
        notesState.searchMatchedNotes = data.notes || [];
        renderSearchResults(data);

        // Si la nota actualmente abierta coincide, enlazar índice
        if (notesState.activeNoteId && notesState.searchMatchedNotes.length > 0) {
          const idx = notesState.searchMatchedNotes.findIndex(n => n.id === notesState.activeNoteId);
          if (idx >= 0) {
            notesState.searchCurrentIndex = idx;
            updateSearchNavBanner();
          }
        }
      }
    } catch (err) {
      console.error('Error en búsqueda global:', err);
    }
  }

  function renderSearchResults(data) {
    const { query, totalMatches, notes, questions } = data;
    if (dom.searchQueryDisplay) dom.searchQueryDisplay.textContent = `Resultados para "${query}"`;
    if (dom.searchCountBadge) dom.searchCountBadge.textContent = `${totalMatches} ${totalMatches === 1 ? 'resultado' : 'resultados'}`;

    if (!dom.searchResultsList) return;
    dom.searchResultsList.innerHTML = '';

    if (totalMatches === 0) {
      dom.searchResultsList.innerHTML = `
        <div class="empty-hint">
          <p>Sin resultados para <strong>"${escapeHtml(query)}"</strong>.</p>
          <p class="muted">Prueba con otra palabra o versículo.</p>
        </div>
      `;
      return;
    }

    if (notes && notes.length > 0) {
      const groupHeader = document.createElement('div');
      groupHeader.className = 'search-section-header';
      groupHeader.textContent = `Apuntes · ${notes.length}`;
      dom.searchResultsList.appendChild(groupHeader);

      notes.forEach((note, index) => {
        const item = document.createElement('div');
        item.className = 'search-result-card';
        if (notesState.activeNoteId === note.id) {
          item.classList.add('active');
        }
        item.innerHTML = `
          <div class="search-result-title">
            <span class="search-result-icon">${note.icon || '📝'}</span>
            <strong>${highlightMatch(escapeHtml(note.title), query)}</strong>
            <span class="search-result-date">${note.date || ''}</span>
          </div>
          <div class="search-result-snippet">
            ${highlightMatch(escapeHtml(note.matchSnippet || ''), query)}
          </div>
          <div class="search-result-tag">${getCategoryLabel(note.category, note.subCategory)}</div>
        `;

        item.addEventListener('click', () => {
          notesState.searchCurrentIndex = index;
          closeSearchModal();
          switchToTab('notion');
          selectNote(note.id);
          showSearchNavBanner();
        });

        dom.searchResultsList.appendChild(item);
      });
    }

    if (questions && questions.length > 0) {
      const qHeader = document.createElement('div');
      qHeader.className = 'search-section-header';
      qHeader.textContent = `Preguntas del concurso · ${questions.length}`;
      dom.searchResultsList.appendChild(qHeader);

      questions.forEach(q => {
        const qCard = document.createElement('div');
        qCard.className = 'search-result-card question-card-match';
        qCard.innerHTML = `
          <div class="search-result-title">
            <strong>${highlightMatch(escapeHtml(q.question), query)}</strong>
          </div>
          <div class="search-result-snippet">
            ${highlightMatch(escapeHtml(q.explanation || ''), query)}
          </div>
          <div class="search-result-tag">Tema: ${escapeHtml(q.topicTitle || '')}</div>
        `;
        dom.searchResultsList.appendChild(qCard);
      });
    }
  }

  function highlightMatch(text, query) {
    if (!query) return text;
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    return text.replace(regex, '<mark class="search-highlight">$1</mark>');
  }

  function getCategoryLabel(cat, sub) {
    if (cat === 'daily_text') return 'Daily Text';
    const names = { bethel_talks: 'Bethel Talks', annual_meeting: 'Annual Meeting', gilead_meeting: 'Gilead Meeting', others: 'Others' };
    if (cat === 'events') return sub ? `Events · ${names[sub] || sub}` : 'Events';
    if (cat === 'spiritual_notes') return 'Spiritual Notes';
    const c = notesState.categories.find(x => x.id === cat);
    return c ? c.name : 'Notas';
  }

  function openSearchModal() {
    if (!dom.searchModal) return;
    dom.searchModal.classList.add('active');
    updateSearchClearButtons();

    const currentQ = notesState.searchQuery || (dom.globalSearchInput ? dom.globalSearchInput.value.trim() : '');
    if (dom.modalSearchInput) {
      dom.modalSearchInput.value = currentQ;
      dom.modalSearchInput.focus();
    } else if (dom.globalSearchInput) {
      dom.globalSearchInput.focus();
    }

    if (currentQ) {
      executeGlobalSearch(currentQ);
    }
  }

  function closeSearchModal() {
    if (!dom.searchModal) return;
    dom.searchModal.classList.remove('active');
  }

  // ==========================================
  // BARRA DE NAVEGACIÓN DE REFERENCIAS DE BÚSQUEDA
  // ==========================================

  function showSearchNavBanner() {
    if (!dom.searchNavBanner) return;
    if (!notesState.searchQuery || notesState.searchMatchedNotes.length === 0) {
      hideSearchNavBanner();
      return;
    }
    dom.searchNavBanner.style.display = 'flex';
    updateSearchNavBanner();
  }

  function hideSearchNavBanner() {
    if (dom.searchNavBanner) {
      dom.searchNavBanner.style.display = 'none';
    }
  }

  function updateSearchNavBanner() {
    if (!dom.searchNavBanner || dom.searchNavBanner.style.display === 'none') return;
    const total = notesState.searchMatchedNotes.length;
    const current = notesState.searchCurrentIndex >= 0 ? notesState.searchCurrentIndex + 1 : 1;

    if (dom.searchNavQueryText) {
      dom.searchNavQueryText.textContent = `"${notesState.searchQuery}"`;
    }
    if (dom.searchNavIndexText) {
      dom.searchNavIndexText.textContent = `${current} de ${total}`;
    }
    if (dom.searchNavTotalCount) {
      dom.searchNavTotalCount.textContent = total;
    }

    if (dom.btnSearchNavPrev) {
      dom.btnSearchNavPrev.disabled = notesState.searchCurrentIndex <= 0;
    }
    if (dom.btnSearchNavNext) {
      dom.btnSearchNavNext.disabled = notesState.searchCurrentIndex >= total - 1;
    }
  }

  function navigateSearchMatch(direction) {
    const total = notesState.searchMatchedNotes.length;
    if (total === 0) return;

    let newIndex = notesState.searchCurrentIndex + direction;
    if (newIndex < 0) newIndex = 0;
    if (newIndex >= total) newIndex = total - 1;

    notesState.searchCurrentIndex = newIndex;
    const targetNote = notesState.searchMatchedNotes[newIndex];
    if (targetNote) {
      selectNote(targetNote.id);
      updateSearchNavBanner();
    }
  }

  // ==========================================
  // ASISTENTE DE IA PARA NOTAS (CONTROL DE CAMBIOS / TRACK CHANGES)
  // ==========================================

  function tokenizeForDiff(text) {
    if (!text) return [];
    return text.match(/[\w\u00C0-\u017F]+|[^\w\s\u00C0-\u017F]+|\s+/g) || [];
  }

  function computeWordDiff(origText, newText) {
    const origTokens = tokenizeForDiff(origText);
    const newTokens = tokenizeForDiff(newText);
    const m = origTokens.length;
    const n = newTokens.length;

    if (origText === newText) {
      return { diffHtml: escapeHtml(newText), changesCount: 0 };
    }

    const dp = Array.from({ length: m + 1 }, () => new Uint32Array(n + 1));
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        if (origTokens[i] === newTokens[j]) {
          dp[i + 1][j + 1] = dp[i][j] + 1;
        } else {
          dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
      }
    }

    let i = m;
    let j = n;
    const rawOps = [];
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && origTokens[i - 1] === newTokens[j - 1]) {
        rawOps.unshift({ type: 'equal', text: origTokens[i - 1] });
        i--;
        j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        rawOps.unshift({ type: 'insert', text: newTokens[j - 1] });
        j--;
      } else {
        rawOps.unshift({ type: 'delete', text: origTokens[i - 1] });
        i--;
      }
    }

    let changesCount = 0;
    let html = '';
    let k = 0;
    while (k < rawOps.length) {
      const op = rawOps[k];
      if (op.type === 'equal') {
        html += escapeHtml(op.text);
        k++;
      } else if (op.type === 'delete') {
        let delText = '';
        while (k < rawOps.length && rawOps[k].type === 'delete') {
          delText += rawOps[k].text;
          k++;
        }
        changesCount++;
        let insText = '';
        while (k < rawOps.length && rawOps[k].type === 'insert') {
          insText += rawOps[k].text;
          k++;
        }
        html += `<del class="track-del">${escapeHtml(delText)}</del>`;
        if (insText) {
          html += `<ins class="track-ins">${escapeHtml(insText)}</ins>`;
        }
      } else if (op.type === 'insert') {
        let insText = '';
        while (k < rawOps.length && rawOps[k].type === 'insert') {
          insText += rawOps[k].text;
          k++;
        }
        changesCount++;
        html += `<ins class="track-ins">${escapeHtml(insText)}</ins>`;
      }
    }

    return { diffHtml: html, changesCount };
  }

  async function checkGeminiKeyStatus() {
    try {
      const res = await fetch('/api/config/ai-status');
      const data = await res.json();
      return Boolean(data && data.hasGeminiKey);
    } catch (e) {
      return false;
    }
  }

  async function runSingleClickAiAssist(customApiKey = '') {
    if (!notesState.activeNoteId) return;
    const note = notesState.notes.find(n => n.id === notesState.activeNoteId);
    if (!note) return;

    const currentContent = dom.noteTextarea.value.trim();
    if (!currentContent) {
      showToastNotification('Escribe algo antes de pedir la revisión.', 'warning');
      return;
    }

    // Si no se pasó clave custom, verificar si ya está configurada
    if (!customApiKey) {
      const hasKey = await checkGeminiKeyStatus();
      if (!hasKey) {
        if (dom.geminiKeyPromptModal) {
          dom.geminiKeyPromptModal.classList.add('active');
          if (dom.geminiPromptKeyInput) dom.geminiPromptKeyInput.focus();
        }
        return;
      }
    }

    // Estado visual de procesamiento
    if (dom.btnRunAiAssist) {
      dom.btnRunAiAssist.classList.add('is-processing');
      dom.btnRunAiAssist.innerHTML = '<span class="spinner"></span><span>Revisando…</span>';
    }

    if (dom.aiDiffPanel) {
      dom.aiDiffPanel.style.display = 'block';
    }
    if (dom.aiChangesCount) dom.aiChangesCount.textContent = 'Analizando texto...';
    if (dom.aiEngineBadge) dom.aiEngineBadge.textContent = 'Gemini Flash';
    if (dom.aiDiffContent) {
      dom.aiDiffContent.innerHTML = `<div class="ai-loading"><span class="spinner"></span> Revisando ortografía y redacción…</div>`;
    }
    if (dom.btnApplyAiChanges) dom.btnApplyAiChanges.disabled = true;

    try {
      const res = await fetch(`/api/notes/${note.id}/ai-assist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'all',
          content: currentContent,
          title: dom.noteTitleInput.value.trim(),
          apiKey: customApiKey || ''
        })
      });

      const data = await res.json();
      if (data.success && data.result) {
        pendingAiResult = data.result;

        const { diffHtml, changesCount } = computeWordDiff(currentContent, data.result);

        const isEn = data.detectedLang === 'en';
        const targetScope = data.isPartial ? (isEn ? 'in last entry' : 'en última entrada') : '';

        if (dom.aiChangesCount) {
          if (isEn) {
            dom.aiChangesCount.textContent = `${changesCount} correction${changesCount === 1 ? '' : 's'} ${targetScope}`.trim();
          } else {
            dom.aiChangesCount.textContent = `${changesCount} corrección${changesCount === 1 ? '' : 'es'} ${targetScope}`.trim();
          }
        }
        if (dom.aiEngineBadge) {
          const langLabel = isEn ? 'English' : 'Español';
          dom.aiEngineBadge.textContent = data.usedEngine === 'gemini' 
            ? `Google Gemini (${langLabel})` 
            : `Motor Local (${langLabel})`;
        }

        if (dom.aiDiffContent) {
          if (changesCount === 0) {
            const noChangeMsg = isEn
              ? 'Looks good — no spelling errors found.'
              : 'Todo correcto: no se encontraron faltas de ortografía.';
            dom.aiDiffContent.innerHTML = `
              <div class="ai-ok">${noChangeMsg}</div>
            `;
          } else {
            dom.aiDiffContent.innerHTML = diffHtml;
          }
        }

        if (dom.btnApplyAiChanges) dom.btnApplyAiChanges.disabled = false;
      } else {
        if (dom.aiChangesCount) dom.aiChangesCount.textContent = 'Aviso';
        if (dom.aiDiffContent) {
          dom.aiDiffContent.innerHTML = `<div class="ai-error">${escapeHtml(data.error || 'No se pudo completar la revisión.')}</div>`;
        }
      }
    } catch (err) {
      console.error('Error en asistente IA:', err);
      if (dom.aiChangesCount) dom.aiChangesCount.textContent = 'Error';
      if (dom.aiDiffContent) {
        dom.aiDiffContent.innerHTML = `<div class="ai-error">Error de conexión: ${escapeHtml(err.message)}</div>`;
      }
    } finally {
      if (dom.btnRunAiAssist) {
        dom.btnRunAiAssist.classList.remove('is-processing');
        dom.btnRunAiAssist.innerHTML = '<svg class="i"><use href="#i-sparkles"/></svg><span>Revisar con IA</span>';
      }
    }
  }

  function applyAiChanges() {
    if (!pendingAiResult) return;
    if (dom.noteRichEditor) {
      dom.noteRichEditor.innerHTML = markdownToRichHtml(pendingAiResult);
    }
    if (dom.noteTextarea) {
      dom.noteTextarea.value = pendingAiResult;
    }
    if (dom.aiDiffPanel) dom.aiDiffPanel.style.display = 'none';
    pendingAiResult = '';
    scheduleAutoSave();
  }

  function discardAiChanges() {
    if (dom.aiDiffPanel) dom.aiDiffPanel.style.display = 'none';
    pendingAiResult = '';
  }

  // ==========================================
  // PREGUNTAS ASOCIADAS Y CONEXIÓN CON JUEGOS
  // ==========================================

  async function loadNoteQuestions(noteId) {
    dom.noteQuestionsList.innerHTML = '<div class="muted">Cargando preguntas…</div>';

    try {
      const res = await fetch(`/api/topics/${noteId}/questions`);
      const data = await res.json();
      if (data.success) {
        renderNoteQuestions(data.questions || []);
      } else {
        dom.noteQuestionsList.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem;">No hay preguntas generadas aún.</div>';
      }
    } catch (err) {
      console.error('Error al cargar preguntas de nota:', err);
      dom.noteQuestionsList.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem;">No hay preguntas disponibles.</div>';
    }
  }

  function toggleNoteQuestionsPanel(forceState) {
    if (!dom.noteQuestionsContainer) return;
    const isCurrentlyOpen = dom.noteQuestionsContainer.style.display !== 'none';
    const shouldOpen = forceState !== undefined ? forceState : !isCurrentlyOpen;

    if (shouldOpen) {
      dom.noteQuestionsContainer.style.display = 'block';
      if (dom.bottomQuestionsArrowText) dom.bottomQuestionsArrowText.textContent = '▲ Ocultar sección';
      if (dom.btnToggleNoteQuestions) dom.btnToggleNoteQuestions.classList.add('active');
      dom.noteQuestionsContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      dom.noteQuestionsContainer.style.display = 'none';
      if (dom.bottomQuestionsArrowText) dom.bottomQuestionsArrowText.textContent = '▼ Abrir sección';
      if (dom.btnToggleNoteQuestions) dom.btnToggleNoteQuestions.classList.remove('active');
    }
  }

  function renderNoteQuestions(questions) {
    dom.noteQuestionsList.innerHTML = '';
    const count = questions ? questions.length : 0;

    if (dom.noteQuestionsCountBadge) dom.noteQuestionsCountBadge.textContent = count;
    if (dom.bottomQuestionsCountPill) dom.bottomQuestionsCountPill.textContent = `${count} preguntas guardadas`;

    if (count === 0) {
      dom.noteQuestionsList.innerHTML = `
        <div style="color: var(--text-muted); font-size: 0.85rem; padding: 0.5rem 0;">
          Aún no has generado preguntas para este día. Pulsa <strong>"Generar Preguntas con IA"</strong> para crearlas y poder repasar jugando en Saber y Ganar o el Rosco.
        </div>
      `;
      return;
    }

    questions.slice(0, 8).forEach((q, idx) => {
      const div = document.createElement('div');
      div.className = 'note-question-card';
      div.innerHTML = `
        <div class="nq-question">
          ${idx + 1}. ${escapeHtml(q.question)}
        </div>
        <div style="font-size: 0.85rem; color: var(--green-correct);">
          ✓ Respuesta correcta: <strong>${escapeHtml(q.options[q.correctAnswer] || q.correctAnswer)}</strong>
        </div>
        <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">
          💡 ${escapeHtml(q.explanation || '')}
        </div>
      `;
      dom.noteQuestionsList.appendChild(div);
    });

    if (questions.length > 8) {
      const more = document.createElement('div');
      more.style.fontSize = '0.8rem';
      more.style.color = 'var(--gold-primary)';
      more.style.marginTop = '6px';
      more.textContent = `+ ${questions.length - 8} preguntas adicionales guardadas para el concurso.`;
      dom.noteQuestionsList.appendChild(more);
    }
  }

  async function generateQuestionsForActiveNote() {
    if (!notesState.activeNoteId) {
      showToastNotification('Abre primero un apunte para generar preguntas.', 'warning');
      return;
    }
    const note = notesState.notes.find(n => n.id === notesState.activeNoteId);
    if (!note) return;

    const btn = dom.btnSidebarGenerateQuestions || dom.btnGenerateQuestionsFromNote;
    const originalText = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span><span class="hide-narrow">Generando…</span>';
    }

    try {
      await saveActiveNoteNow();

      const res = await fetch(`/api/notes/${note.id}/generate-questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 8 })
      });
      const data = await res.json();
      if (data.success) {
        showToastNotification(data.message, 'success');
        await fetchNotes();
        const updated = notesState.notes.find(n => n.id === note.id);
        if (dom.sidebarQuestionsCount && updated) {
          dom.sidebarQuestionsCount.textContent = updated.questionsCount || 0;
        }
        if (typeof window.refreshGameTopics === 'function') {
          window.refreshGameTopics();
        }
      } else {
        showToastNotification(data.error || 'No se pudieron generar preguntas.', data.offline ? 'warning' : 'error', 6000);
      }
    } catch (err) {
      console.error('Error generando preguntas:', err);
      showToastNotification('Ocurrió un error al generar preguntas.', 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    }
  }

  async function launchGameWithActiveNote(mode = 'game') {
    if (!notesState.activeNoteId) return;
    const note = notesState.notes.find(n => n.id === notesState.activeNoteId);
    if (!note) return;

    switchToTab('game');

    if (typeof window.playWithTopicId === 'function') {
      window.playWithTopicId(note.id, mode);
    }
  }

  // ==========================================
  // SELECTOR DE EMOJIS
  // ==========================================

  function initEmojiPicker() {
    dom.emojiGrid.innerHTML = '';
    EMOJI_PALETTE.forEach(emoji => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'emoji-btn';
      btn.textContent = emoji;
      btn.addEventListener('click', () => {
        dom.noteIconBtn.textContent = emoji;
        dom.emojiPickerModal.classList.remove('active');
        scheduleAutoSave();
      });
      dom.emojiGrid.appendChild(btn);
    });
  }

  // ==========================================
  // HELPERS DE FECHA
  // ==========================================

  function parseDateDetails(dateStr) {
    if (!dateStr || !dateStr.includes('-')) {
      const now = new Date();
      return {
        year: now.getFullYear(),
        month: MONTHS_LIST[now.getMonth()],
        day: now.getDate(),
        weekday: DAYS_OF_WEEK[now.getDay()]
      };
    }
    const parts = dateStr.split('-');
    const y = parseInt(parts[0], 10) || new Date().getFullYear();
    const mNum = parseInt(parts[1], 10) || 9;
    const d = parseInt(parts[2], 10) || 1;

    const dt = new Date(y, mNum - 1, d);
    const weekday = DAYS_OF_WEEK[dt.getDay()] || 'Día';
    const month = MONTHS_LIST[mNum - 1] || 'Mes';

    return {
      year: y,
      month,
      day: d,
      weekday
    };
  }

  // ==========================================
  // ==========================================
  // CONSULTA E INSERCIÓN DE CITAS BÍBLICAS (TNM / JW.ORG)
  // ==========================================

  let activeScripturePromptData = null;
  let savedEditorSelectionRange = null;

  function saveCurrentEditorSelection() {
    try {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && dom.noteRichEditor && dom.noteRichEditor.contains(sel.anchorNode)) {
        savedEditorSelectionRange = sel.getRangeAt(0).cloneRange();
      } else {
        savedEditorSelectionRange = null;
      }
    } catch (e) {
      savedEditorSelectionRange = null;
    }
  }

  function restoreEditorSelection() {
    try {
      if (savedEditorSelectionRange && dom.noteRichEditor) {
        dom.noteRichEditor.focus({ preventScroll: true });
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(savedEditorSelectionRange);
      } else if (dom.noteRichEditor) {
        dom.noteRichEditor.focus({ preventScroll: true });
      }
    } catch (e) {}
  }

  async function insertScriptureForSelectedText(refStr) {
    if (!dom.noteRichEditor) return;
    const clean = (refStr || '').replace(/^[📖💡•\-\*\s]+/, '').replace(/^Punto Clave:\s*/i, '').trim();
    if (!clean) return;

    // Guardar selección y buscar el bloque contenedor
    const sel = window.getSelection();
    let targetBlock = null;
    let originalRange = null;

    if (sel && sel.rangeCount > 0 && dom.noteRichEditor.contains(sel.anchorNode)) {
      originalRange = sel.getRangeAt(0).cloneRange();
      let node = originalRange.commonAncestorContainer;
      if (node.nodeType === Node.TEXT_NODE) node = node.parentNode;
      while (node && node.parentNode && node.parentNode !== dom.noteRichEditor) {
        node = node.parentNode;
      }
      targetBlock = node;
    }

    // Indicador visual sutil en el botón de Versículo
    const btnScripture = document.querySelector('button[data-format="scripture"]');
    const oldBtnHtml = btnScripture ? btnScripture.innerHTML : '';
    if (btnScripture) {
      btnScripture.innerHTML = '<span class="spinner"></span><span>Buscando…</span>';
    }

    try {
      const res = await fetch(`/api/scripture?ref=${encodeURIComponent(clean)}`);
      const data = await res.json();

      if (btnScripture) {
        btnScripture.innerHTML = oldBtnHtml;
      }

      if (data && data.success && data.text) {
        const scriptureHtml = `<div class="paper-scripture-box"><span class="scripture-icon">📖</span> <span class="paper-scripture-text"><em>"${escapeHtml(data.text)}"</em></span> — <strong>${escapeHtml(data.citation)}</strong></div><p><br></p>`;
        
        const temp = document.createElement('div');
        temp.innerHTML = scriptureHtml;
        const frag = document.createDocumentFragment();
        let scriptureBox = null, nextBlankP = null;
        while (temp.firstChild) {
          const child = temp.firstChild;
          if (child.classList && child.classList.contains('paper-scripture-box')) {
            scriptureBox = child;
          }
          if (child.tagName && child.tagName.toLowerCase() === 'p') {
            nextBlankP = child;
          }
          frag.appendChild(child);
        }

        if (targetBlock && targetBlock.parentNode === dom.noteRichEditor) {
          // Insertar en el párrafo siguiente al bloque donde está la cita
          if (targetBlock.nextSibling) {
            dom.noteRichEditor.insertBefore(frag, targetBlock.nextSibling);
          } else {
            dom.noteRichEditor.appendChild(frag);
          }
        } else if (originalRange) {
          originalRange.collapse(false);
          originalRange.insertNode(frag);
        } else {
          insertHtmlAtCursor(scriptureHtml);
        }

        // Mantener la pantalla EXACTAMENTE en el lugar de la inserción sin ir al final
        if (nextBlankP && sel) {
          const newRange = document.createRange();
          newRange.selectNodeContents(nextBlankP);
          newRange.collapse(false);
          sel.removeAllRanges();
          sel.addRange(newRange);
        }

        dom.noteRichEditor.focus({ preventScroll: true });

        // Asegurar que el elemento insertado esté en vista suavemente sin saltar
        if (scriptureBox && typeof scriptureBox.scrollIntoView === 'function') {
          scriptureBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        if (dom.noteTextarea) {
          dom.noteTextarea.value = richHtmlToMarkdown(dom.noteRichEditor.innerHTML);
        }
        scheduleAutoSave();

        if (window.soundEngine && typeof window.soundEngine.playSuccess === 'function') {
          window.soundEngine.playSuccess();
        }
      } else {
        // Si no se reconoció la cita directamente, abrir el buscador con el texto prellenado
        openScriptureLookupModal(clean);
      }
    } catch (err) {
      if (btnScripture) btnScripture.innerHTML = oldBtnHtml;
      console.warn('Error al buscar versículo para texto seleccionado:', err);
      openScriptureLookupModal(clean);
    }
  }

  async function insertScriptureForSelectedTextMarkdown(query, start, end) {
    const clean = (query || '').replace(/^[📖💡•\-\*\s]+/, '').replace(/^Punto Clave:\s*/i, '').trim();
    if (!clean) return;

    try {
      const res = await fetch(`/api/scripture?ref=${encodeURIComponent(clean)}`);
      const data = await res.json();
      if (data && data.success && data.text) {
        const replacement = `\n> 📖 *"${data.text}"* — **${data.citation}**\n\n`;
        const ta = dom.noteTextarea;
        if (ta) {
          ta.setRangeText(replacement, end, end, 'end');
          ta.focus({ preventScroll: true });
          scheduleAutoSave();
        }
      } else {
        openScriptureLookupModal(clean);
      }
    } catch (e) {
      openScriptureLookupModal(clean);
    }
  }

  function openScriptureLookupModal(initialRef = '') {
    if (!dom.scriptureLookupModal) return;
    saveCurrentEditorSelection();
    if (dom.scriptureLookupInput) {
      dom.scriptureLookupInput.value = initialRef || '';
    }
    if (dom.scriptureLookupPreviewBox) {
      dom.scriptureLookupPreviewBox.style.display = 'none';
    }
    dom.scriptureLookupModal.classList.add('active');
    setTimeout(() => {
      if (dom.scriptureLookupInput) {
        dom.scriptureLookupInput.focus();
        if (initialRef) {
          executeScriptureLookup(initialRef);
        }
      }
    }, 120);
  }

  async function executeScriptureLookup(refVal) {
    const q = (refVal || (dom.scriptureLookupInput ? dom.scriptureLookupInput.value : '')).trim();
    if (!q) return;

    if (dom.scriptureLookupPreviewBox) {
      dom.scriptureLookupPreviewBox.style.display = 'block';
      if (dom.scriptureLookupRefBadge) dom.scriptureLookupRefBadge.textContent = q;
      if (dom.scriptureLookupSourceBadge) dom.scriptureLookupSourceBadge.textContent = 'Consultando…';
      if (dom.scriptureLookupTextPreview) dom.scriptureLookupTextPreview.textContent = 'Buscando el texto en la Traducción del Nuevo Mundo…';
    }

    try {
      const res = await fetch(`/api/scripture?ref=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (data.success && data.text) {
        activeScripturePromptData = data;
        activeScripturePromptData.rawRef = q;
        if (dom.scriptureLookupRefBadge) dom.scriptureLookupRefBadge.textContent = data.citation;
        if (dom.scriptureLookupSourceBadge) dom.scriptureLookupSourceBadge.textContent = data.translation || 'TNM / jw.org';
        if (dom.scriptureLookupTextPreview) dom.scriptureLookupTextPreview.textContent = `"${data.text}"`;
      } else {
        if (dom.scriptureLookupSourceBadge) dom.scriptureLookupSourceBadge.textContent = 'No disponible';
        if (dom.scriptureLookupTextPreview) {
          const msg = String(data.error || 'No se pudo localizar el texto bíblico.').replace(/\s*https?:\/\/\S+$/, '').replace(/:\s*$/, '.');
          dom.scriptureLookupTextPreview.innerHTML = `${escapeHtml(msg)}${data.link ? ` <a href="${escapeHtml(data.link)}" target="_blank" rel="noopener">Abrir ${escapeHtml(data.citation || '')} en jw.org</a>` : ''}`;
        }
      }
    } catch (err) {
      if (dom.scriptureLookupSourceBadge) dom.scriptureLookupSourceBadge.textContent = 'Error';
      if (dom.scriptureLookupTextPreview) dom.scriptureLookupTextPreview.textContent = `Error al conectar con el servidor: ${err.message}`;
    }
  }

  // ==========================================
  // GESTIÓN DE EVENTOS Y ENLACES
  // ==========================================

  function initEventListeners() {
    // Pestañas principales
    dom.btnTabNotion.addEventListener('click', () => switchToTab('notion'));
    dom.btnTabGame.addEventListener('click', () => switchToTab('game'));

    // Botón para colapsar/expandir sidebar (Modo Estudio Ampliado)
    if (dom.btnToggleSidebar) {
      dom.btnToggleSidebar.addEventListener('click', () => {
        notesState.isSidebarCollapsed = !notesState.isSidebarCollapsed;
        dom.notionSection.classList.toggle('sidebar-collapsed', notesState.isSidebarCollapsed);
        dom.btnToggleSidebar.classList.toggle('active', notesState.isSidebarCollapsed);
        dom.btnToggleSidebar.title = notesState.isSidebarCollapsed ? 'Mostrar el menú' : 'Modo concentración (ocultar menú)';
      });
    }

    // Botón de acción principal contextual en el sidebar y en la barra de herramientas del cuaderno
    if (dom.btnSidebarMainAction) {
      dom.btnSidebarMainAction.addEventListener('click', handleMainSidebarActionClick);
    }
    if (dom.btnOpenNewDayModal && dom.btnOpenNewDayModal !== dom.btnSidebarMainAction) {
      dom.btnOpenNewDayModal.addEventListener('click', handleMainSidebarActionClick);
    }
    if (dom.btnToolbarAddEntry) {
      dom.btnToolbarAddEntry.addEventListener('click', handleAddEntryClick);
    }

    // Modal Nuevo Día (Documento Mensual)
    if (dom.btnCloseNewDayModal) dom.btnCloseNewDayModal.addEventListener('click', () => dom.newDayModal.classList.remove('active'));
    if (dom.btnCancelNewDay) dom.btnCancelNewDay.addEventListener('click', () => dom.newDayModal.classList.remove('active'));
    if (dom.newDayForm) dom.newDayForm.addEventListener('submit', handleCreateNewDay);
    if (dom.newDayDateInput) {
      dom.newDayDateInput.addEventListener('input', updateNewDayPreview);
      dom.newDayDateInput.addEventListener('change', updateNewDayPreview);
    }
    if (dom.newDayTitleInput) {
      dom.newDayTitleInput.addEventListener('input', updateNewDayPreview);
    }

    // Modal Nuevo Documento en Carpeta (Base de Datos)
    if (dom.btnCloseFolderDocModal) dom.btnCloseFolderDocModal.addEventListener('click', () => dom.newFolderDocModal.classList.remove('active'));
    if (dom.btnCancelFolderDoc) dom.btnCancelFolderDoc.addEventListener('click', () => dom.newFolderDocModal.classList.remove('active'));
    if (dom.newFolderDocForm) dom.newFolderDocForm.addEventListener('submit', handleCreateFolderDoc);

    // Modal Nuevo Año
    dom.btnOpenNewYearModal.addEventListener('click', () => {
      dom.newYearNumberInput.value = (Math.max(...notesState.availableYears) + 1) || 2027;
      dom.newYearModal.classList.add('active');
    });
    dom.btnCloseNewYearModal.addEventListener('click', () => dom.newYearModal.classList.remove('active'));
    dom.btnCancelNewYear.addEventListener('click', () => dom.newYearModal.classList.remove('active'));
    dom.newYearForm.addEventListener('submit', (e) => {
      e.preventDefault();
      addNewYear(dom.newYearNumberInput.value);
    });

    // Modal de Nueva Categoría o Subcategoría
    if (dom.btnOpenNewCategoryModal) {
      dom.btnOpenNewCategoryModal.addEventListener('click', () => openNewCategoryModal(null));
    }
    if (dom.btnCloseCategoryModal) {
      dom.btnCloseCategoryModal.addEventListener('click', () => {
        if (dom.newCategoryModal) dom.newCategoryModal.classList.remove('active');
      });
    }
    if (dom.btnCancelCategoryModal) {
      dom.btnCancelCategoryModal.addEventListener('click', () => {
        if (dom.newCategoryModal) dom.newCategoryModal.classList.remove('active');
      });
    }
    if (dom.newCategoryTypeSelect) {
      dom.newCategoryTypeSelect.addEventListener('change', (e) => {
        const isSub = e.target.value === 'sub';
        if (dom.parentCategoryWrapper) {
          dom.parentCategoryWrapper.style.display = isSub ? 'block' : 'none';
        }
        if (dom.newCategoryIconInput) {
          dom.newCategoryIconInput.value = isSub ? '📂' : '📁';
        }
      });
    }
    if (dom.newCategoryForm) {
      dom.newCategoryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const type = dom.newCategoryTypeSelect.value;
        const name = dom.newCategoryNameInput.value.trim();
        const icon = dom.newCategoryIconInput.value.trim() || (type === 'sub' ? '📂' : '📁');
        const parentId = type === 'sub' ? dom.parentCategorySelect.value : null;

        if (!name) return;
        await createNewCategory({ name, icon, parentId });
      });
    }

    // Selectores de Caligrafía y Papel
    dom.fontFamilySelector.addEventListener('change', (e) => applyFontFamily(e.target.value));
    dom.paperStyleSelector.addEventListener('change', (e) => applyPaperStyle(e.target.value));
    dom.btnFontInc.addEventListener('mousedown', (e) => e.preventDefault());
    dom.btnFontDec.addEventListener('mousedown', (e) => e.preventDefault());
    dom.btnFontInc.addEventListener('click', () => applyFontSize(notesState.fontSize + 0.1));
    dom.btnFontDec.addEventListener('click', () => applyFontSize(notesState.fontSize - 0.1));

    // Interruptor de Tema (Modo Día / Modo Noche)
    if (dom.btnToggleTheme) {
      dom.btnToggleTheme.addEventListener('click', toggleTheme);
    }

    // Buscador global en cabecera
    if (dom.globalSearchInput) {
      dom.globalSearchInput.addEventListener('focus', openSearchModal);
      dom.globalSearchInput.addEventListener('input', (e) => executeGlobalSearch(e.target.value));
    }
    if (dom.btnSearchClear) {
      dom.btnSearchClear.addEventListener('click', (e) => {
        e.stopPropagation();
        clearSearch();
      });
    }

    // Buscador dentro del modal
    if (dom.modalSearchInput) {
      dom.modalSearchInput.addEventListener('input', (e) => executeGlobalSearch(e.target.value));
    }
    if (dom.btnModalSearchClear) {
      dom.btnModalSearchClear.addEventListener('click', (e) => {
        e.stopPropagation();
        clearSearch();
      });
    }
    if (dom.btnCloseSearch) {
      dom.btnCloseSearch.addEventListener('click', closeSearchModal);
    }

    // Barra flotante de navegación de referencias
    if (dom.btnSearchNavPrev) {
      dom.btnSearchNavPrev.addEventListener('click', () => navigateSearchMatch(-1));
    }
    if (dom.btnSearchNavNext) {
      dom.btnSearchNavNext.addEventListener('click', () => navigateSearchMatch(1));
    }
    if (dom.btnSearchNavReturn) {
      dom.btnSearchNavReturn.addEventListener('click', () => openSearchModal());
    }
    if (dom.btnSearchNavClose) {
      dom.btnSearchNavClose.addEventListener('click', () => hideSearchNavBanner());
    }

    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openSearchModal();
      }
      if (e.key === 'Escape') {
        closeSearchModal();
        if (dom.emojiPickerModal) dom.emojiPickerModal.classList.remove('active');
        if (dom.newDayModal) dom.newDayModal.classList.remove('active');
        if (dom.newFolderDocModal) dom.newFolderDocModal.classList.remove('active');
        if (dom.newYearModal) dom.newYearModal.classList.remove('active');
        if (dom.newCategoryModal) dom.newCategoryModal.classList.remove('active');
        if (dom.geminiKeyPromptModal) dom.geminiKeyPromptModal.classList.remove('active');
        if (dom.scriptureLookupModal) dom.scriptureLookupModal.classList.remove('active');
        document.body.classList.remove('drawer-open');
      }
    });

    // Cerrar modales al pulsar fuera
    [dom.searchModal, dom.newDayModal, dom.newFolderDocModal, dom.newYearModal, dom.newCategoryModal, dom.emojiPickerModal, dom.geminiKeyPromptModal, dom.scriptureLookupModal].filter(Boolean).forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
      });
    });

    // Selector de emoji
    dom.noteIconBtn.addEventListener('click', () => {
      dom.emojiPickerModal.classList.add('active');
    });
    dom.btnCloseEmojiPicker.addEventListener('click', () => {
      dom.emojiPickerModal.classList.remove('active');
    });

    // Inputs de la cabecera interactiva
    dom.noteTitleInput.addEventListener('input', scheduleAutoSave);
    dom.noteDateInput.addEventListener('change', () => {
      const note = notesState.notes.find(n => n.id === notesState.activeNoteId);
      if (note) updateDayHeaderBanner(note);
      scheduleAutoSave();
    });
    dom.noteTagsInput.addEventListener('input', scheduleAutoSave);
    dom.noteTextarea.addEventListener('input', scheduleAutoSave);

    dom.noteCategorySelect.addEventListener('change', () => {
      const cat = dom.noteCategorySelect.value;
      const note = notesState.notes.find(n => n.id === notesState.activeNoteId);
      if (note) {
        note.category = cat;
        updateCategorySelectorsUI(note);
      }
      scheduleAutoSave();
    });

    if (dom.noteSubCategorySelect) dom.noteSubCategorySelect.addEventListener('change', scheduleAutoSave);
    if (dom.noteYearInput) dom.noteYearInput.addEventListener('input', scheduleAutoSave);
    if (dom.noteMonthSelect) dom.noteMonthSelect.addEventListener('change', scheduleAutoSave);

    // Botones de acción del editor
    if (dom.btnDeleteNote) dom.btnDeleteNote.addEventListener('click', deleteCurrentNote);
    if (dom.btnPlayNoteGame) dom.btnPlayNoteGame.addEventListener('click', () => launchGameWithActiveNote('game'));
    if (dom.btnPlayNoteRosco) dom.btnPlayNoteRosco.addEventListener('click', () => launchGameWithActiveNote('rosco'));
    if (dom.btnGenerateQuestionsFromNote) dom.btnGenerateQuestionsFromNote.addEventListener('click', generateQuestionsForActiveNote);

    // Botones del menú lateral para Generar y Ver Preguntas con IA
    if (dom.btnSidebarGenerateQuestions) {
      dom.btnSidebarGenerateQuestions.addEventListener('click', generateQuestionsForActiveNote);
    }
    if (dom.btnSidebarViewQuestions) {
      dom.btnSidebarViewQuestions.addEventListener('click', () => {
        if (!notesState.activeNoteId) {
          showToastNotification('Abre primero un apunte para ver sus preguntas.', 'warning');
          return;
        }
        const note = notesState.notes.find(n => n.id === notesState.activeNoteId);
        if (!note) return;
        if (typeof window.openQuestionsModalForTopic === 'function') {
          window.openQuestionsModalForTopic(note);
        }
      });
    }

    // Botón de IA único de 1 clic (Gemini + Control de Cambios)
    if (dom.btnRunAiAssist) {
      dom.btnRunAiAssist.addEventListener('click', () => runSingleClickAiAssist());
    }

    if (dom.btnApplyAiChanges) {
      dom.btnApplyAiChanges.addEventListener('click', applyAiChanges);
    }
    if (dom.btnDiscardAiChanges) {
      dom.btnDiscardAiChanges.addEventListener('click', discardAiChanges);
    }

    // Modal de prompt de API Key de Gemini
    if (dom.geminiKeyPromptForm) {
      dom.geminiKeyPromptForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const key = (dom.geminiPromptKeyInput ? dom.geminiPromptKeyInput.value : '').trim();
        if (!key) return;

        try {
          const res = await fetch('/api/config/gemini-key', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiKey: key })
          });
          const data = await res.json();
          if (data.success) {
            if (dom.geminiKeyPromptModal) dom.geminiKeyPromptModal.classList.remove('active');
            // Ejecutar de inmediato la mejora con esta nueva clave en 1 clic
            runSingleClickAiAssist(key);
          } else {
            showToastNotification(data.error || 'No se pudo guardar la clave.', 'error');
          }
        } catch (err) {
          showToastNotification('Error al guardar la clave: ' + err.message, 'error');
        }
      });
    }

    if (dom.btnCloseGeminiKeyPrompt) {
      dom.btnCloseGeminiKeyPrompt.addEventListener('click', () => {
        if (dom.geminiKeyPromptModal) dom.geminiKeyPromptModal.classList.remove('active');
      });
    }

    if (dom.btnCancelGeminiPrompt) {
      dom.btnCancelGeminiPrompt.addEventListener('click', () => {
        if (dom.geminiKeyPromptModal) dom.geminiKeyPromptModal.classList.remove('active');
      });
    }

    if (dom.noteRichEditor) {
      dom.noteRichEditor.addEventListener('input', () => {
        if (dom.noteTextarea) {
          dom.noteTextarea.value = richHtmlToMarkdown(dom.noteRichEditor.innerHTML);
        }
        scheduleAutoSave();
      });
    }

    // Botones para Desplegar / Ocultar Preguntas de Repaso con IA bajo demanda
    if (dom.btnToggleNoteQuestions) {
      dom.btnToggleNoteQuestions.addEventListener('click', () => toggleNoteQuestionsPanel());
    }
    if (dom.btnBottomToggleQuestions) {
      dom.btnBottomToggleQuestions.addEventListener('click', () => toggleNoteQuestionsPanel());
    }
    if (dom.btnCloseNoteQuestionsPanel) {
      dom.btnCloseNoteQuestionsPanel.addEventListener('click', () => toggleNoteQuestionsPanel(false));
    }

    // Modal de Consulta e Inserción Bíblica (TNM / jw.org)
    if (dom.btnSearchScriptureLookup) {
      dom.btnSearchScriptureLookup.addEventListener('click', () => executeScriptureLookup());
    }
    if (dom.scriptureLookupInput) {
      dom.scriptureLookupInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          executeScriptureLookup();
        }
      });
    }

    async function handleScriptureModalInsert(e) {
      if (e) e.preventDefault();
      const q = (dom.scriptureLookupInput ? dom.scriptureLookupInput.value : '').trim();
      if (!q) return;

      if (!activeScripturePromptData || !activeScripturePromptData.text || (activeScripturePromptData.rawRef && activeScripturePromptData.rawRef.toLowerCase() !== q.toLowerCase())) {
        await executeScriptureLookup(q);
      }

      if (activeScripturePromptData && activeScripturePromptData.text) {
        const scriptureHtml = `<div class="paper-scripture-box"><span class="scripture-icon">📖</span> <span class="paper-scripture-text"><em>"${escapeHtml(activeScripturePromptData.text)}"</em></span> — <strong>${escapeHtml(activeScripturePromptData.citation)}</strong></div><p><br></p>`;
        restoreEditorSelection();
        insertHtmlAtCursor(scriptureHtml);
        dom.noteRichEditor.focus({ preventScroll: true });

        const boxes = dom.noteRichEditor.querySelectorAll('.paper-scripture-box');
        if (boxes.length > 0) {
          boxes[boxes.length - 1].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        if (dom.noteTextarea) {
          dom.noteTextarea.value = richHtmlToMarkdown(dom.noteRichEditor.innerHTML);
        }
        scheduleAutoSave();
        if (dom.scriptureLookupModal) dom.scriptureLookupModal.classList.remove('active');
        if (window.soundEngine && typeof window.soundEngine.playSuccess === 'function') {
          window.soundEngine.playSuccess();
        }
      }
    }

    if (dom.scriptureLookupForm) {
      dom.scriptureLookupForm.addEventListener('submit', handleScriptureModalInsert);
    }

    const btnSubmitScripture = document.getElementById('btnSubmitScriptureLookup');
    if (btnSubmitScripture) {
      btnSubmitScripture.addEventListener('click', handleScriptureModalInsert);
    }

    if (dom.btnCloseScriptureLookupModal) {
      dom.btnCloseScriptureLookupModal.addEventListener('click', () => {
        if (dom.scriptureLookupModal) dom.scriptureLookupModal.classList.remove('active');
      });
    }
    if (dom.btnCancelScriptureLookup) {
      dom.btnCancelScriptureLookup.addEventListener('click', () => {
        if (dom.scriptureLookupModal) dom.scriptureLookupModal.classList.remove('active');
      });
    }

    if (dom.btnToggleFullscreen) {
      dom.btnToggleFullscreen.addEventListener('click', toggleFullscreen);
    }

    const btnWinMinimize = document.getElementById('btnWinMinimize');
    if (btnWinMinimize) {
      btnWinMinimize.addEventListener('click', () => {
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().then(() => {
            localStorage.setItem('study_auto_fullscreen', 'disabled');
          }).catch(() => {});
        }
      });
    }

    const btnWinClose = document.getElementById('btnWinClose');
    if (btnWinClose) {
      btnWinClose.addEventListener('click', () => {
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().then(() => {
            localStorage.setItem('study_auto_fullscreen', 'disabled');
          }).catch(() => {});
        }
      });
    }

    // Formato
    document.querySelectorAll('[data-format]').forEach(btn => {
      // Evitar perder la selección o el foco al hacer clic en los botones de formato
      btn.addEventListener('mousedown', (e) => e.preventDefault());
      btn.addEventListener('click', () => {
        const fmt = btn.dataset.format;
        applyTextFormat(fmt);
      });
    });

    // Barra de herramientas integrada con botón para minimizar o ampliar
    initToolbarCollapse();
  }

  function initToolbarCollapse() {
    const toolbar = dom.paperToolbar || document.getElementById('paperToolbar');
    const toggleBtn = dom.btnToggleToolbarCollapse || document.getElementById('btnToggleToolbarCollapse');
    if (!toolbar || !toggleBtn) return;

    // Limpiar estilos inline antiguos que hayan quedado de versiones flotantes
    toolbar.style.left = '';
    toolbar.style.right = '';
    toolbar.style.bottom = '';
    toolbar.style.top = '';
    toolbar.style.transform = '';
    try {
      localStorage.removeItem('study_toolbar_sticky_pos');
      localStorage.removeItem('study_toolbar_position');
    } catch (e) {}

    // Restaurar estado minimizado guardado
    const savedCollapsed = localStorage.getItem('study_toolbar_collapsed_v3') !== 'false';
    toolbar.classList.toggle('is-collapsed', savedCollapsed);
    updateToggleUi(savedCollapsed);

    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isNowCollapsed = toolbar.classList.toggle('is-collapsed');
      try {
        localStorage.setItem('study_toolbar_collapsed_v3', isNowCollapsed ? 'true' : 'false');
      } catch (err) {}
      updateToggleUi(isNowCollapsed);
    });

    function updateToggleUi(isCollapsed) {
      const textSpan = toggleBtn.querySelector('.toggle-text');
      const iconSpan = toggleBtn.querySelector('.toggle-icon');
      if (textSpan) textSpan.textContent = isCollapsed ? 'Mostrar' : 'Minimizar';
      if (iconSpan) iconSpan.innerHTML = isCollapsed ? '<svg class="i"><use href="#i-chevron-down"/></svg>' : '<svg class="i"><use href="#i-chevron-up"/></svg>';
      toggleBtn.title = isCollapsed ? 'Mostrar opciones de letra y hoja' : 'Ocultar opciones de letra y hoja';
    }
  }

  function insertHtmlAtCursor(html) {
    const editor = dom.noteRichEditor;
    if (!editor) return;
    editor.focus({ preventScroll: true });
    const sel = window.getSelection();
    let range;
    if (sel && sel.rangeCount > 0 && editor.contains(sel.anchorNode)) {
      range = sel.getRangeAt(0);
    } else {
      range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }

    range.deleteContents();
    const div = document.createElement('div');
    div.innerHTML = html;
    const frag = document.createDocumentFragment();
    let node, lastNode;
    while ((node = div.firstChild)) {
      lastNode = frag.appendChild(node);
    }
    range.insertNode(frag);

    if (lastNode) {
      const nextRange = document.createRange();
      nextRange.setStartAfter(lastNode);
      nextRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(nextRange);
    }
  }

  function applyTextFormat(fmt) {
    if (dom.noteRichEditor && dom.noteRichEditor.offsetParent !== null) {
      dom.noteRichEditor.focus();
      const sel = window.getSelection();
      let selectedText = '';
      if (sel && sel.rangeCount > 0 && dom.noteRichEditor.contains(sel.anchorNode)) {
        selectedText = sel.toString().trim();
      }

      if (fmt === 'normal') {
        try {
          document.execCommand('removeFormat', false, null);
        } catch (e) {}

        let node = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).commonAncestorContainer : null;
        if (node && node.nodeType === Node.TEXT_NODE) node = node.parentNode;

        let specialBlock = null;
        let curr = node;
        while (curr && curr !== dom.noteRichEditor) {
          const tag = (curr.tagName || '').toLowerCase();
          const cl = curr.classList;
          if (['h1', 'h2', 'h3', 'blockquote', 'li', 'ul', 'ol'].includes(tag) ||
              (cl && (cl.contains('paper-scripture-box') || cl.contains('paper-callout-box') || cl.contains('paper-h1') || cl.contains('paper-h2')))) {
            specialBlock = curr;
            if (tag === 'li' && curr.parentNode && curr.parentNode.children.length === 1) {
              specialBlock = curr.parentNode;
            }
            break;
          }
          curr = curr.parentNode;
        }

        if (specialBlock && specialBlock !== dom.noteRichEditor) {
          let clean = specialBlock.innerText || specialBlock.textContent || '';
          clean = clean.replace(/^[📖💡•\-\*\s]+/, '').replace(/^Punto Clave:\s*/i, '').trim();

          const p = document.createElement('p');
          p.textContent = clean || '';
          specialBlock.parentNode.replaceChild(p, specialBlock);

          const newRange = document.createRange();
          newRange.selectNodeContents(p);
          newRange.collapse(false);
          sel.removeAllRanges();
          sel.addRange(newRange);
        } else if (selectedText) {
          let clean = selectedText.replace(/^[📖💡•\-\*\s]+/, '').replace(/^Punto Clave:\s*/i, '').trim();
          insertHtmlAtCursor(`<p>${escapeHtml(clean)}</p>`);
        } else {
          try {
            document.execCommand('formatBlock', false, '<p>');
          } catch (e) {}
        }
      } else if (fmt === 'bold') {
        document.execCommand('bold', false, null);
      } else if (fmt === 'italic') {
        document.execCommand('italic', false, null);
      } else if (fmt === 'h1') {
        const text = selectedText || 'Título Principal';
        insertHtmlAtCursor(`<h1 class="paper-h1">${escapeHtml(text)}</h1><p><br></p>`);
      } else if (fmt === 'h2') {
        const text = selectedText || 'Subtítulo';
        insertHtmlAtCursor(`<h2 class="paper-h2">${escapeHtml(text)}</h2><p><br></p>`);
      } else if (fmt === 'bullet') {
        const text = selectedText || 'Elemento de lista';
        insertHtmlAtCursor(`<ul class="paper-bullet-list"><li>${escapeHtml(text)}</li></ul><p><br></p>`);
      } else if (fmt === 'scripture') {
        const textToSearch = (selectedText || '').trim();
        if (textToSearch) {
          insertScriptureForSelectedText(textToSearch);
          return;
        } else {
          openScriptureLookupModal('');
          return;
        }
      } else if (fmt === 'callout') {
        const text = selectedText || 'Idea o punto clave aquí...';
        insertHtmlAtCursor(`<div class="paper-callout-box">💡 <strong>Punto Clave:</strong> ${escapeHtml(text)}</div><p><br></p>`);
      } else if (fmt === 'quote') {
        const text = selectedText || 'Cita de estudio...';
        insertHtmlAtCursor(`<blockquote>${escapeHtml(text)}</blockquote><p><br></p>`);
      }

      if (dom.noteTextarea) {
        dom.noteTextarea.value = richHtmlToMarkdown(dom.noteRichEditor.innerHTML);
      }
      scheduleAutoSave();
      return;
    }

    const ta = dom.noteTextarea;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const sel = ta.value.substring(start, end) || 'texto';

    let replacement = '';
    if (fmt === 'normal') {
      replacement = sel
        .replace(/^[#>\s\-*•]+\s*/gm, '')
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/^[📖💡\s]+/gm, '')
        .replace(/^Punto Clave:\s*/gm, '');
    }
    else if (fmt === 'bold') replacement = `**${sel}**`;
    else if (fmt === 'italic') replacement = `*${sel}*`;
    else if (fmt === 'h1') replacement = `\n# ${sel}\n`;
    else if (fmt === 'h2') replacement = `\n## ${sel}\n`;
    else if (fmt === 'quote') replacement = `\n> ${sel}\n`;
    else if (fmt === 'bullet') replacement = `\n- ${sel}\n`;
    else if (fmt === 'callout') replacement = `\n> 💡 **Punto Clave:** ${sel}\n`;
    else if (fmt === 'scripture') {
      const textToSearch = (sel !== 'texto' ? sel : '').trim();
      if (textToSearch) {
        insertScriptureForSelectedTextMarkdown(textToSearch, start, end);
        return;
      } else {
        openScriptureLookupModal('');
        return;
      }
    }

    ta.setRangeText(replacement, start, end, 'end');
    ta.focus();
    scheduleAutoSave();
  }

  function switchToTab(tab) {
    notesState.activeTab = tab;
    document.body.classList.remove('drawer-open');
    window.scrollTo({ top: 0 });
    if (tab === 'notion') {
      dom.btnTabNotion.classList.add('active');
      dom.btnTabGame.classList.remove('active');
      dom.notionSection.style.display = 'grid';
      dom.gameSection.style.display = 'none';
      if (dom.paperToolbar) {
        dom.paperToolbar.style.display = notesState.activeNoteId ? 'flex' : 'none';
      }
    } else {
      dom.btnTabNotion.classList.remove('active');
      dom.btnTabGame.classList.add('active');
      dom.notionSection.style.display = 'none';
      dom.gameSection.style.display = 'block';
      if (dom.paperToolbar) {
        dom.paperToolbar.style.display = 'none';
      }

      if (typeof window.refreshGameTopics === 'function') {
        window.refreshGameTopics();
      }
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Exponer API global
  window.switchToTab = switchToTab;
  window.NotionNotes = {
    selectNote,
    fetchNotes,
    switchToTab,
    openSearchModal,
    openNewDayPrompt
  };

})();
