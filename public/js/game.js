// Lógica Principal de "Saber y Ganar" para Estudio Personal
(function () {
  const state = {
    topics: [],
    selectedTopicIds: [],
    questions: [],
    currentIndex: 0,
    score: 0,
    targetScore: 100,
    pointsPerQuestion: 5,
    streak: 0,
    correctCount: 0,
    wrongCount: 0,
    hasAnswered: false,
    config: {
      hasApiKey: false,
      maskedKey: '',
      targetScore: 100
    }
  };

  const views = {
    lobby: document.getElementById('lobbyView'),
    game: document.getElementById('gameView'),
    victory: document.getElementById('victoryView'),
    rosco: document.getElementById('roscoView'),
    roscoResult: document.getElementById('roscoResultView'),
    reyes: document.getElementById('reyesView')
  };

  const elements = {
    topicsGrid: document.getElementById('topicsGrid'),
    selectedCountBadge: document.getElementById('selectedCountBadge'),
    btnStartGame: document.getElementById('btnStartGame'),
    btnSyncApuntes: document.getElementById('btnSyncApuntes'),
    uploadArea: document.getElementById('uploadArea'),
    fileInput: document.getElementById('fileInput'),
    uploadStatus: document.getElementById('uploadStatus'),
    currentScoreVal: document.getElementById('currentScoreVal'),
    targetScoreVal: document.getElementById('targetScoreVal'),
    progressBarInner: document.getElementById('progressBarInner'),
    progressText: document.getElementById('progressText'),
    streakVal: document.getElementById('streakVal'),
    questionTopicTag: document.getElementById('questionTopicTag'),
    questionText: document.getElementById('questionText'),
    optionsGrid: document.getElementById('optionsGrid'),
    explanationPanel: document.getElementById('explanationPanel'),
    explanationText: document.getElementById('explanationText'),
    btnNextQuestion: document.getElementById('btnNextQuestion'),
    btnExitGame: document.getElementById('btnExitGame'),
    finalScoreVal: document.getElementById('finalScoreVal'),
    finalAccuracyVal: document.getElementById('finalAccuracyVal'),
    finalTopicsVal: document.getElementById('finalTopicsVal'),
    btnPlayAgain: document.getElementById('btnPlayAgain'),
    btnBackToLobby: document.getElementById('btnBackToLobby'),
    btnStartRosco: document.getElementById('btnStartRosco'),
    btnToggleSound: document.getElementById('btnToggleSound'),
    btnOpenConfig: document.getElementById('btnOpenConfig'),
    configModal: document.getElementById('configModal'),
    btnCloseConfig: document.getElementById('btnCloseConfig'),
    configForm: document.getElementById('configForm'),
    apiKeyInput: document.getElementById('apiKeyInput'),
    targetScoreInput: document.getElementById('targetScoreInput'),
    questionsModal: document.getElementById('questionsModal'),
    btnCloseQuestions: document.getElementById('btnCloseQuestions'),
    questionsModalTitle: document.getElementById('questionsModalTitle'),
    questionsModalList: document.getElementById('questionsModalList'),
    btnSubTabQuiz: document.getElementById('btnSubTabQuiz'),
    btnSubTabReyes: document.getElementById('btnSubTabReyes'),
    btnOpenReyesFeatured: document.getElementById('btnOpenReyesFeatured'),
    btnBackFromReyes: document.getElementById('btnBackFromReyes'),
    btnReloadReyes: document.getElementById('btnReloadReyes'),
    btnOpenReyesNewTab: document.getElementById('btnOpenReyesNewTab'),
    reyesIframe: document.getElementById('reyesIframe'),
    btnVictoryToReyes: document.getElementById('btnVictoryToReyes'),
    btnRoscoToReyes: document.getElementById('btnRoscoToReyes')
  };

  window.addEventListener('DOMContentLoaded', async () => {
    setupEventListeners();
    await loadConfig();
    await loadTopics();
  });

  function setupEventListeners() {
    elements.btnToggleSound.addEventListener('click', () => {
      const isMuted = soundEngine.toggleMute();
      elements.btnToggleSound.classList.toggle('active', !isMuted);
      elements.btnToggleSound.innerHTML = isMuted 
        ? '<svg class="i"><use href="#i-volume-x"/></svg>'
        : '<svg class="i"><use href="#i-volume"/></svg>';
      elements.btnToggleSound.title = isMuted ? 'Activar música y efectos' : 'Silenciar música y efectos';
    });

    elements.uploadArea.addEventListener('click', () => elements.fileInput.click());
    elements.fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleFileUpload(e.target.files[0]);
      }
    });

    ['dragenter', 'dragover'].forEach(name => {
      elements.uploadArea.addEventListener(name, (e) => {
        e.preventDefault();
        elements.uploadArea.classList.add('dragover');
      });
    });
    ['dragleave', 'drop'].forEach(name => {
      elements.uploadArea.addEventListener(name, (e) => {
        e.preventDefault();
        elements.uploadArea.classList.remove('dragover');
      });
    });
    elements.uploadArea.addEventListener('drop', (e) => {
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFileUpload(e.dataTransfer.files[0]);
      }
    });

    elements.btnStartGame.addEventListener('click', startGame);
    elements.btnNextQuestion.addEventListener('click', advanceToNextQuestion);

    if (elements.btnSyncApuntes) {
      elements.btnSyncApuntes.addEventListener('click', handleSyncApuntes);
    }

    elements.btnExitGame.addEventListener('click', () => {
      if (confirm('¿Seguro que quieres salir de la partida actual?')) {
        soundEngine.stopBackgroundMusic();
        showView('lobby');
      }
    });

    elements.btnPlayAgain.addEventListener('click', startGame);
    elements.btnBackToLobby.addEventListener('click', () => {
      stopConfetti();
      showView('lobby');
    });

    // Enlace a la Ruleta de la A a la Z
    elements.btnStartRosco.addEventListener('click', () => {
      if (window.RoscoManager) {
        window.RoscoManager.startRoscoGame(state.selectedTopicIds);
      }
    });

    // Modales
    elements.btnOpenConfig.addEventListener('click', () => {
      elements.apiKeyInput.value = '';
      elements.targetScoreInput.value = state.targetScore;
      elements.configModal.classList.add('active');
    });
    elements.btnCloseConfig.addEventListener('click', () => {
      elements.configModal.classList.remove('active');
    });
    elements.configForm.addEventListener('submit', handleSaveConfig);

    elements.btnCloseQuestions.addEventListener('click', () => {
      elements.questionsModal.classList.remove('active');
    });

    // Sub-navegación Concurso vs Reyes y Profetas
    if (elements.btnSubTabQuiz) {
      elements.btnSubTabQuiz.addEventListener('click', () => showView('lobby'));
    }
    if (elements.btnSubTabReyes) {
      elements.btnSubTabReyes.addEventListener('click', () => showView('reyes'));
    }
    if (elements.btnOpenReyesFeatured) {
      elements.btnOpenReyesFeatured.addEventListener('click', () => showView('reyes'));
    }
    if (elements.btnBackFromReyes) {
      elements.btnBackFromReyes.addEventListener('click', () => showView('lobby'));
    }
    if (elements.btnReloadReyes) {
      elements.btnReloadReyes.addEventListener('click', () => {
        if (elements.reyesIframe) {
          elements.reyesIframe.src = 'reyes-memorizador/index.html?t=' + Date.now();
        }
      });
    }
    if (elements.btnOpenReyesNewTab) {
      elements.btnOpenReyesNewTab.addEventListener('click', () => {
        window.open('reyes-memorizador/index.html', '_blank');
      });
    }
    if (elements.btnVictoryToReyes) {
      elements.btnVictoryToReyes.addEventListener('click', () => {
        if (typeof stopConfetti === 'function') stopConfetti();
        showView('reyes');
      });
    }
    if (elements.btnRoscoToReyes) {
      elements.btnRoscoToReyes.addEventListener('click', () => {
        showView('reyes');
      });
    }
  }

  function showView(viewName) {
    const gameSec = document.getElementById('gameSection');
    if (gameSec) {
      if (viewName === 'reyes') {
        gameSec.classList.add('reyes-mode-active');
      } else {
        gameSec.classList.remove('reyes-mode-active');
      }
    }

    if (elements.btnSubTabQuiz && elements.btnSubTabReyes) {
      if (viewName === 'reyes') {
        elements.btnSubTabQuiz.classList.remove('active');
        elements.btnSubTabReyes.classList.add('active');
      } else {
        elements.btnSubTabQuiz.classList.add('active');
        elements.btnSubTabReyes.classList.remove('active');
      }
    }

    Object.keys(views).forEach(k => {
      if (views[k]) {
        views[k].style.display = (k === viewName) ? (k === 'reyes' ? 'flex' : 'block') : 'none';
      }
    });

    if (viewName === 'reyes' && elements.reyesIframe) {
      const currentSrc = elements.reyesIframe.getAttribute('src');
      if (!currentSrc || currentSrc === 'about:blank' || !currentSrc.includes('reyes-memorizador/')) {
        elements.reyesIframe.src = 'reyes-memorizador/index.html';
      }
    }
  }

  async function loadConfig() {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      if (data.success) {
        state.config = data;
        state.targetScore = data.targetScore || 100;
        state.pointsPerQuestion = data.pointsPerQuestion || 5;
        elements.targetScoreVal.textContent = state.targetScore;
      }
    } catch (e) {
      console.warn('Error al cargar config:', e);
    }
  }

  async function handleSaveConfig(e) {
    e.preventDefault();
    const apiKey = elements.apiKeyInput.value.trim();
    const targetScore = parseInt(elements.targetScoreInput.value, 10) || 100;

    const payload = { targetScore };
    if (apiKey) payload.geminiApiKey = apiKey;

    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        state.targetScore = data.targetScore;
        elements.targetScoreVal.textContent = state.targetScore;
        elements.configModal.classList.remove('active');
        (window.showAppToast || window.alert)('Ajustes guardados.', 'success');
      } else {
        elements.configModal.classList.remove('active');
        (window.showAppToast || window.alert)(data.error || 'No se pudieron guardar los ajustes.', data.offline ? 'warning' : 'error');
      }
    } catch (err) {
      (window.showAppToast || window.alert)('Error al guardar los ajustes: ' + err.message, 'error');
    }
  }

  async function loadTopics() {
    try {
      const res = await fetch('/api/topics');
      const data = await res.json();
      if (data.success) {
        state.topics = data.topics || [];
        renderTopicsGrid();
      }
    } catch (err) {
      console.error('Error al cargar temas:', err);
    }
  }

  function renderTopicsGrid() {
    elements.topicsGrid.innerHTML = '';

    if (state.topics.length === 0) {
      elements.topicsGrid.innerHTML = `
        <div class="empty-hint" style="grid-column: 1 / -1;">
          <p><strong>Aún no tienes temas de apuntes.</strong></p>
          <p>Sube tu primer documento (.txt, .md, .docx, .pdf) arriba o copia tus archivos en la carpeta <strong>Personal Study/apuntes</strong>.</p>
        </div>
      `;
      updateSelectionUI();
      return;
    }

    state.topics.forEach(topic => {
      const isSelected = state.selectedTopicIds.includes(topic.id);
      const card = document.createElement('div');
      card.className = `topic-card ${isSelected ? 'selected' : ''}`;
      card.dataset.id = topic.id;

      const topicIcon = topic.icon || (topic.isNote ? '📝' : '📚');
      let subInfo = '';
      if (topic.isNote) {
        const catName = topic.category === 'daily_text' ? 'Texto Diario' : topic.category === 'events' ? 'Evento' : 'Espiritual';
        subInfo = `${topic.date || ''} · ${catName}`;
      } else {
        subInfo = `Archivo: ${escapeHtml(topic.fileName || '')}`;
      }

      card.innerHTML = `
        <div>
          <div class="topic-card-header">
            <span class="topic-icon">${topicIcon}</span>
            <div class="topic-check">${isSelected ? '<svg class="i"><use href="#i-check"/></svg>' : ''}</div>
          </div>
          <div class="topic-title">${escapeHtml(topic.title)}</div>
          <div class="topic-sub">
            ${subInfo}
          </div>
        </div>
        <div>
          <div class="topic-meta">
            <span class="topic-badge-questions">${topic.questionsCount || 0} preguntas</span>
            <div class="topic-actions">
              <button class="btn-small btn-open-note" title="Abrir el apunte">Abrir</button>
              <button class="btn-small btn-view-questions" title="Ver preguntas guardadas en la base de datos">Ver</button>
              <button class="btn-small btn-generate-more" title="Generar más preguntas con IA">+ IA</button>
            </div>
          </div>
        </div>
      `;

      card.addEventListener('click', (e) => {
        if (e.target.closest('.topic-actions')) return;
        soundEngine.playClick();
        toggleTopicSelection(topic.id);
      });

      card.addEventListener('dblclick', () => {
        if (typeof window.openNoteFromExternal === 'function') {
          window.openNoteFromExternal(topic.id);
        }
      });

      const btnOpen = card.querySelector('.btn-open-note');
      if (btnOpen) {
        btnOpen.addEventListener('click', (e) => {
          e.stopPropagation();
          if (typeof window.openNoteFromExternal === 'function') {
            window.openNoteFromExternal(topic.id);
          }
        });
      }

      const btnView = card.querySelector('.btn-view-questions');
      btnView.addEventListener('click', (e) => {
        e.stopPropagation();
        openQuestionsModal(topic);
      });

      const btnGen = card.querySelector('.btn-generate-more');
      btnGen.addEventListener('click', (e) => {
        e.stopPropagation();
        handleGenerateMore(topic, btnGen);
      });

      elements.topicsGrid.appendChild(card);
    });

    updateSelectionUI();
  }

  function toggleTopicSelection(topicId) {
    const idx = state.selectedTopicIds.indexOf(topicId);
    if (idx !== -1) {
      state.selectedTopicIds.splice(idx, 1);
    } else {
      if (state.selectedTopicIds.length >= 5) {
        (window.showAppToast || window.alert)('Puedes elegir un máximo de 5 temas por partida.', 'warning');
        return;
      }
      state.selectedTopicIds.push(topicId);
    }
    renderTopicsGrid();
  }

  function updateSelectionUI() {
    const count = state.selectedTopicIds.length;
    elements.selectedCountBadge.textContent = `${count} / 5`;
    elements.btnStartGame.disabled = count === 0;
  }

  async function handleSyncApuntes() {
    const btn = elements.btnSyncApuntes;
    const origText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span><span>Buscando…</span>';

    try {
      const res = await fetch('/api/topics/sync', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        state.topics = data.topics || [];
        renderTopicsGrid();
        if (data.discoveredCount > 0 || data.generatedCount > 0) {
          (window.showAppToast || window.alert)(`${data.discoveredCount} temas nuevos y ${data.generatedCount} preguntas nuevas.`, 'success');
        } else {
          (window.showAppToast || window.alert)(`Todo al día: ${state.topics.length} temas disponibles.`, 'success');
        }
      } else {
        (window.showAppToast || window.alert)(data.error || 'No se pudo completar la búsqueda.', data.offline ? 'warning' : 'error', 6000);
      }
    } catch (e) {
      (window.showAppToast || window.alert)('Error de conexión: ' + e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = origText;
    }
  }

  async function handleFileUpload(file) {
    const formData = new FormData();
    formData.append('document', file);
    formData.append('count', 20);

    elements.uploadStatus.style.display = 'block';
    elements.uploadStatus.innerHTML = `
      <div class="status-box status-info"><span class="spinner"></span> Analizando documento "<strong>${escapeHtml(file.name)}</strong>" y generando preguntas con IA...
      </div>
    `;

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error al procesar archivo');

      elements.uploadStatus.innerHTML = `
        <div class="status-box status-success">Tema añadido. Se han guardado <strong>${data.questionsCount} preguntas</strong> en la base de datos.
        </div>
      `;

      if (data.topic && state.selectedTopicIds.length < 5) {
        state.selectedTopicIds.push(data.topic.id);
      }

      await loadTopics();

      setTimeout(() => {
        elements.uploadStatus.style.display = 'none';
      }, 4000);
    } catch (err) {
      elements.uploadStatus.innerHTML = `
        <div class="status-box status-error">Error: ${escapeHtml(err.message)}
        </div>
      `;
    } finally {
      elements.fileInput.value = '';
    }
  }

  async function handleGenerateMore(topic, buttonEl) {
    const originalText = buttonEl.textContent;
    buttonEl.disabled = true;
    buttonEl.textContent = '...';

    try {
      const res = await fetch(`/api/topics/${topic.id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 8 })
      });
      const data = await res.json();
      if (data.success) {
        (window.showAppToast || window.alert)(data.message, 'success');
        await loadTopics();
      } else {
        (window.showAppToast || window.alert)(data.error || 'Error', data.offline ? 'warning' : 'error', 6000);
      }
    } catch (err) {
      (window.showAppToast || window.alert)('Error de conexión: ' + err.message, 'error');
    } finally {
      buttonEl.disabled = false;
      buttonEl.textContent = originalText;
    }
  }

  async function openQuestionsModal(topic) {
    elements.questionsModalTitle.textContent = `Banco de Preguntas: ${topic.title}`;
    elements.questionsModalList.innerHTML = '<p class="muted">Cargando preguntas…</p>';
    elements.questionsModal.classList.add('active');

    try {
      const res = await fetch(`/api/topics/${topic.id}/questions`);
      const data = await res.json();
      if (!data.success || !data.questions || data.questions.length === 0) {
        elements.questionsModalList.innerHTML = `<p class="muted">Todavía no hay preguntas para este tema.</p>`;
        return;
      }

      elements.questionsModalList.innerHTML = data.questions.map((q, i) => `
        <div class="qcard">
          <div class="qcard-q">${i + 1}. ${escapeHtml(q.question)}</div>
          <div class="qcard-options">
            ${['A', 'B', 'C', 'D'].map(L => `<div class="qcard-opt ${q.correctAnswer === L ? 'is-correct' : ''}"><span>${L}</span>${escapeHtml(q.options[L] || '')}</div>`).join('')}
          </div>
          ${q.explanation ? `<div class="qcard-exp">${escapeHtml(q.explanation)}</div>` : ''}
        </div>
      `).join('');
    } catch (err) {
      elements.questionsModalList.innerHTML = `<p class="text-danger">Error al cargar preguntas: ${escapeHtml(err.message)}</p>`;
    }
  }

  async function startGame() {
    if (state.selectedTopicIds.length === 0) {
      (window.showAppToast || window.alert)('Selecciona de 1 a 5 temas para empezar.', 'warning');
      return;
    }

    elements.btnStartGame.disabled = true;
    elements.btnStartGame.innerHTML = '<span class="spinner"></span><span>Preparando…</span>';

    try {
      const res = await fetch('/api/game/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicIds: state.selectedTopicIds })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'No se pudo iniciar la partida');

      state.questions = data.questions || [];
      state.currentIndex = 0;
      state.score = 0;
      state.streak = 0;
      state.correctCount = 0;
      state.wrongCount = 0;
      state.hasAnswered = false;
      state.targetScore = data.config.targetScore || 100;
      state.pointsPerQuestion = data.config.pointsPerQuestion || 5;

      soundEngine.startBackgroundMusic();
      showView('game');
      updateScoreboardUI();
      renderCurrentQuestion();
    } catch (err) {
      (window.showAppToast || window.alert)('No se pudo empezar: ' + err.message, 'error', 6000);
    } finally {
      elements.btnStartGame.disabled = false;
      elements.btnStartGame.innerHTML = '<svg class="i"><use href="#i-play"/></svg><span>Empezar</span>';
    }
  }

  function renderCurrentQuestion() {
    if (state.currentIndex >= state.questions.length) {
      shuffleArray(state.questions);
      state.currentIndex = 0;
    }

    const q = state.questions[state.currentIndex];
    state.hasAnswered = false;

    elements.questionTopicTag.textContent = q.topicTitle || 'General';
    elements.questionText.textContent = q.question;
    elements.explanationPanel.style.display = 'none';
    elements.btnNextQuestion.style.display = 'none';

    elements.optionsGrid.innerHTML = '';
    const letters = ['A', 'B', 'C', 'D'];

    letters.forEach(letter => {
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.dataset.letter = letter;

      btn.innerHTML = `
        <span class="option-letter">${letter}</span>
        <span class="option-content">${escapeHtml(q.options[letter] || '')}</span>
      `;

      btn.addEventListener('click', () => handleOptionClick(letter, btn));
      elements.optionsGrid.appendChild(btn);
    });
  }

  function handleOptionClick(selectedLetter, clickedBtn) {
    if (state.hasAnswered) return;
    state.hasAnswered = true;

    const currentQ = state.questions[state.currentIndex];
    const isCorrect = selectedLetter === currentQ.correctAnswer;

    const allButtons = elements.optionsGrid.querySelectorAll('.option-btn');
    allButtons.forEach(btn => {
      btn.disabled = true;
      const letter = btn.dataset.letter;
      if (letter === currentQ.correctAnswer) {
        btn.classList.add('correct');
      } else if (letter === selectedLetter && !isCorrect) {
        btn.classList.add('wrong');
      }
    });

    if (isCorrect) {
      soundEngine.playCorrect();
      state.streak += 1;
      state.correctCount += 1;
      state.score += state.pointsPerQuestion;
    } else {
      soundEngine.playWrong();
      state.streak = 0;
      state.wrongCount += 1;
    }

    fetch('/api/game/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: currentQ.id, isCorrect })
    }).catch(e => console.warn('Error al registrar respuesta:', e));

    elements.explanationText.innerHTML = `
      <strong>${isCorrect ? '¡CORRECTO!' : 'RESPUESTA INCORRECTA (Era la opción ' + currentQ.correctAnswer + '):'}</strong><br>
      ${escapeHtml(currentQ.explanation)}
    `;
    elements.explanationPanel.style.display = 'block';

    updateScoreboardUI();

    if (state.score >= state.targetScore) {
      setTimeout(() => {
        triggerVictory();
      }, 1500);
    } else {
      elements.btnNextQuestion.style.display = 'inline-flex';
    }
  }

  function advanceToNextQuestion() {
    soundEngine.playClick();
    state.currentIndex += 1;
    renderCurrentQuestion();
  }

  function updateScoreboardUI() {
    elements.currentScoreVal.textContent = state.score;
    elements.targetScoreVal.textContent = state.targetScore;
    elements.streakVal.textContent = state.streak;

    const pct = Math.min(100, Math.round((state.score / state.targetScore) * 100));
    elements.progressBarInner.style.width = `${pct}%`;
    elements.progressText.textContent = `${pct}% hacia la meta`;
  }

  function triggerVictory() {
    soundEngine.stopBackgroundMusic();
    soundEngine.playVictory();

    const totalQuestions = state.correctCount + state.wrongCount;
    elements.finalScoreVal.textContent = state.score;
    const accuracy = totalQuestions > 0 ? Math.round((state.correctCount / totalQuestions) * 100) : 100;
    elements.finalAccuracyVal.textContent = `${accuracy}%`;
    elements.finalTopicsVal.textContent = state.selectedTopicIds.length;

    showView('victory');
    startConfetti();
  }

  let confettiAnimId = null;
  function startConfetti() {
    const canvas = document.getElementById('confettiCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const pieces = [];
    const colors = ['#f6c026', '#38bdf8', '#10b981', '#f43f5e', '#a855f7', '#ffffff'];

    for (let i = 0; i < 150; i++) {
      pieces.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        speedY: Math.random() * 3 + 2,
        speedX: (Math.random() - 0.5) * 2,
        rot: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 4
      });
    }

    function render() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pieces.forEach(p => {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();

        p.y += p.speedY;
        p.x += p.speedX;
        p.rot += p.rotSpeed;

        if (p.y > canvas.height) {
          p.y = -10;
          p.x = Math.random() * canvas.width;
        }
      });
      confettiAnimId = requestAnimationFrame(render);
    }
    render();
  }

  function stopConfetti() {
    if (confettiAnimId) {
      cancelAnimationFrame(confettiAnimId);
      confettiAnimId = null;
    }
    const canvas = document.getElementById('confettiCanvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  window.startConfetti = startConfetti;
  window.stopConfetti = stopConfetti;
  window.refreshGameTopics = loadTopics;
  window.playWithTopicId = async function(topicId, mode = 'game') {
    await loadTopics();
    state.selectedTopicIds = [topicId];
    updateSelectionUI();
    if (mode === 'rosco') {
      elements.btnStartRosco.click();
    } else {
      startGame();
    }
  };

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  // Exponer para abrir el banco de preguntas desde el menú del cuaderno
  window.openQuestionsModalForTopic = openQuestionsModal;

  // Exponer para abrir el Memorizador de Reyes directamente desde cualquier parte de la app
  window.openReyesMemorizador = function () {
    if (typeof window.switchToTab === 'function') {
      window.switchToTab('game');
    } else {
      const btn = document.getElementById('btnTabGame');
      if (btn) btn.click();
    }
    showView('reyes');
  };
})();
