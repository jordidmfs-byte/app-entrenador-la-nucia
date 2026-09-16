
// ==========================================
// APP ENTRENADOR LA NUCÍA FS - FILIAL & JUVENIL
// ==========================================

let appState = {
  activeTeam: 'filial',
  teams: [],
  tasks: [],
  players: { filial: [], juvenil: [] },
  sessions: { filial: [], juvenil: [] },
  matches: { filial: [], juvenil: [] },
  videos: { filial: [], juvenil: [] },
  attendances: { filial: {}, juvenil: {} },
  ratings: { filial: {}, juvenil: {} }
};

let currentView = 'dashboard';
let taskFilterFase = 'all';
let taskSearchQuery = '';
let selectedWeekStart = null;

// Tactical Board Global State for Task Creation
let boardInitialTokens = [];
let boardTokens = [];
let boardStrokes = [];
let activeBoardTool = 'move';
let boardStrokeColor = '#E30613';
let isBoardDrawing = false;
let currentBoardStroke = null;
let draggedBoardToken = null;
let dragBoardOffset = { x: 0, y: 0 };
let selectedBoardToken = null;
let copiedBoardToken = null;
let boardCanvas = null;
let boardCtx = null;
let boardBackgroundImg = null;

function saveStateToStorage() {
  try {
    if (!appState) return;
    const lightTasks = (appState.tasks || []).map(t => {
      const copy = { ...t };
      if (Number(copy.id) <= 50 && copy.grafico && copy.grafico.length > 500) {
        delete copy.grafico;
      }
      return copy;
    });

    const lightState = {
      ...appState,
      tasks: lightTasks
    };

    localStorage.setItem('lanucia_app_state', JSON.stringify(lightState));
  } catch (e) {
    console.warn('LocalStorage save warning:', e);
  }
}

// Initialize
// Initialize
async function init() {
  currentView = 'dashboard';
  if (window.location.hash) {
    history.replaceState(null, null, ' ');
  }

  // 1. Render inicial inmediato desde cache local o defaults
  initWeekSelector();
  updateHeaderUI();
  renderView();

  // 2. Cargar datos del servidor Cloud DB (Neon) y refrescar vista
  await fetchState(false);
  initWeekSelector();
  updateHeaderUI();
  renderView();

  // 3. Polling en tiempo real cada 4 segundos para sincronización entre dispositivos
  if (!window.cloudSyncInterval) {
    window.cloudSyncInterval = setInterval(() => {
      fetchState(true);
    }, 4000);
  }
}

async function fetchState(silent = false) {
  try {
    let initData = null;
    const initialGraphicsMap = {};
    try {
      const resInit = await fetch('/initial_store.json');
      if (resInit.ok) {
        initData = await resInit.json();
        if (initData && initData.tasks) {
          initData.tasks.forEach(t => {
            if (t.id && t.grafico) {
              initialGraphicsMap[t.id] = t.grafico;
            }
          });
        }
      }
    } catch (e) {}

    // Fetch live state from Cloud DB via /api/state
    let serverData = null;
    try {
      const resServer = await fetch('/api/state');
      if (resServer.ok) {
        serverData = await resServer.json();
      }
    } catch (e) {}

    let newStore = serverData;

    if (!newStore) {
      const cached = localStorage.getItem('lanucia_app_state');
      if (cached) {
        try {
          newStore = JSON.parse(cached);
        } catch (e) {}
      }
    }

    if (!newStore && initData) {
      newStore = initData;
    }

    if (newStore) {
      if (!newStore.tasks) {
        newStore.tasks = (initData && initData.tasks) ? initData.tasks : [];
      } else {
        newStore.tasks.forEach(t => {
          if (!t.grafico && initialGraphicsMap[t.id]) {
            t.grafico = initialGraphicsMap[t.id];
          }
        });
      }

      if (!newStore.players) newStore.players = { filial: [], juvenil: [] };
      if (!newStore.players.filial) newStore.players.filial = [];
      if (!newStore.players.juvenil) newStore.players.juvenil = [];

      if (!newStore.sessions) newStore.sessions = { filial: [], juvenil: [] };
      if (!newStore.sessions.filial) newStore.sessions.filial = [];
      if (!newStore.sessions.juvenil) newStore.sessions.juvenil = [];

      if (!newStore.matches) newStore.matches = { filial: [], juvenil: [] };
      if (!newStore.matches.filial) newStore.matches.filial = [];
      if (!newStore.matches.juvenil) newStore.matches.juvenil = [];

      if (!newStore.videos) newStore.videos = { filial: [], juvenil: [] };
      if (!newStore.videos.filial) newStore.videos.filial = [];
      if (!newStore.videos.juvenil) newStore.videos.juvenil = [];

      if (!newStore.attendances) newStore.attendances = { filial: {}, juvenil: {} };
      if (!newStore.attendances.filial) newStore.attendances.filial = {};
      if (!newStore.attendances.juvenil) newStore.attendances.juvenil = {};

      if (!newStore.ratings) newStore.ratings = { filial: {}, juvenil: {} };
      if (!newStore.ratings.filial) newStore.ratings.filial = {};
      if (!newStore.ratings.juvenil) newStore.ratings.juvenil = {};

      const prevJson = JSON.stringify(appState);
      const nextJson = JSON.stringify(newStore);

      appState = newStore;
      saveStateToStorage();

      if (silent && prevJson !== nextJson) {
        const isEditing = document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
        if (!isEditing) {
          initWeekSelector();
          updateHeaderUI();
          renderView();
        }
      }
    }
  } catch (err) {
    console.error('Error fetching state:', err);
  }
}

// Helper for formatted local YYYY-MM-DD (avoids UTC timezone shift issues)
function formatLocalDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Generate weeks list for season
function getSeasonWeeks() {
  const weeks = [];
  // Primera semana de entrenos: Lunes 03/08/2026 al Domingo 09/08/2026
  let current = new Date(2026, 7, 3, 0, 0, 0); // Month is 0-indexed: 7 is August (03/08/2026 es Lunes)
  const end = new Date(2027, 6, 4, 23, 59, 59); // 04/07/2027 es Domingo
  let num = 1;

  while (current <= end) {
    const startStr = formatLocalDate(current);
    const endOfWeek = new Date(current.getFullYear(), current.getMonth(), current.getDate() + 6);
    const endStr = formatLocalDate(endOfWeek);

    const d1 = String(current.getDate()).padStart(2, '0') + '/' + String(current.getMonth() + 1).padStart(2, '0');
    const d2 = String(endOfWeek.getDate()).padStart(2, '0') + '/' + String(endOfWeek.getMonth() + 1).padStart(2, '0');

    weeks.push({
      number: num,
      start: startStr,
      end: endStr,
      label: `Semana ${num} (${d1} - ${d2})`
    });

    current = new Date(current.getFullYear(), current.getMonth(), current.getDate() + 7);
    num++;
  }
  return weeks;
}

function initWeekSelector() {
  const weeks = getSeasonWeeks();
  const todayStr = formatLocalDate(new Date());
  const found = weeks.find(w => todayStr >= w.start && todayStr <= w.end);
  selectedWeekStart = found ? found.start : weeks[0].start;
}

function updateHeaderUI() {
  const team = appState.activeTeam || 'filial';
  const btnFilial = document.getElementById('btn-team-filial');
  const btnJuvenil = document.getElementById('btn-team-juvenil');

  if (team === 'filial') {
    btnFilial.className = 'flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-xl font-outfit text-xs font-extrabold uppercase bg-club-red text-white shadow-lg shadow-club-red/30 transition-all duration-200';
    btnJuvenil.className = 'flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-xl font-outfit text-xs font-bold uppercase text-[#94A3B8] hover:text-white hover:bg-white/5 transition-all duration-200';
  } else {
    btnFilial.className = 'flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-xl font-outfit text-xs font-bold uppercase text-[#94A3B8] hover:text-white hover:bg-white/5 transition-all duration-200';
    btnJuvenil.className = 'flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-xl font-outfit text-xs font-extrabold uppercase bg-blue-600 text-white shadow-lg shadow-blue-600/30 transition-all duration-200';
  }

  document.querySelectorAll('.nav-link').forEach(el => {
    el.className = 'nav-link font-outfit font-semibold text-xs uppercase px-3 py-2 rounded-lg transition-all text-[#94A3B8] hover:text-white hover:bg-white/5';
  });
  const currentNav = document.getElementById('nav-' + currentView);
  if (currentNav) {
    currentNav.className = 'nav-link font-outfit font-semibold text-xs uppercase px-3 py-2 rounded-lg transition-all bg-club-red text-white shadow-lg shadow-club-red/20';
  }

  // Update mobile bottom nav active tab
  ['dashboard', 'sessions', 'tasks', 'players', 'attendance'].forEach(v => {
    const bEl = document.getElementById('bnav-' + v);
    if (bEl) {
      if (currentView === v) {
        bEl.className = 'flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all text-club-red font-black scale-105';
      } else {
        bEl.className = 'flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all text-slate-400 hover:text-white';
      }
    }
  });
}



async function setTeam(team) {
  if (appState.activeTeam === team) return;
  appState.activeTeam = team;
  updateHeaderUI();
  try {
    await fetch('/api/active-team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team })
    });
    showNotification('Equipo cambiado a: ' + (team === 'filial' ? '🔴 FILIAL' : '🔵 JUVENIL'));
  } catch(e) {
    console.error(e);
  }
  renderView();
}

