// ═══════════════════════════════════════════════════════════════
//  SIGNANDO – Gestión de sesión y modal de identificación
// ═══════════════════════════════════════════════════════════════

const SIGNANDO = (() => {

  // ── CONFIGURACIÓN ────────────────────────────────────────────
  // Sustituir por la URL de tu Apps Script desplegado
  const GAS_URL    = 'PEGA_AQUÍ_LA_URL_DE_TU_APPS_SCRIPT';
  const LS_TOKEN   = 'signando_token';
  const LS_EMAIL   = 'signando_email';
  const LS_USUARIO = 'signando_usuario';

  // ── SESIÓN ───────────────────────────────────────────────────

  function getSession() {
    return {
      token:   localStorage.getItem(LS_TOKEN),
      email:   localStorage.getItem(LS_EMAIL),
      usuario: JSON.parse(localStorage.getItem(LS_USUARIO) || 'null')
    };
  }

  function saveSession(token, email, usuario) {
    localStorage.setItem(LS_TOKEN, token);
    localStorage.setItem(LS_EMAIL, email);
    localStorage.setItem(LS_USUARIO, JSON.stringify(usuario));
  }

  function clearSession() {
    localStorage.removeItem(LS_TOKEN);
    localStorage.removeItem(LS_EMAIL);
    localStorage.removeItem(LS_USUARIO);
  }

  function hasSession() {
    return !!localStorage.getItem(LS_TOKEN);
  }

  // ── API ──────────────────────────────────────────────────────

  async function apiCall(data) {
    // Enviamos como text/plain para evitar preflight CORS con GAS
    const resp = await fetch(GAS_URL, {
      method: 'POST',
      body:   JSON.stringify(data)
    });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    return resp.json();
  }

  async function verificarAcceso(email, token) {
    return apiCall({ action: 'verificar_acceso', email, token: token || null });
  }

  async function solicitarAcceso(email, nombre, tipo_usuario) {
    return apiCall({ action: 'solicitar_acceso', email, nombre, tipo_usuario });
  }

  async function actualizarPerfil(email, token, datos) {
    return apiCall({ action: 'actualizar_perfil', email, token, datos });
  }

  // ── MODAL ────────────────────────────────────────────────────

  function mostrarModal() {
    const m = document.getElementById('signando-modal');
    if (m) m.classList.remove('snd-oculto');
  }

  function ocultarModal() {
    const m = document.getElementById('signando-modal');
    if (m) m.classList.add('snd-oculto');
  }

  function irAPaso(paso) {
    document.querySelectorAll('.snd-paso').forEach(p => p.classList.remove('snd-activo'));
    const el = document.getElementById('snd-paso-' + paso);
    if (el) el.classList.add('snd-activo');
  }

  function setError(id, msg) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('snd-oculto', !msg);
  }

  function setLoading(btn, activo) {
    btn.disabled = activo;
    if (activo) {
      btn.dataset.txt = btn.textContent;
      btn.textContent  = 'Un momento…';
    } else {
      btn.textContent = btn.dataset.txt || btn.textContent;
    }
  }

  // ── INIT MODAL ───────────────────────────────────────────────

  function initModal() {
    const modal = document.getElementById('signando-modal');
    if (!modal) return;

    // ── Paso "email": el usuario escribe su email ──────────────
    document.getElementById('snd-form-email')
      .addEventListener('submit', async e => {
        e.preventDefault();
        const email = document.getElementById('snd-input-email').value.trim().toLowerCase();
        const btn   = e.target.querySelector('button[type="submit"]');
        setError('snd-error-email', '');
        setLoading(btn, true);

        try {
          const res = await verificarAcceso(email);

          if (res.status === 'activo') {
            saveSession(res.token, email, res.usuario);
            document.getElementById('snd-bienvenido-nombre').textContent =
              res.usuario.nombre.split(' ')[0];
            irAPaso('bienvenido');
            setTimeout(ocultarModal, 2200);

          } else if (res.status === 'pendiente') {
            irAPaso('pendiente');

          } else if (res.status === 'bloqueado') {
            setError('snd-error-email',
              'Tu acceso ha sido suspendido. Contacta con el administrador.');

          } else {
            // No existe → solicitar acceso
            document.getElementById('snd-hidden-email').value = email;
            document.getElementById('snd-label-email-reg').textContent = email;
            irAPaso('registro');
          }
        } catch {
          setError('snd-error-email',
            'No se pudo conectar. Comprueba tu conexión e inténtalo de nuevo.');
        } finally {
          setLoading(btn, false);
        }
      });

    // ── Paso "registro": el usuario rellena su nombre y tipo ───
    document.getElementById('snd-form-registro')
      .addEventListener('submit', async e => {
        e.preventDefault();
        const email  = document.getElementById('snd-hidden-email').value;
        const nombre = document.getElementById('snd-input-nombre').value.trim();
        const tipo   = document.getElementById('snd-input-tipo').value;
        const btn    = e.target.querySelector('button[type="submit"]');
        setError('snd-error-registro', '');
        setLoading(btn, true);

        try {
          const res = await solicitarAcceso(email, nombre, tipo);
          if (res.status === 'pendiente') {
            irAPaso('pendiente');
          } else {
            setError('snd-error-registro',
              res.mensaje || 'Error inesperado. Inténtalo de nuevo.');
          }
        } catch {
          setError('snd-error-registro',
            'No se pudo conectar. Comprueba tu conexión e inténtalo de nuevo.');
        } finally {
          setLoading(btn, false);
        }
      });

    // ── Botón volver al paso de email ─────────────────────────
    document.getElementById('snd-btn-volver')
      ?.addEventListener('click', () => irAPaso('email'));
  }

  // ── ARRANQUE ─────────────────────────────────────────────────

  async function init() {
    const esIndex = !!document.getElementById('signando-modal');

    if (!esIndex) {
      // Vistas secundarias: redirigir si no hay sesión
      if (!hasSession()) {
        window.location.href = '../index.html';
      }
      return;
    }

    // index.html: verificar sesión existente con el servidor
    if (hasSession()) {
      const { token, email } = getSession();
      try {
        const res = await verificarAcceso(email, token);
        if (res.status === 'activo') {
          saveSession(res.token, email, res.usuario); // refresca datos
          return; // sesión válida, ocultar modal
        }
        if (res.status === 'token_invalido') {
          clearSession();
        }
      } catch {
        // Sin conexión: confiar en datos locales
        return;
      }
    }

    // Sin sesión válida → mostrar modal
    mostrarModal();
    initModal();
  }

  // ── API PÚBLICA ───────────────────────────────────────────────
  return {
    init,
    getSession,
    saveSession,
    clearSession,
    hasSession,
    actualizarPerfil
  };

})();

// Arrancar
document.addEventListener('DOMContentLoaded', () => SIGNANDO.init());
