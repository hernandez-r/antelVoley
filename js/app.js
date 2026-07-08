const horarios = [
  { id: "lunes-1900", dia: "Lunes", hora: "19:00" },
  { id: "lunes-2000", dia: "Lunes", hora: "20:00" },
  { id: "miercoles-1900", dia: "Miércoles", hora: "19:00" },
  { id: "miercoles-2000", dia: "Miércoles", hora: "20:00" },
  { id: "viernes-1900", dia: "Viernes", hora: "19:00" },
  { id: "viernes-2000", dia: "Viernes", hora: "20:00" },
];

const CLAVE_NOMBRE = "antelVoleyNombre";
const CLAVE_DISPONIBILIDAD = "antelVoleyDisponibilidad";

const inputNombre = document.querySelector("#nombre");
const listaHorarios = document.querySelector("#lista-horarios");
const listaSeleccionados = document.querySelector("#seleccionados");
const contador = document.querySelector("#contador");
const mensaje = document.querySelector("#mensaje");
const botonCopiar = document.querySelector("#copiar-resumen");

let nombre = localStorage.getItem(CLAVE_NOMBRE) || "";
let disponibilidad = obtenerDisponibilidadGuardada();

inputNombre.value = nombre;

renderizarHorarios();
renderizarResumen();

inputNombre.addEventListener("input", () => {
  nombre = inputNombre.value.trim();
  localStorage.setItem(CLAVE_NOMBRE, nombre);

  if (nombre) {
    mostrarMensaje("Nombre guardado.", "ok");
  }
});

botonCopiar.addEventListener("click", copiarResumen);

function obtenerDisponibilidadGuardada() {
  const datosGuardados = localStorage.getItem(CLAVE_DISPONIBILIDAD);

  if (!datosGuardados) {
    return [];
  }

  try {
    const datos = JSON.parse(datosGuardados);
    return Array.isArray(datos) ? datos : [];
  } catch (error) {
    // Si el dato guardado se rompe, arrancamos limpio sin bloquear la app.
    return [];
  }
}

function guardarDisponibilidad() {
  localStorage.setItem(CLAVE_DISPONIBILIDAD, JSON.stringify(disponibilidad));
}

function renderizarHorarios() {
  listaHorarios.innerHTML = "";

  horarios.forEach((horario) => {
    const estaSeleccionado = disponibilidad.includes(horario.id);
    const tarjeta = document.createElement("article");
    tarjeta.className = `tarjeta-horario${estaSeleccionado ? " seleccionado" : ""}`;

    tarjeta.innerHTML = `
      <div>
        <span class="dia">${horario.dia}</span>
        <span class="hora">${horario.hora}</span>
      </div>
      <button class="boton ${estaSeleccionado ? "desmarcar" : ""}" type="button">
        ${estaSeleccionado ? "Quitar" : "Estoy disponible"}
      </button>
    `;

    const boton = tarjeta.querySelector("button");
    boton.addEventListener("click", () => alternarDisponibilidad(horario.id));

    listaHorarios.appendChild(tarjeta);
  });
}

function renderizarResumen() {
  listaSeleccionados.innerHTML = "";

  const horariosSeleccionados = horarios.filter((horario) =>
    disponibilidad.includes(horario.id)
  );

  if (horariosSeleccionados.length === 0) {
    contador.textContent = "Todavía no marcaste horarios.";
    listaSeleccionados.innerHTML =
      '<li class="vacio">Cuando marques disponibilidad, va a aparecer acá.</li>';
    return;
  }

  contador.textContent = `${horariosSeleccionados.length} horario${
    horariosSeleccionados.length === 1 ? "" : "s"
  } marcado${horariosSeleccionados.length === 1 ? "" : "s"}.`;

  horariosSeleccionados.forEach((horario) => {
    const item = document.createElement("li");
    item.className = "item-seleccionado";
    item.innerHTML = `
      <div>
        <strong>${horario.dia}</strong>
        <span>${horario.hora}</span>
      </div>
      <button class="boton secundario" type="button">Quitar</button>
    `;

    const boton = item.querySelector("button");
    boton.addEventListener("click", () => alternarDisponibilidad(horario.id));

    listaSeleccionados.appendChild(item);
  });
}

function alternarDisponibilidad(idHorario) {
  if (!nombre) {
    mostrarMensaje("Escribí tu nombre antes de marcar disponibilidad.");
    inputNombre.focus();
    return;
  }

  if (disponibilidad.includes(idHorario)) {
    disponibilidad = disponibilidad.filter((id) => id !== idHorario);
    mostrarMensaje("Disponibilidad quitada.", "ok");
  } else {
    disponibilidad.push(idHorario);
    mostrarMensaje("Disponibilidad guardada.", "ok");
  }

  guardarDisponibilidad();
  renderizarHorarios();
  renderizarResumen();
}

async function copiarResumen() {
  if (!nombre) {
    mostrarMensaje("Escribí tu nombre antes de copiar el resumen.");
    inputNombre.focus();
    return;
  }

  const horariosSeleccionados = horarios.filter((horario) =>
    disponibilidad.includes(horario.id)
  );

  if (horariosSeleccionados.length === 0) {
    mostrarMensaje("Marcá al menos un horario para copiar el resumen.");
    return;
  }

  const textoHorarios = horariosSeleccionados
    .map((horario) => `- ${horario.dia} ${horario.hora}`)
    .join("\n");

  const resumen = `Antel Voley\n${nombre} está disponible:\n${textoHorarios}`;

  try {
    await copiarAlPortapapeles(resumen);
    mostrarMensaje("Resumen copiado al portapapeles.", "ok");
  } catch (error) {
    mostrarMensaje("No se pudo copiar. Seleccioná y copiá manualmente el resumen.");
  }
}

async function copiarAlPortapapeles(texto) {
  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(texto);
      return;
    } catch (error) {
      // Si el navegador bloquea Clipboard API en file://, probamos el fallback.
    }
  }

  // Fallback para navegadores que limitan Clipboard API al abrir index.html directo.
  const areaTemporal = document.createElement("textarea");
  areaTemporal.value = texto;
  areaTemporal.setAttribute("readonly", "");
  areaTemporal.style.position = "fixed";
  areaTemporal.style.left = "-9999px";
  document.body.appendChild(areaTemporal);
  areaTemporal.select();

  const copiado = document.execCommand("copy");
  document.body.removeChild(areaTemporal);

  if (!copiado) {
    throw new Error("No se pudo copiar el resumen.");
  }
}

function mostrarMensaje(texto, tipo = "error") {
  mensaje.textContent = texto;
  mensaje.className = `mensaje ${tipo === "ok" ? "ok" : ""}`;
}