function navigate(view) {
  currentView = view;
  if (view === 'sessions') {
    sessionSubView = 'index';
    activeSessionId = null;
  }
  updateHeaderUI();
  const mobileNav = document.getElementById('mobile-nav');
  if (mobileNav) mobileNav.classList.add('hidden');
  renderView();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleMobileNav() {
  const m = document.getElementById('mobile-nav');
  if (m) m.classList.toggle('hidden');
}

function showNotification(msg) {
  const banner = document.getElementById('notification-banner');
  const text = document.getElementById('notification-text');
  if (banner && text) {
    text.innerText = msg;
    banner.classList.remove('hidden');
    setTimeout(() => {
      dismissNotification();
    }, 3500);
  }
}

function dismissNotification() {
  const banner = document.getElementById('notification-banner');
  if (banner) banner.classList.add('hidden');
}

function openModal(htmlContent) {
  const modal = document.getElementById('modal-container');
  const content = document.getElementById('modal-content');
  if (modal && content) {
    content.innerHTML = htmlContent;
    modal.classList.remove('hidden');
  }
}

function closeModal() {
  const modal = document.getElementById('modal-container');
  if (modal) modal.classList.add('hidden');
}

// ----------------------------------------------------
// VIEW RENDERING
// ----------------------------------------------------
function renderView() {
  const container = document.getElementById('app-view');
  if (!container) return;

  if (currentView === 'dashboard') {
    container.innerHTML = renderDashboard();
  } else if (currentView === 'sessions') {
    container.innerHTML = renderSessions();
  } else if (currentView === 'tasks') {
    container.innerHTML = renderTasks();
  } else if (currentView === 'players') {
    container.innerHTML = renderPlayers();
  } else if (currentView === 'attendance') {
    container.innerHTML = renderAttendance();
    attachAttendanceEvents();
  } else if (currentView === 'matches') {
    container.innerHTML = renderMatches();
  } else if (currentView === 'videos') {
    container.innerHTML = renderVideos();
  }
}

// ====================================================
// VIEW 1: DASHBOARD
// ====================================================
function renderDashboard() {
  const team = appState.activeTeam || 'filial';
  const teamName = team === 'filial' ? 'Filial Sporting La Nucía' : 'Juvenil La Nucía FS';
  const teamBadge = team === 'filial' ? '🔴 FILIAL' : '🔵 JUVENIL';
  const players = appState.players[team] || [];
  const sessions = appState.sessions[team] || [];
  const matches = appState.matches[team] || [];
  const attendances = appState.attendances[team] || {};

  const totalPlayers = players.length;
  const available = players.filter(p => (p.estado || 'disponible') === 'disponible').length;
  const unavailable = totalPlayers - available;

  const todayStr = new Date().toISOString().split('T')[0];
  const upcomingMatches = matches.filter(m => m.fecha >= todayStr).sort((a,b) => a.fecha.localeCompare(b.fecha));
  const nextMatch = upcomingMatches[0] || null;
  let nextMatchDays = '—';
  if (nextMatch) {
    const diff = Math.ceil((new Date(nextMatch.fecha) - new Date(todayStr)) / (1000 * 60 * 60 * 24));
    nextMatchDays = diff + 'd';
  }

  const sortedSessions = [...sessions].sort((a,b) => (b.fecha || '').localeCompare(a.fecha || ''));
  const lastSession = sortedSessions[0] || null;

  // Real attendance rate calculation
  let totalPresences = 0;
  let totalOpportunities = 0;
  players.forEach(p => {
    const pAtt = attendances[p.id] || {};
    Object.values(pAtt).forEach(status => {
      totalOpportunities++;
      if (status === 'presente') totalPresences++;
    });
  });
  const avgAttendance = totalOpportunities > 0 ? Math.round((totalPresences / totalOpportunities) * 100) : 95;

  // 7-day tactical strip (Lunes a Domingo de la semana actual)
  const todayObj = new Date();
  const todayDayIndex = todayObj.getDay() === 0 ? 6 : todayObj.getDay() - 1; // 0 = Lunes, ..., 6 = Domingo
  const mondayObj = new Date(todayObj.getFullYear(), todayObj.getMonth(), todayObj.getDate() - todayDayIndex);
  const weekDays = [];
  const dayNamesShort = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];
  for (let i = 0; i < 7; i++) {
    const d = new Date(mondayObj.getFullYear(), mondayObj.getMonth(), mondayObj.getDate() + i);
    const dStr = formatLocalDate(d);
    const hasSess = sessions.find(s => s.fecha === dStr);
    const hasMat = matches.find(m => m.fecha === dStr);
    const isToday = dStr === todayStr;
    weekDays.push({ date: d, str: dStr, label: dayNamesShort[i], session: hasSess, match: hasMat, isToday, isWeekend: i >= 5 });
  }

  const faseCounts = { 'Ataque': 0, 'Defensa': 0, 'Transición Ofensiva': 0, 'Transición Defensiva': 0, 'ABP': 0 };
  (appState.tasks || []).forEach(t => {
    const f = t.fase_juego || 'Ataque';
    if (faseCounts[f] !== undefined) faseCounts[f]++;
    else faseCounts['Ataque']++;
  });
  const totalTasksCount = (appState.tasks || []).length || 1;
  const todayDisplay = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());

  return `
    <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8 border-b border-white/10 pb-6">
      <div class="flex items-center gap-4">
        <div class="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-black/40 border border-white/10 shadow-2xl p-1.5 flex items-center justify-center">
          <img src="/escudo.jpg" alt="Escudo La Nucía FS" class="w-full h-full object-contain">
        </div>
        <div class="flex flex-col items-center text-center">
          <p class="text-[10px] text-[#94A3B8] uppercase tracking-[0.2em] font-semibold mb-1">${todayDisplay}</p>
          <div class="flex items-center gap-3">
            <div class="flex flex-col items-center">
              <h2 class="font-outfit font-extrabold text-2xl sm:text-3xl text-white tracking-tight leading-none text-center">Centro Control</h2>
              <h3 class="font-outfit font-extrabold text-lg sm:text-xl text-club-red tracking-wide mt-1.5 uppercase text-center w-full">Entrenador</h3>
            </div>
            <span class="self-start mt-0.5 px-2.5 py-0.5 rounded-full font-outfit text-xs font-black uppercase ${team === 'filial' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'}">
              ${teamBadge}
            </span>
          </div>
        </div>
      </div>

      <div class="flex items-center bg-black/45 border border-white/10 rounded-2xl p-1.5 gap-2 shadow-2xl backdrop-blur-lg overflow-x-auto max-w-full no-scrollbar">
        ${weekDays.map(day => {
          let cardBg = 'bg-white/3 border-white/5 text-[#94A3B8]';
          let badge = '💤 DESC';
          let badgeColor = 'bg-white/5 text-[#64748B]';
          if (day.isToday) {
            cardBg = 'bg-gradient-to-br from-club-red to-red-800 border-club-red text-white scale-105 shadow-lg shadow-club-red/40 font-bold';
            badge = day.match ? '⚽ PART' : (day.session ? '📋 SES.' : '🌱 RECUP');
            badgeColor = 'bg-white/25 text-white';
          } else if (day.match) {
            cardBg = 'bg-red-950/40 border-red-500/40 text-rose-200';
            badge = '⚽ PART';
            badgeColor = 'bg-red-500/20 text-red-300 border border-red-500/30';
          } else if (day.session) {
            cardBg = 'bg-violet-950/40 border-violet-500/40 text-violet-200';
            badge = '📋 SES.';
            badgeColor = 'bg-violet-500/20 text-violet-300 border border-violet-500/30';
          } else if (!day.isWeekend) {
            cardBg = 'bg-emerald-950/20 border-emerald-500/20 text-emerald-300';
            badge = '🌱 RECUP';
            badgeColor = 'bg-emerald-500/10 text-emerald-400';
          }
          return `
            <div class="flex flex-col items-center justify-between py-2 px-1 rounded-xl border ${cardBg} w-[46px] h-[72px] sm:w-14 sm:h-20 select-none">
              <span class="text-[8px] sm:text-[9px] font-black uppercase tracking-widest leading-none">${day.label}</span>
              <span class="text-xs sm:text-base font-black leading-none my-0.5">${day.date.getDate()}</span>
              <span class="text-[6px] sm:text-[7px] font-bold uppercase px-1 py-0.5 rounded leading-none shrink-0 ${badgeColor}">${badge}</span>
            </div>
          `;
        }).join('')}
      </div>

      <div class="flex items-center gap-3">
        <button onclick="openNewSessionModal()" class="inline-flex items-center gap-2 bg-club-red hover:bg-club-red/90 text-white text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-club-red/20">
          <span>+</span> Nueva Sesión
        </button>
      </div>
    </div>

    <!-- ROW 1: KPIS -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
      <div class="bg-[#161616] border border-white/10 rounded-2xl p-4 flex flex-col gap-1 hover:border-white/20 transition-all">
        <span class="text-[10px] text-[#64748B] uppercase tracking-widest font-semibold">Plantilla (${teamName})</span>
        <div class="flex items-baseline gap-1.5">
          <span class="font-outfit font-extrabold text-3xl text-club-red">${available}</span>
          <span class="text-sm text-[#475569]">/</span>
          <span class="text-sm font-bold text-slate-400">${totalPlayers}</span>
        </div>
        <span class="text-xs text-[#94A3B8]">disponibles ${unavailable > 0 ? `· <span class="text-amber-400 font-semibold">${unavailable} baja(s)</span>` : '· 100% listos'}</span>
      </div>

      <div class="bg-[#161616] border border-white/10 rounded-2xl p-4 flex flex-col gap-1 hover:border-white/20 transition-all">
        <span class="text-[10px] text-[#64748B] uppercase tracking-widest font-semibold">Sesiones de entrenamiento</span>
        <span class="font-outfit font-extrabold text-3xl text-violet-400">${sessions.length}</span>
        <span class="text-xs text-[#94A3B8]">acumuladas en el equipo</span>
      </div>

      <div class="bg-[#161616] border border-white/10 rounded-2xl p-4 flex flex-col gap-1 hover:border-white/20 transition-all">
        <span class="text-[10px] text-[#64748B] uppercase tracking-widest font-semibold">Asistencia media</span>
        <span class="font-outfit font-extrabold text-3xl ${avgAttendance >= 80 ? 'text-emerald-400' : 'text-amber-400'}">${avgAttendance}%</span>
        <span class="text-xs text-[#94A3B8]">control del día a día</span>
      </div>

      <div class="bg-[#161616] border border-white/10 rounded-2xl p-4 flex flex-col gap-1 hover:border-white/20 transition-all">
        <span class="text-[10px] text-[#64748B] uppercase tracking-widest font-semibold">Próximo partido</span>
        <span class="font-outfit font-extrabold text-3xl ${nextMatch ? 'text-rose-400' : 'text-slate-500'}">${nextMatchDays}</span>
        <span class="text-xs text-[#94A3B8] truncate">${nextMatch ? ('vs ' + nextMatch.rival) : 'sin partido próximo'}</span>
      </div>
    </div>

    <!-- ROW 2: ACCESO RÁPIDO (5 BOTONES) -->
    <div class="mb-6">
      <div class="bg-[#141414] rounded-2xl overflow-hidden card-quick-actions">
        <div class="flex items-center justify-between px-6 py-4 card-quick-header">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg flex items-center justify-center text-sm badge-quick-bolt">⚡</div>
            <div>
              <p class="font-outfit font-extrabold text-sm text-white tracking-wide uppercase">Acceso Rápido del Entrenador</p>
              <p class="text-[10px] text-slate-400">Funciones prioritarias de trabajo</p>
            </div>
          </div>
          <span class="text-[10px] uppercase font-bold text-[#94A3B8] bg-white/5 border border-white/10 px-3 py-1 rounded-full">
            La Nucía FS · ${teamName}
          </span>
        </div>

        <div class="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div onclick="navigate('tasks')" class="flex items-center gap-3 p-3.5 rounded-xl qa-btn qa-task cursor-pointer">
            <span class="w-10 h-10 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-lg shrink-0">✏️</span>
            <div class="flex-1 min-w-0">
              <p class="text-xs font-bold text-white uppercase tracking-wider">Tareas</p>
              <p class="text-[10px] text-[#94A3B8] truncate">Catálogo 50 tareas</p>
            </div>
            <span class="text-teal-400 text-xs qa-arrow">→</span>
          </div>

          <div onclick="navigate('sessions')" class="flex items-center gap-3 p-3.5 rounded-xl qa-btn qa-session cursor-pointer">
            <span class="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-lg shrink-0">📋</span>
            <div class="flex-1 min-w-0">
              <p class="text-xs font-bold text-white uppercase tracking-wider">Sesiones</p>
              <p class="text-[10px] text-[#94A3B8] truncate">Planificar entrenos</p>
            </div>
            <span class="text-violet-400 text-xs qa-arrow">→</span>
          </div>

          <div onclick="navigate('players')" class="flex items-center gap-3 p-3.5 rounded-xl qa-btn qa-players cursor-pointer">
            <span class="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-lg shrink-0">👥</span>
            <div class="flex-1 min-w-0">
              <p class="text-xs font-bold text-white uppercase tracking-wider">Plantilla</p>
              <p class="text-[10px] text-[#94A3B8] truncate">Fichas de ${teamName}</p>
            </div>
            <span class="text-blue-400 text-xs qa-arrow">→</span>
          </div>

          <div onclick="navigate('attendance')" class="flex items-center gap-3 p-3.5 rounded-xl qa-btn qa-attendance cursor-pointer">
            <span class="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-lg shrink-0">✅</span>
            <div class="flex-1 min-w-0">
              <p class="text-xs font-bold text-white uppercase tracking-wider">Asistencia</p>
              <p class="text-[10px] text-[#94A3B8] truncate">Semanal + Valoración</p>
            </div>
            <span class="text-amber-400 text-xs qa-arrow">→</span>
          </div>

          <div onclick="openNewMatchModal()" class="flex items-center gap-3 p-3.5 rounded-xl qa-btn qa-match cursor-pointer">
            <span class="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-lg shrink-0">⚽</span>
            <div class="flex-1 min-w-0">
              <p class="text-xs font-bold text-white uppercase tracking-wider">Nuevo Partido</p>
              <p class="text-[10px] text-[#94A3B8] truncate">Añadir al calendario</p>
            </div>
            <span class="text-rose-400 text-xs qa-arrow">→</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ROW 3: PLANIFICACIÓN SEMANAL -->
    <div class="bg-[#0f0f0f] border border-white/10 rounded-2xl overflow-hidden mb-6 shadow-2xl">
      <div class="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/2">
        <div class="flex items-center gap-3">
          <span class="text-xl">📅</span>
          <div>
            <p class="font-outfit font-extrabold text-sm uppercase text-white tracking-wider">Planificación Semanal</p>
            <p class="text-[10px] text-[#94A3B8] font-semibold">Calendario táctico (${teamName})</p>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <button onclick="openNewSessionModal()" class="text-[10px] font-bold font-outfit uppercase tracking-wider bg-violet-500/10 border border-violet-500/30 hover:bg-violet-500 hover:text-white px-3 py-1.5 rounded-lg transition-all text-violet-400">
            + Sesión
          </button>
          <button onclick="openNewMatchModal()" class="text-[10px] font-bold font-outfit uppercase tracking-wider bg-club-red/10 border border-club-red/30 hover:bg-club-red hover:text-white px-3 py-1.5 rounded-lg transition-all text-club-red">
            + Partido
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-7 gap-4 p-5 bg-[#0a0a0a]/40">
        ${weekDays.map(day => {
          let cardBorder = 'border-white/5 bg-black/20';
          if (day.isToday) cardBorder = 'border-club-red bg-[#181818] shadow-lg shadow-club-red/10';
          else if (day.match) cardBorder = 'border-club-red/40 bg-red-950/20';
          else if (day.session) cardBorder = 'border-violet-500/40 bg-violet-950/20';
          else if (!day.isWeekend) cardBorder = 'border-emerald-500/30 bg-emerald-950/15';

          return `
            <div class="flex flex-col justify-between p-4 rounded-2xl border min-h-[170px] ${cardBorder}">
              <div class="flex items-center justify-between border-b border-white/5 pb-2 mb-2">
                <span class="text-[9px] font-black font-outfit uppercase tracking-widest ${day.isToday ? 'text-club-red' : 'text-[#94A3B8]'}">${day.label}</span>
                <span class="text-base font-black leading-none text-white">${day.date.getDate()}</span>
              </div>
              <div class="flex-1 flex flex-col justify-center">
                ${day.match ? `
                  <div class="flex flex-col gap-1 text-center">
                    <span class="text-xl">⚽</span>
                    <span class="text-[8px] font-black uppercase tracking-widest text-club-red leading-none">Partido</span>
                    <h4 class="text-xs font-bold text-white truncate max-w-full">${day.match.rival}</h4>
                    <span class="text-[9px] text-[#94A3B8]">⏱️ ${day.match.hora || '18:00'}</span>
                  </div>
                ` : day.session ? `
                  <div class="flex flex-col gap-1 text-center">
                    <span class="text-xl">📋</span>
                    <span class="text-[8px] font-black uppercase tracking-widest text-violet-400 leading-none">Sesión</span>
                    <h4 class="text-xs font-bold text-white truncate max-w-full">${day.session.titulo}</h4>
                    <span class="text-[9px] text-[#94A3B8]">⏱️ ${day.session.duracion || 90} min</span>
                  </div>
                ` : `
                  <div class="flex flex-col items-center justify-center text-center opacity-50">
                    <span class="text-lg mb-1">${day.isWeekend ? '💤' : '🌱'}</span>
                    <span class="text-[8px] font-bold uppercase tracking-widest text-slate-500">${day.isWeekend ? 'Descanso' : 'Recuperación'}</span>
                  </div>
                `}
              </div>
              <div class="mt-3 pt-2 border-t border-white/5">
                ${day.match ? `
                  <button onclick="navigate('matches')" class="w-full text-center font-outfit font-bold text-[8px] uppercase tracking-wider py-1.5 rounded-lg bg-club-red text-white hover:bg-club-red-hover transition-colors">Ver Partidos ↗</button>
                ` : day.session ? `
                  <button onclick="navigate('sessions')" class="w-full text-center font-outfit font-bold text-[8px] uppercase tracking-wider py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-500 transition-colors">Ficha Táctica ⚡</button>
                ` : `
                  <div class="h-6"></div>
                `}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>

    <!-- ROW 4: ÚLTIMA SESIÓN + PRÓXIMO EVENTO -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
      <div class="bg-[#0f0f0f] border border-white/10 rounded-2xl overflow-hidden flex flex-col">
        <div class="flex items-center gap-3 px-5 py-4 border-b border-white/10 bg-white/2">
          <div class="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-sm">⚡</div>
          <p class="font-outfit font-bold text-sm text-white uppercase tracking-wider">Última Sesión</p>
        </div>
        <div class="p-5 flex-1 flex flex-col justify-between">
          ${lastSession ? `
            <div class="flex flex-col gap-4">
              <div>
                <p class="text-white font-bold text-base leading-tight">${lastSession.titulo}</p>
                <p class="text-xs text-[#64748B] mt-1">📅 Fecha: ${lastSession.fecha || 'Reciente'}</p>
              </div>
              <div class="grid grid-cols-3 gap-3">
                <div class="bg-white/5 rounded-xl p-3 text-center">
                  <p class="font-outfit font-extrabold text-xl text-white">${lastSession.duracion || 90}</p>
                  <p class="text-[9px] text-[#64748B] uppercase tracking-wider mt-0.5">min</p>
                </div>
                <div class="bg-white/5 rounded-xl p-3 text-center">
                  <p class="font-outfit font-extrabold text-xl text-white">${(lastSession.tasks || []).length}</p>
                  <p class="text-[9px] text-[#64748B] uppercase tracking-wider mt-0.5">tareas</p>
                </div>
                <div class="bg-white/5 rounded-xl p-3 text-center">
                  <p class="font-outfit font-extrabold text-xl text-teal-400">✓</p>
                  <p class="text-[9px] text-[#64748B] uppercase tracking-wider mt-0.5">hecha</p>
                </div>
              </div>
              <p class="text-xs text-[#94A3B8] italic">${lastSession.observaciones || 'Sesión táctica completada.'}</p>
            </div>
            <div class="pt-4 mt-4 border-t border-white/5">
              <button onclick="navigate('sessions')" class="w-full text-center text-xs font-semibold text-[#94A3B8] hover:text-white border border-white/10 hover:border-white/20 py-2 rounded-lg transition-all">
                Ver detalle de sesiones →
              </button>
            </div>
          ` : `
            <div class="flex flex-col items-center justify-center p-8 gap-3">
              <span class="text-4xl opacity-20">📋</span>
              <p class="text-sm text-[#475569] text-center">Aún no hay sesiones en este equipo.</p>
              <button onclick="openNewSessionModal()" class="text-xs text-teal-400 hover:text-teal-300">+ Crear primera sesión</button>
            </div>
          `}
        </div>
      </div>

      <div class="rounded-2xl overflow-hidden flex flex-col relative ${nextMatch ? 'bg-gradient-to-br from-[#1a0a0a] to-[#0f0f0f] border border-club-red/25' : 'bg-[#0f0f0f] border border-white/10'}">
        <div class="flex items-center gap-3 px-5 py-4 border-b border-white/10 bg-white/2">
          <div class="w-8 h-8 rounded-lg ${nextMatch ? 'bg-club-red/10 border-club-red/20' : 'bg-white/5 border-white/10'} border flex items-center justify-center text-sm">
            ${nextMatch ? '⚽' : '🗓️'}
          </div>
          <p class="font-outfit font-bold text-sm text-white uppercase tracking-wider">Próximo Evento Oficial</p>
        </div>
        <div class="p-5 flex-1 flex flex-col justify-between gap-4 relative z-10">
          ${nextMatch ? `
            <div>
              <div class="flex items-baseline gap-2 mb-1">
                <span class="font-outfit font-black text-4xl text-rose-400">${nextMatchDays}</span>
                <span class="text-sm text-[#64748B]">para el partido</span>
              </div>
              <p class="text-xs text-[#64748B]">📅 ${nextMatch.fecha} · ⏱️ ${nextMatch.hora || '18:00'}</p>
            </div>
            <div>
              <p class="text-xs text-[#64748B] uppercase tracking-widest font-semibold mb-1">Rival Oficial</p>
              <p class="font-outfit font-extrabold text-xl text-white">${nextMatch.rival}</p>
              <p class="text-xs text-[#64748B] mt-1 flex items-center gap-1">
                <span>📍</span> ${nextMatch.localizacion || 'Pabellón Camilo Cano (La Nucía)'}
              </p>
            </div>
            <div class="pt-4 border-t border-white/5">
              <button onclick="navigate('matches')" class="w-full text-center text-xs font-semibold text-[#94A3B8] hover:text-white border border-white/10 hover:border-white/20 py-2 rounded-lg transition-all">
                Ver calendario de partidos →
              </button>
            </div>
          ` : `
            <div class="flex flex-col items-center justify-center py-8 gap-3">
              <span class="text-4xl opacity-20">📅</span>
              <p class="text-sm text-[#475569] text-center">Sin partidos programados para este equipo.</p>
              <button onclick="openNewMatchModal()" class="text-xs text-club-red hover:text-red-400">+ Añadir partido al calendario</button>
            </div>
          `}
        </div>
      </div>
    </div>

    <!-- ROW 5: DISTRIBUCIÓN CONTENIDOS + ASISTENCIA PLANTILLA -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="bg-[#0f0f0f] border border-white/10 rounded-2xl overflow-hidden">
        <div class="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-white/2">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-sm">📈</div>
            <div>
              <p class="font-outfit font-bold text-sm text-white uppercase tracking-wider">Distribución de Contenidos</p>
              <p class="text-[10px] text-[#64748B]">Catálogo activo · ${(appState.tasks || []).length} tareas tácticas</p>
            </div>
          </div>
        </div>
        <div class="p-5 flex flex-col gap-4">
          ${Object.entries(faseCounts).map(([fase, count]) => {
            const pct = Math.round((count / totalTasksCount) * 100);
            let barColor = '#3B82F6';
            if (fase === 'Ataque') barColor = '#E30613';
            else if (fase === 'Transición Ofensiva') barColor = '#10B981';
            else if (fase === 'Transición Defensiva') barColor = '#F59E0B';
            else if (fase === 'ABP') barColor = '#8B5CF6';
            return `
              <div>
                <div class="flex items-center justify-between mb-1.5">
                  <div class="flex items-center gap-2">
                    <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: ${barColor};"></span>
                    <span class="text-xs text-[#CBD5E1] font-medium">${fase}</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-[10px] text-[#64748B]">${count} tarea(s)</span>
                    <span class="text-xs font-bold text-white">${pct}%</span>
                  </div>
                </div>
                <div class="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div class="h-full rounded-full transition-all duration-700" style="width: ${pct}%; background-color: ${barColor};"></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <div class="bg-[#0f0f0f] border border-white/10 rounded-2xl overflow-hidden">
        <div class="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-white/2">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-sm">👥</div>
            <div>
              <p class="font-outfit font-bold text-sm text-white uppercase tracking-wider">Asistencia de la Plantilla</p>
              <p class="text-[10px] text-[#64748B]">Plantilla (${teamName})</p>
            </div>
          </div>
          <button onclick="navigate('attendance')" class="text-xs text-[#64748B] hover:text-white transition-colors">Control Semanal →</button>
        </div>
        <div class="overflow-auto max-h-72">
          <table class="w-full">
            <tbody class="divide-y divide-white/5">
              ${players.map(p => {
                const pAtt = attendances[p.id] || {};
                let pPres = 0, pTot = 0;
                Object.values(pAtt).forEach(st => {
                  pTot++;
                  if (st === 'presente') pPres++;
                });
                const rate = pTot > 0 ? Math.round((pPres / pTot) * 100) : (p.estado === 'disponible' ? 100 : (p.estado === 'dudoso' ? 70 : 30));
                const rc = rate >= 80 ? 'text-emerald-400' : (rate >= 60 ? 'text-amber-400' : 'text-rose-400');
                const rb = rate >= 80 ? 'bg-emerald-500' : (rate >= 60 ? 'bg-amber-500' : 'bg-rose-500');

                return `
                  <tr class="hover:bg-white/2 transition-colors">
                    <td class="px-5 py-2.5">
                      <div class="flex items-center gap-3">
                        <div class="relative w-7 h-7 rounded-full overflow-hidden bg-white/10 border border-white/10 flex items-center justify-center flex-shrink-0">
                          ${p.foto && p.foto.startsWith('data:image') ? `
                            <img src="${p.foto}" alt="${p.nombre}" class="w-full h-full object-cover">
                          ` : `
                            <span class="text-[10px] font-bold text-white">${p.dorsal || (p.nombre ? p.nombre[0] : '#')}</span>
                          `}
                        </div>
                        <div>
                          <p class="text-xs font-semibold text-white">${p.nombre} ${p.apellidos || ''}</p>
                          <p class="text-[10px] text-[#64748B] uppercase">${p.posicion || 'Universal'} · ${p.estado || 'disponible'}</p>
                        </div>
                      </div>
                    </td>
                    <td class="px-3 py-2.5 w-24">
                      <div class="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div class="${rb} h-full rounded-full" style="width: ${rate}%"></div>
                      </div>
                    </td>
                    <td class="px-5 py-2.5 text-right">
                      <span class="text-xs font-bold ${rc}">${rate}%</span>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// ====================================================
// VIEW 2: CONTROL DE ASISTENCIA SEMANAL + VALORACIÓN
// (IDÉNTICO A LARAVEL FUTSAL GAMEMODEL MANAGER)
// ====================================================
function renderAttendance() {
  const team = appState.activeTeam || 'filial';
  const teamName = team === 'filial' ? 'Filial Sporting La Nucía' : 'Juvenil La Nucía FS';
  const players = (appState.players[team] || []).sort((a,b) => (a.dorsal || 99) - (b.dorsal || 99));
  const attendances = appState.attendances[team] || {};
  const ratings = appState.ratings[team] || {};

  const weeks = getSeasonWeeks();
  if (!selectedWeekStart) selectedWeekStart = weeks[0].start;
  const currentWeek = weeks.find(w => w.start === selectedWeekStart) || weeks[0];

  // Calculate 7 days for the selected week (Monday to Sunday)
  const daysOfWeek = [];
  const dayNamesShort = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const startParts = currentWeek.start.split('-').map(Number);
  const startD = new Date(startParts[0], startParts[1] - 1, startParts[2]);
  for (let i = 0; i < 7; i++) {
    const d = new Date(startD.getFullYear(), startD.getMonth(), startD.getDate() + i);
    const dateStr = formatLocalDate(d);
    const formatted = String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
    daysOfWeek.push({
      date: dateStr,
      label: dayNamesShort[i],
      formatted: formatted
    });
  }

  return `
    <div class="flex flex-col gap-6">
      <!-- Header / Action Bar -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/8 pb-4">
        <div>
          <div class="flex items-center gap-3">
            <h2 class="font-outfit font-extrabold text-xl sm:text-2xl text-white uppercase tracking-wider">
              Control de Asistencia
            </h2>
            <span class="bg-club-red/20 text-club-red border border-club-red/30 font-outfit text-xs font-bold uppercase px-3 py-1 rounded-xl">
              ${teamName}
            </span>
          </div>
          <p class="text-xs text-[#94A3B8] mt-0.5">Controla y registra la presencia y valoración de la plantilla por semanas.</p>
        </div>

        <!-- Week Selector Form -->
        <div class="bg-[#1a1a1a]/80 border border-white/8 rounded-xl px-4 py-2.5 flex items-center shadow-lg">
          <div class="flex flex-col sm:flex-row items-center gap-3">
            <label for="semana-select" class="text-[10px] text-[#94A3B8] font-bold uppercase tracking-wider whitespace-nowrap">Semana Activa:</label>
            <select id="semana-select" onchange="changeWeek(this.value)"
                    class="bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs font-semibold focus:outline-none focus:border-club-red transition-all min-w-[280px] cursor-pointer">
              ${weeks.map(w => `
                <option value="${w.start}" ${w.start === selectedWeekStart ? 'selected' : ''}>
                  ${w.label}
                </option>
              `).join('')}
            </select>
          </div>
        </div>
      </div>

      ${players.length === 0 ? `
        <div class="flex flex-col items-center justify-center gap-3 p-12 bg-[#1a1a1a]/40 border border-dashed border-white/8 rounded-2xl text-center">
          <span class="text-5xl">👤</span>
          <h3 class="font-outfit font-bold text-white uppercase tracking-wider text-sm mt-2">No hay jugadores registrados en ${teamName}</h3>
          <p class="text-xs text-[#94A3B8] max-w-sm">Añade jugadores a la plantilla antes de poder registrar asistencias.</p>
          <button onclick="openNewPlayerModal()" class="mt-2 px-4 py-2 rounded-lg bg-club-red text-white font-bold text-xs uppercase">
            Añadir Jugador
          </button>
        </div>
      ` : `
        <!-- Attendance Grid Form -->
        <form id="attendance-form" onsubmit="handleSaveAttendance(event)" class="flex flex-col gap-6">
          <div class="bg-[#1a1a1a]/80 border border-white/8 rounded-2xl overflow-hidden shadow-2xl">
            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="bg-black/40 border-b border-white/8">
                    <th class="py-4 px-6 text-xs font-bold text-[#94A3B8] uppercase tracking-wider min-w-[220px]">Jugador</th>
                    ${daysOfWeek.map(day => `
                      <th class="py-4 px-4 text-xs font-bold text-[#94A3B8] uppercase tracking-wider text-center min-w-[125px]">
                        <div>${day.label}</div>
                        <div class="text-[10px] text-white/40 font-normal mt-0.5">${day.formatted}</div>
                      </th>
                    `).join('')}
                  </tr>
                </thead>
                <tbody class="divide-y divide-white/5">
                  ${players.map(player => `
                    <tr class="hover:bg-white/2 transition-colors duration-150">
                      <!-- Player profile metadata -->
                      <td class="py-3 px-6">
                        <div class="flex items-center gap-3">
                          <div class="relative w-8 h-8 rounded-full overflow-hidden border border-white/10 bg-black/40 flex items-center justify-center flex-shrink-0">
                            ${player.foto && player.foto.startsWith('data:image') ? `
                              <img src="${player.foto}" alt="${player.nombre}" class="w-full h-full object-cover">
                            ` : `
                              <span class="text-xs font-outfit font-bold text-white/50 uppercase">
                                ${player.dorsal || (player.nombre ? player.nombre[0] : '#')}
                              </span>
                            `}
                          </div>
                          <div class="flex flex-col">
                            <div class="flex items-center gap-1.5">
                              ${player.dorsal !== null ? `
                                <span class="text-[9px] font-black font-outfit px-1.5 py-0.5 rounded bg-club-red text-white">
                                  ${player.dorsal}
                                </span>
                              ` : ''}
                              <span class="font-outfit font-bold text-sm text-white leading-tight">
                                ${player.apodo || player.nombre}
                              </span>
                            </div>
                            <span class="text-[10px] text-[#94A3B8] font-medium mt-0.5 leading-none">
                              ${player.nombre} ${player.apellidos || ''}
                            </span>
                          </div>
                        </div>
                      </td>

                      <!-- Day attendance & rating selectors -->
                      ${daysOfWeek.map(day => {
                        const currentStatus = (attendances[player.id] && attendances[player.id][day.date]) || '';
                        const currentRating = (ratings[player.id] && ratings[player.id][day.date]) || '';

                        return `
                          <td class="py-3 px-2 text-center align-top">
                            <div class="flex flex-col gap-1.5 items-center">
                              <!-- Status Select -->
                              <select name="attendance_${player.id}_${day.date}" data-pid="${player.id}" data-date="${day.date}"
                                      class="attendance-select border rounded-lg px-2 py-1 text-[11px] font-bold focus:outline-none transition-all duration-200 cursor-pointer w-full text-center">
                                <option value="" class="bg-[#121212] text-white/50">- Estado -</option>
                                <option value="presente" ${currentStatus === 'presente' ? 'selected' : ''} class="bg-[#121212] text-emerald-400">✔️ Presente</option>
                                <option value="ausente" ${currentStatus === 'ausente' ? 'selected' : ''} class="bg-[#121212] text-rose-400">❌ Ausente</option>
                                <option value="justificado" ${currentStatus === 'justificado' ? 'selected' : ''} class="bg-[#121212] text-blue-400">⚖️ Justificado</option>
                                <option value="lesionado" ${currentStatus === 'lesionado' ? 'selected' : ''} class="bg-[#121212] text-amber-400">🏥 Lesionado</option>
                              </select>

                              <!-- Rating Select (Valoración 1 a 5) -->
                              <div class="flex items-center gap-1 w-full justify-center">
                                <select name="rating_${player.id}_${day.date}" data-pid="${player.id}" data-date="${day.date}"
                                        class="rating-select bg-black/40 border border-white/8 hover:border-amber-500/40 rounded-lg px-1.5 py-0.5 text-[10px] font-bold text-amber-400 focus:outline-none transition-all duration-200 cursor-pointer w-full text-center">
                                  <option value="" class="bg-[#121212] text-white/40">⭐ Valoración</option>
                                  <option value="5" ${currentRating == 5 ? 'selected' : ''} class="bg-[#121212] text-amber-400">⭐ 5 / 5</option>
                                  <option value="4" ${currentRating == 4 ? 'selected' : ''} class="bg-[#121212] text-amber-400">⭐ 4 / 5</option>
                                  <option value="3" ${currentRating == 3 ? 'selected' : ''} class="bg-[#121212] text-amber-400">⭐ 3 / 5</option>
                                  <option value="2" ${currentRating == 2 ? 'selected' : ''} class="bg-[#121212] text-amber-400">⭐ 2 / 5</option>
                                  <option value="1" ${currentRating == 1 ? 'selected' : ''} class="bg-[#121212] text-amber-400">⭐ 1 / 5</option>
                                </select>
                              </div>
                            </div>
                          </td>
                        `;
                      }).join('')}
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Submit action buttons -->
          <div class="flex justify-end gap-4 border-t border-white/5 pt-6 mb-8">
            <button type="button" onclick="navigate('dashboard')" class="font-outfit font-bold text-xs uppercase px-6 py-3.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white text-[#94A3B8] transition-colors">
              Ir a Inicio
            </button>
            <button type="submit" onclick="handleSaveAttendance(event)" class="cursor-pointer inline-flex items-center gap-2 font-outfit font-bold text-xs uppercase px-8 py-3.5 rounded-xl bg-club-red hover:bg-club-red-hover text-white transition-all shadow-lg shadow-club-red/20 active:scale-95">
              💾 Guardar Asistencia y Valoraciones
            </button>
          </div>
        </form>
      `}
    </div>
  `;
}

function changeWeek(weekStart) {
  selectedWeekStart = weekStart;
  renderView();
}

function updateAttendanceSelectStyle(select) {
  select.classList.remove(
    'bg-emerald-500/10', 'text-emerald-400', 'border-emerald-500/20',
    'bg-rose-500/10', 'text-rose-400', 'border-rose-500/25',
    'bg-blue-500/10', 'text-blue-400', 'border-blue-500/20',
    'bg-amber-500/10', 'text-amber-400', 'border-amber-500/20',
    'bg-black/30', 'text-white/40', 'border-white/8'
  );

  const val = select.value;
  if (val === 'presente') {
    select.classList.add('bg-emerald-500/10', 'text-emerald-400', 'border-emerald-500/20');
  } else if (val === 'ausente') {
    select.classList.add('bg-rose-500/10', 'text-rose-400', 'border-rose-500/25');
  } else if (val === 'justificado') {
    select.classList.add('bg-blue-500/10', 'text-blue-400', 'border-blue-500/20');
  } else if (val === 'lesionado') {
    select.classList.add('bg-amber-500/10', 'text-amber-400', 'border-amber-500/20');
  } else {
    select.classList.add('bg-black/30', 'text-white/40', 'border-white/8');
  }
}

function attachAttendanceEvents() {
  document.querySelectorAll('.attendance-select').forEach(select => {
    updateAttendanceSelectStyle(select);
    select.addEventListener('change', function() {
      updateAttendanceSelectStyle(this);
    });
  });
}

async function handleSaveAttendance(e) {
  if (e) e.preventDefault();
  const team = appState.activeTeam || 'filial';
  const attendancePayload = {};
  const ratingPayload = {};

  document.querySelectorAll('.attendance-select').forEach(sel => {
    const pid = sel.getAttribute('data-pid');
    const date = sel.getAttribute('data-date');
    if (!attendancePayload[pid]) attendancePayload[pid] = {};
    attendancePayload[pid][date] = sel.value;
  });

  document.querySelectorAll('.rating-select').forEach(sel => {
    const pid = sel.getAttribute('data-pid');
    const date = sel.getAttribute('data-date');
    if (!ratingPayload[pid]) ratingPayload[pid] = {};
    ratingPayload[pid][date] = sel.value;
  });

  // 1. Guardar de inmediato en el estado local de la aplicación
  if (!appState.attendances) appState.attendances = { filial: {}, juvenil: {} };
  if (!appState.attendances[team]) appState.attendances[team] = {};
  if (!appState.ratings) appState.ratings = { filial: {}, juvenil: {} };
  if (!appState.ratings[team]) appState.ratings[team] = {};

  for (const pid in attendancePayload) {
    if (!appState.attendances[team][pid]) appState.attendances[team][pid] = {};
    Object.assign(appState.attendances[team][pid], attendancePayload[pid]);
  }
  for (const pid in ratingPayload) {
    if (!appState.ratings[team][pid]) appState.ratings[team][pid] = {};
    Object.assign(appState.ratings[team][pid], ratingPayload[pid]);
  }

  saveStateToStorage();

  showNotification('Asistencias y valoraciones guardadas correctamente para la semana seleccionada.');
  renderView();

  // 2. Sincronizar con el servidor en segundo plano si está disponible
  try {
    await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        team,
        semana: selectedWeekStart,
        attendance: attendancePayload,
        rating: ratingPayload
      })
    });
  } catch(err) {
    console.warn('Sync notice:', err);
  }
}

// ====================================================
// ====================================================
// VIEW 3: TAREAS (50 TAREAS + PIZARRA TÁCTICA CANVAS)
// ====================================================
function filterTasksList() {
  const tasks = appState.tasks || [];
  let filtered = tasks;

  if (taskFilterFase !== 'all') {
    filtered = filtered.filter(t => (t.fase_juego || '').toLowerCase() === taskFilterFase.toLowerCase());
  }

  if (taskSearchQuery && taskSearchQuery.trim()) {
    const rawTokens = taskSearchQuery.trim().split(/\s+/).filter(Boolean);
    const normalize = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const tokens = rawTokens.map(t => normalize(t));

    filtered = filtered.filter(t => {
      const tagsStr = Array.isArray(t.etiquetas) ? t.etiquetas.join(' ') : (t.etiquetas || '');
      const matStr = Array.isArray(t.material) ? t.material.join(' ') : (t.material || '');
      const corpus = normalize(`${t.nombre || ''} ${t.objetivo || ''} ${t.descripcion || ''} ${t.fase_juego || ''} ${tagsStr} ${matStr} ${t.dificultad || ''}`);

      return tokens.every(tok => corpus.includes(tok));
    });
  }
  return filtered;
}

function renderTaskCardsHtml(filtered) {
  if (!filtered || filtered.length === 0) {
    return `
      <div class="flex flex-col items-center justify-center p-12 bg-[#161616] border border-dashed border-white/10 rounded-2xl text-center col-span-full">
        <div class="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
          <svg class="w-6 h-6 text-[#94A3B8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
          </svg>
        </div>
        <h4 class="font-outfit font-bold text-white uppercase tracking-wider text-sm">No se encontraron tareas</h4>
        <p class="text-xs text-[#94A3B8] max-w-sm mt-1">No hay tareas que coincidan con los términos de búsqueda o el filtro seleccionado.</p>
        <button onclick="clearTaskSearch(); setTaskFaseFilter('all');" class="mt-4 px-4 py-2 rounded-xl bg-club-red hover:bg-club-red-hover text-white text-xs font-bold uppercase transition-all shadow-md shadow-club-red/20">
          Mostrar todas las tareas
        </button>
      </div>
    `;
  }

  return `
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      ${filtered.map(t => {
        let faseBadgeColor = 'bg-blue-500/20 text-blue-300 border-blue-500/30';
        if (t.fase_juego === 'Ataque') faseBadgeColor = 'bg-red-500/20 text-red-300 border-red-500/30';
        else if (t.fase_juego === 'ABP') faseBadgeColor = 'bg-purple-500/20 text-purple-300 border-purple-500/30';
        else if (t.fase_juego === 'Transición Ofensiva') faseBadgeColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';

        return `
          <div class="bg-[#181818] border border-white/10 rounded-2xl p-5 flex flex-col justify-between shadow-xl hover:border-club-red/40 hover:-translate-y-1 transition-all">
            <div class="flex flex-col gap-3">
              <div class="flex items-center justify-between">
                <span class="text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md border ${faseBadgeColor}">
                  ${t.fase_juego || 'Ataque'}
                </span>
                <div class="flex items-center gap-2">
                  ${(t.multimedia_file || t.multimedia_link) ? `
                    <span title="Contenido multimedia adjunto" class="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded">🎬</span>
                  ` : ''}
                  <span class="text-xs text-[#94A3B8] font-bold">⏱️ ${t.duracion || 15} min</span>
                </div>
              </div>
              ${t.grafico && t.grafico.startsWith('data:image') ? `
                <div class="w-full h-36 rounded-xl overflow-hidden border border-white/10 bg-black/40">
                  <img src="${t.grafico}" class="w-full h-full object-cover">
                </div>
              ` : ''}
              <h3 class="font-outfit font-bold text-base text-white leading-snug line-clamp-2">
                ${t.nombre}
              </h3>
              <p class="text-xs text-[#94A3B8] line-clamp-3 leading-relaxed">
                ${t.objetivo || t.descripcion || 'Sin descripción detallada.'}
              </p>
            </div>

            <div class="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
              <span class="text-[10px] text-slate-400">👥 ${t.num_jugadores || '10'} Jug. · ${t.dificultad || 'Media'}</span>
              <div class="flex items-center gap-1.5">
                <button onclick="editTaskModal(${t.id})" title="Editar tarea" class="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white transition-colors text-xs">
                  ✏️
                </button>
                <button onclick="confirmDeleteTask(${t.id}, '${(t.nombre || '').replace(/'/g, "\\'")}')" title="Borrar tarea" class="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/25 text-red-400 hover:text-red-300 transition-colors text-xs">
                  🗑️
                </button>
                <button onclick="viewTaskDetail(${t.id})" class="text-xs font-bold text-club-red hover:text-white transition-colors ml-1">
                  Ficha ↗
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderTasks() {
  const tasks = appState.tasks || [];
  const filtered = filterTasksList();
  const fases = ['all', 'Ataque', 'Defensa', 'Transición Ofensiva', 'Transición Defensiva', 'ABP'];

  return `
    <div class="flex flex-col gap-6">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <div class="flex items-center gap-3">
            <h2 class="font-outfit font-extrabold text-xl sm:text-2xl text-white uppercase tracking-wider">
              Catálogo de Tareas Tácticas
            </h2>
            <span class="bg-club-red/20 text-club-red border border-club-red/30 font-outfit text-xs font-bold uppercase px-3 py-1 rounded-xl">
              ${tasks.length} Tareas Totales
            </span>
          </div>
          <p class="text-xs text-[#94A3B8] mt-0.5">Tareas tácticas oficiales de fútbol sala con pizarra interactiva.</p>
        </div>
        <button onclick="openNewTaskModalWithBoard()" class="inline-flex items-center gap-2 font-outfit font-bold text-xs uppercase px-5 py-3 rounded-xl bg-club-red hover:bg-club-red-hover text-white transition-all shadow-lg shadow-club-red/20">
          ➕ Crear Tarea con Pizarra Interactiva
        </button>
      </div>

      <!-- Filters & Enhanced Search -->
      <div class="bg-[#161616] border border-white/10 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between shadow-xl">
        <div class="w-full md:w-96 relative flex items-center">
          <span class="absolute left-3.5 text-slate-400 pointer-events-none flex items-center">
            <svg class="w-4 h-4 text-[#94A3B8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
          </span>
          <input type="text" id="task-search-input" value="${taskSearchQuery}"
                 placeholder="Buscar por nombre, objetivo, contenido..."
                 oninput="handleTaskSearch(this.value)"
                 class="w-full bg-black/50 border border-white/10 focus:border-club-red rounded-xl pl-10 pr-9 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-club-red/50 transition-all">
          <button id="task-search-clear" onclick="clearTaskSearch()"
                  class="absolute right-3 text-slate-400 hover:text-white text-xs font-bold ${taskSearchQuery ? '' : 'hidden'}"
                  title="Borrar búsqueda">
            ✕
          </button>
        </div>

        <div class="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
          <div id="task-search-count" class="text-[11px] font-bold text-[#94A3B8] whitespace-nowrap px-2.5 py-1 rounded-lg bg-white/5 border border-white/5">
            ${filtered.length} ${filtered.length === 1 ? 'tarea' : 'tareas'}
          </div>
          <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 md:pb-0">
            ${fases.map(f => {
              const isActive = taskFilterFase.toLowerCase() === f.toLowerCase();
              return `
                <button onclick="setTaskFaseFilter('${f}')" class="px-3 py-1.5 rounded-lg text-xs font-outfit font-bold uppercase whitespace-nowrap transition-all ${isActive ? 'bg-club-red text-white shadow-md shadow-club-red/20' : 'bg-white/5 text-[#94A3B8] hover:text-white'}">
                  ${f === 'all' ? 'Todas' : f}
                </button>
              `;
            }).join('')}
          </div>
        </div>
      </div>

      <!-- Tasks Grid Container -->
      <div id="tasks-grid-container">
        ${renderTaskCardsHtml(filtered)}
      </div>
    </div>
  `;
}

function handleTaskSearch(val) {
  taskSearchQuery = val;
  const clearBtn = document.getElementById('task-search-clear');
  if (clearBtn) {
    if (val && val.trim()) clearBtn.classList.remove('hidden');
    else clearBtn.classList.add('hidden');
  }

  const filtered = filterTasksList();
  const gridContainer = document.getElementById('tasks-grid-container');
  if (gridContainer) {
    gridContainer.innerHTML = renderTaskCardsHtml(filtered);
  }

  const countBadge = document.getElementById('task-search-count');
  if (countBadge) {
    countBadge.textContent = `${filtered.length} ${filtered.length === 1 ? 'tarea' : 'tareas'}`;
  }
}

function clearTaskSearch() {
  taskSearchQuery = '';
  const input = document.getElementById('task-search-input');
  if (input) {
    input.value = '';
    input.focus();
  }
  const clearBtn = document.getElementById('task-search-clear');
  if (clearBtn) clearBtn.classList.add('hidden');

  const filtered = filterTasksList();
  const gridContainer = document.getElementById('tasks-grid-container');
  if (gridContainer) {
    gridContainer.innerHTML = renderTaskCardsHtml(filtered);
  }

  const countBadge = document.getElementById('task-search-count');
  if (countBadge) {
    countBadge.textContent = `${filtered.length} ${filtered.length === 1 ? 'tarea' : 'tareas'}`;
  }
}

function setTaskFaseFilter(fase) {
  taskFilterFase = fase;
  renderView();
}

function viewTaskDetail(taskId) {
  const task = (appState.tasks || []).find(t => t.id == taskId);
  if (!task) return;

  const materials = Array.isArray(task.material) ? task.material.join(', ') : (task.material || 'Balones, conos, petos');

  openModal(`
    <div class="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
      <div>
        <span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-club-red/20 text-club-red border border-club-red/30">
          ${task.fase_juego || 'Ataque'}
        </span>
        <h3 class="font-outfit font-extrabold text-xl text-white mt-1">${task.nombre}</h3>
      </div>
      <button onclick="closeModal()" class="text-slate-400 hover:text-white text-lg">✕</button>
    </div>
    
    <div class="flex flex-col gap-4 text-xs">
      ${task.grafico && task.grafico.startsWith('data:image') ? `
        <div class="w-full rounded-xl overflow-hidden border border-white/10 shadow-lg">
          <img src="${task.grafico}" class="w-full max-h-72 object-contain bg-black">
        </div>
      ` : ''}

      <div class="grid grid-cols-3 gap-2 bg-white/5 p-3 rounded-xl">
        <div><span class="text-slate-400">Duración:</span> <strong class="text-white">${task.duracion || 15} min</strong></div>
        <div><span class="text-slate-400">Jugadores:</span> <strong class="text-white">${task.num_jugadores || '10'}</strong></div>
        <div><span class="text-slate-400">Dificultad:</span> <strong class="text-white">${task.dificultad || 'Media'}</strong></div>
      </div>

      <div>
        <h4 class="font-bold text-white uppercase tracking-wider text-[11px] mb-1">🎯 Objetivo Táctico:</h4>
        <p class="text-slate-300 leading-relaxed bg-black/30 p-3 rounded-xl border border-white/5">${task.objetivo || 'Mejora de la toma de decisiones y conceptos tácticos específicos.'}</p>
      </div>

      <div>
        <h4 class="font-bold text-white uppercase tracking-wider text-[11px] mb-1">📋 Descripción y Reglas:</h4>
        <p class="text-slate-300 leading-relaxed bg-black/30 p-3 rounded-xl border border-white/5 whitespace-pre-line">${task.descripcion || 'Espacio delimitado para la correcta ejecución del ejercicio.'}</p>
      </div>

      <div>
        <h4 class="font-bold text-white uppercase tracking-wider text-[11px] mb-1">📦 Material:</h4>
        <p class="text-slate-400">${materials}</p>
      </div>

      ${(task.multimedia_file || task.multimedia_link) ? `
        <div class="bg-black/40 border border-white/10 p-3.5 rounded-xl flex flex-col gap-2.5">
          <div class="flex items-center gap-2 border-l-2 border-club-red pl-2">
            <span class="text-sm">🎬</span>
            <h4 class="font-bold text-white uppercase tracking-wider text-[11px]">Contenido Multimedia Vinculado</h4>
          </div>
          
          <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            ${task.multimedia_file ? `
              <div class="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-2 rounded-xl text-xs">
                <span class="text-emerald-400 font-bold">📎 ${task.multimedia_filename || 'Archivo adjunto'}</span>
                ${task.multimedia_file.startsWith('data:video') ? `
                  <video src="${task.multimedia_file}" controls class="w-full max-h-48 mt-2 rounded-lg bg-black"></video>
                ` : (task.multimedia_file.startsWith('data:image') ? `
                  <a href="${task.multimedia_file}" target="_blank" class="text-club-red hover:underline font-bold text-[11px]">Ver Imagen ↗</a>
                ` : `
                  <a href="${task.multimedia_file}" download="${task.multimedia_filename || 'archivo_tarea'}" class="text-club-red hover:underline font-bold text-[11px]">Descargar 📥</a>
                `)}
              </div>
            ` : ''}

            ${task.multimedia_link ? `
              <div class="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-2 rounded-xl text-xs">
                <span class="text-slate-400">🔗 Enlace:</span>
                <a href="${task.multimedia_link}" target="_blank" rel="noopener noreferrer" class="text-club-red hover:text-white font-bold hover:underline flex items-center gap-1 text-[11px]">
                  ${task.multimedia_link.length > 40 ? task.multimedia_link.substring(0, 37) + '...' : task.multimedia_link} ↗
                </a>
              </div>
            ` : ''}
          </div>
        </div>
      ` : ''}

      <div class="flex items-center justify-between pt-4 mt-2 border-t border-white/10">
        <button onclick="confirmDeleteTask(${task.id}, '${(task.nombre || '').replace(/'/g, "\\'")}')" class="px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 font-bold uppercase text-xs flex items-center gap-1.5 transition-colors">
          🗑️ Borrar Tarea
        </button>
        <div class="flex items-center gap-2">
          <button onclick="editTaskModal(${task.id})" class="px-4 py-2 rounded-xl bg-club-red hover:bg-club-red-hover text-white font-bold uppercase text-xs flex items-center gap-1.5 transition-all shadow-lg shadow-club-red/20">
            ✏️ Editar Tarea y Pizarra
          </button>
          <button onclick="closeModal()" class="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold uppercase text-xs">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  `);
}

function editTaskModal(taskId) {
  const task = (appState.tasks || []).find(t => t.id == taskId);
  if (!task) return;
  openNewTaskModalWithBoard(task);
}

async function confirmDeleteTask(taskId, taskName) {
  if (!confirm(`¿Estás seguro de que deseas eliminar la tarea "${taskName || taskId}" del catálogo?`)) {
    return;
  }
  if (!appState.tasks) appState.tasks = [];
  appState.tasks = appState.tasks.filter(t => String(t.id) !== String(taskId));
  saveStateToStorage();
  closeModal();
  showNotification('Tarea eliminada correctamente');
  renderView();

  try {
    await fetch('/api/tasks', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: taskId })
    });
  } catch (err) {
    console.error('Server sync error deleting task:', err);
  }
}

function openNewTaskModalWithBoard(taskToEdit = null) {
  const isEditing = !!taskToEdit;
  const initialTokens = [
    { id: 'r1', type: 'player-red', label: '1', name: 'Portero (R)', x: 60, y: 80, radius: 14, color: '#22C55E', border: '#E30613', isGK: true },
    { id: 'r2', type: 'player-red', label: '2', name: 'Cierre (R)', x: 60, y: 135, radius: 14, color: '#E30613', border: '#FFFFFF' },
    { id: 'r3', type: 'player-red', label: '3', name: 'Ala D (R)', x: 60, y: 190, radius: 14, color: '#E30613', border: '#FFFFFF' },
    { id: 'r4', type: 'player-red', label: '4', name: 'Ala I (R)', x: 60, y: 245, radius: 14, color: '#E30613', border: '#FFFFFF' },
    { id: 'r5', type: 'player-red', label: '5', name: 'Pívot (R)', x: 60, y: 300, radius: 14, color: '#E30613', border: '#FFFFFF' },

    { id: 'o1', type: 'player-orange', label: '1', name: 'Portero (O)', x: 400, y: 80, radius: 14, color: '#22C55E', border: '#F97316', isGK: true },
    { id: 'o2', type: 'player-orange', label: '2', name: 'Cierre (O)', x: 400, y: 135, radius: 14, color: '#F97316', border: '#FFFFFF' },
    { id: 'o3', type: 'player-orange', label: '3', name: 'Ala D (O)', x: 400, y: 190, radius: 14, color: '#F97316', border: '#FFFFFF' },
    { id: 'o4', type: 'player-orange', label: '4', name: 'Ala I (O)', x: 400, y: 245, radius: 14, color: '#F97316', border: '#FFFFFF' },
    { id: 'o5', type: 'player-orange', label: '5', name: 'Pívot (O)', x: 400, y: 300, radius: 14, color: '#F97316', border: '#FFFFFF' },

    { id: 'b1', type: 'player-blue', label: '1', name: 'Portero (A)', x: 740, y: 80, radius: 14, color: '#22C55E', border: '#1E40AF', isGK: true },
    { id: 'b2', type: 'player-blue', label: '2', name: 'Cierre (A)', x: 740, y: 135, radius: 14, color: '#1E40AF', border: '#FFFFFF' },
    { id: 'b3', type: 'player-blue', label: '3', name: 'Ala D (A)', x: 740, y: 190, radius: 14, color: '#1E40AF', border: '#FFFFFF' },
    { id: 'b4', type: 'player-blue', label: '4', name: 'Ala I (A)', x: 740, y: 245, radius: 14, color: '#1E40AF', border: '#FFFFFF' },
    { id: 'b5', type: 'player-blue', label: '5', name: 'Pívot (A)', x: 740, y: 300, radius: 14, color: '#1E40AF', border: '#FFFFFF' },

    { id: 'c1', type: 'cone', label: '▲', name: 'Cono 1', x: 250, y: 420, radius: 11, color: '#F59E0B', border: '#D97706' },
    { id: 'c2', type: 'cone', label: '▲', name: 'Cono 2', x: 290, y: 420, radius: 11, color: '#F59E0B', border: '#D97706' },
    { id: 'c3', type: 'cone', label: '▲', name: 'Cono 3', x: 330, y: 420, radius: 11, color: '#F59E0B', border: '#D97706' },
    { id: 'c4', type: 'cone', label: '▲', name: 'Cono 4', x: 370, y: 420, radius: 11, color: '#F59E0B', border: '#D97706' },

    { id: 'ball', type: 'ball', label: '⚽', name: 'Balón', x: 450, y: 420, radius: 10, color: '#FFFFFF', border: '#000000' },

    { id: 'g1', type: 'goal', label: '🥅', name: 'Portería 1', x: 530, y: 420, radius: 22, color: '#FFFFFF', border: '#E30613', rotation: 0 },
    { id: 'g2', type: 'goal', label: '🥅', name: 'Portería 2', x: 605, y: 420, radius: 22, color: '#FFFFFF', border: '#E30613', rotation: 0 }
  ];

  boardInitialTokens = initialTokens;
  boardTokens = JSON.parse(JSON.stringify(initialTokens));
  boardStrokes = [];
  activeBoardTool = 'move';
  boardStrokeColor = '#E30613';
  selectedBoardToken = null;
  copiedBoardToken = null;
  boardBackgroundImg = null;

  if (isEditing && taskToEdit.grafico && taskToEdit.grafico.startsWith('data:image')) {
    boardBackgroundImg = new Image();
    boardBackgroundImg.src = taskToEdit.grafico;
  }

  const materialsVal = isEditing ? (Array.isArray(taskToEdit.material) ? taskToEdit.material.join(', ') : (taskToEdit.material || '')) : 'Balones, Petos, Conos';

  openModal(`
    <div class="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
      <div>
        <h3 class="font-outfit font-extrabold text-xl text-white uppercase tracking-wider">
          ${isEditing ? '✏️ Editar Tarea Táctica' : 'Crear Tarea con Pizarra Interactiva'}
        </h3>
        <p class="text-xs text-[#94A3B8]">Diseña esquemas tácticos, arrastra fichas y dibuja trayectorias de fútbol sala.</p>
      </div>
      <button onclick="closeModal()" class="text-slate-400 hover:text-white text-lg">✕</button>
    </div>

    <form id="new-task-board-form" onsubmit="handleSaveTaskWithBoard(event)" class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <input type="hidden" id="task-edit-id" value="${isEditing ? taskToEdit.id : ''}">
      <input type="hidden" id="task-graphic-data" name="grafico" value="">

      <!-- Left Column: Form Details (5 cols) -->
      <div class="lg:col-span-5 flex flex-col gap-3 text-xs">
        <div>
          <label class="block text-slate-300 mb-1 font-bold uppercase text-[10px]">Nombre del Ejercicio *</label>
          <input type="text" id="tb-nombre" required value="${isEditing ? (taskToEdit.nombre || '') : ''}" placeholder="Ej: Salida de presión 3-1 vs 2-2" class="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:border-club-red">
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-slate-300 mb-1 font-bold uppercase text-[10px]">Fase del Juego</label>
            <select id="tb-fase" class="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-xs">
              <option value="Ataque" ${isEditing && taskToEdit.fase_juego === 'Ataque' ? 'selected' : ''}>Ataque Organizado</option>
              <option value="Defensa" ${isEditing && taskToEdit.fase_juego === 'Defensa' ? 'selected' : ''}>Defensa Organizada</option>
              <option value="Transición Ofensiva" ${isEditing && taskToEdit.fase_juego === 'Transición Ofensiva' ? 'selected' : ''}>Transición Ofensiva (Robo)</option>
              <option value="Transición Defensiva" ${isEditing && taskToEdit.fase_juego === 'Transición Defensiva' ? 'selected' : ''}>Transición Defensiva (Pérdida)</option>
              <option value="ABP" ${isEditing && taskToEdit.fase_juego === 'ABP' ? 'selected' : ''}>ABP (Estrategia / Balón Parado)</option>
            </select>
          </div>
          <div>
            <label class="block text-slate-300 mb-1 font-bold uppercase text-[10px]">Duración (min)</label>
            <input type="number" id="tb-duracion" value="${isEditing ? (taskToEdit.duracion || 15) : 15}" min="1" class="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-xs">
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-slate-300 mb-1 font-bold uppercase text-[10px]">Dificultad</label>
            <select id="tb-dificultad" class="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-xs">
              <option value="Baja" ${isEditing && taskToEdit.dificultad === 'Baja' ? 'selected' : ''}>Baja</option>
              <option value="Media" ${!isEditing || taskToEdit.dificultad === 'Media' ? 'selected' : ''}>Media</option>
              <option value="Alta" ${isEditing && taskToEdit.dificultad === 'Alta' ? 'selected' : ''}>Alta</option>
            </select>
          </div>
          <div>
            <label class="block text-slate-300 mb-1 font-bold uppercase text-[10px]">Nº Jugadores</label>
            <input type="text" id="tb-jugadores" value="${isEditing ? (taskToEdit.num_jugadores || '5v5 + 2 Porteros') : '5v5 + 2 Porteros'}" class="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-xs">
          </div>
        </div>

        <div>
          <label class="block text-slate-300 mb-1 font-bold uppercase text-[10px]">Objetivo de la Tarea</label>
          <textarea id="tb-objetivo" rows="2" placeholder="Fijar par, generar línea de pase y orientación de apoyos..." class="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:border-club-red">${isEditing ? (taskToEdit.objetivo || '') : ''}</textarea>
        </div>

        <div>
          <label class="block text-slate-300 mb-1 font-bold uppercase text-[10px]">Desarrollo y Reglas</label>
          <textarea id="tb-descripcion" rows="3" placeholder="Descripción de los movimientos, rotaciones y consignas..." class="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:border-club-red">${isEditing ? (taskToEdit.descripcion || '') : ''}</textarea>
        </div>

        <div>
          <label class="block text-slate-300 mb-1 font-bold uppercase text-[10px]">Material</label>
          <input type="text" id="tb-material" value="${materialsVal}" class="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-xs">
        </div>

        <!-- Contenido Multimedia Card (idéntico a aplicación modelo juego) -->
        <div class="bg-black/30 border border-white/10 rounded-xl p-3 flex flex-col gap-2.5 mt-1">
          <div class="flex items-center gap-1.5 border-l-2 border-club-red pl-2">
            <span class="text-sm">🎬</span>
            <span class="font-outfit font-extrabold text-[11px] uppercase text-white tracking-wider">Contenido Multimedia</span>
          </div>
          <p class="text-[10px] text-[#94A3B8]">Vincula vídeos, documentos explicativos o enlaces externos del ejercicio.</p>

          <!-- Archivo multimedia -->
          <div class="flex flex-col gap-1">
            <label class="block text-slate-400 font-bold uppercase text-[9px]">Subir Archivo (Vídeo, Imagen o PDF)</label>
            <input type="file" id="tb-media-file" accept="video/mp4,video/quicktime,video/webm,image/*,application/pdf" onchange="handleTaskMediaFileUpload(this)"
                   class="w-full bg-black/50 border border-white/10 rounded-xl px-2.5 py-1.5 text-[11px] text-slate-300 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:uppercase file:bg-club-red/20 file:text-club-red hover:file:bg-club-red hover:file:text-white cursor-pointer">
            <input type="hidden" id="tb-media-file-data" value="${isEditing ? (taskToEdit.multimedia_file || '') : ''}">
            <input type="hidden" id="tb-media-file-name" value="${isEditing ? (taskToEdit.multimedia_filename || '') : ''}">
            
            <div id="tb-media-file-preview" class="mt-1">
              ${isEditing && taskToEdit.multimedia_file ? `
                <div class="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/10 text-[10px]">
                  <span class="text-emerald-400 font-bold flex items-center gap-1">
                    📎 ${taskToEdit.multimedia_filename || 'Archivo adjunto'}
                  </span>
                  <button type="button" onclick="removeTaskMediaFile()" class="text-rose-400 hover:text-rose-300 underline font-semibold">
                    Quitar
                  </button>
                </div>
              ` : ''}
            </div>
          </div>

          <!-- Enlace externo -->
          <div class="flex flex-col gap-1 border-t border-white/5 pt-2">
            <label class="block text-slate-400 font-bold uppercase text-[9px]">Enlace Externo (YouTube, Vimeo, Web)</label>
            <input type="url" id="tb-media-link" value="${isEditing ? (taskToEdit.multimedia_link || '') : ''}" placeholder="https://youtube.com/watch?v=... o https://..."
                   class="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:border-club-red">
          </div>
        </div>
      </div>

      <!-- Right Column: Interactive Canvas Board (7 cols) -->
      <div class="lg:col-span-7 flex flex-col gap-3">
        <!-- Board Toolbar (Exact match with modelo de juego) -->
        <div class="flex flex-wrap items-center justify-between gap-2 bg-black/35 p-2.5 rounded-xl border border-white/5 text-xs">
          
          <!-- Tool Selectors -->
          <div class="flex flex-wrap items-center gap-1.5 bg-white/3 p-1 rounded-lg">
            <button type="button" id="tool-move" onclick="selectBoardTool('move')" class="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-all duration-200 bg-club-red text-white" title="Mover fichas tácticas">
              ✋ Mover
            </button>
            <button type="button" id="tool-draw" onclick="selectBoardTool('draw')" class="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-all duration-200 text-[#94A3B8] hover:text-white" title="Dibujo libre">
              ✏️ Lápiz
            </button>
            <button type="button" id="tool-arrow" onclick="selectBoardTool('arrow')" class="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-all duration-200 text-[#94A3B8] hover:text-white" title="Dibujar flechas">
              ➡️ Flecha
            </button>
            <button type="button" id="tool-text" onclick="selectBoardTool('text')" class="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-all duration-200 text-[#94A3B8] hover:text-white" title="Escribir letras">
              🔤 Texto
            </button>
          </div>

          <!-- Color Selectors -->
          <div id="draw-colors" class="flex items-center gap-1.5 opacity-50 pointer-events-none transition-opacity duration-300">
            <button type="button" data-color="#E30613" onclick="setBoardColor('#E30613', this)" class="w-6 h-6 rounded-full bg-[#E30613] border-2 border-white scale-110 shadow-lg cursor-pointer"></button>
            <button type="button" data-color="#1E40AF" onclick="setBoardColor('#1E40AF', this)" class="w-6 h-6 rounded-full bg-[#1E40AF] border border-white/10 hover:scale-110 transition-transform cursor-pointer"></button>
            <button type="button" data-color="#F59E0B" onclick="setBoardColor('#F59E0B', this)" class="w-6 h-6 rounded-full bg-[#F59E0B] border border-white/10 hover:scale-110 transition-transform cursor-pointer"></button>
            <button type="button" data-color="#FFFFFF" onclick="setBoardColor('#FFFFFF', this)" class="w-6 h-6 rounded-full bg-[#FFFFFF] border border-white/10 hover:scale-110 transition-transform cursor-pointer"></button>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-1.5 ml-auto">
            <button type="button" id="btn-copy" onclick="copyBoardToken()" class="px-2.5 py-1.5 rounded bg-white/5 border border-white/10 hover:bg-white/15 text-xs text-white transition-all duration-200" title="Copiar ficha (Ctrl+C)">
              📋 Copiar
            </button>
            <button type="button" id="btn-paste" onclick="pasteBoardToken()" class="px-2.5 py-1.5 rounded bg-white/5 border border-white/10 hover:bg-white/15 text-xs text-white transition-all duration-200" title="Pegar ficha (Ctrl+V)">
              📥 Pegar
            </button>
            <button type="button" id="btn-delete-token" onclick="deleteBoardToken()" class="px-2.5 py-1.5 rounded bg-white/5 border border-white/10 hover:bg-rose-500/10 hover:border-rose-500/20 hover:text-rose-400 text-xs text-[#cbd5e1] transition-all duration-200" title="Eliminar ficha seleccionada (Supr)">
              ❌ Eliminar
            </button>
            <button type="button" id="btn-undo" onclick="undoBoardStroke()" class="px-2.5 py-1.5 rounded bg-white/5 border border-white/10 hover:bg-white/15 text-xs text-white transition-all duration-200" title="Deshacer trazo">
              ↩️ Deshacer
            </button>
            <button type="button" id="btn-clear" onclick="clearBoardCanvas()" class="px-2.5 py-1.5 rounded bg-white/5 border border-white/10 hover:bg-rose-500/10 hover:border-rose-500/25 hover:text-rose-400 text-xs text-[#cbd5e1] transition-all duration-200" title="Limpiar tablero">
              🗑️ Limpiar
            </button>
          </div>
        </div>

        <!-- Canvas Container with Flash Overlay -->
        <div class="relative bg-slate-950 rounded-xl overflow-hidden border border-white/8 flex items-center justify-center">
          <canvas id="modal-tactical-canvas" width="800" height="450" class="w-full h-auto cursor-default block"></canvas>
          <div id="capture-flash" class="absolute inset-0 bg-white opacity-0 pointer-events-none transition-opacity duration-200"></div>
        </div>

        <!-- Actions and Capture Button -->
        <div class="flex flex-col sm:flex-row gap-3 mt-1">
          <button type="button" id="btn-capture-graphic" onclick="captureBoardGraphic()" class="flex-1 inline-flex justify-center items-center gap-2 font-outfit font-bold text-xs uppercase px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:border-emerald-500/30 hover:bg-emerald-500/10 text-white transition-all duration-300">
            📸 Capturar Gráfico
          </button>
          <button type="submit" class="flex-1 inline-flex justify-center items-center gap-2 font-outfit font-bold text-xs uppercase px-4 py-3 rounded-xl bg-club-red hover:bg-club-red-hover text-white transition-all duration-300 shadow-lg shadow-club-red/10">
            💾 ${isEditing ? 'Actualizar Tarea' : 'Guardar Tarea'}
          </button>
        </div>

        <div class="flex items-center justify-between text-[10px] text-[#94A3B8]">
          <span>* Doble clic en una portería para rotarla 90º. Arrastra las fichas libremente.</span>
          ${isEditing && taskToEdit.grafico ? '<span class="text-amber-400 font-bold">Gráfico anterior cargado</span>' : ''}
        </div>

        ${isEditing ? `
          <div class="pt-2 border-t border-white/10 flex justify-end">
            <button type="button" onclick="confirmDeleteTask(${taskToEdit.id}, '${(taskToEdit.nombre || '').replace(/'/g, "\\'")}')" class="px-3.5 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 font-bold uppercase text-xs flex items-center gap-1.5 transition-colors">
              🗑️ Borrar Tarea
            </button>
          </div>
        ` : ''}
      </div>
    </form>
  `);

  // Initialize Canvas Logic
  setTimeout(() => {
    initInteractiveCanvas();
  }, 100);
}

function initInteractiveCanvas() {
  boardCanvas = document.getElementById('modal-tactical-canvas');
  if (!boardCanvas) return;
  boardCtx = boardCanvas.getContext('2d');

  function getMousePos(e) {
    const rect = boardCanvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * (boardCanvas.width / rect.width),
      y: (clientY - rect.top) * (boardCanvas.height / rect.height)
    };
  }

  function onStart(e) {
    if (e.cancelable) e.preventDefault();
    const pos = getMousePos(e);

    if (activeBoardTool === 'move') {
      let found = false;
      for (let i = boardTokens.length - 1; i >= 0; i--) {
        const t = boardTokens[i];
        const dx = pos.x - t.x;
        const dy = pos.y - t.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist <= t.radius + 5) {
          draggedBoardToken = t;
          selectedBoardToken = t;
          dragBoardOffset.x = dx;
          dragBoardOffset.y = dy;
          boardCanvas.style.cursor = 'grabbing';
          found = true;
          break;
        }
      }
      if (!found) selectedBoardToken = null;
      drawTacticalBoard();
    } else if (activeBoardTool === 'draw') {
      isBoardDrawing = true;
      currentBoardStroke = { type: 'freehand', color: boardStrokeColor, points: [pos] };
      boardStrokes.push(currentBoardStroke);
    } else if (activeBoardTool === 'arrow') {
      isBoardDrawing = true;
      currentBoardStroke = { type: 'arrow', color: boardStrokeColor, points: [pos, pos] };
      boardStrokes.push(currentBoardStroke);
    } else if (activeBoardTool === 'text') {
      const rect = boardCanvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const inputX = clientX - rect.left;
      const inputY = clientY - rect.top;

      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'Texto...';
      input.className = 'absolute bg-black/90 text-white border border-club-red rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-club-red transition-all';
      input.style.left = `${inputX}px`;
      input.style.top = `${inputY - 10}px`;
      input.style.zIndex = '100';

      boardCanvas.parentElement.appendChild(input);
      input.focus();

      function commitText() {
        const textVal = input.value.trim();
        if (textVal) {
          boardStrokes.push({
            type: 'text',
            text: textVal,
            color: boardStrokeColor,
            points: [pos]
          });
          drawTacticalBoard();
        }
        input.remove();
      }

      input.addEventListener('keydown', function(evt) {
        if (evt.key === 'Enter') {
          commitText();
        } else if (evt.key === 'Escape') {
          input.remove();
        }
      });

      input.addEventListener('blur', function() {
        commitText();
      });
    }
  }

  function onMove(e) {
    const pos = getMousePos(e);
    if (activeBoardTool === 'move' && draggedBoardToken) {
      draggedBoardToken.x = pos.x - dragBoardOffset.x;
      draggedBoardToken.y = pos.y - dragBoardOffset.y;
      drawTacticalBoard();
    } else if (activeBoardTool === 'draw' && isBoardDrawing && currentBoardStroke) {
      currentBoardStroke.points.push(pos);
      drawTacticalBoard();
    } else if (activeBoardTool === 'arrow' && isBoardDrawing && currentBoardStroke) {
      currentBoardStroke.points[1] = pos;
      drawTacticalBoard();
    }
  }

  function onEnd() {
    if (activeBoardTool === 'move') {
      draggedBoardToken = null;
      boardCanvas.style.cursor = 'default';
    } else if (activeBoardTool === 'draw' || activeBoardTool === 'arrow') {
      isBoardDrawing = false;
      currentBoardStroke = null;
    }
  }

  boardCanvas.addEventListener('mousedown', onStart);
  boardCanvas.addEventListener('mousemove', onMove);
  boardCanvas.addEventListener('mouseup', onEnd);
  boardCanvas.addEventListener('mouseleave', onEnd);

  boardCanvas.addEventListener('dblclick', function(e) {
    if (activeBoardTool !== 'move') return;
    const pos = getMousePos(e);
    for (let i = boardTokens.length - 1; i >= 0; i--) {
      const t = boardTokens[i];
      if (t.type === 'goal') {
        const dx = pos.x - t.x;
        const dy = pos.y - t.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist <= t.radius + 5) {
          t.rotation = (t.rotation || 0) + Math.PI / 2;
          drawTacticalBoard();
          break;
        }
      }
    }
  });

  boardCanvas.addEventListener('touchstart', onStart, { passive: false });
  boardCanvas.addEventListener('touchmove', onMove, { passive: false });
  boardCanvas.addEventListener('touchend', onEnd, { passive: false });

  document.removeEventListener('keydown', handleBoardKeydown);
  document.addEventListener('keydown', handleBoardKeydown);

  drawTacticalBoard();
}

function handleBoardKeydown(e) {
  const activeEl = document.activeElement;
  if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
    return;
  }
  if (!boardCanvas || !document.getElementById('modal-tactical-canvas')) return;

  if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) {
    e.preventDefault();
    copyBoardToken();
  } else if (e.ctrlKey && (e.key === 'v' || e.key === 'V')) {
    e.preventDefault();
    pasteBoardToken();
  } else if (e.key === 'Delete' || e.key === 'Del' || e.key === 'Backspace') {
    e.preventDefault();
    deleteBoardToken();
  }
}

function selectBoardTool(tool) {
  activeBoardTool = tool;
  const tools = ['move', 'draw', 'arrow', 'text'];
  tools.forEach(t => {
    const btn = document.getElementById('tool-' + t);
    if (btn) {
      btn.classList.remove('bg-club-red', 'text-white');
      btn.classList.add('text-[#94A3B8]', 'hover:text-white');
    }
  });

  const activeBtn = document.getElementById('tool-' + tool);
  if (activeBtn) {
    activeBtn.classList.add('bg-club-red', 'text-white');
    activeBtn.classList.remove('text-[#94A3B8]', 'hover:text-white');
  }

  const drawColorsDiv = document.getElementById('draw-colors');
  if (drawColorsDiv) {
    if (tool === 'move') {
      drawColorsDiv.classList.add('opacity-50', 'pointer-events-none');
      if (boardCanvas) boardCanvas.style.cursor = 'default';
    } else {
      drawColorsDiv.classList.remove('opacity-50', 'pointer-events-none');
      if (boardCanvas) {
        boardCanvas.style.cursor = (tool === 'text') ? 'text' : 'crosshair';
      }
    }
  }
}

function setBoardColor(color, btnElement = null) {
  boardStrokeColor = color;
  const colorButtons = document.querySelectorAll('#draw-colors button');
  colorButtons.forEach(b => {
    b.classList.remove('scale-110', 'border-2', 'border-white');
    b.classList.add('border', 'border-white/10');
  });
  if (btnElement) {
    btnElement.classList.remove('border', 'border-white/10');
    btnElement.classList.add('scale-110', 'border-2', 'border-white');
  }
}

function copyBoardToken() {
  if (selectedBoardToken) {
    copiedBoardToken = JSON.parse(JSON.stringify(selectedBoardToken));
  }
}

function pasteBoardToken() {
  if (copiedBoardToken && boardCanvas) {
    const newToken = JSON.parse(JSON.stringify(copiedBoardToken));
    newToken.id = newToken.type + '_' + Date.now();
    newToken.x += 20;
    newToken.y += 20;
    if (newToken.x > boardCanvas.width - 20) newToken.x = 40;
    if (newToken.y > boardCanvas.height - 20) newToken.y = 40;
    boardTokens.push(newToken);
    selectedBoardToken = newToken;
    drawTacticalBoard();
  }
}

function deleteBoardToken() {
  if (selectedBoardToken) {
    boardTokens = boardTokens.filter(t => t.id !== selectedBoardToken.id);
    selectedBoardToken = null;
    drawTacticalBoard();
  }
}

function undoBoardStroke() {
  boardStrokes.pop();
  drawTacticalBoard();
}

function clearBoardCanvas() {
  boardStrokes = [];
  boardTokens = JSON.parse(JSON.stringify(boardInitialTokens));
  selectedBoardToken = null;
  drawTacticalBoard();
}

function captureBoardGraphic() {
  if (!boardCanvas) return false;
  drawTacticalBoard();
  const base64Data = boardCanvas.toDataURL('image/png');
  const hiddenInput = document.getElementById('task-graphic-data');
  if (hiddenInput) hiddenInput.value = base64Data;

  const flash = document.getElementById('capture-flash');
  if (flash) {
    flash.classList.remove('opacity-0');
    flash.classList.add('opacity-80');
    setTimeout(() => {
      flash.classList.remove('opacity-80');
      flash.classList.add('opacity-0');
    }, 150);
  }

  const btnCapture = document.getElementById('btn-capture-graphic');
  if (btnCapture) {
    const originalText = btnCapture.innerHTML;
    btnCapture.innerHTML = '✅ ¡Gráfico Capturado!';
    btnCapture.classList.add('border-emerald-500/40', 'bg-emerald-500/10', 'text-emerald-400');
    setTimeout(() => {
      btnCapture.innerHTML = originalText;
      btnCapture.classList.remove('border-emerald-500/40', 'bg-emerald-500/10', 'text-emerald-400');
    }, 1500);
  }
  return true;
}

function drawTacticalBoard() {
  if (!boardCanvas || !boardCtx) return;
  const ctx = boardCtx;
  const width = boardCanvas.width;
  const height = boardCanvas.height;

  ctx.clearRect(0, 0, width, height);

  if (boardBackgroundImg && boardBackgroundImg.complete && boardBackgroundImg.naturalWidth > 0) {
    ctx.drawImage(boardBackgroundImg, 0, 0, width, height);
  } else {
    // 1. Draw Parquet Futsal Court
    ctx.fillStyle = '#b37d45';
    ctx.fillRect(0, 0, width, height);

    const plankWidth = 80;
    const plankHeight = 20;
    for (let y = 0; y < height; y += plankHeight) {
      const xOffset = (y / plankHeight) % 2 === 0 ? 0 : plankWidth / 2;
      for (let x = -plankWidth; x < width; x += plankWidth) {
        const rand = Math.sin(x * 17 + y * 43);
        if (rand > 0.6) {
          ctx.fillStyle = '#be8850';
        } else if (rand < -0.6) {
          ctx.fillStyle = '#a6723c';
        } else if (rand > 0.1) {
          ctx.fillStyle = '#b78149';
        } else {
          ctx.fillStyle = '#ad773f';
        }
        ctx.fillRect(x + xOffset, y, plankWidth, plankHeight);
        ctx.strokeStyle = 'rgba(50, 30, 10, 0.08)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x + xOffset, y, plankWidth, plankHeight);
      }
    }

    // Gradient vignette
    const grad = ctx.createRadialGradient(width/2, height/2, width/4, width/2, height/2, width/2);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.25)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // 2. Official Court Lines
    const borderMargin = 40;
    const pitchWidth = width - (borderMargin * 2);
    const pitchHeight = height - (borderMargin * 2);
    const cX = width / 2;
    const cY = height / 2;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.lineWidth = 2.5;

    ctx.strokeRect(borderMargin, borderMargin, pitchWidth, pitchHeight);

    ctx.beginPath();
    ctx.moveTo(cX, borderMargin);
    ctx.lineTo(cX, borderMargin + pitchHeight);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cX, cY, 54, 0, 2 * Math.PI);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath();
    ctx.arc(cX, cY, 3.5, 0, 2 * Math.PI);
    ctx.fill();

    // 6m Areas
    ctx.beginPath();
    ctx.arc(borderMargin, cY, 108, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(width - borderMargin, cY, 108, Math.PI / 2, -Math.PI / 2);
    ctx.stroke();

    // Penalty spots (6m)
    ctx.beginPath();
    ctx.arc(borderMargin + 108, cY, 3, 0, 2 * Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(width - borderMargin - 108, cY, 3, 0, 2 * Math.PI);
    ctx.fill();

    // Double penalty spots (10m)
    ctx.beginPath();
    ctx.arc(borderMargin + 180, cY, 2.5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(width - borderMargin - 180, cY, 2.5, 0, 2 * Math.PI);
    ctx.fill();

    // Goals
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(borderMargin, cY - 27);
    ctx.lineTo(borderMargin, cY + 27);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(width - borderMargin, cY - 27);
    ctx.lineTo(width - borderMargin, cY + 27);
    ctx.stroke();
  }

  // 3. Draw Strokes (drawings, arrows & text)
  boardStrokes.forEach(stroke => {
    if (stroke.type === 'arrow' && stroke.points.length >= 2) {
      const p1 = stroke.points[0];
      const p2 = stroke.points[1];
      ctx.save();
      ctx.strokeStyle = stroke.color;
      ctx.fillStyle = stroke.color;
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();

      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      const headLength = 12;
      ctx.beginPath();
      ctx.moveTo(p2.x, p2.y);
      ctx.lineTo(p2.x - headLength * Math.cos(angle - Math.PI / 6), p2.y - headLength * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(p2.x - headLength * Math.cos(angle + Math.PI / 6), p2.y - headLength * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else if (stroke.type === 'text' && stroke.points.length > 0) {
      ctx.save();
      ctx.fillStyle = stroke.color;
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(stroke.text, stroke.points[0].x, stroke.points[0].y);
      ctx.restore();
    } else if (stroke.type === 'freehand' && stroke.points.length > 0) {
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    }
  });

  // 4. Draw Tokens (players, cones, ball, goals)
  boardTokens.forEach(token => {
    // Selection highlight
    if (selectedBoardToken && selectedBoardToken.id === token.id) {
      ctx.save();
      ctx.strokeStyle = '#22C55E';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(token.x, token.y, token.radius + 6, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.restore();
    }

    if (token.type === 'cone') {
      ctx.fillStyle = token.color;
      ctx.strokeStyle = token.border;
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.moveTo(token.x, token.y - 12);
      ctx.lineTo(token.x - 11, token.y + 11);
      ctx.lineTo(token.x + 11, token.y + 11);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(token.x - 14, token.y + 11);
      ctx.lineTo(token.x + 14, token.y + 11);
      ctx.lineWidth = 3;
      ctx.strokeStyle = token.border;
      ctx.stroke();
    } else if (token.type === 'ball') {
      ctx.fillStyle = token.color;
      ctx.strokeStyle = token.border;
      ctx.lineWidth = 2.5;

      ctx.beginPath();
      ctx.arc(token.x, token.y, token.radius, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(token.x, token.y, token.radius * 0.4, 0, 2 * Math.PI);
      ctx.fill();

      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      for (let a = 0; a < 2 * Math.PI; a += (2 * Math.PI) / 5) {
        ctx.beginPath();
        ctx.moveTo(token.x + Math.cos(a) * (token.radius * 0.4), token.y + Math.sin(a) * (token.radius * 0.4));
        ctx.lineTo(token.x + Math.cos(a) * token.radius, token.y + Math.sin(a) * token.radius);
        ctx.stroke();
      }
    } else if (token.type === 'goal') {
      ctx.save();
      ctx.translate(token.x, token.y);
      ctx.rotate(token.rotation || 0);

      // Draw net
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1.2;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.beginPath();
      ctx.moveTo(-26, 0);
      ctx.lineTo(-18, -22);
      ctx.lineTo(18, -22);
      ctx.lineTo(26, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Net mesh
      ctx.beginPath();
      for (let i = -26; i <= 26; i += 10) {
        ctx.moveTo(i, 0);
        ctx.lineTo(i + 8, -22);
      }
      for (let i = -26; i <= 26; i += 10) {
        ctx.moveTo(i, 0);
        ctx.lineTo(i - 8, -22);
      }
      ctx.stroke();

      // Support frames
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-26, 0);
      ctx.lineTo(-18, -22);
      ctx.lineTo(18, -22);
      ctx.lineTo(26, 0);
      ctx.stroke();

      // White post base
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-26, 0);
      ctx.lineTo(26, 0);
      ctx.stroke();

      // Red stripes
      ctx.strokeStyle = '#E30613';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-26, 0); ctx.lineTo(-16, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-5, 0); ctx.lineTo(5, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(16, 0); ctx.lineTo(26, 0);
      ctx.stroke();

      ctx.restore();

      // Label below goal token
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const metrics = ctx.measureText(token.name);
      const padding = 2;
      ctx.fillRect(token.x - (metrics.width/2) - padding, token.y + token.radius + 3, metrics.width + (padding*2), 12);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(token.name, token.x, token.y + token.radius + 9);
    } else {
      // Player token
      ctx.fillStyle = token.color;
      ctx.strokeStyle = token.border;
      ctx.lineWidth = 2.5;

      ctx.beginPath();
      ctx.arc(token.x, token.y, token.radius, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(token.label, token.x, token.y + 0.5);

      // Label below player token
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const metrics = ctx.measureText(token.name);
      const padding = 2;
      ctx.fillRect(token.x - (metrics.width/2) - padding, token.y + token.radius + 3, metrics.width + (padding*2), 12);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(token.name, token.x, token.y + token.radius + 9);
    }
  });
}

function handleTaskMediaFileUpload(input) {
  const file = input.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const base64 = e.target.result;
    const hiddenData = document.getElementById('tb-media-file-data');
    const hiddenName = document.getElementById('tb-media-file-name');
    const preview = document.getElementById('tb-media-file-preview');
    
    if (hiddenData) hiddenData.value = base64;
    if (hiddenName) hiddenName.value = file.name;

    if (preview) {
      preview.innerHTML = `
        <div class="flex items-center justify-between p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px]">
          <span class="text-emerald-400 font-bold flex items-center gap-1">
            ✅ ${file.name} (${Math.round(file.size / 1024)} KB)
          </span>
          <button type="button" onclick="removeTaskMediaFile()" class="text-rose-400 hover:text-rose-300 underline font-semibold">
            Quitar
          </button>
        </div>
      `;
    }
  };
  reader.readAsDataURL(file);
}

function removeTaskMediaFile() {
  const hiddenData = document.getElementById('tb-media-file-data');
  const hiddenName = document.getElementById('tb-media-file-name');
  const fileInput = document.getElementById('tb-media-file');
  const preview = document.getElementById('tb-media-file-preview');

  if (hiddenData) hiddenData.value = '';
  if (hiddenName) hiddenName.value = '';
  if (fileInput) fileInput.value = '';
  if (preview) preview.innerHTML = '';
}

async function handleSaveTaskWithBoard(e) {
  e.preventDefault();
  drawTacticalBoard();
  const base64Data = boardCanvas ? boardCanvas.toDataURL('image/png') : null;
  const editIdInput = document.getElementById('task-edit-id');
  const editId = editIdInput ? editIdInput.value : '';

  const mediaFileInput = document.getElementById('tb-media-file-data');
  const mediaFileNameInput = document.getElementById('tb-media-file-name');
  const mediaLinkInput = document.getElementById('tb-media-link');

  const payload = {
    nombre: document.getElementById('tb-nombre').value,
    fase_juego: document.getElementById('tb-fase').value,
    duracion: parseInt(document.getElementById('tb-duracion').value) || 15,
    dificultad: document.getElementById('tb-dificultad').value,
    num_jugadores: document.getElementById('tb-jugadores').value,
    objetivo: document.getElementById('tb-objetivo').value,
    descripcion: document.getElementById('tb-descripcion').value,
    material: document.getElementById('tb-material').value.split(',').map(m => m.trim()),
    multimedia_file: mediaFileInput ? mediaFileInput.value : null,
    multimedia_filename: mediaFileNameInput ? mediaFileNameInput.value : null,
    multimedia_link: mediaLinkInput ? mediaLinkInput.value.trim() : null,
    grafico: base64Data
  };

  if (editId) {
    payload.id = editId;
    if (!appState.tasks) appState.tasks = [];
    const idx = appState.tasks.findIndex(t => String(t.id) === String(editId));
    if (idx !== -1) {
      appState.tasks[idx] = { ...appState.tasks[idx], ...payload };
    } else {
      appState.tasks.push(payload);
    }
  } else {
    payload.id = Date.now();
    if (!appState.tasks) appState.tasks = [];
    appState.tasks.push(payload);
  }

  saveStateToStorage();
  closeModal();
  showNotification(editId ? 'Tarea y pizarra actualizadas correctamente' : 'Tarea guardada con gráfico táctico interactivo');
  renderView();

  try {
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch(err) {
    console.error('Server sync error for task save:', err);
  }
}

// ====================================================
// VIEW 4: PLANTILLA DE JUGADORES (DOCX EXACTOS)
// ====================================================
function renderPlayers() {
  const team = appState.activeTeam || 'filial';
  const teamName = team === 'filial' ? 'Filial Sporting La Nucía' : 'Juvenil La Nucía FS';
  const players = appState.players[team] || [];

  return `
    <div class="flex flex-col gap-6">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <div class="flex items-center gap-3">
            <h2 class="font-outfit font-extrabold text-xl sm:text-2xl text-white uppercase tracking-wider">
              Plantilla Oficial (${teamName})
            </h2>
            <span class="bg-club-red/20 text-club-red border border-club-red/30 font-outfit text-xs font-bold uppercase px-3 py-1 rounded-xl">
              ${players.length} Jugadores
            </span>
          </div>
          <p class="text-xs text-[#94A3B8] mt-0.5">Listado oficial extraído de los archivos de plantilla de La Nucía FS.</p>
        </div>
        <button onclick="openNewPlayerModal()" class="inline-flex items-center gap-2 font-outfit font-bold text-xs uppercase px-5 py-3 rounded-xl bg-club-red hover:bg-club-red-hover text-white transition-all shadow-lg shadow-club-red/20">
          ➕ Añadir Jugador
        </button>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        ${players.map(p => {
          let estadoColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
          if (p.estado === 'lesionado') estadoColor = 'bg-rose-500/20 text-rose-300 border-rose-500/30';
          else if (p.estado === 'dudoso') estadoColor = 'bg-amber-500/20 text-amber-300 border-amber-500/30';

          return `
            <div class="bg-[#161616] border border-white/10 rounded-2xl p-4 flex flex-col justify-between hover:border-white/20 transition-all">
              <div class="flex items-start justify-between mb-3">
                <div class="relative w-14 h-14 rounded-2xl bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center group flex-shrink-0 shadow-md">
                  ${p.foto && p.foto.startsWith('data:image') ? `
                    <img src="${p.foto}" alt="${p.nombre}" class="w-full h-full object-cover">
                  ` : `
                    <div class="flex flex-col items-center justify-center">
                      <span class="font-outfit font-black text-xl text-club-red leading-none">${p.dorsal || '#'}</span>
                      <span class="text-[9px] text-slate-500 font-semibold mt-0.5">FOTO</span>
                    </div>
                  `}
                  <button onclick="openEditPlayerModal('${p.id}')" title="Cambiar foto / editar" class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs text-white transition-opacity">
                    📷
                  </button>
                </div>
                <div class="flex flex-col items-end gap-1">
                  <span class="text-[9px] font-bold uppercase px-2 py-0.5 rounded border ${estadoColor}">
                    ${p.estado || 'disponible'}
                  </span>
                  <span class="text-[10px] text-white/50 font-bold">#${p.dorsal || '-'}</span>
                </div>
              </div>

              <div>
                <h3 class="font-outfit font-bold text-sm text-white leading-tight">${p.nombre} ${p.apellidos || ''}</h3>
                <p class="text-[11px] text-[#94A3B8] uppercase font-semibold mt-1">
                  Posición: <strong class="text-white">${p.posicion || 'Universal'}</strong>
                </p>
                <div class="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-white/5 text-[10px] text-slate-400">
                  <div>Minutos: <strong class="text-white">${p.minutos || 0}</strong></div>
                  <div>Goles: <strong class="text-emerald-400">${p.goles || 0}</strong></div>
                </div>
              </div>

              <div class="mt-4 pt-2 border-t border-white/5 flex items-center justify-between text-xs">
                <button onclick="openEditPlayerModal('${p.id}')" class="text-blue-400 hover:text-blue-300 font-bold">Editar ✏️</button>
                <button onclick="deletePlayer('${p.id}')" class="text-rose-400 hover:text-rose-300">Eliminar</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function openNewPlayerModal() {
  const team = appState.activeTeam || 'filial';
  openModal(`
    <div class="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
      <h3 class="font-outfit font-extrabold text-lg text-white uppercase">Añadir Jugador (${team.toUpperCase()})</h3>
      <button onclick="closeModal()" class="text-slate-400 hover:text-white text-lg">✕</button>
    </div>
    <form onsubmit="handleSavePlayer(event)" class="flex flex-col gap-3 text-xs">
      <!-- Player Photo Uploader -->
      <div class="flex items-center gap-4 bg-white/5 p-3 rounded-xl border border-white/10">
        <div id="p-photo-preview" class="w-16 h-16 rounded-2xl bg-black/50 border border-white/20 overflow-hidden flex items-center justify-center flex-shrink-0 shadow-inner">
          <span class="text-2xl text-slate-500">👤</span>
        </div>
        <div class="flex-1">
          <label class="block text-slate-300 mb-1 font-bold uppercase text-[10px]">Foto del Jugador</label>
          <input type="file" id="p-photo-file" accept="image/*" onchange="previewPlayerPhoto(this, 'p-photo-preview', 'p-foto-data')" class="text-[11px] text-slate-400 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:uppercase file:bg-club-red file:text-white hover:file:bg-club-red-hover cursor-pointer">
          <input type="hidden" id="p-foto-data" value="">
          <p class="text-[10px] text-slate-500 mt-1">Sube una foto de carnet o retrato (JPG, PNG, WebP).</p>
        </div>
      </div>

      <div>
        <label class="block text-slate-300 mb-1 font-bold uppercase text-[10px]">Nombre *</label>
        <input type="text" id="p-nombre" required placeholder="Nombre de pila" class="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-xs">
      </div>
      <div>
        <label class="block text-slate-300 mb-1 font-bold uppercase text-[10px]">Apellidos</label>
        <input type="text" id="p-apellidos" placeholder="Apellidos" class="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-xs">
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="block text-slate-300 mb-1 font-bold uppercase text-[10px]">Dorsal</label>
          <input type="number" id="p-dorsal" placeholder="Ej: 10" class="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-xs">
        </div>
        <div>
          <label class="block text-slate-300 mb-1 font-bold uppercase text-[10px]">Posición</label>
          <select id="p-posicion" class="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-xs">
            <option value="portero">Portero</option>
            <option value="cierre">Cierre</option>
            <option value="ala">Ala</option>
            <option value="ala_cierre">Ala-Cierre</option>
            <option value="ala_pivot">Ala-Pívot</option>
            <option value="pivot">Pívot</option>
          </select>
        </div>
      </div>
      <div>
        <label class="block text-slate-300 mb-1 font-bold uppercase text-[10px]">Estado</label>
        <select id="p-estado" class="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-xs">
          <option value="disponible">Disponible</option>
          <option value="dudoso">Dudoso / Molestias</option>
          <option value="lesionado">Lesionado / Baja</option>
        </select>
      </div>
      <div class="flex justify-end gap-2 mt-2">
        <button type="button" onclick="closeModal()" class="px-4 py-2 rounded-xl bg-white/5 text-slate-400 hover:text-white">Cancelar</button>
        <button type="submit" class="px-5 py-2 rounded-xl bg-club-red text-white font-bold uppercase text-xs">Guardar</button>
      </div>
    </form>
  `);
}

function openEditPlayerModal(playerId) {
  const team = appState.activeTeam || 'filial';
  const player = (appState.players[team] || []).find(p => p.id == playerId);
  if (!player) return;

  openModal(`
    <div class="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
      <h3 class="font-outfit font-extrabold text-lg text-white uppercase">Editar Jugador</h3>
      <button onclick="closeModal()" class="text-slate-400 hover:text-white text-lg">✕</button>
    </div>
    <form onsubmit="handleUpdatePlayer(event, '${player.id}')" class="flex flex-col gap-3 text-xs">
      <!-- Player Photo Uploader with Preview -->
      <div class="flex items-center gap-4 bg-white/5 p-3 rounded-xl border border-white/10">
        <div id="pe-photo-preview" class="w-16 h-16 rounded-2xl bg-black/50 border border-white/20 overflow-hidden flex items-center justify-center flex-shrink-0 shadow-inner">
          ${player.foto && player.foto.startsWith('data:image') ? `
            <img src="${player.foto}" alt="${player.nombre}" class="w-full h-full object-cover">
          ` : `
            <div class="flex flex-col items-center justify-center">
              <span class="font-outfit font-black text-xl text-club-red leading-none">${player.dorsal || '#'}</span>
              <span class="text-[8px] text-slate-500 font-bold uppercase mt-0.5">Sin foto</span>
            </div>
          `}
        </div>
        <div class="flex-1">
          <label class="block text-slate-300 mb-1 font-bold uppercase text-[10px]">Cambiar Foto</label>
          <input type="file" id="pe-photo-file" accept="image/*" onchange="previewPlayerPhoto(this, 'pe-photo-preview', 'pe-foto-data')" class="text-[11px] text-slate-400 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:uppercase file:bg-club-red file:text-white hover:file:bg-club-red-hover cursor-pointer">
          <input type="hidden" id="pe-foto-data" value="${player.foto || ''}">
          <div class="flex items-center gap-3 mt-1.5">
            <span class="text-[10px] text-slate-500">JPG, PNG, WebP</span>
            ${player.foto ? `
              <button type="button" onclick="removePlayerPhoto('pe-photo-preview', 'pe-foto-data', '${player.dorsal || '#'}')" class="text-[10px] text-rose-400 hover:text-rose-300 underline font-bold">
                Quitar Foto
              </button>
            ` : ''}
          </div>
        </div>
      </div>

      <div>
        <label class="block text-slate-300 mb-1 font-bold uppercase text-[10px]">Nombre *</label>
        <input type="text" id="pe-nombre" value="${player.nombre}" required class="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-xs">
      </div>
      <div>
        <label class="block text-slate-300 mb-1 font-bold uppercase text-[10px]">Apellidos</label>
        <input type="text" id="pe-apellidos" value="${player.apellidos || ''}" class="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-xs">
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="block text-slate-300 mb-1 font-bold uppercase text-[10px]">Dorsal</label>
          <input type="number" id="pe-dorsal" value="${player.dorsal || ''}" class="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-xs">
        </div>
        <div>
          <label class="block text-slate-300 mb-1 font-bold uppercase text-[10px]">Posición</label>
          <select id="pe-posicion" class="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-xs">
            <option value="portero" ${player.posicion === 'portero' ? 'selected' : ''}>Portero</option>
            <option value="cierre" ${player.posicion === 'cierre' ? 'selected' : ''}>Cierre</option>
            <option value="ala" ${player.posicion === 'ala' ? 'selected' : ''}>Ala</option>
            <option value="ala_cierre" ${player.posicion === 'ala_cierre' ? 'selected' : ''}>Ala-Cierre</option>
            <option value="ala_pivot" ${player.posicion === 'ala_pivot' ? 'selected' : ''}>Ala-Pívot</option>
            <option value="pivot" ${player.posicion === 'pivot' ? 'selected' : ''}>Pívot</option>
          </select>
        </div>
      </div>
      <div>
        <label class="block text-slate-300 mb-1 font-bold uppercase text-[10px]">Estado</label>
        <select id="pe-estado" class="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-xs">
          <option value="disponible" ${player.estado === 'disponible' ? 'selected' : ''}>Disponible</option>
          <option value="dudoso" ${player.estado === 'dudoso' ? 'selected' : ''}>Dudoso / Molestias</option>
          <option value="lesionado" ${player.estado === 'lesionado' ? 'selected' : ''}>Lesionado / Baja</option>
        </select>
      </div>
      <div class="flex justify-end gap-2 mt-2">
        <button type="button" onclick="closeModal()" class="px-4 py-2 rounded-xl bg-white/5 text-slate-400 hover:text-white">Cancelar</button>
        <button type="submit" class="px-5 py-2 rounded-xl bg-club-red text-white font-bold uppercase text-xs">Actualizar</button>
      </div>
    </form>
  `);
}

function previewPlayerPhoto(fileInput, previewContainerId, hiddenInputId) {
  const file = fileInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const base64 = e.target.result;
    const hidden = document.getElementById(hiddenInputId);
    if (hidden) hidden.value = base64;

    const preview = document.getElementById(previewContainerId);
    if (preview) {
      preview.innerHTML = `<img src="${base64}" class="w-full h-full object-cover">`;
    }
  };
  reader.readAsDataURL(file);
}

function removePlayerPhoto(previewContainerId, hiddenInputId, defaultDorsal) {
  const hidden = document.getElementById(hiddenInputId);
  if (hidden) hidden.value = '';

  const preview = document.getElementById(previewContainerId);
  if (preview) {
    preview.innerHTML = `
      <div class="flex flex-col items-center justify-center">
        <span class="font-outfit font-black text-xl text-club-red leading-none">${defaultDorsal || '#'}</span>
        <span class="text-[8px] text-slate-500 font-bold uppercase mt-0.5">Sin foto</span>
      </div>
    `;
  }
}

async function handleSavePlayer(e) {
  e.preventDefault();
  const team = appState.activeTeam || 'filial';
  const fotoData = document.getElementById('p-foto-data') ? document.getElementById('p-foto-data').value : '';

  const newPlayer = {
    id: Date.now(),
    nombre: (document.getElementById('p-nombre').value || '').trim(),
    apellidos: (document.getElementById('p-apellidos').value || '').trim(),
    dorsal: parseInt(document.getElementById('p-dorsal').value) || 0,
    posicion: document.getElementById('p-posicion').value,
    estado: document.getElementById('p-estado').value,
    foto: fotoData
  };

  if (!appState.players) appState.players = { filial: [], juvenil: [] };
  if (!appState.players[team]) appState.players[team] = [];
  appState.players[team].push(newPlayer);

  saveStateToStorage();
  closeModal();
  showNotification('Jugador añadido con éxito');
  renderView();

  try {
    await fetch('/api/players', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team, ...newPlayer })
    });
  } catch(err) {
    console.error('Server sync error for add player:', err);
  }
}

async function handleUpdatePlayer(e, id) {
  e.preventDefault();
  const team = appState.activeTeam || 'filial';
  const fotoData = document.getElementById('pe-foto-data') ? document.getElementById('pe-foto-data').value : '';

  if (!appState.players) appState.players = { filial: [], juvenil: [] };
  if (!appState.players[team]) appState.players[team] = [];

  const idx = appState.players[team].findIndex(p => String(p.id) === String(id));
  const updatedPlayer = {
    id: id,
    nombre: (document.getElementById('pe-nombre').value || '').trim(),
    apellidos: (document.getElementById('pe-apellidos').value || '').trim(),
    dorsal: parseInt(document.getElementById('pe-dorsal').value) || 0,
    posicion: document.getElementById('pe-posicion').value,
    estado: document.getElementById('pe-estado').value,
    foto: fotoData
  };

  if (idx !== -1) {
    appState.players[team][idx] = { ...appState.players[team][idx], ...updatedPlayer };
  } else {
    appState.players[team].push(updatedPlayer);
  }

  saveStateToStorage();
  closeModal();
  showNotification('Jugador y foto actualizados');
  renderView();

  try {
    await fetch('/api/players', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team, ...updatedPlayer })
    });
  } catch(err) {
    console.error('Server sync error for update player:', err);
  }
}

async function deletePlayer(id) {
  if (!confirm('¿Seguro que deseas eliminar este jugador?')) return;
  const team = appState.activeTeam || 'filial';

  if (!appState.players) appState.players = { filial: [], juvenil: [] };
  if (appState.players[team]) {
    appState.players[team] = appState.players[team].filter(p => String(p.id) !== String(id));
  }

  saveStateToStorage();
  showNotification('Jugador eliminado');
  renderView();

  try {
    await fetch('/api/players', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, team })
    });
  } catch(err) {
    console.error('Server sync error for delete player:', err);
  }
}

// ====================================================
// ====================================================
// VIEW 5: SESIONES DE ENTRENAMIENTO (RÉPLICA MODELO JUEGO)
// ====================================================
let sessionSearchQuery = '';
let sessionSubView = 'index'; // 'index', 'create', 'edit', 'show'
let activeSessionId = null;

function renderSessions() {
  const team = appState.activeTeam || 'filial';
  const teamName = team === 'filial' ? 'Filial Sporting La Nucía' : 'Juvenil La Nucía FS';
  const allSessions = appState.sessions[team] || [];

  if (sessionSubView === 'create') {
    return renderSessionCreateOrEdit(null);
  } else if (sessionSubView === 'edit' && activeSessionId) {
    const s = allSessions.find(x => x.id == activeSessionId);
    return renderSessionCreateOrEdit(s);
  } else if (sessionSubView === 'show' && activeSessionId) {
    const s = allSessions.find(x => x.id == activeSessionId);
    return renderSessionShow(s);
  }

  // INDEX VIEW
  let filtered = allSessions;
  if (sessionSearchQuery.trim()) {
    const q = sessionSearchQuery.toLowerCase();
    filtered = allSessions.filter(s => 
      (s.titulo || '').toLowerCase().includes(q) || 
      (s.observaciones || '').toLowerCase().includes(q)
    );
  }

  return `
    <div class="flex flex-col gap-6">
      <!-- Header Action Bar -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/8 pb-4">
        <div>
          <div class="flex items-center gap-3">
            <h2 class="font-outfit font-extrabold text-xl sm:text-2xl text-white uppercase tracking-wider">
              Sesiones de Entrenamiento
            </h2>
            <span class="bg-club-red/20 text-club-red border border-club-red/30 font-outfit text-xs font-bold uppercase px-3 py-1 rounded-xl shadow-sm tracking-wider">
              ${filtered.length} ${filtered.length === 1 ? 'Sesión' : 'Sesiones en total'}
            </span>
            <span class="bg-white/5 border border-white/10 font-outfit text-xs font-bold uppercase px-2.5 py-1 rounded-xl text-slate-300">
              ${teamName}
            </span>
          </div>
          <p class="text-xs text-[#94A3B8] mt-0.5">Planificación y acumulación de tus entrenamientos semanales.</p>
        </div>
        <button onclick="goToSessionSubView('create')" class="inline-flex items-center gap-2 font-outfit font-bold text-xs uppercase px-5 py-3.5 rounded-xl bg-club-red hover:bg-club-red-hover text-white transition-all duration-300 shadow-lg shadow-club-red/10">
          ➕ Añadir Sesión Nueva
        </button>
      </div>

      <!-- Filters Bar -->
      <div class="bg-[#1a1a1a]/60 border border-white/8 rounded-2xl p-4 flex flex-col sm:flex-row gap-4 items-center justify-between shadow-xl">
        <div class="flex-grow max-w-md w-full relative">
          <input type="text" id="session-search-input" value="${sessionSearchQuery}" placeholder="Buscar por título u observaciones..."
                 oninput="handleSessionSearch(this.value)"
                 class="bg-black/30 border border-white/8 rounded-xl pl-10 pr-4 py-2.5 text-white text-xs focus:outline-none focus:border-club-red focus:ring-1 focus:ring-club-red transition-all duration-300 w-full">
          <span class="absolute left-3.5 top-3 text-[#94A3B8]/50 text-xs">🔍</span>
        </div>
        
        <div class="flex items-center gap-2 w-full sm:w-auto justify-end">
          ${sessionSearchQuery ? `
            <button type="button" onclick="clearSessionSearch()" class="font-outfit font-bold text-xs uppercase px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white transition-colors duration-200">
              Limpiar Filtro
            </button>
          ` : ''}
        </div>
      </div>

      <!-- Sessions Grid / List -->
      ${filtered.length === 0 ? `
        <div class="flex flex-col items-center justify-center gap-3 p-12 bg-[#1a1a1a]/40 border border-dashed border-white/8 rounded-2xl text-center max-w-lg mx-auto w-full">
          <span class="text-5xl">${sessionSearchQuery ? '🔍' : '📋'}</span>
          ${sessionSearchQuery ? `
            <h3 class="font-outfit font-bold text-white uppercase tracking-wider text-sm mt-2">No se encontraron sesiones</h3>
            <p class="text-xs text-[#94A3B8] max-w-sm">No hay sesiones de entrenamiento que coincidan con la búsqueda: "${sessionSearchQuery}".</p>
            <button type="button" onclick="clearSessionSearch()" class="mt-2 inline-flex items-center gap-2 font-outfit font-bold text-xs uppercase px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white transition-all duration-300">
              Limpiar Filtro
            </button>
          ` : `
            <h3 class="font-outfit font-bold text-white uppercase tracking-wider text-sm mt-2">No hay sesiones registradas</h3>
            <p class="text-xs text-[#94A3B8] max-w-sm">Comienza a planificar tus entrenamientos haciendo clic en el botón de añadir sesión nueva.</p>
            <button type="button" onclick="goToSessionSubView('create')" class="mt-2 inline-flex items-center gap-2 font-outfit font-bold text-xs uppercase px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 hover:border-club-red hover:bg-club-red/10 text-white transition-all duration-300">
              Crear mi primera sesión
            </button>
          `}
        </div>
      ` : `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          ${filtered.map(s => {
            const calCount = (s.calentamiento || []).filter(x => x && x.taskId).length;
            const prinCount = (s.parte_principal || []).filter(x => x && x.taskId).length;
            const vueCount = (s.vuelta_calma || []).filter(x => x && x.taskId).length;
            let totalTasks = calCount + prinCount + vueCount;
            if (totalTasks === 0 && Array.isArray(s.tasks)) totalTasks = s.tasks.length;

            let duration = 0;
            if (s.duracion) {
              duration = s.duracion;
            } else {
              duration = (calCount * 10) + (vueCount * 10);
              (s.parte_principal || []).forEach(p => {
                if (p && p.taskId) duration += parseInt(p.duration) || 15;
              });
              if (duration === 0) duration = 90;
            }

            return `
              <div class="bg-[#1a1a1a]/80 border border-white/8 rounded-2xl p-6 flex flex-col justify-between shadow-xl hover:border-white/15 hover:shadow-2xl transition-all duration-300">
                <div class="flex flex-col gap-3">
                  <!-- Date badge -->
                  <div class="flex items-center justify-between">
                    <span class="text-[10px] font-bold font-outfit uppercase tracking-widest text-[#94A3B8] bg-white/5 border border-white/5 px-2.5 py-1 rounded-md">
                      📅 ${formatSpanishDate(s.fecha)}
                    </span>
                    ${totalTasks > 0 ? `
                      <span class="text-[10px] font-bold font-outfit uppercase tracking-wider text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 px-2 py-0.5 rounded-md">
                        ${totalTasks} ${totalTasks === 1 ? 'Tarea' : 'Tareas'}
                      </span>
                    ` : `
                      <span class="text-[10px] font-bold font-outfit uppercase tracking-wider text-club-red bg-club-red/10 border border-club-red/20 px-2 py-0.5 rounded-md">
                        Sesión Planificada
                      </span>
                    `}
                  </div>

                  <!-- Session Title -->
                  <div>
                    <h3 class="font-outfit font-extrabold text-base text-white tracking-tight leading-snug line-clamp-2">
                      ${s.titulo}
                    </h3>
                    <span class="text-[10px] text-[#94A3B8] font-semibold block mt-1">
                      ⏱️ Duración total: ${duration} min
                    </span>
                  </div>

                  <!-- Observations snippet -->
                  ${s.observaciones ? `
                    <p class="text-xs text-slate-300 line-clamp-3 italic leading-relaxed border-t border-white/5 pt-3">
                      "${s.observaciones}"
                    </p>
                  ` : `
                    <p class="text-xs text-slate-500 line-clamp-3 italic leading-relaxed border-t border-white/5 pt-3">
                      Sin observaciones anotadas.
                    </p>
                  `}
                </div>

                <!-- Action buttons -->
                <div class="flex items-center gap-2 border-t border-white/5 pt-4 mt-4">
                  <button type="button" onclick="goToSessionSubView('show', '${s.id}')" class="flex-1 text-center font-outfit font-bold text-[10px] uppercase tracking-wider py-2.5 rounded-lg bg-club-red text-white hover:bg-club-red-hover transition-colors duration-200">
                    🔍 Ver Ficha
                  </button>
                  <button type="button" onclick="goToSessionSubView('edit', '${s.id}')" class="px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 hover:border-club-red hover:bg-club-red/10 text-white transition-all duration-200" title="Editar Sesión">
                    ✏️
                  </button>
                  <button type="button" onclick="deleteSession('${s.id}')" class="px-3 py-2.5 rounded-lg bg-rose-500/10 border border-rose-500/25 hover:bg-rose-500/20 text-rose-400 transition-colors duration-200" title="Eliminar Sesión">
                    🗑️
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}
    </div>
  `;
}

function handleSessionSearch(q) {
  sessionSearchQuery = q;
  renderView();
}

function clearSessionSearch() {
  sessionSearchQuery = '';
  renderView();
}

function goToSessionSubView(view, id = null) {
  sessionSubView = view;
  activeSessionId = id;
  renderView();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function formatSpanishDate(dStr) {
  if (!dStr) return 'Sin fecha';
  try {
    const p = dStr.split('-');
    if (p.length === 3) return `${p[2]}/${p[1]}/${p[0]}`;
    return dStr;
  } catch(e) {
    return dStr;
  }
}

// ----------------------------------------------------
// CREATE / EDIT SESSION (IDÉNTICO A MODELO JUEGO)
// ----------------------------------------------------
function renderSessionCreateOrEdit(sessionToEdit) {
  const isEditing = !!sessionToEdit;
  const team = appState.activeTeam || 'filial';
  const allTasks = appState.tasks || [];
  const today = new Date().toISOString().split('T')[0];

  const calTasks = (sessionToEdit && sessionToEdit.calentamiento) || [{ taskId: '' }];
  const prinTasks = (sessionToEdit && sessionToEdit.parte_principal) || [
    { taskId: '', duration: 15 },
    { taskId: '', duration: 15 },
    { taskId: '', duration: 15 },
    { taskId: '', duration: 15 },
    { taskId: '', duration: 15 }
  ];
  const vueTasks = (sessionToEdit && sessionToEdit.vuelta_calma) || [{ taskId: '' }];

  // Fallback for legacy sessions that only had sessionToEdit.tasks array
  if (isEditing && (!sessionToEdit.calentamiento && !sessionToEdit.parte_principal) && Array.isArray(sessionToEdit.tasks)) {
    sessionToEdit.tasks.forEach((tid, idx) => {
      if (idx === 0) calTasks[0] = { taskId: tid };
      else if (idx <= 5) prinTasks[idx - 1] = { taskId: tid, duration: 15 };
      else if (idx === 6) vueTasks[0] = { taskId: tid };
    });
  }

  // Pre-seed window global tasks for slot autocomplete
  window.__sessionTasksData = {};
  allTasks.forEach(t => {
    window.__sessionTasksData[t.id] = {
      id: t.id,
      nombre: t.nombre || '',
      fase: t.fase_juego || 'Táctica',
      duracion: t.duracion || 15,
      grafico: t.grafico || ''
    };
  });

  return `
    <div class="flex flex-col gap-6">
      <!-- Header Action Bar -->
      <div class="flex items-center gap-3 border-b border-white/8 pb-4">
        <button type="button" onclick="goToSessionSubView('index')" class="font-outfit font-bold text-xs uppercase px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white text-[#94A3B8] transition-colors duration-200">
          ⬅️ Cancelar
        </button>
        <span class="text-white/20">/</span>
        <span class="text-white font-semibold text-sm uppercase tracking-wider">
          ${isEditing ? `Editar Sesión: ${sessionToEdit.titulo}` : 'Planificar Nueva Sesión'}
        </span>
      </div>

      <!-- Form Container (Full Width Stacked Layout) -->
      <form id="session-editor-form" onsubmit="handleSaveSessionForm(event, ${isEditing ? `'${sessionToEdit.id}'` : 'null'})" class="flex flex-col gap-8 w-full">
        <!-- General Details Card -->
        <div class="bg-[#1a1a1a]/80 border border-white/8 rounded-2xl p-6 flex flex-col gap-4 shadow-2xl">
          <div class="border-l-4 border-club-red pl-3">
            <h3 class="font-outfit font-extrabold text-sm uppercase text-white tracking-wider">Datos de la Sesión</h3>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mt-2">
            <!-- Session Title -->
            <div class="flex flex-col gap-1.5 md:col-span-2">
              <label for="sess-titulo" class="text-[10px] text-[#94A3B8] uppercase font-bold tracking-wider">Título de la Sesión</label>
              <input type="text" id="sess-titulo" required value="${isEditing ? (sessionToEdit.titulo || '') : ''}" placeholder="Ej: Lunes - Presión y Transición"
                     class="bg-black/30 border border-white/8 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-club-red focus:ring-1 focus:ring-club-red transition-all duration-300">
            </div>

            <!-- Date -->
            <div class="flex flex-col gap-1.5">
              <label for="sess-fecha" class="text-[10px] text-[#94A3B8] uppercase font-bold tracking-wider">Fecha del Entrenamiento</label>
              <input type="date" id="sess-fecha" required value="${isEditing ? (sessionToEdit.fecha || today) : today}"
                     class="bg-black/30 border border-white/8 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-club-red focus:ring-1 focus:ring-club-red transition-all duration-300">
            </div>
          </div>
        </div>

        <!-- 1. Calentamiento Block -->
        <div class="bg-[#1a1a1a]/85 border border-white/8 rounded-2xl p-6 shadow-2xl flex flex-col gap-4">
          <div class="flex items-center gap-3 border-b border-white/5 pb-3">
            <span class="text-xl">🔥</span>
            <div>
              <h3 class="font-outfit font-extrabold text-sm uppercase text-white tracking-wider">1. Calentamiento (Activación)</h3>
              <p class="text-[10px] text-[#94A3B8]">Organiza el espacio único de 10 minutos seleccionando una tarea.</p>
            </div>
          </div>

          <div class="mt-2">
            <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
              ${renderSlotItem('calentamiento_0', 'Espacio Único', 10, calTasks[0] ? calTasks[0].taskId : '', false)}
            </div>
          </div>
        </div>

        <!-- 2. Parte Principal Block -->
        <div class="bg-[#1a1a1a]/85 border border-white/8 rounded-2xl p-6 shadow-2xl flex flex-col gap-4">
          <div class="flex items-center gap-3 border-b border-white/5 pb-3">
            <span class="text-xl">⚽</span>
            <div>
              <h3 class="font-outfit font-extrabold text-sm uppercase text-white tracking-wider">2. Parte Principal</h3>
              <p class="text-[10px] text-[#94A3B8]">Organiza los 5 espacios de 15 minutos seleccionando una tarea para cada uno.</p>
            </div>
          </div>

          <div class="mt-2">
            <div class="grid grid-cols-1 md:grid-cols-5 gap-6">
              ${[0,1,2,3,4].map(idx => {
                const pt = prinTasks[idx] || { taskId: '', duration: 15 };
                return renderSlotItem(`principal_${idx}`, `Espacio ${idx + 1}`, pt.duration || 15, pt.taskId || '', true, idx);
              }).join('')}
            </div>
          </div>
        </div>

        <!-- 3. Vuelta a la Calma Block -->
        <div class="bg-[#1a1a1a]/85 border border-white/8 rounded-2xl p-6 shadow-2xl flex flex-col gap-4">
          <div class="flex items-center gap-3 border-b border-white/5 pb-3">
            <span class="text-xl">🧘</span>
            <div>
              <h3 class="font-outfit font-extrabold text-sm uppercase text-white tracking-wider">3. Vuelta a la Calma</h3>
              <p class="text-[10px] text-[#94A3B8]">Organiza el espacio único de 10 minutos seleccionando una tarea.</p>
            </div>
          </div>

          <div class="mt-2">
            <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
              ${renderSlotItem('vuelta_calma_0', 'Espacio Único', 10, vueTasks[0] ? vueTasks[0].taskId : '', false)}
            </div>
          </div>
        </div>

        <!-- 4. Observaciones Finales -->
        <div class="bg-[#1a1a1a]/80 border border-white/8 rounded-2xl p-6 flex flex-col gap-4 shadow-2xl">
          <div class="border-l-4 border-club-red pl-3">
            <h3 class="font-outfit font-extrabold text-sm uppercase text-white tracking-wider">4. Observaciones Finales</h3>
            <p class="text-[10px] text-[#94A3B8]">Apunta los aspectos generales a corregir, la intensidad planificada o los objetivos generales del día.</p>
          </div>

          <div class="flex flex-col gap-1.5 mt-2">
            <textarea id="sess-observaciones" rows="5" placeholder="Escribe aquí las observaciones generales del entrenamiento..."
                      class="bg-black/30 border border-white/8 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-club-red focus:ring-1 focus:ring-club-red transition-all duration-300">${isEditing ? (sessionToEdit.observaciones || '') : ''}</textarea>
          </div>
        </div>

        <!-- Form Submit Bar -->
        <div class="flex justify-end gap-4 border-t border-white/5 pt-6 mt-2">
          <button type="button" onclick="goToSessionSubView('index')" class="font-outfit font-bold text-xs uppercase px-6 py-3.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white text-[#94A3B8] transition-colors duration-200">
            Cancelar
          </button>
          <button type="submit" class="inline-flex items-center gap-2 font-outfit font-bold text-xs uppercase px-8 py-3.5 rounded-xl bg-club-red hover:bg-club-red-hover text-white transition-all duration-300 shadow-lg shadow-club-red/10">
            💾 ${isEditing ? 'Actualizar Sesión de Entrenamiento' : 'Guardar Sesión de Entrenamiento'}
          </button>
        </div>
      </form>
    </div>
  `;
}

function renderSlotItem(slotKey, label, defaultDuration, currentTaskId, isPrincipal, pIndex = 0) {
  const currentTask = (appState.tasks || []).find(t => t.id == currentTaskId);
  const currentName = currentTask ? currentTask.nombre : '';

  return `
    <div class="bg-black/20 border border-white/5 rounded-2xl p-4 flex flex-col gap-3">
      <div class="flex items-center justify-between border-b border-white/5 pb-2">
        <span class="text-[10px] font-bold font-outfit uppercase tracking-widest text-[#94A3B8]">
          ${label}
        </span>
        ${isPrincipal ? `
          <div class="flex items-center gap-1">
            <span class="text-[9px] text-[#94A3B8]">⏱️</span>
            <input type="number" id="dur_${slotKey}" value="${defaultDuration}" 
                   class="w-10 bg-black/40 border border-white/10 rounded px-1 py-0.5 text-center text-[10px] font-bold text-club-red focus:outline-none focus:border-club-red"
                   min="1" max="120">
            <span class="text-[9px] text-[#94A3B8] font-bold">min</span>
          </div>
        ` : `
          <span class="text-[9px] font-bold text-club-red bg-club-red/10 border border-club-red/20 px-2 py-0.5 rounded">
            ⏱️ ${defaultDuration} min
          </span>
        `}
      </div>
      
      <div class="flex flex-col gap-2 relative">
        <label class="text-[9px] text-[#94A3B8] uppercase font-bold tracking-wider">Seleccionar Ejercicio</label>
        <div class="relative">
          <input type="text" id="search_input_slot_${slotKey}" value="${currentName}" placeholder="Buscar por nombre..." autocomplete="off"
                 oninput="filterSessionTasks('${slotKey}')" onfocus="showSessionTasksList('${slotKey}')"
                 class="bg-black/40 border border-white/8 rounded-xl pl-3 pr-8 py-2.5 text-white text-xs focus:outline-none focus:border-club-red transition-all duration-300 w-full">
          <button type="button" onclick="clearSessionTaskSelection('${slotKey}')" id="clear_btn_slot_${slotKey}" 
                  class="absolute right-3 top-3 text-[#94A3B8]/60 hover:text-white text-xs ${currentTaskId ? '' : 'hidden'}">✕</button>
        </div>
        <input type="hidden" id="slot_${slotKey}" value="${currentTaskId}">
        
        <!-- Suggestions Autocomplete List -->
        <div id="suggestions_slot_${slotKey}" class="absolute left-0 right-0 top-[60px] z-50 bg-[#1a1a1a] border border-white/10 rounded-xl max-h-48 overflow-y-auto hidden shadow-2xl">
        </div>
      </div>

      <!-- Dynamic Preview Container -->
      <div id="preview_slot_${slotKey}" class="${currentTask ? '' : 'hidden'} flex flex-col gap-2 border-t border-white/5 pt-3">
        <div class="flex items-center justify-between">
          <span id="preview_phase_slot_${slotKey}" class="text-[8px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/5 px-1.5 py-0.5 rounded border border-emerald-500/10">
            ${currentTask ? currentTask.fase_juego : ''}
          </span>
          <span id="preview_duration_slot_${slotKey}" class="text-[8px] font-bold text-white bg-white/5 px-1.5 py-0.5 rounded">
            ⏱️ ${currentTask ? currentTask.duracion : 15} min
          </span>
        </div>
        <!-- Thumbnail -->
        <div class="w-full aspect-[16/9] rounded-lg overflow-hidden border border-white/5 bg-[#12261e]/50 mt-0.5">
          <img id="preview_img_slot_${slotKey}" src="${currentTask ? (currentTask.grafico || '') : ''}" class="w-full h-full object-contain ${currentTask && currentTask.grafico ? '' : 'hidden'}" alt="Pizarra táctica">
        </div>
      </div>
    </div>
  `;
}

function getAllSessionSlotKeys() {
  const list = ['calentamiento_0', 'vuelta_calma_0'];
  for (let i = 0; i < 5; i++) {
    list.push(`principal_${i}`);
  }
  return list;
}

function filterSessionTasks(slotKey) {
  const searchInput = document.getElementById('search_input_slot_' + slotKey);
  const suggestions = document.getElementById('suggestions_slot_' + slotKey);
  const clearBtn = document.getElementById('clear_btn_slot_' + slotKey);
  if (!searchInput || !suggestions) return;
  const query = searchInput.value.toLowerCase().trim();

  if (searchInput.value.length > 0) {
    if (clearBtn) clearBtn.classList.remove('hidden');
  } else {
    if (clearBtn) clearBtn.classList.add('hidden');
  }

  let html = '';
  if (query === '') {
    html += `
      <div onclick="selectSessionTask('${slotKey}', '', '-- Vacío / Sin Tarea --')" 
           class="px-3 py-2.5 hover:bg-white/5 text-xs text-[#94A3B8] cursor-pointer border-b border-white/5">
        -- Vacío / Sin Tarea --
      </div>
    `;
  }

  const tasksData = window.__sessionTasksData || {};
  let matchesFound = 0;
  for (const taskId in tasksData) {
    const task = tasksData[taskId];
    if (query === '' || task.nombre.toLowerCase().includes(query)) {
      html += `
        <div onclick="selectSessionTask('${slotKey}', '${taskId}', '${task.nombre.replace(/'/g, "\\'")}')" 
             class="px-3 py-2.5 hover:bg-club-red/25 text-xs text-white cursor-pointer transition-colors duration-150 flex items-center justify-between border-b border-white/5 last:border-b-0">
          <span class="font-semibold">${task.nombre}</span>
          <span class="text-[8px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/5 px-1 rounded border border-emerald-500/10">${task.fase}</span>
        </div>
      `;
      matchesFound++;
    }
  }

  if (matchesFound === 0 && query !== '') {
    html = `<div class="px-3 py-3 text-xs text-slate-500 italic text-center">No se encontraron tareas</div>`;
  }

  suggestions.innerHTML = html;
  suggestions.classList.remove('hidden');
}

function showSessionTasksList(slotKey) {
  getAllSessionSlotKeys().forEach(id => {
    if (id !== slotKey) {
      const list = document.getElementById('suggestions_slot_' + id);
      if (list) list.classList.add('hidden');
    }
  });
  filterSessionTasks(slotKey);
}

function selectSessionTask(slotKey, taskId, taskName) {
  const searchInput = document.getElementById('search_input_slot_' + slotKey);
  const hiddenInput = document.getElementById('slot_' + slotKey);
  const suggestions = document.getElementById('suggestions_slot_' + slotKey);
  const clearBtn = document.getElementById('clear_btn_slot_' + slotKey);

  if (taskId === '') {
    if (searchInput) searchInput.value = '';
    if (hiddenInput) hiddenInput.value = '';
    if (clearBtn) clearBtn.classList.add('hidden');
  } else {
    if (searchInput) searchInput.value = taskName;
    if (hiddenInput) hiddenInput.value = taskId;
    if (clearBtn) clearBtn.classList.remove('hidden');
  }

  if (suggestions) suggestions.classList.add('hidden');
  updateSessionSlotPreview(slotKey);
}

function clearSessionTaskSelection(slotKey) {
  selectSessionTask(slotKey, '', '');
}

function updateSessionSlotPreview(slotKey) {
  const hiddenInput = document.getElementById('slot_' + slotKey);
  const previewDiv = document.getElementById('preview_slot_' + slotKey);
  const img = document.getElementById('preview_img_slot_' + slotKey);
  const phaseSpan = document.getElementById('preview_phase_slot_' + slotKey);
  const durationSpan = document.getElementById('preview_duration_slot_' + slotKey);
  if (!hiddenInput || !previewDiv) return;

  const taskId = hiddenInput.value;
  const tasksData = window.__sessionTasksData || {};
  if (taskId && tasksData[taskId]) {
    const data = tasksData[taskId];
    if (phaseSpan) phaseSpan.innerText = data.fase;
    if (durationSpan) durationSpan.innerText = '⏱️ ' + data.duracion + ' min';
    if (img) {
      if (data.grafico) {
        img.src = data.grafico;
        img.classList.remove('hidden');
      } else {
        img.src = '';
        img.classList.add('hidden');
      }
    }
    previewDiv.classList.remove('hidden');
  } else {
    previewDiv.classList.add('hidden');
  }
}

// Global click handler to close suggestions
document.addEventListener('click', function(e) {
  getAllSessionSlotKeys().forEach(slotKey => {
    const suggestions = document.getElementById('suggestions_slot_' + slotKey);
    const searchInput = document.getElementById('search_input_slot_' + slotKey);
    const clearBtn = document.getElementById('clear_btn_slot_' + slotKey);
    if (suggestions && !suggestions.contains(e.target) && e.target !== searchInput && e.target !== clearBtn) {
      suggestions.classList.add('hidden');
    }
  });
});

async function handleSaveSessionForm(e, editId = null) {
  e.preventDefault();
  const team = appState.activeTeam || 'filial';
  const titulo = document.getElementById('sess-titulo').value;
  const fecha = document.getElementById('sess-fecha').value;
  const observaciones = document.getElementById('sess-observaciones').value;

  const calSlotVal = document.getElementById('slot_calentamiento_0') ? document.getElementById('slot_calentamiento_0').value : '';
  const vueSlotVal = document.getElementById('slot_vuelta_calma_0') ? document.getElementById('slot_vuelta_calma_0').value : '';

  const calentamiento = calSlotVal ? [{ taskId: calSlotVal, duration: 10 }] : [];
  const vuelta_calma = vueSlotVal ? [{ taskId: vueSlotVal, duration: 10 }] : [];

  const parte_principal = [];
  for (let i = 0; i < 5; i++) {
    const hid = document.getElementById(`slot_principal_${i}`);
    const dur = document.getElementById(`dur_principal_${i}`);
    if (hid && hid.value) {
      parte_principal.push({
        taskId: hid.value,
        duration: parseInt(dur ? dur.value : 15) || 15
      });
    }
  }

  // Calculate total duration
  let duracion = (calentamiento.length * 10) + (vuelta_calma.length * 10);
  parte_principal.forEach(p => duracion += p.duration);
  if (duracion === 0) duracion = 90;

  // Flatten task list for fast querying / backward compatibility
  const flatTasks = [
    ...calentamiento.map(x => x.taskId),
    ...parte_principal.map(x => x.taskId),
    ...vuelta_calma.map(x => x.taskId)
  ];

  const payload = {
    id: editId || undefined,
    team,
    titulo,
    fecha,
    duracion,
    observaciones,
    calentamiento,
    parte_principal,
    vuelta_calma,
    tasks: flatTasks
  };

  if (!appState.sessions) appState.sessions = { filial: [], juvenil: [] };
  if (!appState.sessions[team]) appState.sessions[team] = [];

  if (editId) {
    payload.id = editId;
    const idx = appState.sessions[team].findIndex(s => String(s.id) === String(editId));
    if (idx !== -1) {
      appState.sessions[team][idx] = { ...appState.sessions[team][idx], ...payload };
    } else {
      appState.sessions[team].push(payload);
    }
  } else {
    payload.id = Date.now();
    appState.sessions[team].push(payload);
  }

  saveStateToStorage();
  showNotification(editId ? 'Sesión de entrenamiento actualizada con éxito' : 'Sesión de entrenamiento creada con éxito');
  goToSessionSubView('index');

  try {
    await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch(err) {
    console.error('Server sync error for session save:', err);
  }
}

// ----------------------------------------------------
// SHOW SESSION VIEW (IDÉNTICO A MODELO JUEGO: FICHA + PDF + PRINT)
// ----------------------------------------------------
function renderSessionShow(session) {
  if (!session) return '<div class="p-8 text-center text-white">Sesión no encontrada.</div>';
  const allTasks = appState.tasks || [];

  // Reconstruct sections
  let calentamientoTasks = (session.calentamiento || []).map(item => {
    const t = allTasks.find(x => x.id == item.taskId);
    return t ? { ...t, pivotDuration: item.duration || 10 } : null;
  }).filter(Boolean);

  let partePrincipalTasks = (session.parte_principal || []).map(item => {
    const t = allTasks.find(x => x.id == item.taskId);
    return t ? { ...t, pivotDuration: item.duration || 15 } : null;
  }).filter(Boolean);

  let vueltaCalmaTasks = (session.vuelta_calma || []).map(item => {
    const t = allTasks.find(x => x.id == item.taskId);
    return t ? { ...t, pivotDuration: item.duration || 10 } : null;
  }).filter(Boolean);

  // Fallback for legacy session format
  if (calentamientoTasks.length === 0 && partePrincipalTasks.length === 0 && vueltaCalmaTasks.length === 0 && Array.isArray(session.tasks)) {
    session.tasks.forEach((tid, idx) => {
      const t = allTasks.find(x => x.id == tid);
      if (t) {
        if (idx === 0) calentamientoTasks.push({ ...t, pivotDuration: 10 });
        else if (idx <= 5) partePrincipalTasks.push({ ...t, pivotDuration: 15 });
        else vueltaCalmaTasks.push({ ...t, pivotDuration: 10 });
      }
    });
  }

  let totalDuration = 0;
  calentamientoTasks.forEach(t => totalDuration += (t.pivotDuration || 10));
  partePrincipalTasks.forEach(t => totalDuration += (t.pivotDuration || 15));
  vueltaCalmaTasks.forEach(t => totalDuration += (t.pivotDuration || 10));
  if (totalDuration === 0) totalDuration = session.duracion || 90;

  const obsLines = (session.observaciones || '').split('\n').map(l => l.trim()).filter(Boolean);

  return `
    <style>
      @media print {
        header, footer, .no-print, nav, button, a { display: none !important; }
        body { background: #FFFFFF !important; color: #000000 !important; font-size: 12px !important; }
        main { max-width: 100% !important; padding: 0 !important; margin: 0 !important; }
        .print-card { background: #FFFFFF !important; border: 1px solid #E2E8F0 !important; color: #000000 !important; box-shadow: none !important; page-break-inside: avoid; }
        .print-title { color: #000000 !important; }
        .print-text { color: #1E293B !important; }
        .print-badge { background: #F1F5F9 !important; border: 1px solid #CBD5E1 !important; color: #0F172A !important; }
        .print-court { border: 1px solid #CBD5E1 !important; background: #F8FAFC !important; }
      }
      .generating-pdf { background: #FFFFFF !important; color: #000000 !important; font-family: 'Plus Jakarta Sans', sans-serif !important; padding: 30px !important; }
      .generating-pdf .bg-\\[\\#1a1a1a\\]\\/80, .generating-pdf .bg-\\[\\#1a1a1a\\]\\/85, .generating-pdf .print-card { background: #FFFFFF !important; border: 1px solid #E2E8F0 !important; color: #000000 !important; box-shadow: none !important; }
      .generating-pdf h2, .generating-pdf h3, .generating-pdf h4, .generating-pdf span, .generating-pdf p, .generating-pdf div { color: #0F172A !important; }
      .generating-pdf .text-white { color: #0F172A !important; }
      .generating-pdf .text-club-red { color: #E11D48 !important; }
      .generating-pdf .text-\\[\\#94A3B8\\] { color: #475569 !important; }
      .generating-pdf .print-badge { background: #F8FAFC !important; border: 1px solid #E2E8F0 !important; color: #0F172A !important; }
      .generating-pdf .no-print { display: none !important; }
    </style>

    <div class="flex flex-col gap-6">
      <!-- Top Action Bar / Back button (no-print) -->
      <div class="flex items-center justify-between border-b border-white/8 pb-4 no-print">
        <div class="flex items-center gap-3">
          <button type="button" onclick="goToSessionSubView('index')" class="font-outfit font-bold text-xs uppercase px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white text-[#94A3B8] transition-colors duration-200">
            ⬅️ Volver
          </button>
          <span class="text-white/20">/</span>
          <span class="text-[#94A3B8] text-sm font-semibold uppercase tracking-wider">Ficha de Entrenamiento</span>
        </div>
        <div class="flex items-center gap-2">
          <button type="button" onclick="exportSessionToPDF()" class="font-outfit font-bold text-xs uppercase px-4 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 hover:bg-emerald-500/20 text-emerald-400 transition-all duration-300">
            📄 Exportar PDF
          </button>
          <button type="button" onclick="window.print()" class="font-outfit font-bold text-xs uppercase px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white text-[#94A3B8] transition-all duration-300">
            🖨️ Imprimir Sesión
          </button>
          <button type="button" onclick="goToSessionSubView('edit', '${session.id}')" class="font-outfit font-bold text-xs uppercase px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 hover:border-club-red hover:bg-club-red/10 text-white transition-all duration-300">
            ✏️ Editar Sesión
          </button>
          <button type="button" onclick="deleteSession('${session.id}')" class="font-outfit font-bold text-xs uppercase px-4 py-2.5 rounded-lg bg-rose-500/10 border border-rose-500/25 hover:bg-rose-500/20 text-rose-400 transition-colors duration-200">
            🗑️ Eliminar
          </button>
        </div>
      </div>

      <!-- PDF Document Content Container -->
      <div id="pdf-session-content" class="flex flex-col gap-6 bg-transparent">
        <!-- Session Header Information Card -->
        <div class="bg-[#1a1a1a]/80 border border-white/8 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xl print-card">
          <div class="flex flex-col gap-2">
            <div class="flex items-center gap-2">
              <span class="text-[10px] font-bold font-outfit uppercase tracking-widest text-[#94A3B8] bg-white/5 border border-white/5 px-2.5 py-1 rounded-md print-badge">
                📅 ${formatSpanishDate(session.fecha)}
              </span>
              <span class="text-[10px] font-bold font-outfit uppercase tracking-widest text-club-red bg-club-red/10 border border-club-red/20 px-2.5 py-1 rounded-md print-badge">
                ⏱️ ${totalDuration} Minutos Totales
              </span>
            </div>
            <h2 class="font-outfit font-extrabold text-2xl text-white tracking-tight print-title">
              ${session.titulo}
            </h2>
          </div>

          <div class="hidden print:block text-right">
            <span class="text-xs font-bold font-outfit uppercase text-[#94A3B8]">La Nucía Fútbol Sala</span>
            <span class="text-[10px] text-slate-500 block">Ficha de Sesión Técnica</span>
          </div>
        </div>

        <!-- Observations & Session Metadata Card -->
        ${obsLines.length > 0 ? `
          <div class="bg-[#1a1a1a]/80 border border-white/8 rounded-2xl p-6 shadow-2xl print-card">
            <div class="border-l-4 border-club-red pl-3 mb-4">
              <h3 class="font-outfit font-extrabold text-xs uppercase text-white tracking-wider print-title">Detalles de la Planificación</h3>
            </div>
            
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              ${obsLines.map(line => `
                <div class="bg-black/30 border border-white/5 rounded-xl p-3 flex items-center gap-2.5 print-badge">
                  <span class="text-xs text-slate-200 font-medium leading-tight">
                    ${line}
                  </span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Training Blocks -->
        <div class="flex flex-col gap-8">
          <!-- 1. Calentamiento Block -->
          ${calentamientoTasks.length > 0 ? `
            <div class="flex flex-col gap-4">
              <div class="flex items-center gap-3 border-b border-white/8 pb-2">
                <span class="text-xl no-print">🔥</span>
                <h3 class="font-outfit font-extrabold text-sm uppercase text-white tracking-wider print-title">1. Calentamiento (Activación)</h3>
                <span class="text-xs text-[#94A3B8] font-bold font-outfit uppercase ml-auto bg-white/3 px-2 py-0.5 rounded print-badge">
                  ${calentamientoTasks.length} ${calentamientoTasks.length === 1 ? 'Ejercicio' : 'Ejercicios'}
                </span>
              </div>

              <div class="flex flex-col gap-4">
                ${calentamientoTasks.map((t, idx) => `
                  <div class="flex flex-col gap-2">
                    <div class="flex items-center justify-between px-4 py-1.5 bg-[#1a1a1a]/40 border border-white/5 rounded-xl text-[10px] uppercase font-bold text-[#94A3B8] print-badge">
                      <span>Calentamiento #${idx + 1}</span>
                      <span>⏱️ ${t.pivotDuration || 10} min</span>
                    </div>
                    ${renderTaskDetailRow(t)}
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- 2. Parte Principal Block -->
          ${partePrincipalTasks.length > 0 ? `
            <div class="flex flex-col gap-4">
              <div class="flex items-center gap-3 border-b border-white/8 pb-2">
                <span class="text-xl no-print">⚽</span>
                <h3 class="font-outfit font-extrabold text-sm uppercase text-white tracking-wider print-title">2. Parte Principal</h3>
                <span class="text-xs text-[#94A3B8] font-bold font-outfit uppercase ml-auto bg-white/3 px-2 py-0.5 rounded print-badge">
                  ${partePrincipalTasks.length} ${partePrincipalTasks.length === 1 ? 'Ejercicio' : 'Ejercicios'}
                </span>
              </div>

              <div class="flex flex-col gap-4">
                ${partePrincipalTasks.map((t, idx) => `
                  <div class="flex flex-col gap-2">
                    <div class="flex items-center justify-between px-4 py-1.5 bg-[#1a1a1a]/40 border border-white/5 rounded-xl text-[10px] uppercase font-bold text-[#94A3B8] print-badge">
                      <span>Ejercicio Principal #${idx + 1}</span>
                      <span>⏱️ ${t.pivotDuration || 15} min</span>
                    </div>
                    ${renderTaskDetailRow(t)}
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- 3. Vuelta a la Calma Block -->
          ${vueltaCalmaTasks.length > 0 ? `
            <div class="flex flex-col gap-4">
              <div class="flex items-center gap-3 border-b border-white/8 pb-2">
                <span class="text-xl no-print">🧘</span>
                <h3 class="font-outfit font-extrabold text-sm uppercase text-white tracking-wider print-title">3. Vuelta a la Calma</h3>
                <span class="text-xs text-[#94A3B8] font-bold font-outfit uppercase ml-auto bg-white/3 px-2 py-0.5 rounded print-badge">
                  ${vueltaCalmaTasks.length} ${vueltaCalmaTasks.length === 1 ? 'Ejercicio' : 'Ejercicios'}
                </span>
              </div>

              <div class="flex flex-col gap-4">
                ${vueltaCalmaTasks.map((t, idx) => `
                  <div class="flex flex-col gap-2">
                    <div class="flex items-center justify-between px-4 py-1.5 bg-[#1a1a1a]/40 border border-white/5 rounded-xl text-[10px] uppercase font-bold text-[#94A3B8] print-badge">
                      <span>Vuelta a la Calma #${idx + 1}</span>
                      <span>⏱️ ${t.pivotDuration || 10} min</span>
                    </div>
                    ${renderTaskDetailRow(t)}
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          ${calentamientoTasks.length === 0 && partePrincipalTasks.length === 0 && vueltaCalmaTasks.length === 0 ? `
            <div class="p-8 text-center bg-[#1a1a1a]/40 border border-dashed border-white/10 rounded-2xl">
              <span class="text-4xl block mb-2">📋</span>
              <p class="text-sm font-semibold text-white">Esta sesión no tiene tareas asignadas todavía.</p>
              <button type="button" onclick="goToSessionSubView('edit', '${session.id}')" class="mt-2 text-xs font-bold text-club-red hover:underline">
                Editar y asignar tareas
              </button>
            </div>
          ` : ''}
        </div>
      </div>
    </div>
  `;
}

// Partial row renderer for each task inside session show (matches task_detail_row.blade.php)
function renderTaskDetailRow(task) {
  const materials = Array.isArray(task.material) ? task.material : (task.material ? task.material.split(',') : []);

  let diffColor = 'bg-emerald-500';
  if (task.dificultad === 'Media') diffColor = 'bg-amber-500';
  else if (task.dificultad === 'Alta') diffColor = 'bg-rose-500';

  return `
    <div class="bg-[#1a1a1a]/85 border border-white/8 rounded-2xl p-6 shadow-xl flex flex-col gap-6 print-card">
      <!-- Header: Task Name, Phase & Link -->
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 pb-4">
        <div>
          <h4 class="font-outfit font-extrabold text-lg text-white uppercase tracking-tight leading-snug print-title">
            <span class="hover:text-club-red transition-colors duration-200 cursor-pointer" onclick="viewTaskDetail(${task.id})">
              ${task.nombre}
            </span>
          </h4>
          <span class="text-xs text-[#94A3B8]">Ficha técnica de ejercicio</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs font-bold font-outfit uppercase tracking-widest text-club-red bg-club-red/10 border border-club-red/20 px-3 py-1 rounded-md print-badge">
            ${task.fase_juego || 'Ataque'}
          </span>
        </div>
      </div>

      <!-- Main Grid: Left Details & Right Board -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <!-- Left Column: All Tactical Details (7 cols) -->
        <div class="lg:col-span-7 flex flex-col gap-5">
          <!-- Metadata Attributes -->
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div class="bg-white/2 border border-white/5 rounded-xl p-3">
              <span class="text-[10px] text-[#94A3B8] uppercase font-bold block mb-1">Duración</span>
              <span class="font-outfit font-bold text-xs text-white">⏱️ ${task.pivotDuration || task.duracion || 15} min</span>
            </div>
            <div class="bg-white/2 border border-white/5 rounded-xl p-3">
              <span class="text-[10px] text-[#94A3B8] uppercase font-bold block mb-1">Dificultad</span>
              <div class="flex items-center gap-1.5 mt-0.5">
                <span class="w-2 h-2 rounded-full ${diffColor}"></span>
                <span class="font-outfit font-bold text-xs text-white uppercase">${task.dificultad || 'Media'}</span>
              </div>
            </div>
            <div class="bg-white/2 border border-white/5 rounded-xl p-3">
              <span class="text-[10px] text-[#94A3B8] uppercase font-bold block mb-1">Nº Jugadores</span>
              <span class="font-outfit font-bold text-xs text-white">👥 ${task.num_jugadores || '5v5 + 2P'}</span>
            </div>
            <div class="bg-white/2 border border-white/5 rounded-xl p-3 col-span-2 sm:col-span-3">
              <span class="text-[10px] text-[#94A3B8] uppercase font-bold block mb-1">Dimensiones</span>
              <span class="font-outfit font-bold text-xs text-white">📐 ${task.dimensiones || '40x20m / Cancha fútbol sala completa'}</span>
            </div>
          </div>

          <!-- Objetivo Principal -->
          ${task.objetivo ? `
            <div class="bg-white/2 border border-white/5 rounded-xl p-4">
              <span class="text-[10px] font-bold uppercase tracking-wider text-club-red block mb-1">🎯 Objetivo Principal</span>
              <p class="text-xs font-semibold text-slate-200 leading-relaxed print-text">
                ${task.objetivo}
              </p>
            </div>
          ` : ''}

          <!-- Descripción / Desarrollo y Reglas -->
          ${task.descripcion ? `
            <div class="bg-white/2 border border-white/5 rounded-xl p-4">
              <span class="text-[10px] font-bold uppercase tracking-wider text-club-red block mb-1">📝 Descripción / Detalles del Desarrollo</span>
              <p class="text-xs text-slate-300 leading-relaxed whitespace-pre-line print-text">
                ${task.descripcion}
              </p>
            </div>
          ` : ''}

          <!-- Material Necesario -->
          ${materials.length > 0 ? `
            <div class="bg-white/2 border border-white/5 rounded-xl p-4">
              <span class="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] block mb-2">📦 Material Necesario</span>
              <div class="flex flex-wrap gap-1.5">
                ${materials.map(m => `
                  <span class="text-xs font-semibold px-2.5 py-1 rounded-lg border border-white/10 bg-white/3 text-[#f8fafc] print-badge">
                    📦 ${m.trim()}
                  </span>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Principios Tácticos RFEF -->
          <div class="bg-white/2 border border-white/5 rounded-xl p-4">
            <span class="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] block mb-2">🧠 Principios Tácticos RFEF</span>
            <div class="flex flex-col gap-2.5">
              <div>
                <span class="text-[9px] font-bold uppercase tracking-wider text-emerald-400 block mb-1">⚽ Fase Ofensiva</span>
                <div class="flex flex-wrap gap-1">
                  <span class="text-[10px] font-semibold px-2.5 py-0.5 rounded-md border border-emerald-500/20 bg-emerald-500/5 text-emerald-300 print-badge">
                    Desmarques de apoyo y ruptura
                  </span>
                  <span class="text-[10px] font-semibold px-2.5 py-0.5 rounded-md border border-emerald-500/20 bg-emerald-500/5 text-emerald-300 print-badge">
                    Orientación corporal y amplitud
                  </span>
                </div>
              </div>
              <div>
                <span class="text-[9px] font-bold uppercase tracking-wider text-rose-400 block mb-1">🛡️ Fase Defensiva</span>
                <div class="flex flex-wrap gap-1">
                  <span class="text-[10px] font-semibold px-2.5 py-0.5 rounded-md border border-rose-500/20 bg-rose-500/5 text-rose-300 print-badge">
                    Presión sobre el poseedor
                  </span>
                  <span class="text-[10px] font-semibold px-2.5 py-0.5 rounded-md border border-rose-500/20 bg-rose-500/5 text-rose-300 print-badge">
                    Cobertura y permuta defensiva
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Column: Tactical Board Graphic (5 cols) -->
        <div class="lg:col-span-5 flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">Esquema Táctico 2D</span>
            <span class="text-[9px] text-slate-400">Pizarra Fútbol Sala</span>
          </div>
          <div class="w-full bg-[#12261e]/50 border border-white/5 rounded-xl overflow-hidden flex items-center justify-center p-2 print-court shadow-inner min-h-[220px]">
            ${task.grafico ? `
              <img src="${task.grafico}" alt="Pizarra táctica de ${task.nombre}" loading="lazy" class="w-full h-auto object-contain rounded-lg">
            ` : `
              <div class="flex flex-col items-center justify-center p-6 text-slate-500">
                <span class="text-3xl mb-1">📋</span>
                <span class="text-xs italic">Sin esquema gráfico guardado</span>
              </div>
            `}
          </div>
        </div>
      </div>
    </div>
  `;
}

// PDF Export Function using html2pdf.js
function exportSessionToPDF() {
  const element = document.getElementById('pdf-session-content');
  if (!element) return;
  if (typeof html2pdf === 'undefined') {
    window.print();
    return;
  }

  element.classList.add('generating-pdf');
  const opt = {
    margin: [10, 10, 10, 10],
    filename: `Sesion_Entrenamiento_${activeSessionId || 'LaNucia'}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['css', 'legacy'] }
  };

  html2pdf().set(opt).from(element).save().then(() => {
    element.classList.remove('generating-pdf');
    showNotification('PDF de la sesión generado con éxito');
  }).catch(err => {
    element.classList.remove('generating-pdf');
    console.error(err);
    window.print();
  });
}

async function deleteSession(id) {
  if (!confirm('¿Seguro que deseas eliminar esta sesión?')) return;
  const team = appState.activeTeam || 'filial';

  if (!appState.sessions) appState.sessions = { filial: [], juvenil: [] };
  if (appState.sessions[team]) {
    appState.sessions[team] = appState.sessions[team].filter(s => String(s.id) !== String(id));
  }

  saveStateToStorage();
  showNotification('Sesión eliminada');
  if (sessionSubView === 'show' || sessionSubView === 'edit') {
    goToSessionSubView('index');
  } else {
    renderView();
  }

  try {
    await fetch('/api/sessions', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, team })
    });
  } catch(err) {
    console.error('Server sync error for delete session:', err);
  }
}

// ====================================================
// VIEW 6: PARTIDOS
// ====================================================
function renderMatches() {
  const team = appState.activeTeam || 'filial';
  const teamName = team === 'filial' ? 'Filial Sporting La Nucía' : 'Juvenil La Nucía FS';
  const matches = appState.matches[team] || [];

  return `
    <div class="flex flex-col gap-6">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <div class="flex items-center gap-3">
            <h2 class="font-outfit font-extrabold text-xl sm:text-2xl text-white uppercase tracking-wider">
              Partidos Oficiales (${teamName})
            </h2>
            <span class="bg-club-red/20 text-club-red border border-club-red/30 font-outfit text-xs font-bold uppercase px-3 py-1 rounded-xl">
              ${matches.length} Partidos
            </span>
          </div>
          <p class="text-xs text-[#94A3B8] mt-0.5">Calendario de partidos, resultados y rivales.</p>
        </div>
        <button onclick="openNewMatchModal()" class="inline-flex items-center gap-2 font-outfit font-bold text-xs uppercase px-5 py-3 rounded-xl bg-club-red hover:bg-club-red-hover text-white transition-all shadow-lg shadow-club-red/20">
          ➕ Añadir Partido
        </button>
      </div>

      ${matches.length === 0 ? `
        <div class="flex flex-col items-center justify-center gap-3 p-12 bg-[#161616] border border-dashed border-white/10 rounded-2xl text-center max-w-lg mx-auto w-full">
          <span class="text-5xl">⚽</span>
          <h3 class="font-outfit font-bold text-white uppercase tracking-wider text-sm mt-2">No hay partidos en ${teamName}</h3>
          <p class="text-xs text-[#94A3B8]">Añade partidos al calendario oficial para controlar la cuenta atrás.</p>
          <button onclick="openNewMatchModal()" class="mt-2 px-4 py-2.5 rounded-lg bg-club-red text-white text-xs font-bold uppercase">
            Añadir primer partido
          </button>
        </div>
      ` : `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          ${matches.map(m => `
            <div class="bg-[#181818] border border-white/10 rounded-2xl p-5 flex flex-col justify-between shadow-xl hover:border-club-red/30 transition-all">
              <div class="flex flex-col gap-3">
                <div class="flex items-center justify-between">
                  <span class="text-[10px] font-bold uppercase tracking-widest text-club-red bg-club-red/10 border border-club-red/20 px-2.5 py-1 rounded-md">
                    ⚽ ${m.competicion || 'Liga'}
                  </span>
                  <span class="text-xs text-[#94A3B8] font-bold">📅 ${m.fecha} · ${m.hora || '18:00'}</span>
                </div>
                <div>
                  <p class="text-[10px] text-slate-500 uppercase font-bold">Rival:</p>
                  <h3 class="font-outfit font-black text-lg text-white leading-tight">${m.rival}</h3>
                </div>
                <div class="bg-black/30 p-2.5 rounded-xl flex items-center justify-between text-xs">
                  <span class="text-slate-400">📍 Lugar:</span>
                  <span class="text-white font-semibold truncate">${m.localizacion || 'Pabellón Camilo Cano'}</span>
                </div>
                ${m.resultado ? `
                  <div class="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-2 rounded-xl text-center font-outfit font-extrabold text-sm">
                    Resultado: ${m.resultado}
                  </div>
                ` : ''}
              </div>
              <div class="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                <div class="flex items-center gap-3">
                  <button onclick="editMatch('${m.id}')" class="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1">✏️ Editar</button>
                  <button onclick="deleteMatch('${m.id}')" class="text-rose-400 hover:text-rose-300 flex items-center gap-1">🗑️ Eliminar</button>
                </div>
                <span class="text-slate-400 font-bold uppercase text-[10px]">La Nucía FS</span>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    </div>
  `;
}

function openNewMatchModal() {
  openMatchModal(null);
}

function editMatch(id) {
  const team = appState.activeTeam || 'filial';
  const matches = appState.matches[team] || [];
  const match = matches.find(m => String(m.id) === String(id));
  if (match) {
    openMatchModal(match);
  }
}

function openMatchModal(matchToEdit = null) {
  const team = appState.activeTeam || 'filial';
  const today = new Date().toISOString().split('T')[0];
  const isEdit = !!matchToEdit;

  openModal(`
    <div class="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
      <h3 class="font-outfit font-extrabold text-lg text-white uppercase">${isEdit ? 'Editar Partido' : 'Añadir Partido'} (${team.toUpperCase()})</h3>
      <button onclick="closeModal()" class="text-slate-400 hover:text-white text-lg">✕</button>
    </div>
    <form onsubmit="handleSaveMatch(event)" class="flex flex-col gap-3 text-xs">
      <input type="hidden" id="m-id" value="${isEdit ? matchToEdit.id : ''}">
      <div>
        <label class="block text-slate-300 mb-1 font-bold uppercase text-[10px]">Equipo Rival</label>
        <input type="text" id="m-rival" required placeholder="Ej: CD Calpe Futsal" value="${isEdit ? (matchToEdit.rival || '') : ''}" class="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-xs">
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="block text-slate-300 mb-1 font-bold uppercase text-[10px]">Fecha del partido</label>
          <input type="date" id="m-fecha" value="${isEdit ? (matchToEdit.fecha || today) : today}" required class="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-xs">
        </div>
        <div>
          <label class="block text-slate-300 mb-1 font-bold uppercase text-[10px]">Hora</label>
          <input type="time" id="m-hora" value="${isEdit ? (matchToEdit.hora || '18:00') : '18:00'}" class="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-xs">
        </div>
      </div>
      <div>
        <label class="block text-slate-300 mb-1 font-bold uppercase text-[10px]">Competición / Categoría</label>
        <input type="text" id="m-competicion" value="${isEdit ? (matchToEdit.competicion || 'Liga Regular') : 'Liga Regular'}" class="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-xs">
      </div>
      <div>
        <label class="block text-slate-300 mb-1 font-bold uppercase text-[10px]">Pabellón / Localización</label>
        <input type="text" id="m-localizacion" value="${isEdit ? (matchToEdit.localizacion || 'Pabellón Camilo Cano (La Nucía)') : 'Pabellón Camilo Cano (La Nucía)'}" class="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-xs">
      </div>
      <div>
        <label class="block text-slate-300 mb-1 font-bold uppercase text-[10px]">Resultado (Opcional)</label>
        <input type="text" id="m-resultado" placeholder="Ej: 4 - 2" value="${isEdit ? (matchToEdit.resultado || '') : ''}" class="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-xs">
      </div>
      <div class="flex justify-end gap-2 mt-2">
        <button type="button" onclick="closeModal()" class="px-4 py-2 rounded-xl bg-white/5 text-slate-400 hover:text-white">Cancelar</button>
        <button type="submit" class="px-5 py-2 rounded-xl bg-club-red text-white font-bold uppercase text-xs">${isEdit ? 'Guardar Cambios' : 'Guardar Partido'}</button>
      </div>
    </form>
  `);
}

async function handleSaveMatch(e) {
  e.preventDefault();
  const team = appState.activeTeam || 'filial';
  const editId = document.getElementById('m-id') ? document.getElementById('m-id').value : '';

  const matchData = {
    id: editId || Date.now(),
    team,
    rival: document.getElementById('m-rival').value,
    fecha: document.getElementById('m-fecha').value,
    hora: document.getElementById('m-hora').value,
    competicion: document.getElementById('m-competicion').value,
    localizacion: document.getElementById('m-localizacion').value,
    resultado: document.getElementById('m-resultado') ? document.getElementById('m-resultado').value : ''
  };

  if (!appState.matches) appState.matches = { filial: [], juvenil: [] };
  if (!appState.matches[team]) appState.matches[team] = [];

  if (editId) {
    const idx = appState.matches[team].findIndex(m => String(m.id) === String(editId));
    if (idx !== -1) {
      appState.matches[team][idx] = { ...appState.matches[team][idx], ...matchData };
    } else {
      appState.matches[team].push(matchData);
    }
  } else {
    appState.matches[team].push(matchData);
  }

  saveStateToStorage();
  closeModal();
  showNotification(editId ? 'Partido actualizado' : 'Partido añadido al calendario');
  renderView();

  try {
    await fetch('/api/matches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(matchData)
    });
  } catch(err) {
    console.error('Server sync error for match save:', err);
  }
}

async function deleteMatch(id) {
  if (!confirm('¿Seguro que deseas eliminar este partido?')) return;
  const team = appState.activeTeam || 'filial';

  if (!appState.matches) appState.matches = { filial: [], juvenil: [] };
  if (appState.matches[team]) {
    appState.matches[team] = appState.matches[team].filter(m => String(m.id) !== String(id));
  }

  saveStateToStorage();
  showNotification('Partido eliminado');
  renderView();

  try {
    await fetch('/api/matches', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, team })
    });
  } catch(err) {
    console.error('Server sync error for delete match:', err);
  }
}

// ====================================================
// VIEW 7: VÍDEOS
// ====================================================
function renderVideos() {
  const team = appState.activeTeam || 'filial';
  const teamName = team === 'filial' ? 'Filial Sporting La Nucía' : 'Juvenil La Nucía FS';
  const videos = (appState.videos && appState.videos[team]) ? appState.videos[team] : [];

  return `
    <div class="flex flex-col gap-6">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <div class="flex items-center gap-3">
            <h2 class="font-outfit font-extrabold text-xl sm:text-2xl text-white uppercase tracking-wider">
              Vídeos y Análisis Táctico (${teamName})
            </h2>
            <span class="bg-club-red/20 text-club-red border border-club-red/30 font-outfit text-xs font-bold uppercase px-3 py-1 rounded-xl">
              ${videos.length} Vídeos
            </span>
          </div>
          <p class="text-xs text-[#94A3B8] mt-0.5">Repositorio de análisis táctico y scouting para el equipo.</p>
        </div>
        <button onclick="openNewVideoModal()" class="inline-flex items-center gap-2 font-outfit font-bold text-xs uppercase px-5 py-3 rounded-xl bg-club-red hover:bg-club-red-hover text-white transition-all shadow-lg shadow-club-red/20">
          ➕ Añadir Vídeo
        </button>
      </div>

      ${videos.length === 0 ? `
        <div class="flex flex-col items-center justify-center gap-3 p-12 bg-[#161616] border border-dashed border-white/10 rounded-2xl text-center max-w-lg mx-auto w-full">
          <span class="text-5xl">🎥</span>
          <h3 class="font-outfit font-bold text-white uppercase tracking-wider text-sm mt-2">Sin vídeos para ${teamName}</h3>
          <p class="text-xs text-[#94A3B8]">Añade enlaces de partidos y análisis de rivales.</p>
          <button onclick="openNewVideoModal()" class="mt-2 px-4 py-2.5 rounded-lg bg-club-red text-white text-xs font-bold uppercase">
            Añadir primer vídeo
          </button>
        </div>
      ` : `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          ${videos.map(v => `
            <div class="bg-[#181818] border border-white/10 rounded-2xl p-5 flex flex-col justify-between shadow-xl hover:border-white/20 transition-all">
              <div class="flex flex-col gap-3">
                <div class="flex items-center justify-between">
                  <span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-white/5 text-slate-400">${v.categoria || 'Táctico'}</span>
                  <span class="text-xs text-[#94A3B8]">📅 ${v.fecha || 'Reciente'}</span>
                </div>
                <h3 class="font-outfit font-bold text-base text-white">${v.titulo}</h3>
                <p class="text-xs text-[#94A3B8] line-clamp-2">${v.descripcion || 'Análisis táctico.'}</p>
                ${v.url ? `
                  <a href="${v.url}" target="_blank" class="inline-flex items-center gap-1.5 text-xs text-club-red hover:underline font-bold mt-1">
                    ▶️ Abrir Enlace de Vídeo
                  </a>
                ` : ''}
              </div>
              <div class="mt-4 pt-3 border-t border-white/5 flex items-center justify-end">
                <button onclick="deleteVideo('${v.id}')" class="text-xs text-rose-400 hover:text-rose-300">Eliminar</button>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    </div>
  `;
}

function openNewVideoModal() {
  const team = appState.activeTeam || 'filial';
  openModal(`
    <div class="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
      <h3 class="font-outfit font-extrabold text-lg text-white uppercase">Añadir Vídeo (${team.toUpperCase()})</h3>
      <button onclick="closeModal()" class="text-slate-400 hover:text-white text-lg">✕</button>
    </div>
    <form onsubmit="handleSaveVideo(event)" class="flex flex-col gap-3 text-xs">
      <div>
        <label class="block text-slate-300 mb-1 font-bold uppercase text-[10px]">Título del vídeo</label>
        <input type="text" id="v-titulo" required placeholder="Ej: Salida de presión rival vs Denia" class="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-xs">
      </div>
      <div>
        <label class="block text-slate-300 mb-1 font-bold uppercase text-[10px]">Categoría</label>
        <select id="v-categoria" class="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-xs">
          <option value="Scouting Rival">Scouting Rival</option>
          <option value="Análisis Propio">Análisis Propio</option>
          <option value="ABP Rival">ABP Rival</option>
          <option value="Vídeo Sesión">Vídeo Sesión</option>
        </select>
      </div>
      <div>
        <label class="block text-slate-300 mb-1 font-bold uppercase text-[10px]">Enlace / URL</label>
        <input type="url" id="v-url" placeholder="https://..." class="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-xs">
      </div>
      <div>
        <label class="block text-slate-300 mb-1 font-bold uppercase text-[10px]">Descripción</label>
        <textarea id="v-descripcion" rows="2" placeholder="Observaciones tácticas clave..." class="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-xs"></textarea>
      </div>
      <div class="flex justify-end gap-2 mt-2">
        <button type="button" onclick="closeModal()" class="px-4 py-2 rounded-xl bg-white/5 text-slate-400 hover:text-white">Cancelar</button>
        <button type="submit" class="px-5 py-2 rounded-xl bg-club-red text-white font-bold uppercase text-xs">Guardar Vídeo</button>
      </div>
    </form>
  `);
}

async function handleSaveVideo(e) {
  e.preventDefault();
  const team = appState.activeTeam || 'filial';
  const newVideo = {
    id: Date.now(),
    team,
    titulo: document.getElementById('v-titulo').value,
    categoria: document.getElementById('v-categoria').value,
    url: document.getElementById('v-url').value,
    descripcion: document.getElementById('v-descripcion').value
  };

  if (!appState.videos) appState.videos = { filial: [], juvenil: [] };
  if (!appState.videos[team]) appState.videos[team] = [];
  appState.videos[team].push(newVideo);

  saveStateToStorage();
  closeModal();
  showNotification('Vídeo guardado con éxito');
  renderView();

  try {
    await fetch('/api/videos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newVideo)
    });
  } catch(err) {
    console.error('Server sync error for video save:', err);
  }
}

async function deleteVideo(id) {
  if (!confirm('¿Seguro que deseas eliminar este vídeo?')) return;
  const team = appState.activeTeam || 'filial';

  if (!appState.videos) appState.videos = { filial: [], juvenil: [] };
  if (appState.videos[team]) {
    appState.videos[team] = appState.videos[team].filter(v => String(v.id) !== String(id));
  }

  saveStateToStorage();
  showNotification('Vídeo eliminado');
  renderView();

  try {
    await fetch('/api/videos', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, team })
    });
  } catch(err) {
    console.error('Server sync error for delete video:', err);
  }
}

function exportData() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appState, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", "la_nucia_futsal_entrenador_backup.json");
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
