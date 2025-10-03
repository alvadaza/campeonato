// ---------------------------
// main.js - Lógica compartida
// ---------------------------

// === REEMPLAZA ESTO CON TUS CREDENCIALES ===
const SUPABASE_URL = "https://iqgetmuguxjzwsvyawbx.supabase.co"; // <- REEMPLAZA
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlxZ2V0bXVndXhqendzdnlhd2J4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0OTc5OTIsImV4cCI6MjA3NTA3Mzk5Mn0.4wO9wSGOsZu5e_1JR8CpZXN2qvx1v_1QaZMHoO293rM"; // <- REEMPLAZA
// ============================================

if (
  SUPABASE_URL.includes("TU-PROYECTO") ||
  SUPABASE_ANON_KEY.includes("PUBLIC_ANON_KEY")
) {
  console.warn(
    "Recuerda reemplazar SUPABASE_URL y SUPABASE_ANON_KEY en main.js antes de usar."
  );
}

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// UTILITARIOS ----------------------------------------------------------------

function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function q(sel) {
  return document.querySelector(sel);
}
function qAll(sel) {
  return Array.from(document.querySelectorAll(sel));
}

// ---------- DB helpers ----------

async function fetchTeams() {
  const { data, error } = await supabase
    .from("equipos")
    .select("*")
    .order("id");
  if (error) {
    console.error("fetchTeams:", error);
    return [];
  }
  return data || [];
}

async function fetchMatches() {
  const { data, error } = await supabase
    .from("partidos")
    .select(
      "*, local:equipo_local(id,nombre), visitante:equipo_visitante(id,nombre)"
    )
    .order("id");
  if (error) {
    console.error("fetchMatches:", error);
    return [];
  }
  return data || [];
}

// ---------- Round-robin generator ----------
// Returns list of pairs of team ids
function roundRobin(teamIds) {
  const teams = teamIds.slice();
  if (teams.length % 2 === 1) teams.push(null);
  const rounds = teams.length - 1;
  const half = teams.length / 2;
  const schedule = [];
  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < half; i++) {
      const a = teams[i],
        b = teams[teams.length - 1 - i];
      if (a !== null && b !== null) schedule.push([a, b]);
    }
    teams.splice(1, 0, teams.pop());
  }
  return schedule;
}

// ---------- Scheduling dates ----------
// weekdays: array of integers 0 (Sun) .. 6 (Sat). matchesPerDay: int. startDateStr: 'YYYY-MM-DD'. startTimeStr 'HH:MM'.
// intervalMinutes: minutes between match start times (default 30).
// Returns array of {date:'YYYY-MM-DD', time:'HH:MM'} length >= count
function generateScheduleDates(
  count,
  weekdays,
  startDateStr,
  startTimeStr,
  matchesPerDay,
  intervalMinutes = 30
) {
  const dates = [];
  // parse start date
  let cur = new Date(startDateStr + "T00:00:00");
  // ensure cur is at or after startDateStr (set hours to startTime)
  const [startH, startM] = startTimeStr.split(":").map(Number);

  // loop until we have enough slots
  let dayIndex = 0;
  let i = 0;
  while (dates.length < count && i < 5000) {
    // iterate days
    const day = new Date(cur);
    // if day is one of chosen weekdays
    if (weekdays.includes(day.getDay())) {
      // generate matchesPerDay slots
      for (let slot = 0; slot < matchesPerDay && dates.length < count; slot++) {
        const slotTime = new Date(day);
        slotTime.setHours(startH);
        slotTime.setMinutes(startM + slot * intervalMinutes);
        const dateStr = slotTime.toISOString().slice(0, 10);
        const timeStr = slotTime.toTimeString().slice(0, 5);
        dates.push({ date: dateStr, time: timeStr });
      }
    }
    cur.setDate(cur.getDate() + 1);
    i++;
  }
  return dates;
}

// ---------- Create calendar (in DB) ----------
// options: { matchesPerDay, weekdays (array), startDate, startTime, intervalMinutes }
async function createCalendarFromTeams(options) {
  const teams = await fetchTeams();
  if (teams.length < 2) throw new Error("Se necesitan al menos 2 equipos");
  if (teams.length > 16) throw new Error("Máximo 16 equipos permitido");
  const ids = teams.map((t) => t.id);
  const pairs = roundRobin(ids);
  const total = pairs.length;
  const dates = generateScheduleDates(
    total,
    options.weekdays,
    options.startDate,
    options.startTime,
    options.matchesPerDay,
    options.intervalMinutes
  );
  if (dates.length < total)
    throw new Error(
      "No hay suficientes slots de fecha/hora para el número de partidos. Aumenta días/slots o cambia la fecha de inicio."
    );

  // prepare inserts: set jornada as round index (optional). We'll compute jornada = Math.floor(i / matchesPerDay)+1 for grouping
  const inserts = pairs.map((p, i) => {
    const slot = dates[i];
    return {
      jornada: Math.floor(i / options.matchesPerDay) + 1,
      fecha: slot.date,
      hora: slot.time,
      equipo_local: p[0],
      equipo_visitante: p[1],
      goles_local: null,
      goles_visitante: null,
      jugado: false,
      fase: "grupos",
    };
  });

  // insert in batches
  const { error } = await supabase.from("partidos").insert(inserts);
  if (error) throw error;
  return inserts.length;
}

