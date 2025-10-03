import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// 🚀 CONFIGURA TU SUPABASE
const supabaseUrl = "https://iqgetmuguxjzwsvyawbx.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlxZ2V0bXVndXhqendzdnlhd2J4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0OTc5OTIsImV4cCI6MjA3NTA3Mzk5Mn0.4wO9wSGOsZu5e_1JR8CpZXN2qvx1v_1QaZMHoO293rM";
const supabase = createClient(supabaseUrl, supabaseKey);

const equiposDiv = document.getElementById("equipos");

// Cargar equipos al iniciar
async function cargarEquipos() {
  equiposDiv.innerHTML = "Cargando...";
  const { data, error } = await supabase
    .from("equipos")
    .select("*")
    .order("id", { ascending: true });

  if (error) {
    equiposDiv.innerHTML = "Error cargando equipos 😢";
    console.error(error);
    return;
  }

  equiposDiv.innerHTML = "";
  data.forEach((equipo) => {
    const div = document.createElement("div");
    div.className = "equipo";

    const input = document.createElement("input");
    input.type = "text";
    input.value = equipo.nombre;

    const btn = document.createElement("button");
    btn.textContent = "Actualizar";
    btn.onclick = () => actualizarEquipo(equipo.id, input.value);

    div.appendChild(input);
    div.appendChild(btn);
    equiposDiv.appendChild(div);
  });
}

// Agregar un nuevo equipo
async function agregarEquipo() {
  const nombre = document.getElementById("nuevoEquipo").value.trim();
  if (!nombre) return alert("Escribe un nombre de equipo");

  const { error } = await supabase.from("equipos").insert([{ nombre }]);
  if (error) {
    alert("Error agregando equipo");
    console.error(error);
    return;
  }
  document.getElementById("nuevoEquipo").value = "";
  cargarEquipos();
}

// Actualizar un equipo
async function actualizarEquipo(id, nuevoNombre) {
  const { error } = await supabase
    .from("equipos")
    .update({ nombre: nuevoNombre })
    .eq("id", id);

  if (error) {
    alert("Error actualizando equipo");
    console.error(error);
    return;
  }
  cargarEquipos();
}

// Inicializar
cargarEquipos();
