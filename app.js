// ============================================================================
// Procomly — Proceso de Compras y Licitaciones Automatizado — ETED — lógica de la aplicación
// Backend real: Supabase (autenticación + PostgreSQL + Storage).
// La seguridad de verdad vive en supabase-schema.sql (Row Level Security);
// todo lo de aquí es además una capa de conveniencia en la interfaz — nunca
// el único lugar donde se hacen cumplir los permisos.
// ============================================================================
(function () {
  "use strict";

  // ============================================================ constantes
  var STAGES = {
    "secretaria":       { label: "Secretaría Administrativa", role: "secretaria" },
    "gerente":          { label: "Gerente de Compras",        role: "gerente" },
    "coordinador":      { label: "Coordinador",                role: "coordinador" },
    "analista":         { label: "Analista",                   role: "analista" },
    "correccion":       { label: "Analista — resolviendo objeción", role: "analista" },
    "area-correccion":  { label: "Área requirente — corrigiendo",   role: "area" },
    "juridico":         { label: "Consultoría Jurídica",       role: "juridico" },
    "publicacion":      { label: "Lista para publicar",        role: "gerente" },
    "publicado":        { label: "Publicado",                  role: null },
    "cancelado":        { label: "Cancelado",                  role: null }
  };
  var ROLE_LABELS = {
    area: "Área requirente", secretaria: "Secretaría Administrativa", gerente: "Gerente de Compras",
    coordinador: "Coordinador", analista: "Analista", juridico: "Consultoría Jurídica"
  };
  var ROLE_ORDER = ["area", "secretaria", "gerente", "coordinador", "analista", "juridico"];
  var PIPELINE_ROLE_ORDER = ["area", "secretaria", "gerente", "coordinador", "analista", "juridico"];
  var DEVOLVER_STAGE_FOR_ROLE = { secretaria: "secretaria", gerente: "gerente", coordinador: "coordinador", analista: "analista", area: "area-correccion" };
  var DEVOLVER_FIELD_FOR_ROLE = { secretaria: "secretaria_id", gerente: "gerente_id", coordinador: "coordinador_id", analista: "analista_id" };
  var STUCK_MS = 1000 * 60 * 60 * 24 * 3; // 3 días
  var ATTACH_MAX_BYTES = 8 * 1024 * 1024; // 8 MB por archivo (Supabase Storage soporta más; límite conservador aquí)
  var ATTACH_BUCKET = "attachments";
  var THEME_KEY = "eted-licitaciones-theme-v2";
  var THEME_LABELS = { auto: "🌗 Automático", light: "☀️ Claro", dark: "🌙 Oscuro" };

  // ================================================================ dom ==
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function initials(name) {
    var parts = String(name || "?").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
  }
  function fmtDateTime(iso) {
    if (!iso) return "—";
    try { return new Intl.DateTimeFormat("es-DO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)); }
    catch (e) { return iso; }
  }
  function fmtDuration(ms) {
    if (ms < 0) ms = 0;
    var min = Math.floor(ms / 60000);
    var d = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60), m = min % 60;
    if (d > 0) return d + "d " + h + "h";
    if (h > 0) return h + "h " + m + "min";
    return m + "min";
  }
  function fmtDurationPrecise(ms) {
    if (ms < 0) ms = 0;
    var totalSec = Math.floor(ms / 1000);
    var days = Math.floor(totalSec / 86400), hours = Math.floor((totalSec % 86400) / 3600), minutes = Math.floor((totalSec % 3600) / 60), seconds = totalSec % 60;
    var pad2 = function (n) { return (n < 10 ? "0" : "") + n; };
    if (days > 0) return days + "d " + pad2(hours) + ":" + pad2(minutes) + ":" + pad2(seconds);
    return hours + ":" + pad2(minutes) + ":" + pad2(seconds);
  }
  function fmtBytes(n) {
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
    return (n / (1024 * 1024)).toFixed(1) + " MB";
  }
  function optHtml(v, label) { return '<option value="' + esc(v) + '">' + esc(label == null ? v : label) + "</option>"; }
  function debounce(fn, ms) { var t; return function () { var a = arguments, ctx = this; clearTimeout(t); t = setTimeout(function () { fn.apply(ctx, a); }, ms); }; }

  // ============================================================= toasts ==
  function showToast(title, subtitle, isError) {
    var el = document.createElement("div");
    el.className = "toast" + (isError ? " toast-error" : "");
    el.innerHTML = '<div class="t-title">' + esc(title) + "</div>" + (subtitle ? "<div>" + esc(subtitle) + "</div>" : "");
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add("show"); });
    setTimeout(function () {
      el.classList.remove("show");
      setTimeout(function () { el.remove(); }, 300);
    }, 4500);
  }

  // ============================================== modal propio (sin native)
  function showModal(opts) {
    return new Promise(function (resolve) {
      var overlay = $("#modal-overlay"), msgEl = $("#modal-msg"), inputWrap = $("#modal-input-wrap"),
          input = $("#modal-input"), cancelBtn = $("#modal-cancel"), okBtn = $("#modal-ok");
      var isPrompt = opts.type === "prompt", isAlert = opts.type === "alert";
      msgEl.textContent = opts.message;
      inputWrap.hidden = !isPrompt;
      if (isPrompt) { input.type = opts.inputType || "text"; input.value = opts.defaultValue || ""; input.placeholder = opts.placeholder || ""; }
      cancelBtn.hidden = isAlert;
      okBtn.textContent = isAlert ? "Entendido" : "Aceptar";
      overlay.hidden = false;
      document.body.classList.add("modal-open");
      function cleanup() {
        overlay.hidden = true;
        document.body.classList.remove("modal-open");
        okBtn.removeEventListener("click", onOk);
        cancelBtn.removeEventListener("click", onCancel);
        overlay.removeEventListener("keydown", onKeydown);
      }
      function onOk() { var result = isPrompt ? input.value : true; cleanup(); resolve(result); }
      function onCancel() { cleanup(); resolve(isPrompt ? null : false); }
      function onKeydown(e) { if (e.key === "Enter") { e.preventDefault(); onOk(); } else if (e.key === "Escape") { e.preventDefault(); onCancel(); } }
      okBtn.addEventListener("click", onOk);
      cancelBtn.addEventListener("click", onCancel);
      overlay.addEventListener("keydown", onKeydown);
      setTimeout(function () { if (isPrompt) { input.focus(); input.select(); } else { okBtn.focus(); } }, 30);
    });
  }
  function showAlert(msg) { return showModal({ type: "alert", message: msg }); }
  function showConfirm(msg) { return showModal({ type: "confirm", message: msg }); }
  function showPrompt(msg, def, inputType) { return showModal({ type: "prompt", message: msg, defaultValue: def, inputType: inputType }); }

  // =============================================================== tema ==
  function getStoredTheme() {
    try { var v = localStorage.getItem(THEME_KEY); return v === "light" || v === "dark" ? v : "auto"; } catch (e) { return "auto"; }
  }
  function setStoredTheme(mode) {
    try { if (mode === "auto") localStorage.removeItem(THEME_KEY); else localStorage.setItem(THEME_KEY, mode); } catch (e) {}
  }
  function applyTheme(mode) {
    var root = document.documentElement;
    if (mode === "light") root.setAttribute("data-theme", "light");
    else if (mode === "dark") root.setAttribute("data-theme", "dark");
    else root.removeAttribute("data-theme");
    var btn = $("#theme-toggle");
    if (btn) btn.textContent = THEME_LABELS[mode] || THEME_LABELS.auto;
  }
  function cycleTheme() {
    var order = ["auto", "light", "dark"];
    var next = order[(order.indexOf(getStoredTheme()) + 1) % order.length];
    setStoredTheme(next);
    applyTheme(next);
  }
  function wireThemeToggle() {
    applyTheme(getStoredTheme());
    document.body.addEventListener("click", function (e) {
      if (e.target.closest("#theme-toggle")) cycleTheme();
    });
  }

  // ======================================================= supabase client
  var cfg = window.ETED_CONFIG || {};
  var CONFIGURED = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY &&
    cfg.SUPABASE_URL.indexOf("PEGA_AQUI") === -1 && cfg.SUPABASE_ANON_KEY.indexOf("PEGA_AQUI") === -1);
  var sb = null;
  if (CONFIGURED && window.supabase && window.supabase.createClient) {
    sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  }

  // ============================================================ DB layer ==
  // Única capa que habla con Supabase — así toda la lógica de arriba (UI,
  // reglas de negocio) no depende de los detalles de la librería.
  var DB = {
    async getSession() {
      var r = await sb.auth.getSession();
      return (r.data && r.data.session) || null;
    },
    onAuthStateChange(cb) { return sb.auth.onAuthStateChange(cb); },
    async signUp(email, password) { return sb.auth.signUp({ email: email, password: password }); },
    async signIn(email, password) { return sb.auth.signInWithPassword({ email: email, password: password }); },
    async signOut() { return sb.auth.signOut(); },
    async requestPasswordReset(email) { return sb.auth.resetPasswordForEmail(email); },

    async fetchAll() {
      var results = await Promise.all([
        sb.from("profiles").select("*").order("full_name"),
        sb.from("areas").select("*").order("name"),
        sb.from("cases").select("*").order("created_at"),
        sb.from("case_events").select("*").order("ts"),
        sb.from("attachments").select("*").order("created_at")
      ]);
      results.forEach(function (r) { if (r.error) throw r.error; });
      return {
        profiles: results[0].data || [],
        areas: results[1].data || [],
        cases: results[2].data || [],
        events: results[3].data || [],
        attachments: results[4].data || []
      };
    },

    async createArea(name, manager) {
      var r = await sb.from("areas").insert({ name: name, manager_name: manager || "" }).select().single();
      if (r.error) throw r.error;
      return r.data;
    },
    async updateArea(id, fields) {
      var r = await sb.from("areas").update(fields).eq("id", id);
      if (r.error) throw r.error;
    },
    async deleteArea(id) {
      var r = await sb.from("areas").delete().eq("id", id);
      if (r.error) throw r.error;
    },

    async updateProfile(id, fields) {
      var r = await sb.from("profiles").update(fields).eq("id", id);
      if (r.error) throw r.error;
    },

    async createCase(fields) {
      var r = await sb.from("cases").insert(fields).select().single();
      if (r.error) throw r.error;
      return r.data;
    },
    async updateCase(id, fields) {
      var r = await sb.from("cases").update(fields).eq("id", id);
      if (r.error) throw r.error;
    },

    async insertEvent(fields) {
      var r = await sb.from("case_events").insert(fields).select().single();
      if (r.error) throw r.error;
      return r.data;
    },

    async uploadAttachment(caseId, file, actorId, actorName) {
      var safeName = file.name.replace(/[^\w.\-]+/g, "_");
      var path = caseId + "/" + Date.now() + "_" + safeName;
      var up = await sb.storage.from(ATTACH_BUCKET).upload(path, file);
      if (up.error) throw up.error;
      var r = await sb.from("attachments").insert({
        case_id: caseId, storage_path: path, file_name: file.name, file_size: file.size,
        mime_type: file.type || "", uploaded_by: actorId, uploaded_by_name: actorName
      }).select().single();
      if (r.error) throw r.error;
      return r.data;
    },
    async deleteAttachment(att) {
      await sb.storage.from(ATTACH_BUCKET).remove([att.storage_path]);
      var r = await sb.from("attachments").delete().eq("id", att.id);
      if (r.error) throw r.error;
    },
    async getSignedUrl(storagePath) {
      var r = await sb.storage.from(ATTACH_BUCKET).createSignedUrl(storagePath, 120);
      if (r.error) throw r.error;
      return r.data.signedUrl;
    },

    async logNotification(toEmail, toName, subject, body, caseId) {
      try { await sb.from("notifications_log").insert({ to_email: toEmail || "", to_name: toName || "", subject: subject, body: body || "", case_id: caseId || null }); }
      catch (e) { /* la bitácora de notificaciones es solo informativa — nunca bloquea la acción principal */ }
    }
  };

  // ================================================================ state
  var state = {
    session: null,
    user: null,      // auth.users row (from session)
    me: null,         // profiles row for the current user
    profiles: [],
    areas: [],
    cases: [],
    events: [],       // todos los eventos de todos los procesos
    attachments: [],  // todos los adjuntos de todos los procesos
    activeTab: "home",
    authMode: "signin", // 'signin' | 'signup'
    caseFilterArea: "",
    loading: true,
    lastError: null
  };

  function profileById(id) { return state.profiles.filter(function (p) { return p.id === id; })[0] || null; }
  function areaById(id) { return state.areas.filter(function (a) { return a.id === id; })[0] || null; }
  function areaName(id) { var a = areaById(id); return a ? a.name : ""; }
  function eventsForCase(caseId) { return state.events.filter(function (e) { return e.case_id === caseId; }); }
  function attachmentsForCase(caseId) { return state.attachments.filter(function (a) { return a.case_id === caseId; }); }
  function assignedProfiles() { return state.profiles.filter(function (p) { return p.roles && p.roles.length; }); }
  function profilesByRole(role) { return assignedProfiles().filter(function (p) { return p.roles.indexOf(role) !== -1; }); }
  function coordinadoresParaTipo(tipo) {
    return profilesByRole("coordinador").filter(function (p) { return !p.coord_tipos || !p.coord_tipos.length || p.coord_tipos.indexOf(tipo) !== -1; });
  }
  function isAdmin() { return !!(state.me && state.me.is_admin); }
  function myRoles() { return (state.me && state.me.roles) || []; }
  function myAreaId() { return state.me ? state.me.area_id : null; }

  function caseDisplayNumber(c) { return "#" + (1000 + Number(c.case_number || 0)); }

  // ===================================================== reglas de acceso
  function eligibleProfiles(role, assignedId) {
    var pool = profilesByRole(role);
    if (!assignedId) return pool;
    return pool.filter(function (p) { return p.id === assignedId; });
  }
  function meMatchesRole(role, assignedId, matchArea) {
    if (!state.me) return false;
    if (myRoles().indexOf(role) === -1) return false;
    if (matchArea) return myAreaId() && assignedId === myAreaId();
    if (!assignedId) return true;
    return state.me.id === assignedId;
  }
  function whoLine(role, assignedId, matchArea) {
    if (meMatchesRole(role, assignedId, matchArea)) {
      return '<div class="who">Actuando como <strong>' + esc(state.me.full_name || state.me.email) + "</strong></div>";
    }
    if (isAdmin()) {
      return '<div class="who admin-who">⚠ Modo administrador — puedes forzar esta acción, pero quedará registrada a tu nombre, no al de ' + esc(ROLE_LABELS[role] || role) + ".</div>";
    }
    var label = (ROLE_LABELS[role] || role) + (assignedId ? (matchArea ? " (" + esc(areaName(assignedId)) + ")" : " (" + esc((profileById(assignedId) || {}).full_name || "") + ")") : "");
    return '<div class="who locked">Esta acción le corresponde a: ' + label + ". Si te corresponde a ti, inicia sesión con tu propia cuenta.</div>";
  }
  function canAct(role, assignedId, matchArea) { return meMatchesRole(role, assignedId, matchArea) || isAdmin(); }
  function actorBtn(doAttr, label, role, assignedId, matchArea, cls, caseId, requiresChecks) {
    var enabled = canAct(role, assignedId, matchArea);
    var checksOk = true;
    if (requiresChecks && requiresChecks.length && caseId) {
      var set = getChecklistSet(caseId);
      checksOk = requiresChecks.every(function (k) { return set.has(k); });
    }
    var title = "";
    if (!enabled) title = ' title="Requiere identificarte como: ' + esc(ROLE_LABELS[role] || role) + '"';
    else if (!checksOk) title = ' title="Completa los controles requeridos arriba antes de continuar"';
    return '<button type="button" class="btn ' + (cls || "") + '" data-do="' + esc(doAttr) + '" data-actor-role="' + esc(role) + '" data-actor-assigned="' + esc(assignedId || "") + '" data-actor-match-area="' + (matchArea ? "1" : "0") + '"' +
      (requiresChecks && requiresChecks.length ? ' data-requires-checks="' + esc(requiresChecks.join(",")) + '"' : "") +
      (enabled && checksOk ? "" : " disabled") + title + ">" + esc(label) + "</button>";
  }
  function assignSelectOrHint(roleForTarget, fieldLabel, doAttr, actionLabel, actorRole, actorAssigned, actorMatchArea, caseId, requiresChecks, poolOverride) {
    var pool = poolOverride || profilesByRole(roleForTarget);
    if (!pool.length) {
      var plural = roleForTarget === "coordinador" ? "coordinadores" : "analistas";
      if (poolOverride && profilesByRole(roleForTarget).length) {
        return '<p class="hint">Ningún ' + (roleForTarget === "coordinador" ? "coordinador" : "analista") + ' registrado tiene la especialidad marcada para este tipo de proceso. Un administrador puede ajustarlo, o dejarlo sin marcar para que atienda ambos tipos.</p>';
      }
      return '<p class="hint">Aún no hay ' + plural + ' registrados en el directorio. Un administrador debe asignarles ese puesto primero en "Áreas y usuarios".</p>';
    }
    return '<div class="action-row"><div class="field"><label>' + esc(fieldLabel) + '</label><select class="target-select">' +
      pool.map(function (p) { return optHtml(p.id, p.full_name || p.email); }).join("") +
      "</select></div></div>" +
      '<div class="action-buttons">' + actorBtn(doAttr, actionLabel, actorRole, actorAssigned, actorMatchArea, "", caseId, requiresChecks) + "</div>";
  }

  // ============================================== checklists (solo local)
  var checklistState = {};
  function getChecklistSet(caseId) { if (!checklistState[caseId]) checklistState[caseId] = new Set(); return checklistState[caseId]; }
  function checklistHTML(caseId, items) {
    var set = getChecklistSet(caseId);
    return '<div class="checklist">' + items.map(function (it) {
      var id = "chk-" + caseId + "-" + it.key.replace(/[^a-zA-Z0-9]/g, "_");
      return '<label class="checklist-item" for="' + id + '"><input type="checkbox" class="gate-check" id="' + id + '" data-check-key="' + esc(it.key) + '"' + (set.has(it.key) ? " checked" : "") + "> " + esc(it.label) + "</label>";
    }).join("") + "</div>";
  }

  // =================================================== devolver (regreso)
  function devolverTargets(fromRole, caseAreaId) {
    var idx = PIPELINE_ROLE_ORDER.indexOf(fromRole);
    var earlier = idx > 0 ? PIPELINE_ROLE_ORDER.slice(0, idx) : [];
    var opts = [];
    earlier.forEach(function (r) {
      if (r === "area") {
        opts.push({ value: "area:", label: "Área requirente — " + areaName(caseAreaId) });
      } else {
        profilesByRole(r).forEach(function (p) {
          opts.push({ value: r + ":" + p.id, label: (ROLE_LABELS[r] || r) + ": " + (p.full_name || p.email) });
        });
      }
    });
    return opts;
  }
  function devolverSectionHTML(caseEl, role, assignedId, matchArea) {
    var targets = devolverTargets(role, caseEl.area_id);
    if (!targets.length) return "";
    var optsHtml = targets.map(function (t) { return optHtml(t.value, t.label); }).join("");
    return '<div class="devolver-box"><p class="devolver-title">¿Necesitas devolver este proceso a una etapa anterior?</p>' +
      '<div class="action-row"><div class="field"><label>Devolver a</label><select class="devolver-target-select"><option value="">Selecciona a quién…</option>' + optsHtml + "</select></div></div>" +
      '<div class="action-row"><div class="field"><label>Motivo de la devolución (obligatorio)</label><input type="text" class="devolver-note-input" placeholder="Explica por qué se devuelve"></div></div>' +
      '<div class="action-buttons">' + actorBtn("devolver", "Devolver proceso", role, assignedId, matchArea, "danger") + "</div></div>";
  }

  // ================================================================ init
  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    wireThemeToggle();
    wireGlobalModalsOnce();

    if (!CONFIGURED) {
      renderNotConfigured();
      return;
    }
    if (!sb) {
      renderNotConfigured();
      return;
    }

    DB.onAuthStateChange(function (_event, session) {
      state.session = session;
      state.user = session ? session.user : null;
      if (session) { loadAndRenderApp(); } else { state.me = null; renderAuthGate(); }
    });

    var session = await DB.getSession().catch(function () { return null; });
    state.session = session;
    state.user = session ? session.user : null;
    if (session) { await loadAndRenderApp(); } else { renderAuthGate(); }
  }

  async function loadAndRenderApp() {
    setAppLoading(true);
    try {
      var data = await DB.fetchAll();
      state.profiles = data.profiles;
      state.areas = data.areas;
      state.cases = data.cases;
      state.events = data.events;
      state.attachments = data.attachments;
      state.me = profileById(state.user.id);
      state.loading = false;
      renderShell();
    } catch (err) {
      state.loading = false;
      console.error(err);
      renderLoadError(err);
    }
  }

  async function refreshData(quiet) {
    try {
      var data = await DB.fetchAll();
      state.profiles = data.profiles;
      state.areas = data.areas;
      state.cases = data.cases;
      state.events = data.events;
      state.attachments = data.attachments;
      state.me = profileById(state.user.id);
      renderRoute();
      renderSidebar();
    } catch (err) {
      console.error(err);
      if (!quiet) showToast("No se pudo actualizar", String(err.message || err), true);
    }
  }

  function setAppLoading(v) { state.loading = v; }

  // ======================================================= pantalla base
  function renderNotConfigured() {
    document.body.innerHTML =
      '<div class="auth-shell"><div class="auth-box">' +
      '<div class="auth-brand"><span class="logo-dot"></span><span>Procomly</span></div>' +
      '<p class="sub">Todavía falta conectar esta página a tu proyecto de Supabase.</p>' +
      '<div class="auth-note">Abre el archivo <code>config.js</code> de este sitio y pega ahí la URL de tu proyecto y la clave pública ("anon key"). Sigue el paso a paso completo en <code>SETUP.md</code>.</div>' +
      "</div></div>";
  }
  function renderLoadError(err) {
    document.body.innerHTML =
      '<div class="auth-shell"><div class="auth-box">' +
      '<div class="auth-brand"><span class="logo-dot"></span><span>Procomly</span></div>' +
      '<p class="sub">No se pudo cargar la información.</p>' +
      '<div class="auth-error">' + esc(String((err && err.message) || err)) + "</div>" +
      '<p class="hint">Revisa que el esquema SQL (supabase-schema.sql) se haya ejecutado en tu proyecto, y que la URL/clave en config.js sean correctas. Si el problema sigue, cierra sesión e inténtalo de nuevo.</p>' +
      '<button type="button" class="btn ghost" id="err-signout">Cerrar sesión</button>' +
      "</div></div>";
    var b = $("#err-signout");
    if (b) b.addEventListener("click", async function () { await DB.signOut(); location.reload(); });
  }

  // ============================================================ auth gate
  function renderAuthGate() {
    var mode = state.authMode;
    document.body.innerHTML =
      '<div class="auth-shell"><div class="auth-box">' +
      '<div class="auth-brand"><span class="logo-dot"></span><span>Procomly</span></div>' +
      '<p class="sub">Proceso de Compras y Licitaciones Automatizado — ETED · Gerencia de Compras.</p>' +
      '<div class="auth-tabs">' +
      '<button type="button" class="auth-tab' + (mode === "signin" ? " active" : "") + '" data-mode="signin">Iniciar sesión</button>' +
      '<button type="button" class="auth-tab' + (mode === "signup" ? " active" : "") + '" data-mode="signup">Crear cuenta</button>' +
      "</div>" +
      '<div id="auth-msg"></div>' +
      '<form id="auth-form" class="stack">' +
      '<div class="field"><label>Correo</label><input type="email" id="auth-email" required placeholder="nombre@eted.gob.do"></div>' +
      '<div class="field"><label>Contraseña</label><input type="password" id="auth-password" required minlength="6" placeholder="Mínimo 6 caracteres" autocomplete="' + (mode === "signup" ? "new-password" : "current-password") + '"></div>' +
      (mode === "signup" ? '<p class="hint">Al crear tu cuenta, quedas registrada(o) en el directorio pero sin ningún puesto asignado todavía — pídele al administrador de Procomly que te asigne tu puesto, área y datos.</p>' : "") +
      '<div class="form-actions"><button type="submit" class="btn" id="auth-submit" style="width:100%; justify-content:center;">' + (mode === "signup" ? "Crear cuenta" : "Iniciar sesión") + "</button></div>" +
      (mode === "signin" ? '<button type="button" class="btn ghost small" id="auth-forgot" style="width:100%; justify-content:center;">¿Olvidaste tu contraseña?</button>' : "") +
      "</form>" +
      "</div></div>";

    $$(".auth-tab").forEach(function (t) {
      t.addEventListener("click", function () { state.authMode = t.getAttribute("data-mode"); renderAuthGate(); });
    });
    $("#auth-form").addEventListener("submit", onAuthSubmit);
    var forgot = $("#auth-forgot");
    if (forgot) forgot.addEventListener("click", onForgotPassword);
  }

  async function onAuthSubmit(e) {
    e.preventDefault();
    var email = $("#auth-email").value.trim();
    var password = $("#auth-password").value;
    var btn = $("#auth-submit");
    btn.disabled = true;
    var origText = btn.textContent;
    btn.innerHTML = '<span class="spinner"></span>';
    try {
      var res = state.authMode === "signup" ? await DB.signUp(email, password) : await DB.signIn(email, password);
      if (res.error) throw res.error;
      if (state.authMode === "signup" && res.data && res.data.user && !res.data.session) {
        renderAuthMsg("info", "Cuenta creada. Revisa tu correo (" + esc(email) + ") para confirmar tu cuenta antes de iniciar sesión — según cómo esté configurado el proyecto, puede que ya puedas entrar directamente.");
        return;
      }
      // onAuthStateChange se encarga de cargar la app cuando hay sesión.
    } catch (err) {
      renderAuthMsg("error", translateAuthError(err));
    } finally {
      btn.disabled = false;
      btn.textContent = origText;
    }
  }
  async function onForgotPassword() {
    var email = await showPrompt("Escribe tu correo para enviarte un enlace de recuperación:");
    if (!email) return;
    try {
      var r = await DB.requestPasswordReset(email.trim());
      if (r.error) throw r.error;
      await showAlert("Si ese correo tiene una cuenta, te llegará un enlace para restablecer la contraseña.");
    } catch (err) { await showAlert("No se pudo enviar el correo: " + (err.message || err)); }
  }
  function renderAuthMsg(kind, text) {
    var box = $("#auth-msg");
    if (!box) return;
    box.innerHTML = '<div class="auth-' + (kind === "error" ? "error" : "note") + '">' + esc(text) + "</div>";
  }
  function translateAuthError(err) {
    var m = String((err && err.message) || err || "");
    if (/invalid login credentials/i.test(m)) return "Correo o contraseña incorrectos.";
    if (/user already registered/i.test(m)) return "Ya existe una cuenta con ese correo — intenta iniciar sesión.";
    if (/password should be at least/i.test(m)) return "La contraseña debe tener al menos 6 caracteres.";
    if (/email not confirmed/i.test(m)) return "Todavía no confirmas tu correo — revisa tu bandeja de entrada.";
    return m || "Ocurrió un error. Inténtalo de nuevo.";
  }

  // ============================================================ shell/nav
  var TABS = [
    { key: "home", label: "Inicio", icon: "🏠" },
    { key: "nueva", label: "Nueva solicitud", icon: "➕" },
    { key: "procesos", label: "Procesos en curso", icon: "📋" },
    { key: "panorama", label: "Panorama de tiempos", icon: "📊" },
    { key: "areas", label: "Áreas y usuarios", icon: "🏢" }
  ];

  function renderShell() {
    document.body.innerHTML =
      '<div class="app-shell">' +
      '<aside class="sidebar" id="sidebar">' +
      '<div class="sidebar-brand"><span class="logo-dot"></span><span>Procomly</span></div>' +
      '<nav class="sidebar-nav" id="sidebar-nav"></nav>' +
      '<div class="sidebar-foot">Gerencia de Compras · ETED</div>' +
      "</aside>" +
      '<div class="main-col">' +
      '<header class="topbar">' +
      '<button type="button" class="topbar-btn" id="menu-toggle" style="display:none;">☰</button>' +
      '<div class="topbar-title" id="topbar-title"></div>' +
      '<div class="topbar-spacer"></div>' +
      '<button type="button" class="topbar-btn" id="theme-toggle"></button>' +
      '<button type="button" class="topbar-btn" id="refresh-btn">⟳ Actualizar</button>' +
      '<button type="button" class="user-chip" id="user-chip"></button>' +
      "</header>" +
      '<main class="content" id="content"></main>' +
      "</div></div>" +
      modalMarkup();

    applyTheme(getStoredTheme());
    renderSidebar();
    renderTopUser();
    renderRoute();

    $("#refresh-btn").addEventListener("click", function () { refreshData(); });
    $("#user-chip").addEventListener("click", onUserChipClick);
    $("#menu-toggle").addEventListener("click", function () { $("#sidebar").classList.toggle("open"); });

    if (!window.__eted_interval) {
      window.__eted_interval = setInterval(function () { refreshData(true); }, 60000);
    }
  }

  function renderTopUser() {
    var chip = $("#user-chip");
    if (!chip || !state.me) return;
    chip.innerHTML = '<span class="avatar">' + esc(initials(state.me.full_name || state.me.email)) + "</span>" +
      esc(state.me.full_name || state.me.email) + (isAdmin() ? " · Admin" : "");
  }
  async function onUserChipClick() {
    var choice = await showConfirm("¿Cerrar la sesión de " + esc(state.me.full_name || state.me.email) + "?");
    if (choice) { await DB.signOut(); }
  }

  function pendingForMe() {
    if (!state.me || !myRoles().length) return 0;
    return state.cases.filter(function (c) {
      var meta = STAGES[c.stage];
      if (!meta || meta.role == null) return false;
      if (myRoles().indexOf(meta.role) === -1) return false;
      if (meta.role === "area" && c.area_id !== myAreaId()) return false;
      if (meta.role === "coordinador" && c.coordinador_id !== state.me.id) return false;
      if (meta.role === "analista" && c.analista_id !== state.me.id) return false;
      if (meta.role === "gerente" && c.gerente_id && c.gerente_id !== state.me.id) return false;
      if (meta.role === "secretaria" && c.secretaria_id && c.secretaria_id !== state.me.id) return false;
      return true;
    }).length;
  }
  function activeCasesCount() {
    return state.cases.filter(function (c) { return c.stage !== "publicado" && c.stage !== "cancelado"; }).length;
  }
  function pendingProfilesCount() {
    return state.profiles.filter(function (p) { return !p.roles || !p.roles.length; }).length;
  }

  function renderSidebar() {
    var nav = $("#sidebar-nav");
    if (!nav) return;
    var pending = pendingForMe();
    var activeN = activeCasesCount();
    var pendingProfiles = pendingProfilesCount();
    nav.innerHTML = TABS.map(function (t) {
      var badge = "";
      if (t.key === "home" && pending) badge = '<span class="badge">' + pending + "</span>";
      if (t.key === "procesos" && activeN) badge = '<span class="badge">' + activeN + "</span>";
      if (t.key === "areas" && isAdmin() && pendingProfiles) badge = '<span class="badge">' + pendingProfiles + "</span>";
      var alertCls = (t.key === "home" && pending) ? " badge-alert" : "";
      return '<button type="button" class="side-link' + (state.activeTab === t.key ? " active" : "") + alertCls + '" data-tab="' + t.key + '">' +
        '<span class="ic">' + t.icon + "</span><span>" + esc(t.label) + "</span>" + badge + "</button>";
    }).join("");
    $$(".side-link", nav).forEach(function (b) {
      b.addEventListener("click", function () {
        state.activeTab = b.getAttribute("data-tab");
        $("#sidebar").classList.remove("open");
        renderSidebar();
        renderRoute();
      });
    });
  }

  function renderRoute() {
    var titleMap = { home: "Inicio", nueva: "Nueva solicitud de compra", procesos: "Procesos en curso", panorama: "Panorama de tiempos", areas: "Áreas y usuarios" };
    var titleEl = $("#topbar-title");
    if (titleEl) titleEl.textContent = titleMap[state.activeTab] || "";
    var box = $("#content");
    if (!box) return;
    if (state.activeTab === "home") renderHome(box);
    else if (state.activeTab === "nueva") renderNuevaSolicitud(box);
    else if (state.activeTab === "procesos") renderProcesos(box);
    else if (state.activeTab === "panorama") renderPanorama(box);
    else if (state.activeTab === "areas") renderAreasUsuarios(box);
    wireCaseActionsOnce();
  }

  function modalMarkup() {
    return '<div id="modal-overlay" class="modal-overlay" hidden><div class="modal-box" role="dialog" aria-modal="true">' +
      '<p class="modal-msg" id="modal-msg"></p>' +
      '<div class="modal-input-wrap" id="modal-input-wrap" hidden><input type="text" id="modal-input" class="modal-input"></div>' +
      '<div class="modal-actions"><button type="button" id="modal-cancel" class="btn ghost small">Cancelar</button><button type="button" id="modal-ok" class="btn small">Aceptar</button></div>' +
      "</div></div>" +
      '<div id="preview-overlay" class="preview-overlay" hidden><div class="preview-box" role="dialog" aria-modal="true">' +
      '<div class="preview-header"><span class="preview-title" id="preview-title">Archivo adjunto</span><button type="button" id="preview-close" class="btn ghost small">✕ Cerrar</button></div>' +
      '<div class="preview-content" id="preview-content"></div>' +
      "</div></div>";
  }
  var _modalsWired = false;
  function wireGlobalModalsOnce() {
    document.body.addEventListener("click", function (e) {
      if (e.target.id === "preview-close" || e.target.id === "preview-overlay") closeAttachPreview();
    });
    document.addEventListener("keydown", function (e) {
      var overlay = $("#preview-overlay");
      if (e.key === "Escape" && overlay && !overlay.hidden) closeAttachPreview();
    });
  }

  // =============================================================== Home
  function renderHome(box) {
    var stats = computeStats();
    var pending = pendingForMe();
    box.innerHTML =
      '<div class="page-head"><div><h1>Hola, ' + esc((state.me && (state.me.full_name || state.me.email)) || "") + "</h1>" +
      '<p class="sub">' + (pending ? "Tienes <strong>" + pending + "</strong> proceso(s) esperando tu acción." : "No tienes procesos pendientes ahora mismo.") + "</p></div></div>" +
      kpiRowHTML(stats) +
      (!myRoles().length && !isAdmin() ? '<div class="card card-pad"><p class="hint">Tu cuenta todavía no tiene ningún puesto asignado. Pídele al administrador de Procomly que te asigne tu puesto, área y datos en "Áreas y usuarios".</p></div>' : "") +
      stuckCardHTML(stats) +
      '<div class="card"><div class="card-title">Actividad reciente</div><div class="card-pad">' + recentActivityHTML() + "</div></div>";
  }
  function kpiRowHTML(stats) {
    var pct = stats.total ? Math.round((100 * stats.withRework) / stats.total) : 0;
    return '<div class="kpi-row">' +
      '<div class="kpi brand"><div class="v">' + stats.active + '</div><div class="l">Procesos activos</div></div>' +
      '<div class="kpi"><div class="v">' + stats.published + '</div><div class="l">Publicados</div></div>' +
      '<div class="kpi"><div class="v">' + (stats.avgPublished ? fmtDuration(stats.avgPublished) : "—") + '</div><div class="l">Tiempo prom. hasta publicar</div></div>' +
      '<div class="kpi' + (pct > 0 ? " warn" : "") + '"><div class="v">' + pct + '%</div><div class="l">Con devolución</div></div>' +
      "</div>";
  }
  function stuckCardHTML(stats) {
    if (!stats.stuckList.length) return "";
    return '<div class="card" style="border-left:4px solid var(--critical);"><div class="card-title">⚠ Procesos estancados (más de 3 días en la misma etapa)</div><div class="card-pad">' +
      stats.stuckList.map(function (s) {
        return '<div style="display:flex; justify-content:space-between; gap:12px; font-size:13px; padding:5px 0;"><span>' + esc(s.title) + " — <span style=\"color:var(--ink-soft)\">" + esc(s.stage) + '</span></span><span class="num">' + fmtDuration(s.ms) + "</span></div>";
      }).join("") + "</div></div>";
  }
  function recentActivityHTML() {
    var all = state.events.slice().sort(function (a, b) { return new Date(b.ts) - new Date(a.ts); }).slice(0, 12);
    if (!all.length) return '<p class="hint">Todavía no hay actividad registrada.</p>';
    return '<ul class="profile-events">' + all.map(function (e) {
      var c = state.cases.filter(function (x) { return x.id === e.case_id; })[0];
      return '<li><time class="mono">' + esc(fmtDateTime(e.ts)) + "</time><span><strong>" + esc(e.actor_name) + "</strong> — " + esc(e.action) + (c ? " (" + esc(c.title) + ")" : "") + "</span></li>";
    }).join("") + "</ul>";
  }

  function computeStats() {
    var now = Date.now();
    var active = 0, published = 0, withRework = 0, reworkTotal = 0;
    var publishedDurations = [], stageDurations = {}, areaDurations = {}, areaActiveCounts = {}, areaPublishedCounts = {}, areaActiveDurations = {};
    var stuckList = [];
    state.cases.forEach(function (c) {
      var created = new Date(c.created_at).getTime();
      var events = eventsForCase(c.id);
      var rework = c.rework_count || 0;
      if (rework > 0) withRework++;
      reworkTotal += rework;
      var closed = c.stage === "publicado" || c.stage === "cancelado";
      if (!closed) active++;
      if (!closed) {
        areaActiveCounts[c.area_id] = (areaActiveCounts[c.area_id] || 0) + 1;
        (areaActiveDurations[c.area_id] = areaActiveDurations[c.area_id] || []).push(now - created);
      }
      if (c.stage === "publicado") {
        published++;
        areaPublishedCounts[c.area_id] = (areaPublishedCounts[c.area_id] || 0) + 1;
        var lastEv = events[events.length - 1];
        var endTs = lastEv ? new Date(lastEv.ts).getTime() : now;
        publishedDurations.push(endTs - created);
        (areaDurations[c.area_id] = areaDurations[c.area_id] || []).push(endTs - created);
      }
      var prevTs = created, prevStageHeld = "secretaria";
      events.forEach(function (ev) {
        var ts = new Date(ev.ts).getTime();
        var dur = ts - prevTs;
        if (dur > 0) (stageDurations[prevStageHeld] = stageDurations[prevStageHeld] || []).push(dur);
        prevTs = ts; prevStageHeld = ev.stage_held || prevStageHeld;
      });
      if (!closed) {
        var lastTs = events.length ? new Date(events[events.length - 1].ts).getTime() : created;
        var timeInStage = now - lastTs;
        if (timeInStage > STUCK_MS) stuckList.push({ title: c.title, stage: (STAGES[c.stage] || {}).label || c.stage, ms: timeInStage });
      }
    });
    function avg(arr) { return arr.length ? arr.reduce(function (a, b) { return a + b; }, 0) / arr.length : 0; }
    var areaKeys = state.areas.map(function (a) { return a.id; });
    Object.keys(areaActiveCounts).concat(Object.keys(areaPublishedCounts)).forEach(function (a) { if (a && areaKeys.indexOf(a) === -1) areaKeys.push(a); });
    var areaSummary = areaKeys.map(function (id) {
      return { area: areaName(id) || "(área eliminada)", active: areaActiveCounts[id] || 0, published: areaPublishedCounts[id] || 0, avgActiveMs: avg(areaActiveDurations[id] || []), avgPublishMs: avg(areaDurations[id] || []) };
    }).sort(function (x, y) { return y.active + y.published - (x.active + x.published); });

    return {
      active: active, published: published, total: state.cases.length, withRework: withRework, reworkTotal: reworkTotal,
      avgPublished: avg(publishedDurations),
      stageAverages: Object.keys(stageDurations).map(function (k) { return { label: (STAGES[k] || {}).label || k, ms: avg(stageDurations[k]) }; }).sort(function (a, b) { return b.ms - a.ms; }),
      areaAverages: Object.keys(areaDurations).map(function (k) { return { label: areaName(k) || k, ms: avg(areaDurations[k]) }; }).sort(function (a, b) { return b.ms - a.ms; }),
      areaSummary: areaSummary,
      stuckList: stuckList.sort(function (a, b) { return b.ms - a.ms; })
    };
  }

  // ======================================================= Nueva solicitud
  function renderNuevaSolicitud(box) {
    var canCreate = myRoles().indexOf("area") !== -1 || isAdmin();
    if (!canCreate) {
      box.innerHTML = '<div class="card card-pad"><p class="hint">Solo alguien con el puesto "Área requirente" (o el administrador) puede registrar una solicitud nueva.</p></div>';
      return;
    }
    var showAreaSelect = isAdmin() && myRoles().indexOf("area") === -1;
    box.innerHTML = '<div class="card card-pad">' +
      (showAreaSelect ? "" : '<p class="hint" style="margin-bottom:12px;">Registrando como <strong>' + esc(state.me.full_name || state.me.email) + "</strong>" + (myAreaId() ? " · Área: <strong>" + esc(areaName(myAreaId())) + "</strong>" : "") + "</p>") +
      '<form id="new-case-form" class="stack">' +
      '<div class="form-grid">' +
      '<div class="field"><label>Descripción de lo que se va a comprar</label><input type="text" class="f-title" placeholder="Ej. Repuestos para subestación Los Mina" required></div>' +
      (showAreaSelect ? '<div class="field"><label>Área requirente</label><select class="f-area">' + state.areas.map(function (a) { return optHtml(a.id, a.name); }).join("") + "</select></div>" +
        '<div class="field"><label>Solicitado por (opcional)</label><input type="text" class="f-solicitante" placeholder="Nombre de quien solicita"></div>' : "") +
      "</div>" +
      '<div class="field" style="max-width:280px;"><label>Tipo de proceso</label><div class="radio-row">' +
      '<label><input type="radio" name="f-tipo" value="menor" checked> Compra menor</label>' +
      '<label><input type="radio" name="f-tipo" value="licitacion"> Licitación</label>' +
      "</div></div>" +
      '<div class="attach-block" style="border-top:none; padding-top:0; margin-top:0;">' +
      '<p class="attach-title">Archivos adjuntos (opcional)</p>' +
      '<ul class="attach-list f-staged-list"></ul>' +
      '<p class="attach-empty f-attach-empty">Sin archivos adjuntos todavía.</p>' +
      '<button type="button" class="btn ghost small f-btn-attach">📎 Adjuntar archivo</button><input type="file" class="f-attach-input" hidden>' +
      "</div>" +
      '<div class="form-actions"><button type="submit" class="btn">Registrar solicitud</button><span class="hint">Entra al proceso en la etapa de Secretaría Administrativa.</span></div>' +
      "</form></div>";

    var staged = [];
    var form = $("#new-case-form");
    var fileInput = $(".f-attach-input", form);
    $(".f-btn-attach", form).addEventListener("click", function () { fileInput.click(); });
    fileInput.addEventListener("change", function () {
      var file = fileInput.files[0];
      fileInput.value = "";
      if (!file) return;
      if (file.size > ATTACH_MAX_BYTES) { showToast("Archivo muy grande", "Límite " + fmtBytes(ATTACH_MAX_BYTES), true); return; }
      staged.push(file);
      renderStagedList();
    });
    function renderStagedList() {
      var list = $(".f-staged-list", form);
      list.innerHTML = staged.map(function (f, i) {
        return '<li class="attach-item"><div class="attach-meta"><span class="attach-name">' + esc(f.name) + '</span><span class="attach-who">' + fmtBytes(f.size) + '</span></div>' +
          '<div class="attach-actions"><button type="button" class="btn ghost small f-remove-staged" data-idx="' + i + '">Quitar</button></div></li>';
      }).join("");
      $$(".f-remove-staged", list).forEach(function (b) { b.addEventListener("click", function () { staged.splice(Number(b.getAttribute("data-idx")), 1); renderStagedList(); }); });
    }

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      var title = $(".f-title", form).value.trim();
      if (!title) return;
      var areaId, solicitante;
      if (showAreaSelect) {
        areaId = $(".f-area", form).value;
        if (!areaId) { await showAlert("Registra un área requirente primero en \"Áreas y usuarios\"."); return; }
        solicitante = $(".f-solicitante", form).value.trim() || "Administrador";
      } else {
        areaId = myAreaId();
        solicitante = state.me.full_name || state.me.email;
      }
      var tipo = form.querySelector('input[name="f-tipo"]:checked').value;
      var submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      try {
        var secretarias = profilesByRole("secretaria");
        var caseFields = { title: title, tipo: tipo, area_id: areaId, solicitante: solicitante, stage: "secretaria" };
        if (secretarias.length === 1) caseFields.secretaria_id = secretarias[0].id;
        var created = await DB.createCase(caseFields);
        await DB.insertEvent({ case_id: created.id, stage_held: "secretaria", actor_id: state.me.id, actor_name: solicitante, role_label: areaName(areaId), action: "registró la solicitud de compra", duration_ms: 0 });
        for (var i = 0; i < staged.length; i++) {
          await DB.uploadAttachment(created.id, staged[i], state.me.id, state.me.full_name || state.me.email);
        }
        if (secretarias.length === 1) {
          await DB.logNotification(secretarias[0].email, secretarias[0].full_name, "Nueva solicitud de compra registrada",
            "Se registró la solicitud \"" + title + "\" (" + areaName(areaId) + ") y quedó asignada a ti en la Secretaría Administrativa.", created.id);
          showToast("📧 Notificación enviada (simulada)", "Para: " + secretarias[0].email);
        }
        showToast("Solicitud registrada", title);
        state.activeTab = "procesos";
        await refreshData(true);
        renderSidebar();
      } catch (err) {
        console.error(err);
        showToast("No se pudo registrar", String(err.message || err), true);
      } finally { submitBtn.disabled = false; }
    });
  }

  // =========================================================== Procesos
  function renderProcesos(box) {
    var areaOpts = state.areas.map(function (a) { return optHtml(a.id, a.name); }).join("");
    box.innerHTML =
      '<div class="cases-filter-row">' +
      '<label>Filtrar por área: <select id="cases-area-filter"><option value="">Todas</option>' + areaOpts + "</select></label>" +
      '<span class="queue-note" id="cases-filter-summary"></span>' +
      "</div>" +
      '<div class="case-list" id="cases-list"></div>';
    $("#cases-area-filter").value = state.caseFilterArea;
    $("#cases-area-filter").addEventListener("change", function () { state.caseFilterArea = this.value; renderCasesList(); });
    renderCasesList();
  }
  function renderCasesList() {
    var list = $("#cases-list");
    if (!list) return;
    var cases = state.cases.slice().sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
    var filtered = state.caseFilterArea ? cases.filter(function (c) { return c.area_id === state.caseFilterArea; }) : cases;
    var summary = $("#cases-filter-summary");
    if (summary) summary.textContent = state.caseFilterArea ? filtered.length + " proceso(s) de " + areaName(state.caseFilterArea) + "." : "";
    if (!filtered.length) { list.innerHTML = '<p class="empty">No hay procesos registrados todavía. Crea el primero en "Nueva solicitud".</p>'; return; }
    list.innerHTML = filtered.map(caseCardHTML).join("");
    updateAllTimers();
  }

  function caseCardHTML(c) {
    var meta = STAGES[c.stage] || { label: c.stage };
    var events = eventsForCase(c.id);
    var created = new Date(c.created_at).getTime();
    var lastTs = events.length ? new Date(events[events.length - 1].ts).getTime() : created;
    var closed = c.stage === "publicado" || c.stage === "cancelado";
    var stuck = !closed && (Date.now() - lastTs) > STUCK_MS;
    var attachments = attachmentsForCase(c.id);

    var closedNote = "";
    if (c.stage === "publicado") closedNote = '<p class="hint" style="margin-top:10px;">Publicado el ' + fmtDateTime(events[events.length - 1] ? events[events.length - 1].ts : c.updated_at) + '. Continúa en el Portal Transaccional de la DGCP.</p>';
    if (c.stage === "cancelado") closedNote = '<p class="hint" style="margin-top:10px;">Proceso cancelado.</p>';

    return '<article class="case-card" data-stage="' + esc(c.stage) + '" data-id="' + esc(c.id) + '" data-created="' + esc(c.created_at) + '" data-closed="' + (closed ? "1" : "0") + '">' +
      '<div class="case-head"><div>' +
      '<h3 class="case-title">' + esc(c.title) + "</h3>" +
      '<div class="case-meta">' +
      '<span class="pill pill-muted">' + caseDisplayNumber(c) + "</span>" +
      '<span class="pill pill-tipo">' + (c.tipo === "licitacion" ? "Licitación" : "Compra menor") + "</span>" +
      '<span class="pill pill-stage">' + esc(meta.label) + "</span>" +
      (c.rework_count ? '<span class="pill pill-warn">' + c.rework_count + " devolución(es)</span>" : "") +
      "</div>" +
      '<div class="case-area">' + esc(areaName(c.area_id)) + "</div>" +
      "</div></div>" +
      '<div class="case-timers">' +
      '<div class="timer' + (stuck ? " stuck" : "") + ' js-timer-stage" data-since="' + lastTs + '" data-closed="' + (closed ? "1" : "0") + '"><span class="num">…</span> en etapa actual</div>' +
      '<div class="timer js-timer-total" data-since="' + created + '" data-until="' + (closed ? lastTs : "") + '"><span class="num">…</span> transcurridas en total</div>' +
      "</div>" +
      actionPanelHTML(c) +
      attachBlockHTML(c, attachments) +
      closedNote +
      timelineHTML(events) +
      "</article>";
  }

  function timelineHTML(events) {
    return '<details class="timeline-wrap"><summary>Historial</summary><ol class="timeline">' +
      events.map(function (e, i) {
        var durHtml = "";
        if (i > 0 && e.duration_ms) durHtml = '<p class="event-duration">Duración en la etapa anterior: ' + fmtDurationPrecise(e.duration_ms) + " horas</p>";
        return '<li class="event"><time>' + esc(fmtDateTime(e.ts)) + '</time><p class="event-line"><span class="event-actor">' + esc(e.actor_name || "—") + '</span> · <span class="event-role">' + esc(e.role_label || "") + "</span> — " + esc(e.action) + "</p>" +
          durHtml + (e.note ? '<p class="event-note">' + esc(e.note) + "</p>" : "") + "</li>";
      }).join("") + "</ol></details>";
  }

  function actionPanelHTML(c) {
    if (c.stage === "publicado" || c.stage === "cancelado") return "";
    var caseId = c.id, who = "", body = "";

    if (c.stage === "secretaria") {
      who = whoLine("secretaria", c.secretaria_id, false);
      var secChecks = [
        { key: "secretaria:area_verificada", label: "Verifiqué que el área requirente existe y los datos de la solicitud son correctos" },
        { key: "secretaria:archivado", label: "Descargué la comunicación y la archivé digital y físicamente" }
      ];
      body = checklistHTML(caseId, secChecks) +
        '<div class="action-buttons">' + actorBtn("to-gerente", "Recibir y remitir a Gerencia de Compras", "secretaria", c.secretaria_id, false, "", caseId, secChecks.map(function (i) { return i.key; })) + "</div>";
    } else if (c.stage === "gerente") {
      who = whoLine("gerente", c.gerente_id, false);
      var gerChecks = [{ key: "gerente:tipo_confirmado", label: "Confirmé si el proceso es Compra menor o Licitación y contrataciones" }];
      var coordNames = coordinadoresParaTipo(c.tipo);
      body = checklistHTML(caseId, gerChecks) +
        assignSelectOrHint("coordinador", "Coordinador a asignar", "to-coordinador", "Asignar coordinador y remitir", "gerente", c.gerente_id, false, caseId, gerChecks.map(function (i) { return i.key; }), coordNames) +
        devolverSectionHTML(c, "gerente", c.gerente_id, false);
    } else if (c.stage === "coordinador") {
      who = whoLine("coordinador", c.coordinador_id, false);
      body = assignSelectOrHint("analista", "Analista a asignar", "to-analista", "Asignar analista y remitir", "coordinador", c.coordinador_id, false, caseId) +
        devolverSectionHTML(c, "coordinador", c.coordinador_id, false);
    } else if (c.stage === "analista" || c.stage === "correccion") {
      who = whoLine("analista", c.analista_id, false) + (c.stage === "correccion" ? '<div class="hint" style="margin-bottom:8px;">Objeción de Consultoría Jurídica — ver historial abajo.</div>' : "");
      var analChecks = c.stage === "analista" ? [{ key: "analista:sin_marca", label: "Verifiqué que las especificaciones no señalan marca ni modelo de un suplidor específico" }] : [];
      body = (c.stage === "analista" ? '<div class="action-row"><div class="field"><label>Nota del pliego (opcional)</label><input type="text" class="note-input" placeholder="Observaciones para Jurídico…"></div></div>' : "") +
        checklistHTML(caseId, analChecks) +
        '<div class="action-buttons">' + actorBtn("to-juridico", c.stage === "correccion" ? "Reenviar a Jurídico ya corregido" : "Enviar pliego a Consultoría Jurídica", "analista", c.analista_id, false, "", caseId, analChecks.map(function (i) { return i.key; })) + "</div>" +
        devolverSectionHTML(c, "analista", c.analista_id, false);
    } else if (c.stage === "area-correccion") {
      who = whoLine("area", c.area_id, true);
      body = '<div class="action-buttons">' + actorBtn("to-analista-post-area", "Enviar corrección al Analista", "area", c.area_id, true) + "</div>";
    } else if (c.stage === "juridico") {
      who = whoLine("juridico", null, false);
      var jurChecks = [{ key: "juridico:aceptable", label: "Revisé las especificaciones del pliego y son aceptables" }];
      body = checklistHTML(caseId, jurChecks) +
        '<div class="action-buttons">' + actorBtn("to-publicacion", "Aprobar y dar visto bueno", "juridico", null, false, "", caseId, jurChecks.map(function (i) { return i.key; })) + "</div>" +
        devolverSectionHTML(c, "juridico", null, false);
    } else if (c.stage === "publicacion") {
      who = whoLine("gerente", c.gerente_id, false);
      var pubChecks = [{ key: "publicacion:listo_publicar", label: "El proceso está listo para publicarse (documentación completa)" }];
      body = checklistHTML(caseId, pubChecks) +
        '<div class="action-buttons">' + actorBtn("to-publicado", "Marcar como publicado", "gerente", c.gerente_id, false, "", caseId, pubChecks.map(function (i) { return i.key; })) + "</div>";
    }

    var cancelBtn = actorBtn("cancelar", "Cancelar proceso", "gerente", null, false, "ghost");
    return '<div class="action-box">' + who + body + '<div class="action-buttons" style="margin-top:8px;">' + cancelBtn + "</div></div>";
  }

  function attachBlockHTML(c, attachments) {
    return '<div class="attach-block"><p class="attach-title">Archivos adjuntos</p><ul class="attach-list">' +
      attachments.map(function (a) {
        return '<li class="attach-item" data-att-id="' + esc(a.id) + '"><div class="attach-meta"><span class="attach-name attach-view" data-path="' + esc(a.storage_path) + '" data-name="' + esc(a.file_name) + '">' + esc(a.file_name) + '</span>' +
          '<span class="attach-who">' + esc(a.uploaded_by_name) + " · " + esc(fmtDateTime(a.created_at)) + " · " + fmtBytes(a.file_size) + "</span></div>" +
          '<div class="attach-actions"><button type="button" class="btn ghost small attach-view" data-path="' + esc(a.storage_path) + '" data-name="' + esc(a.file_name) + '">Ver</button>' +
          ((a.uploaded_by === (state.me && state.me.id) || isAdmin()) ? '<button type="button" class="btn ghost small attach-delete" data-att-id="' + esc(a.id) + '">Quitar</button>' : "") + "</div></li>";
      }).join("") + "</ul>" +
      '<p class="attach-empty">Sin archivos adjuntos todavía.</p>' +
      '<button type="button" class="btn ghost small btn-attach">📎 Adjuntar archivo</button><input type="file" class="attach-file-input" hidden>' +
      "</div>";
  }

  function updateAllTimers() {
    var now = Date.now();
    $$(".js-timer-stage").forEach(function (el) {
      var since = Number(el.getAttribute("data-since"));
      $(".num", el).textContent = fmtDuration(now - since);
    });
    $$(".js-timer-total").forEach(function (el) {
      var since = Number(el.getAttribute("data-since"));
      var until = el.getAttribute("data-until");
      $(".num", el).textContent = fmtDuration((until ? Number(until) : now) - since);
    });
  }
  setInterval(function () { if (state.activeTab === "procesos") updateAllTimers(); }, 30000);

  // ---------------------------------------------------- wiring de acciones
  var _caseActionsWired = false;
  function wireCaseActionsOnce() {
    if (_caseActionsWired) return;
    _caseActionsWired = true;
    document.body.addEventListener("click", onContentClick);
    document.body.addEventListener("change", onContentChange);
  }

  async function onContentClick(e) {
    var attachView = e.target.closest(".attach-view");
    if (attachView) { openAttachPreview(attachView.getAttribute("data-path"), attachView.getAttribute("data-name")); return; }
    var attachDel = e.target.closest(".attach-delete");
    if (attachDel) { onDeleteAttachment(attachDel.getAttribute("data-att-id")); return; }
    var attachBtn = e.target.closest(".btn-attach");
    if (attachBtn) { $(".attach-file-input", attachBtn.closest(".attach-block")).click(); return; }

    var actionBtn = e.target.closest("button[data-do]");
    if (actionBtn && !actionBtn.disabled) { onCaseActionClick(actionBtn); return; }
  }
  function onContentChange(e) {
    var fileInput = e.target.closest(".attach-file-input");
    if (fileInput) { onAttachFileChosen(fileInput); return; }
    var gate = e.target.closest("input.gate-check");
    if (gate) { onChecklistToggle(gate); return; }
  }

  function onChecklistToggle(chk) {
    var caseEl = chk.closest(".case-card");
    if (!caseEl) return;
    var caseId = caseEl.getAttribute("data-id");
    var key = chk.getAttribute("data-check-key");
    var set = getChecklistSet(caseId);
    if (chk.checked) set.add(key); else set.delete(key);
    var box = chk.closest(".action-box");
    $$("button[data-requires-checks]", box).forEach(function (btn) {
      var req = (btn.getAttribute("data-requires-checks") || "").split(",").filter(Boolean);
      var role = btn.getAttribute("data-actor-role"), assigned = btn.getAttribute("data-actor-assigned") || null, matchArea = btn.getAttribute("data-actor-match-area") === "1";
      var identityOk = canAct(role, assigned || null, matchArea);
      var checksOk = req.every(function (k) { return set.has(k); });
      btn.disabled = !(identityOk && checksOk);
    });
  }

  async function onAttachFileChosen(input) {
    var file = input.files[0];
    input.value = "";
    if (!file) return;
    if (file.size > ATTACH_MAX_BYTES) { await showAlert("El archivo pesa " + fmtBytes(file.size) + ". El límite por archivo aquí es " + fmtBytes(ATTACH_MAX_BYTES) + "."); return; }
    var caseEl = input.closest(".case-card");
    var caseId = caseEl.getAttribute("data-id");
    try {
      await DB.uploadAttachment(caseId, file, state.me.id, state.me.full_name || state.me.email);
      showToast("Archivo adjuntado", file.name);
      await refreshData(true);
    } catch (err) { console.error(err); showToast("No se pudo adjuntar", String(err.message || err), true); }
  }
  async function onDeleteAttachment(attId) {
    var att = state.attachments.filter(function (a) { return a.id === attId; })[0];
    if (!att) return;
    if (!(await showConfirm('¿Quitar el archivo "' + att.file_name + '"?'))) return;
    try { await DB.deleteAttachment(att); showToast("Archivo eliminado", att.file_name); await refreshData(true); }
    catch (err) { showToast("No se pudo eliminar", String(err.message || err), true); }
  }
  async function openAttachPreview(path, filename) {
    var overlay = $("#preview-overlay"), titleEl = $("#preview-title"), content = $("#preview-content");
    titleEl.textContent = filename || "Archivo adjunto";
    content.innerHTML = '<p class="hint">Cargando vista previa…</p>';
    overlay.hidden = false;
    document.body.classList.add("modal-open");
    try {
      var url = await DB.getSignedUrl(path);
      var mime = "";
      var ext = (filename || "").split(".").pop().toLowerCase();
      if (["png", "jpg", "jpeg", "gif", "webp"].indexOf(ext) !== -1) {
        content.innerHTML = "";
        var img = document.createElement("img"); img.className = "preview-img"; img.src = url; img.alt = filename || "";
        content.appendChild(img);
      } else if (ext === "pdf") {
        content.innerHTML = "";
        var ifr = document.createElement("iframe"); ifr.className = "preview-pdf"; ifr.src = url; ifr.title = filename || "";
        content.appendChild(ifr);
      } else {
        content.innerHTML = '<p class="hint">Vista previa no disponible para este tipo de archivo. <a href="' + esc(url) + '" target="_blank" rel="noopener">Ábrelo en una pestaña nueva</a>.</p>';
      }
    } catch (err) { content.innerHTML = '<p class="hint">No se pudo generar la vista previa: ' + esc(String(err.message || err)) + "</p>"; }
  }
  function closeAttachPreview() {
    var overlay = $("#preview-overlay");
    if (!overlay || overlay.hidden) return;
    overlay.hidden = true;
    document.body.classList.remove("modal-open");
    $("#preview-content").innerHTML = "";
  }

  async function onCaseActionClick(btn) {
    var caseEl = btn.closest(".case-card");
    var caseId = caseEl.getAttribute("data-id");
    var c = state.cases.filter(function (x) { return x.id === caseId; })[0];
    if (!c) return;
    var role = btn.getAttribute("data-actor-role");
    var assigned = btn.getAttribute("data-actor-assigned") || null;
    var matchArea = btn.getAttribute("data-actor-match-area") === "1";
    if (!canAct(role, assigned, matchArea)) { await showAlert("Esta acción le corresponde a otra persona. Inicia sesión con tu propia cuenta."); return; }
    var actorId = state.me.id, actorName = state.me.full_name || state.me.email;
    var roleLabelForEvent = isAdmin() && !meMatchesRole(role, assigned, matchArea) ? "Administrador" : (ROLE_LABELS[role] || role);
    var actionBox = caseEl.querySelector(".action-box");
    var targetSel = actionBox.querySelector(".target-select");
    var noteInput = actionBox.querySelector(".note-input");
    var target = targetSel ? targetSel.value : "";
    var note = noteInput ? noteInput.value.trim() : "";
    var do_ = btn.getAttribute("data-do");

    btn.disabled = true;
    try {
      if (do_ === "to-gerente") {
        await transition(c, "gerente", { actor: actorName, roleLabel: roleLabelForEvent, action: "recibió la solicitud y la remitió a Gerencia de Compras" });
      } else if (do_ === "to-coordinador") {
        if (!target) { await showAlert("Selecciona un coordinador."); btn.disabled = false; return; }
        var coordP = profileById(target);
        await transition(c, "coordinador", { actor: actorName, roleLabel: roleLabelForEvent, action: "asignó coordinador: " + (coordP ? coordP.full_name : ""), setFields: { coordinador_id: target }, notify: coordP, subject: "Proceso asignado como coordinador", body: actorName + " te asignó como coordinador del proceso." });
      } else if (do_ === "to-analista") {
        if (!target) { await showAlert("Selecciona un analista."); btn.disabled = false; return; }
        var analP = profileById(target);
        await transition(c, "analista", { actor: actorName, roleLabel: roleLabelForEvent, action: "asignó analista: " + (analP ? analP.full_name : ""), setFields: { analista_id: target }, notify: analP, subject: "Proceso asignado como analista", body: actorName + " te asignó como analista del proceso." });
      } else if (do_ === "to-juridico") {
        var label = c.stage === "correccion" ? "reenvió el pliego corregido a Consultoría Jurídica" : "elaboró el pliego y lo remitió a Consultoría Jurídica";
        await transition(c, "juridico", { actor: actorName, roleLabel: roleLabelForEvent, action: label, note: note });
      } else if (do_ === "to-analista-post-area") {
        await transition(c, "analista", { actor: actorName, roleLabel: roleLabelForEvent, action: "corrigió la solicitud y la reenvió al Analista" });
      } else if (do_ === "to-publicacion") {
        await transition(c, "publicacion", { actor: actorName, roleLabel: roleLabelForEvent, action: "aprobó el pliego y dio visto bueno" });
      } else if (do_ === "to-publicado") {
        await transition(c, "publicado", { actor: actorName, roleLabel: roleLabelForEvent, action: "publicó el proceso" });
      } else if (do_ === "cancelar") {
        if (!(await showConfirm("¿Cancelar este proceso?"))) { btn.disabled = false; return; }
        await transition(c, "cancelado", { actor: actorName, roleLabel: roleLabelForEvent, action: "canceló el proceso" });
      } else if (do_ === "devolver") {
        var devolverSel = actionBox.querySelector(".devolver-target-select");
        var devolverNoteInput = actionBox.querySelector(".devolver-note-input");
        var devolverTarget = devolverSel ? devolverSel.value : "";
        var devolverNote = devolverNoteInput ? devolverNoteInput.value.trim() : "";
        if (!devolverTarget) { await showAlert("Selecciona a quién se devuelve el proceso."); btn.disabled = false; return; }
        if (!devolverNote) { await showAlert("Escribe el motivo de la devolución."); btn.disabled = false; return; }
        var sepIdx = devolverTarget.indexOf(":");
        var targetRole = devolverTarget.slice(0, sepIdx);
        var targetId = devolverTarget.slice(sepIdx + 1);
        var targetStage = DEVOLVER_STAGE_FOR_ROLE[targetRole];
        var setFields = {}, notifyP = null, notifySubject = "Proceso devuelto para tu atención", notifyBody = "";
        var targetLabel;
        if (targetRole === "area") {
          targetLabel = "el área requirente (" + areaName(c.area_id) + ")";
          notifyBody = actorName + " devolvió el proceso al área requirente. Motivo: " + devolverNote;
        } else {
          var fieldName = DEVOLVER_FIELD_FOR_ROLE[targetRole];
          setFields[fieldName] = targetId;
          notifyP = profileById(targetId);
          targetLabel = (ROLE_LABELS[targetRole] || targetRole) + ": " + (notifyP ? notifyP.full_name : "");
          notifyBody = actorName + " te devolvió el proceso. Motivo: " + devolverNote;
        }
        await transition(c, targetStage, { actor: actorName, roleLabel: roleLabelForEvent, action: "devolvió el proceso a " + targetLabel, note: devolverNote, isReturn: true, setFields: setFields, notify: notifyP, notifyArea: targetRole === "area" ? c.area_id : null, subject: notifySubject, body: notifyBody });
      }
      await refreshData(true);
      renderSidebar();
    } catch (err) {
      console.error(err);
      showToast("No se pudo completar la acción", String((err && err.message) || err), true);
    } finally { btn.disabled = false; }
  }

  async function transition(c, toStage, opts) {
    var events = eventsForCase(c.id);
    var prevTs = events.length ? new Date(events[events.length - 1].ts).getTime() : new Date(c.created_at).getTime();
    var nowIso = new Date().toISOString();
    var durationMs = Math.max(0, new Date(nowIso).getTime() - prevTs);

    var fields = Object.assign({ stage: toStage, updated_at: nowIso }, opts.setFields || {});
    if (toStage === "correccion" || opts.isReturn) fields.rework_count = (c.rework_count || 0) + 1;
    await DB.updateCase(c.id, fields);
    await DB.insertEvent({ case_id: c.id, ts: nowIso, stage_held: toStage, actor_id: state.me.id, actor_name: opts.actor, role_label: opts.roleLabel, action: opts.action, note: opts.note || "", duration_ms: durationMs });

    if (opts.notify && opts.notify.email) {
      await DB.logNotification(opts.notify.email, opts.notify.full_name, opts.subject || "Proceso actualizado: " + c.title, opts.body || opts.action, c.id);
      showToast("📧 Notificación enviada (simulada)", "Para: " + opts.notify.email);
    } else if (opts.notifyArea) {
      var areaUsers = profilesByRole("area").filter(function (p) { return p.area_id === opts.notifyArea; });
      for (var i = 0; i < areaUsers.length; i++) {
        if (areaUsers[i].email) await DB.logNotification(areaUsers[i].email, areaUsers[i].full_name, opts.subject || "Proceso actualizado: " + c.title, opts.body || opts.action, c.id);
      }
      if (areaUsers.length) showToast("📧 Notificación enviada (simulada)", areaUsers.length + " persona(s) del área");
    }
  }

  // ===================================================== Panorama/tiempos
  function renderPanorama(box) {
    var stats = computeStats();
    box.innerHTML =
      '<div class="page-head-actions" style="margin-bottom:16px;"><button type="button" class="btn secondary small" id="export-csv-btn">⬇ Descargar historial (CSV)</button></div>' +
      '<div class="chart-grid">' +
      '<div class="card"><div class="card-title">Tiempo promedio por etapa</div><div class="card-pad">' + renderBars(stats.stageAverages) + "</div></div>" +
      '<div class="card"><div class="card-title">Tiempo total promedio por área (publicados)</div><div class="card-pad">' + renderBars(stats.areaAverages) + "</div></div>" +
      "</div>" +
      '<div class="card" style="margin-top:16px;"><div class="card-title">Procesos por área requirente</div><div class="card-pad">' + renderAreaSummaryTable(stats.areaSummary) + "</div></div>";
    $("#export-csv-btn").addEventListener("click", exportHistoryCSV);
  }
  function renderBars(list) {
    if (!list.length) return '<p class="chart-empty">Todavía no hay suficiente historial para calcular esto.</p>';
    var max = Math.max.apply(null, list.map(function (x) { return x.ms; })) || 1;
    return list.map(function (x, i) {
      return '<div class="bar-row' + (i === 0 ? " bottleneck" : "") + '"><div class="name">' + esc(x.label) + '</div><div class="bar-track"><div class="bar-fill" style="width:' + Math.max(4, Math.round((100 * x.ms) / max)) + '%"></div></div><div class="val num">' + fmtDuration(x.ms) + "</div></div>";
    }).join("");
  }
  function renderAreaSummaryTable(list) {
    if (!list.length) return '<p class="chart-empty">Aún no hay áreas requirentes registradas.</p>';
    return '<div class="table-wrap"><table class="list"><thead><tr><th>Área requirente</th><th class="num">Activos</th><th class="num">Publicados</th><th class="num">T. interno prom.</th><th class="num">T. hasta publicar</th></tr></thead><tbody>' +
      list.map(function (x) {
        return "<tr><td>" + esc(x.area) + '</td><td class="num">' + x.active + '</td><td class="num">' + x.published + '</td><td class="num">' + (x.avgActiveMs ? fmtDuration(x.avgActiveMs) : "—") + '</td><td class="num">' + (x.avgPublishMs ? fmtDuration(x.avgPublishMs) : "—") + "</td></tr>";
      }).join("") + "</tbody></table></div>";
  }
  function csvEscape(v) { var s = String(v == null ? "" : v); return /["\n,]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  function exportHistoryCSV() {
    var rows = [["Núm. de proceso", "Proceso", "Tipo", "Área", "Etapa alcanzada", "Actor", "Puesto", "Acción", "Nota", "Fecha y hora", "Duración en la etapa anterior"]];
    state.cases.forEach(function (c) {
      eventsForCase(c.id).forEach(function (e) {
        rows.push([caseDisplayNumber(c), c.title, c.tipo === "licitacion" ? "Licitación" : "Compra menor", areaName(c.area_id), (STAGES[e.stage_held] || {}).label || e.stage_held, e.actor_name, e.role_label, e.action, e.note, fmtDateTime(e.ts), e.duration_ms ? fmtDurationPrecise(e.duration_ms) : "—"]);
      });
    });
    if (rows.length <= 1) { showAlert("Todavía no hay historial registrado para exportar."); return; }
    var csv = "﻿" + rows.map(function (r) { return r.map(csvEscape).join(","); }).join("\r\n");
    var blob = new Blob([csv], { type: "text/csv" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = "bitacora-licitaciones-" + new Date().toISOString().slice(0, 10) + ".csv";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  // =================================================== Áreas y usuarios
  function renderAreasUsuarios(box) {
    box.innerHTML =
      '<p class="hint" style="margin-bottom:16px;">' + (isAdmin() ? "Como administrador puedes crear áreas y asignar puestos a cada persona registrada." : "Solo el administrador puede editar áreas y el directorio de usuarios.") + "</p>" +
      '<div class="form-grid" style="align-items:start;">' +
      '<div class="card"><div class="card-title">Áreas requirentes</div><div class="card-pad">' +
      '<div class="area-list" id="areas-list"></div>' +
      (isAdmin() ? '<div class="action-row" style="margin-top:10px;"><div class="field"><label>Nueva área</label><input type="text" id="areas-add-name" placeholder="Nombre del área"></div><div class="field"><label>Gerente/director responsable</label><input type="text" id="areas-add-manager" placeholder="Nombre"></div></div><button type="button" class="btn secondary small" id="areas-add-btn" style="margin-top:8px;">+ agregar área</button>' : "") +
      "</div></div>" +
      '<div class="card"><div class="card-title">Directorio de usuarios</div><div class="card-pad">' +
      (isAdmin() ? '<p class="hint" style="margin-bottom:10px;">Para agregar una persona nueva, pídele que cree su cuenta en la pantalla de inicio de sesión ("Crear cuenta"). En cuanto lo haga, aparecerá aquí — sin puesto — para que se lo asignes.</p>' : "") +
      '<div class="user-list" id="users-list"></div>' +
      "</div></div>" +
      "</div>";
    renderAreasChips();
    renderUsersList();
    if (isAdmin()) $("#areas-add-btn").addEventListener("click", onAddArea);
  }

  function renderAreasChips() {
    var box = $("#areas-list");
    if (!box) return;
    if (!state.areas.length) { box.innerHTML = '<p class="hint">Aún no hay áreas registradas.</p>'; return; }
    box.innerHTML = state.areas.map(function (a) {
      return '<span class="area-chip-wrap" data-area-id="' + esc(a.id) + '"><span class="area-chip">' + esc(a.name) + "</span>" +
        (a.manager_name ? '<span class="area-chip-manager">— Resp.: ' + esc(a.manager_name) + "</span>" : "") +
        (isAdmin() ? '<button type="button" class="icon-btn area-rename-btn" title="Renombrar">✎</button><button type="button" class="icon-btn area-manager-btn" title="Responsable">🧑</button><button type="button" class="icon-btn danger area-remove-btn" title="Quitar">×</button>' : "") +
        "</span>";
    }).join("");
    if (!isAdmin()) return;
    $$(".area-rename-btn", box).forEach(function (b) { b.addEventListener("click", function () { onRenameArea(b.closest(".area-chip-wrap").getAttribute("data-area-id")); }); });
    $$(".area-manager-btn", box).forEach(function (b) { b.addEventListener("click", function () { onSetAreaManager(b.closest(".area-chip-wrap").getAttribute("data-area-id")); }); });
    $$(".area-remove-btn", box).forEach(function (b) { b.addEventListener("click", function () { onRemoveArea(b.closest(".area-chip-wrap").getAttribute("data-area-id")); }); });
  }
  async function onAddArea() {
    var name = $("#areas-add-name").value.trim();
    if (!name) return;
    var manager = $("#areas-add-manager").value.trim();
    try { await DB.createArea(name, manager); $("#areas-add-name").value = ""; $("#areas-add-manager").value = ""; showToast("Área agregada", name); await refreshData(true); }
    catch (err) { showToast("No se pudo agregar", String(err.message || err), true); }
  }
  async function onRenameArea(id) {
    var a = areaById(id); if (!a) return;
    var nv = await showPrompt("Nuevo nombre del área:", a.name);
    if (!nv || !nv.trim()) return;
    try { await DB.updateArea(id, { name: nv.trim() }); await refreshData(true); } catch (err) { showToast("No se pudo renombrar", String(err.message || err), true); }
  }
  async function onSetAreaManager(id) {
    var a = areaById(id); if (!a) return;
    var nv = await showPrompt('Gerente o director responsable de "' + a.name + '":', a.manager_name || "");
    if (nv === null) return;
    try { await DB.updateArea(id, { manager_name: nv.trim() }); await refreshData(true); } catch (err) { showToast("No se pudo actualizar", String(err.message || err), true); }
  }
  async function onRemoveArea(id) {
    var a = areaById(id); if (!a) return;
    if (!(await showConfirm('¿Quitar el área "' + a.name + '"? Los procesos que ya la usan no se verán afectados.'))) return;
    try { await DB.deleteArea(id); await refreshData(true); } catch (err) { showToast("No se pudo quitar", String(err.message || err), true); }
  }

  function renderUsersList() {
    var box = $("#users-list");
    if (!box) return;
    var sorted = state.profiles.slice().sort(function (a, b) {
      var ap = !a.roles || !a.roles.length, bp = !b.roles || !b.roles.length;
      if (ap !== bp) return ap ? -1 : 1;
      return (a.full_name || a.email).localeCompare(b.full_name || b.email);
    });
    if (!sorted.length) { box.innerHTML = '<p class="hint">Todavía no hay nadie registrado.</p>'; return; }
    box.innerHTML = sorted.map(function (p) {
      var pending = !p.roles || !p.roles.length;
      return '<div class="user-row-wrap" data-user-id="' + esc(p.id) + '">' +
        '<div class="user-row"><div class="user-row-main"><span class="avatar">' + esc(initials(p.full_name || p.email)) + '</span>' +
        '<div class="user-row-text"><span class="u-name">' + esc(p.full_name || p.email) + (p.is_admin ? " · Admin" : "") + '</span>' +
        '<span class="u-meta">' + (pending ? '<span style="color:var(--warning); font-weight:600;">Sin puesto asignado — pendiente</span>' : userMetaText(p)) + "</span></div></div>" +
        '<button type="button" class="btn ghost small profile-toggle">Perfil</button>' +
        "</div>" +
        '<div class="user-profile" hidden></div>' +
        "</div>";
    }).join("");
    $$(".profile-toggle", box).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var wrap = btn.closest(".user-row-wrap");
        var panel = $(".user-profile", wrap);
        panel.hidden = !panel.hidden;
        if (!panel.hidden) renderUserProfilePanel(panel, wrap.getAttribute("data-user-id"));
      });
    });
  }
  function userMetaText(p) {
    var tipoLabel = "";
    if (p.roles.indexOf("coordinador") !== -1 && p.coord_tipos && p.coord_tipos.length) {
      tipoLabel = " (" + p.coord_tipos.map(function (t) { return t === "menor" ? "Compras menores" : "Licitación"; }).join(" y ") + ")";
    }
    var lugar = p.roles.indexOf("area") !== -1 ? areaName(p.area_id) : p.department;
    return p.roles.map(function (r) { return ROLE_LABELS[r] || r; }).join(" · ") + (lugar ? " — " + lugar : "") + tipoLabel;
  }

  function renderUserProfilePanel(panel, userId) {
    var p = profileById(userId);
    if (!p) { panel.innerHTML = ""; return; }
    var pending = !p.roles || !p.roles.length;
    var rows = [
      ["Correo", p.email],
      ["Puesto(s)", pending ? "— (pendiente)" : p.roles.map(function (r) { return ROLE_LABELS[r] || r; }).join(", ")],
      ["Número de empleado", p.employee_id || "—"],
      ["Posición / cargo", p.position_title || "—"],
      ["Área / departamento", (p.roles.indexOf("area") !== -1 ? areaName(p.area_id) : p.department) || "—"]
    ];
    var html = '<dl class="profile-fields">' + rows.map(function (r) { return '<div class="pf-row"><dt>' + esc(r[0]) + "</dt><dd>" + esc(r[1]) + "</dd></div>"; }).join("") + "</dl>";
    if (isAdmin()) html += '<button type="button" class="btn ghost small profile-edit-toggle" style="margin-top:10px;">Editar perfil</button><div class="edit-user-wrap" hidden></div>';
    var events = state.events.filter(function (e) { return e.actor_id === userId; }).sort(function (a, b) { return new Date(b.ts) - new Date(a.ts); }).slice(0, 15);
    html += '<p class="hint" style="margin-top:12px; margin-bottom:6px;">Actividad reciente</p>';
    html += events.length ? '<ul class="profile-events">' + events.map(function (e) {
      var c = state.cases.filter(function (x) { return x.id === e.case_id; })[0];
      return '<li><time class="mono">' + esc(fmtDateTime(e.ts)) + "</time><span>" + esc(c ? c.title : "") + " — " + esc(e.action) + "</span></li>";
    }).join("") + "</ul>" : '<p class="hint">Sin actividad registrada todavía.</p>';
    panel.innerHTML = html;

    if (!isAdmin()) return;
    var editToggle = $(".profile-edit-toggle", panel);
    var editWrap = $(".edit-user-wrap", panel);
    editToggle.addEventListener("click", function () {
      editWrap.hidden = !editWrap.hidden;
      if (!editWrap.hidden) { editWrap.innerHTML = editUserFormHTML(p); wireEditUserForm(editWrap, p); }
    });
  }
  function editUserFormHTML(p) {
    var roleChecks = ["area", "secretaria", "gerente", "coordinador", "analista", "juridico"].map(function (r) {
      return '<label><input type="checkbox" class="eu-role-check" value="' + r + '"' + (p.roles.indexOf(r) !== -1 ? " checked" : "") + "> " + esc(ROLE_LABELS[r]) + "</label>";
    }).join("");
    var areaOpts = state.areas.map(function (a) { return optHtml(a.id, a.name) .replace('value="' + a.id + '"', 'value="' + a.id + '"' + (a.id === p.area_id ? " selected" : "")); }).join("");
    var coordMenor = p.coord_tipos && p.coord_tipos.indexOf("menor") !== -1;
    var coordLic = p.coord_tipos && p.coord_tipos.indexOf("licitacion") !== -1;
    return '<form class="edit-user-form stack" style="margin-top:10px;">' +
      '<div class="form-grid"><div class="field"><label>Nombre completo</label><input type="text" class="eu-name" value="' + esc(p.full_name) + '"></div>' +
      '<div class="field"><label>Número de empleado</label><input type="text" class="eu-employee-id" value="' + esc(p.employee_id) + '"></div></div>' +
      '<div class="form-grid"><div class="field"><label>Posición / cargo</label><input type="text" class="eu-position" value="' + esc(p.position_title) + '"></div>' +
      '<div class="field"><label>Departamento / área interna (si no es de un área requirente)</label><input type="text" class="eu-dept" value="' + esc(p.department) + '"></div></div>' +
      '<div class="field"><label>Puesto(s)</label><div class="roles-check eu-roles-check">' + roleChecks + "</div></div>" +
      '<div class="field eu-area-field"' + (p.roles.indexOf("area") === -1 ? " hidden" : "") + '><label>Área requirente</label><select class="eu-area">' + areaOpts + "</select></div>" +
      '<div class="field eu-coord-field"' + (p.roles.indexOf("coordinador") === -1 ? " hidden" : "") + '><label>Especialidad del coordinador (opcional)</label><div class="roles-check">' +
      '<label><input type="checkbox" class="eu-coord-menor"' + (coordMenor ? " checked" : "") + "> Compras menores</label>" +
      '<label><input type="checkbox" class="eu-coord-lic"' + (coordLic ? " checked" : "") + "> Licitación y contrataciones</label></div></div>" +
      '<div class="check-row"><label><input type="checkbox" class="eu-is-admin"' + (p.is_admin ? " checked" : "") + "> Es administrador de Procomly</label></div>" +
      '<div class="form-actions"><button type="submit" class="btn small">Guardar cambios</button> <button type="button" class="btn ghost small eu-cancel">Cancelar</button></div>' +
      "</form>";
  }
  function wireEditUserForm(wrap, p) {
    var form = $(".edit-user-form", wrap);
    $(".eu-cancel", form).addEventListener("click", function () { wrap.hidden = true; wrap.innerHTML = ""; });
    $(".eu-roles-check", form).addEventListener("change", function () {
      var areaChecked = form.querySelector('.eu-role-check[value="area"]').checked;
      $(".eu-area-field", form).hidden = !areaChecked;
      var coordChecked = form.querySelector('.eu-role-check[value="coordinador"]').checked;
      $(".eu-coord-field", form).hidden = !coordChecked;
    });
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      var roles = $$(".eu-role-check", form).filter(function (cb) { return cb.checked; }).map(function (cb) { return cb.value; });
      var areaChecked = roles.indexOf("area") !== -1;
      var areaId = areaChecked ? $(".eu-area", form).value : null;
      if (areaChecked && !areaId) { await showAlert("Selecciona un área requirente para esta persona."); return; }
      var coordTipos = roles.indexOf("coordinador") !== -1 ? [$(".eu-coord-menor", form).checked ? "menor" : null, $(".eu-coord-lic", form).checked ? "licitacion" : null].filter(Boolean) : [];
      var willBeAdmin = $(".eu-is-admin", form).checked;
      if (willBeAdmin && !p.is_admin) {
        if (!(await showConfirm(esc(p.full_name || p.email) + ' pasará a tener acceso total de administrador (puede editar todo, incluso a otros administradores). ¿Confirmas?'))) return;
      }
      try {
        await DB.updateProfile(p.id, {
          full_name: $(".eu-name", form).value.trim(),
          employee_id: $(".eu-employee-id", form).value.trim(),
          position_title: $(".eu-position", form).value.trim(),
          department: $(".eu-dept", form).value.trim(),
          roles: roles, area_id: areaId, coord_tipos: coordTipos, is_admin: willBeAdmin
        });
        showToast("Perfil actualizado", p.full_name || p.email);
        await refreshData(true);
        renderRoute();
      } catch (err) { showToast("No se pudo guardar", String(err.message || err), true); }
    });
  }
})();