// ---------- Save result ----------

async function saveResult(matchId, golesLocal, golesVisitante) {
  const payload = {
    goles_local:
      golesLocal === "" || golesLocal === null ? null : Number(golesLocal),
    goles_visitante:
      golesVisitante === "" || golesVisitante === null
        ? null
        : Number(golesVisitante),
    jugado:
      golesLocal !== null &&
      golesLocal !== "" &&
      golesVisitante !== null &&
      golesVisitante !== "",
  };
  const { error } = await supabase
    .from("partidos")
    .update(payload)
    .eq("id", matchId);
  if (error) throw error;
  return true;
}

// ---------- Compute classification ----------
// returns array ordered: [{id, nombre, PJ, PG, PE, PP, GF, GC, DG, Pts}]
async function computeClassification() {
  const teams = await fetchTeams();
  const matches = await fetchMatches();

  const map = {};
  teams.forEach((t) => {
    map[t.id] = {
      id: t.id,
      nombre: t.nombre,
      PJ: 0,
      PG: 0,
      PE: 0,
      PP: 0,
      GF: 0,
      GC: 0,
      DG: 0,
      Pts: 0,
    };
  });

  matches.forEach((m) => {
    if (!m.local || !m.visitante) return;
    if (m.goles_local === null || m.goles_visitante === null) return;
    const a = m.local.id,
      b = m.visitante.id;
    map[a].PJ++;
    map[b].PJ++;
    map[a].GF += Number(m.goles_local);
    map[a].GC += Number(m.goles_visitante);
    map[b].GF += Number(m.goles_visitante);
    map[b].GC += Number(m.goles_local);
    if (Number(m.goles_local) > Number(m.goles_visitante)) {
      map[a].PG++;
      map[a].Pts += 3;
      map[b].PP++;
    } else if (Number(m.goles_local) < Number(m.goles_visitante)) {
      map[b].PG++;
      map[b].Pts += 3;
      map[a].PP++;
    } else {
      map[a].PE++;
      map[b].PE++;
      map[a].Pts++;
      map[b].Pts++;
    }
  });

  const arr = Object.values(map);
  arr.forEach((r) => (r.DG = r.GF - r.GC));
  arr.sort((x, y) => {
    if (y.Pts !== x.Pts) return y.Pts - x.Pts;
    if (y.DG !== x.DG) return y.DG - x.DG;
    if (y.GF !== x.GF) return y.GF - x.GF;
    return x.nombre.localeCompare(y.nombre);
  });
  return arr;
}

// ---------- Generate eliminatoria ----------
// picks bracket size (4/8/16) and inserts matches: 1 vs N, 2 vs N-1, ...
async function generateEliminatoriaFromStandings() {
  const standings = await computeClassification();
  const n = standings.length;
  if (n < 2) throw new Error("No hay suficientes equipos");
  let bracket;
  if (n <= 4) bracket = 4;
  else if (n <= 8) bracket = 8;
  else bracket = 16;
  if (standings.length < bracket)
    throw new Error("No hay suficientes equipos para bracket " + bracket);

  const topNames = standings.slice(0, bracket).map((s) => s.nombre);
  // fetch teams to map name->id
  const teams = await fetchTeams();
  const nameToId = {};
  teams.forEach((t) => (nameToId[t.nombre] = t.id));

  const pairs = [];
  for (let i = 0; i < bracket / 2; i++) {
    pairs.push([nameToId[topNames[i]], nameToId[topNames[bracket - 1 - i]]]);
  }

  // find last group date to start knockout after that
  const matches = await fetchMatches();
  const groupDates = matches
    .filter((m) => m.fase === "grupos" && m.fecha)
    .map((m) => m.fecha)
    .sort();
  let startDate = groupDates.length
    ? new Date(groupDates[groupDates.length - 1])
    : new Date();
  startDate.setDate(startDate.getDate() + 2);

  const inserts = pairs.map((pair, idx) => {
    const fecha = new Date(startDate);
    fecha.setDate(startDate.getDate() + idx * 2);
    return {
      jornada: null,
      fecha: fecha.toISOString().slice(0, 10),
      hora: "20:30",
      equipo_local: pair[0],
      equipo_visitante: pair[1],
      goles_local: null,
      goles_visitante: null,
      jugado: false,
      fase: bracket === 4 ? "semifinal" : bracket === 8 ? "cuartos" : "octavos",
    };
  });

  const { error } = await supabase.from("partidos").insert(inserts);
  if (error) throw error;
  return inserts.length;
}

// Expose API to window.App for pages
window.App = {
  supabase,
  fetchTeams,
  fetchMatches,
  createCalendarFromTeams,
  saveResult,
  computeClassification,
  generateEliminatoriaFromStandings,
  generateScheduleDates, // exported if a page wants to preview
};
