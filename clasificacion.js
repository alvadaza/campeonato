import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// 🚀 CONFIGURA TU SUPABASE
const supabaseUrl = "https://iqgetmuguxjzwsvyawbx.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlxZ2V0bXVndXhqendzdnlhd2J4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0OTc5OTIsImV4cCI6MjA3NTA3Mzk5Mn0.4wO9wSGOsZu5e_1JR8CpZXN2qvx1v_1QaZMHoO293rM";
const supabase = createClient(supabaseUrl, supabaseKey);

const tabla = document.getElementById("tablaClasificacion");

async function cargarClasificacion() {
  // Cargar equipos
  const { data: equipos, error: e1 } = await supabase
    .from("equipos")
    .select("*");
  if (e1) {
    console.error(e1);
    return;
  }

  // Cargar partidos
  const { data: partidos, error: e2 } = await supabase
    .from("partidos")
    .select("*");
  if (e2) {
    console.error(e2);
    return;
  }

  // Inicializar tabla
  const stats = {};
  equipos.forEach((eq) => {
    stats[eq.id] = {
      nombre: eq.nombre,
      PJ: 0,
      PG: 0,
      PE: 0,
      PP: 0,
      GF: 0,
      GC: 0,
      Pts: 0,
    };
  });

  // Procesar partidos
  partidos.forEach((p) => {
    const local = stats[p.equipo_local];
    const visitante = stats[p.equipo_visitante];
    if (!local || !visitante) return;

    local.PJ++;
    visitante.PJ++;
    local.GF += p.goles_local;
    local.GC += p.goles_visitante;
    visitante.GF += p.goles_visitante;
    visitante.GC += p.goles_local;

    if (p.goles_local > p.goles_visitante) {
      local.PG++;
      visitante.PP++;
      local.Pts += 3;
    } else if (p.goles_local < p.goles_visitante) {
      visitante.PG++;
      local.PP++;
      visitante.Pts += 3;
    } else {
      local.PE++;
      visitante.PE++;
      local.Pts++;
      visitante.Pts++;
    }
  });

  // Renderizar tabla ordenada por puntos
  tabla.innerHTML = "";
  Object.values(stats)
    .sort((a, b) => b.Pts - a.Pts || b.GF - b.GC - (a.GF - a.GC))
    .forEach((eq) => {
      tabla.innerHTML += `
        <tr>
          <td>${eq.nombre}</td>
          <td>${eq.PJ}</td>
          <td>${eq.PG}</td>
          <td>${eq.PE}</td>
          <td>${eq.PP}</td>
          <td>${eq.GF}</td>
          <td>${eq.GC}</td>
          <td><b>${eq.Pts}</b></td>
        </tr>
      `;
    });
}

cargarClasificacion();
