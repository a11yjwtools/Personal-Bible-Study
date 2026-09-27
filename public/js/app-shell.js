// ==========================================================================
// ESTUDIO PERSONAL — Interfaz general: avisos, menú móvil, pastilla de
// sincronización y ajustes de GitHub.
// ==========================================================================
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const icon = (name) => `<svg class="i"><use href="#i-${name}"/></svg>`;

  // ------------------------------------------------------------------
  // Avisos (toasts)
  // ------------------------------------------------------------------
  const TOAST_ICONS = { info: 'cloud', success: 'check', warning: 'alert', error: 'alert' };
  window.showAppToast = function (message, type = 'info', durationMs = 4500) {
    const stack = $('toastStack');
    if (!stack || !message) return;
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    el.innerHTML = `${icon(TOAST_ICONS[type] || 'cloud')}<span></span>`;
    el.querySelector('span').textContent = String(message).replace(/^[\u{1F300}-\u{1FAFF}☀-➿️\s]+/u, '');
    stack.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 250);
    }, durationMs);
  };

  // ------------------------------------------------------------------
  // Menú lateral en móvil
  // ------------------------------------------------------------------
  function closeDrawer() { document.body.classList.remove('drawer-open'); }
  function toggleDrawer() { document.body.classList.toggle('drawer-open'); }

  document.addEventListener('DOMContentLoaded', () => {
    const btnMenu = $('btnMobileMenu');
    if (btnMenu) btnMenu.addEventListener('click', () => {
      if (window.switchToTab && $('notionSection').style.display === 'none') window.switchToTab('notion');
      toggleDrawer();
    });
    const backdrop = $('sidebarBackdrop');
    if (backdrop) backdrop.addEventListener('click', closeDrawer);

    // Al abrir un apunte o un día desde el menú en móvil, cerrar el menú
    const sidebar = $('notionSidebar');
    if (sidebar) {
      sidebar.addEventListener('click', (e) => {
        if (window.matchMedia('(max-width: 900px)').matches &&
          e.target.closest('.note-list-item, .day-index-card, .tree-leaf-item')) {
          setTimeout(closeDrawer, 120);
        }
      });
    }

    const btnMobileSearch = $('btnMobileSearch');
    if (btnMobileSearch) btnMobileSearch.addEventListener('click', () => {
      if (window.NotionNotes && window.NotionNotes.openSearchModal) window.NotionNotes.openSearchModal();
    });

    // Mostrar controles solo en la sección que corresponde
    const observer = new MutationObserver(() => {
      const inGame = $('gameSection') && $('gameSection').style.display !== 'none';
      document.body.classList.toggle('in-game', !!inGame);
    });
    if ($('gameSection')) observer.observe($('gameSection'), { attributes: true, attributeFilter: ['style'] });

    // ----------------------------------------------------------------
    // Pastilla de sincronización
    // ----------------------------------------------------------------
    const pill = $('syncStatusPill');
    if (pill) pill.addEventListener('click', () => {
      const st = window.EP ? window.EP.status() : null;
      if (!st) return;
      if (st.status === 'auth' || st.status === 'noserver') { window.EP.showSetup(); return; }
      if (st.status === 'error' && st.detail) window.showAppToast(st.detail, 'error', 6000);
      window.EP.syncNow();
      window.showAppToast(st.pending
        ? `Subiendo ${st.pending} cambio${st.pending === 1 ? '' : 's'} a GitHub…`
        : 'Comprobando cambios en GitHub…', 'info', 2500);
    });

    // ----------------------------------------------------------------
    // Ajustes: sección de GitHub
    // ----------------------------------------------------------------
    const closeConfig = () => { const m = $('configModal'); if (m) m.classList.remove('active'); };

    const btnSyncNow = $('btnSyncNow');
    if (btnSyncNow) btnSyncNow.addEventListener('click', () => window.EP && window.EP.syncNow());

    const btnSetup = $('btnGithubSetup');
    if (btnSetup) btnSetup.addEventListener('click', () => { closeConfig(); window.EP.showSetup(); });

    const btnLogout = $('btnLogout');
    if (btnLogout) btnLogout.addEventListener('click', () => {
      const st = window.EP.status();
      const warn = st.pending ? `\n\nAtención: hay ${st.pending} cambio(s) sin subir; se subirán si vuelves a conectar este dispositivo.` : '';
      if (confirm('¿Desconectar este dispositivo de GitHub? Se borra el token de este dispositivo; tus apuntes se quedan aquí y en GitHub.' + warn)) {
        closeConfig();
        window.EP.disconnect();
        window.showAppToast('Dispositivo desconectado de GitHub.', 'info');
      }
    });

    const btnExport = $('btnExportLocal');
    if (btnExport) btnExport.addEventListener('click', () => window.EP && window.EP.exportLocal());

    const btnImport = $('btnImportLocal');
    const importInput = $('importFileInput');
    if (btnImport && importInput) {
      btnImport.addEventListener('click', () => importInput.click());
      importInput.addEventListener('change', async () => {
        const file = importInput.files && importInput.files[0];
        importInput.value = '';
        if (!file) return;
        try {
          const r = await window.EP.importFile(file);
          window.showAppToast(`Importados ${r.notes} apuntes y preguntas de ${r.questions} temas.`, 'success');
        } catch (e) {
          window.showAppToast(e.message || 'No se pudo importar el archivo.', 'error', 6000);
        }
      });
    }
  });

  // Avisos al perder o recuperar la conexión
  // Solo se avisa una vez por cada pérdida / recuperación real de la conexión
  let connection = 'unknown'; // unknown | online | offline
  window.addEventListener('ep:sync-status', (e) => {
    const st = e.detail.status;
    if (st === 'synced') {
      if (connection === 'offline') window.showAppToast('Conectado de nuevo. Todo está guardado en GitHub.', 'success');
      connection = 'online';
    } else if (st === 'offline') {
      if (connection === 'online') {
        window.showAppToast('Sin conexión. Sigue escribiendo: tus cambios se guardan en este dispositivo y se subirán después.', 'warning', 5500);
      }
      connection = 'offline';
    }
  });
})();
