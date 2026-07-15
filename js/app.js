import {
  DIAS,
  FIREBASE_CONFIG,
  HORAS,
  ID_GRUPO,
  PARTICIPANTES,
} from "./config.js";

const VERSION_FIREBASE = "12.15.0";
const CLAVE_PERSONA = "antelVoleyPersona";

const selectorPersona = document.querySelector("#persona");
const selectorDia = document.querySelector("#dia-visible");
const contenedorResultados = document.querySelector("#resultados");
const contenedorDisponibilidad = document.querySelector("#disponibilidad");
const resumenResultados = document.querySelector("#resumen-resultados");
const rangoSemana = document.querySelector("#rango-semana");
const estadoConexion = document.querySelector("#estado-conexion");
const mensaje = document.querySelector("#mensaje");
const consultaMovil = window.matchMedia("(max-width: 719px)");

let semana = obtenerLunes(new Date());
let personaSeleccionada = "";
let disponibilidades = {};
let baseDeDatos = null;
let apiBaseDeDatos = null;
let cancelarDisponibilidades = null;
let cancelarConexion = null;
let firebaseDisponible = false;

inicializar();

async function inicializar() {
  cargarParticipantes();
  configurarEventos();
  actualizarSemanaEnPantalla();
  renderizarTodo();

  if (!configuracionFirebaseCompleta()) {
    mostrarConfiguracionPendiente();
    return;
  }

  await conectarFirebase();
}

function cargarParticipantes() {
  PARTICIPANTES.forEach((participante) => {
    const opcion = document.createElement("option");
    opcion.value = participante.id;
    opcion.textContent = participante.nombre;
    selectorPersona.appendChild(opcion);
  });

  const personaGuardada = localStorage.getItem(CLAVE_PERSONA);
  if (PARTICIPANTES.some(({ id }) => id === personaGuardada)) {
    personaSeleccionada = personaGuardada;
    selectorPersona.value = personaGuardada;
  }

  const idDiaActual = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"][
    new Date().getDay()
  ];
  DIAS.forEach((dia) => {
    const opcion = document.createElement("option");
    opcion.value = dia.id;
    opcion.textContent = dia.nombre;
    selectorDia.appendChild(opcion);
  });
  selectorDia.value = DIAS.some(({ id }) => id === idDiaActual) ? idDiaActual : DIAS[0]?.id || "";
}

function configurarEventos() {
  selectorPersona.addEventListener("change", () => {
    personaSeleccionada = selectorPersona.value;

    if (personaSeleccionada) {
      localStorage.setItem(CLAVE_PERSONA, personaSeleccionada);
      mostrarMensaje("Ya podés marcar tus horarios.", "ok");
    } else {
      localStorage.removeItem(CLAVE_PERSONA);
      mostrarMensaje("Elegí tu nombre para marcar horarios.");
    }

    renderizarDisponibilidad();
  });

  selectorDia.addEventListener("change", renderizarTodo);
  consultaMovil.addEventListener("change", renderizarTodo);

  document.querySelector("#semana-anterior").addEventListener("click", () => cambiarSemana(-7));
  document.querySelector("#semana-siguiente").addEventListener("click", () => cambiarSemana(7));
  document.querySelector("#semana-actual").addEventListener("click", () => {
    semana = obtenerLunes(new Date());
    cambiarSemana(0);
  });
}

async function conectarFirebase() {
  try {
    const [{ initializeApp }, databaseApi] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${VERSION_FIREBASE}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${VERSION_FIREBASE}/firebase-database.js`),
    ]);

    const app = initializeApp(FIREBASE_CONFIG);
    baseDeDatos = databaseApi.getDatabase(app);
    apiBaseDeDatos = databaseApi;
    firebaseDisponible = true;

    escucharEstadoConexion();
    escucharSemana();
  } catch (error) {
    console.error("No se pudo iniciar Firebase:", error);
    actualizarEstado("Sin conexión", "error");
    resumenResultados.textContent = "No se pudieron cargar los datos compartidos.";
    mostrarMensaje("Revisá la configuración de Firebase y la conexión a internet.");
    renderizarDisponibilidad();
  }
}

function escucharEstadoConexion() {
  if (cancelarConexion) cancelarConexion();

  const referenciaConexion = apiBaseDeDatos.ref(baseDeDatos, ".info/connected");
  cancelarConexion = apiBaseDeDatos.onValue(referenciaConexion, (snapshot) => {
    actualizarEstado(snapshot.val() ? "En vivo" : "Sin conexión", snapshot.val() ? "conectado" : "error");
  });
}

function escucharSemana() {
  if (!firebaseDisponible) return;
  if (cancelarDisponibilidades) cancelarDisponibilidades();

  disponibilidades = {};
  renderizarTodo();
  resumenResultados.textContent = "Cargando disponibilidades…";

  const referencia = apiBaseDeDatos.ref(baseDeDatos, rutaSemana());
  cancelarDisponibilidades = apiBaseDeDatos.onValue(
    referencia,
    (snapshot) => {
      disponibilidades = snapshot.val() || {};
      renderizarTodo();
    },
    (error) => {
      console.error("No se pudo leer la disponibilidad:", error);
      actualizarEstado("Error de lectura", "error");
      resumenResultados.textContent = "No se pudo leer esta semana.";
    }
  );
}

function cambiarSemana(cantidadDias) {
  semana = sumarDias(semana, cantidadDias);
  disponibilidades = {};
  actualizarSemanaEnPantalla();
  renderizarTodo();
  escucharSemana();
}

function renderizarTodo() {
  renderizarResultados();
  renderizarDisponibilidad();
}

function renderizarResultados() {
  const conteos = obtenerConteos();
  const maximo = Math.max(0, ...Object.values(conteos).map(({ personas }) => personas.length));
  const dias = obtenerDiasVisibles();
  const tabla = crearTablaBase("Resultados de coincidencias por día y hora", dias);

  HORAS.forEach((hora) => {
    const fila = document.createElement("tr");
    fila.appendChild(crearEncabezadoHora(hora));

    dias.forEach((dia) => {
      const idHorario = crearIdHorario(dia.id, hora);
      const personas = conteos[idHorario]?.personas || [];
      const celda = document.createElement("td");
      const resultado = document.createElement("div");
      resultado.className = `resultado-celda${maximo > 0 && personas.length === maximo ? " mejor" : ""}`;
      resultado.title = personas.length ? personas.join(", ") : "Nadie marcó este horario";

      const cantidad = document.createElement("span");
      cantidad.className = "cantidad";
      cantidad.textContent = personas.length;

      const nombres = document.createElement("span");
      nombres.className = "nombres";
      nombres.textContent = personas.length ? personas.join(", ") : "Sin votos";

      resultado.append(cantidad, nombres);
      celda.appendChild(resultado);
      fila.appendChild(celda);
    });

    tabla.tBodies[0].appendChild(fila);
  });

  contenedorResultados.replaceChildren(tabla);
  actualizarResumenResultados(conteos, maximo);
}

function renderizarDisponibilidad() {
  const dias = obtenerDiasVisibles();
  const tabla = crearTablaBase("Grilla para marcar tu disponibilidad", dias);
  const seleccionPersona = disponibilidades[personaSeleccionada] || {};
  const sePuedeEditar = Boolean(personaSeleccionada && firebaseDisponible);

  HORAS.forEach((hora) => {
    const fila = document.createElement("tr");
    fila.appendChild(crearEncabezadoHora(hora));

    dias.forEach((dia) => {
      const idHorario = crearIdHorario(dia.id, hora);
      const seleccionado = seleccionPersona[idHorario] === true;
      const celda = document.createElement("td");
      const boton = document.createElement("button");

      boton.type = "button";
      boton.className = `celda-disponibilidad${seleccionado ? " seleccionada" : ""}`;
      boton.textContent = seleccionado ? "✓ Puedo" : "—";
      boton.disabled = !sePuedeEditar;
      boton.setAttribute("aria-pressed", String(seleccionado));
      boton.setAttribute("aria-label", `${dia.nombre} ${hora}: ${seleccionado ? "disponible" : "no disponible"}`);
      boton.addEventListener("click", () => alternarHorario(idHorario, seleccionado));

      celda.appendChild(boton);
      fila.appendChild(celda);
    });

    tabla.tBodies[0].appendChild(fila);
  });

  contenedorDisponibilidad.replaceChildren(tabla);
}

async function alternarHorario(idHorario, estabaSeleccionado) {
  if (!personaSeleccionada) {
    mostrarMensaje("Elegí tu nombre antes de marcar horarios.");
    selectorPersona.focus();
    return;
  }

  if (!firebaseDisponible) {
    mostrarMensaje("La sincronización todavía no está configurada.");
    return;
  }

  const referencia = apiBaseDeDatos.ref(
    baseDeDatos,
    `${rutaSemana()}/${personaSeleccionada}/${idHorario}`
  );

  disponibilidades[personaSeleccionada] ||= {};
  if (estabaSeleccionado) {
    delete disponibilidades[personaSeleccionada][idHorario];
  } else {
    disponibilidades[personaSeleccionada][idHorario] = true;
  }
  renderizarTodo();
  mostrarMensaje("Guardando…", "ok");

  try {
    await apiBaseDeDatos.set(referencia, estabaSeleccionado ? null : true);
    mostrarMensaje("Disponibilidad actualizada para todo el grupo.", "ok");
  } catch (error) {
    console.error("No se pudo guardar el horario:", error);
    if (estabaSeleccionado) {
      disponibilidades[personaSeleccionada][idHorario] = true;
    } else {
      delete disponibilidades[personaSeleccionada][idHorario];
    }
    renderizarTodo();
    mostrarMensaje("No se pudo guardar. Probá nuevamente.");
  }
}

function crearTablaBase(descripcion, dias) {
  const tabla = document.createElement("table");
  tabla.className = "grilla";

  const leyenda = document.createElement("caption");
  leyenda.textContent = descripcion;
  leyenda.hidden = true;
  tabla.appendChild(leyenda);

  const cabecera = document.createElement("thead");
  const filaCabecera = document.createElement("tr");
  const esquina = document.createElement("th");
  esquina.scope = "col";
  esquina.textContent = "Hora";
  filaCabecera.appendChild(esquina);

  dias.forEach((dia) => {
    const celda = document.createElement("th");
    celda.scope = "col";
    celda.textContent = dia.nombre;
    filaCabecera.appendChild(celda);
  });

  cabecera.appendChild(filaCabecera);
  tabla.append(cabecera, document.createElement("tbody"));
  return tabla;
}

function obtenerDiasVisibles() {
  if (!consultaMovil.matches) return DIAS;
  return DIAS.filter(({ id }) => id === selectorDia.value);
}

function crearEncabezadoHora(hora) {
  const encabezado = document.createElement("th");
  encabezado.scope = "row";
  encabezado.className = "encabezado-hora";
  encabezado.textContent = hora;
  return encabezado;
}

function obtenerConteos() {
  const conteos = {};

  PARTICIPANTES.forEach((participante) => {
    const seleccion = disponibilidades[participante.id] || {};
    Object.entries(seleccion).forEach(([idHorario, estaDisponible]) => {
      if (!estaDisponible) return;
      conteos[idHorario] ||= { personas: [] };
      conteos[idHorario].personas.push(participante.nombre);
    });
  });

  return conteos;
}

function actualizarResumenResultados(conteos, maximo) {
  const participantesQueRespondieron = PARTICIPANTES.filter((participante) =>
    Object.values(disponibilidades[participante.id] || {}).some(Boolean)
  ).length;

  if (maximo === 0) {
    resumenResultados.textContent = `${participantesQueRespondieron} de ${PARTICIPANTES.length} marcaron al menos un horario.`;
    return;
  }

  const mejores = Object.entries(conteos)
    .filter(([, valor]) => valor.personas.length === maximo)
    .map(([id]) => nombreDelHorario(id));
  const detalleMejores = mejores.slice(0, 2).join(" y ");
  const extras = mejores.length > 2 ? ` y ${mejores.length - 2} más` : "";

  resumenResultados.textContent = `${participantesQueRespondieron} de ${PARTICIPANTES.length} marcaron horarios. Mejor coincidencia: ${detalleMejores}${extras} (${maximo}).`;
}

function nombreDelHorario(idHorario) {
  const dia = DIAS.find(({ id }) => idHorario.startsWith(`${id}-`));
  const hora = idHorario.slice((dia?.id.length || 0) + 1).replace("-", ":");
  return `${dia?.nombre || "Horario"} ${hora}`;
}

function crearIdHorario(idDia, hora) {
  return `${idDia}-${hora.replace(":", "-")}`;
}

function rutaSemana() {
  return `grupos/${ID_GRUPO}/semanas/${claveFecha(semana)}/disponibilidades`;
}

function actualizarSemanaEnPantalla() {
  const domingo = sumarDias(semana, 6);
  const formato = new Intl.DateTimeFormat("es-UY", { day: "numeric", month: "long" });
  rangoSemana.textContent = `${formato.format(semana)} al ${formato.format(domingo)}`;
}

function obtenerLunes(fecha) {
  const resultado = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 12);
  const dia = resultado.getDay();
  resultado.setDate(resultado.getDate() + (dia === 0 ? -6 : 1 - dia));
  return resultado;
}

function sumarDias(fecha, cantidad) {
  const resultado = new Date(fecha);
  resultado.setDate(resultado.getDate() + cantidad);
  return resultado;
}

function claveFecha(fecha) {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

function configuracionFirebaseCompleta() {
  return ["apiKey", "authDomain", "databaseURL", "projectId", "appId"].every(
    (clave) => typeof FIREBASE_CONFIG[clave] === "string" && FIREBASE_CONFIG[clave].trim()
  );
}

function mostrarConfiguracionPendiente() {
  actualizarEstado("Falta configurar", "error");
  resumenResultados.textContent = "La grilla está lista, pero Firebase todavía no está conectado.";
  mostrarMensaje("Completá FIREBASE_CONFIG en js/config.js para habilitar los cambios compartidos.");
}

function actualizarEstado(texto, tipo = "") {
  estadoConexion.textContent = texto;
  estadoConexion.className = `estado${tipo ? ` ${tipo}` : ""}`;
}

function mostrarMensaje(texto, tipo = "error") {
  mensaje.textContent = texto;
  mensaje.className = `mensaje${tipo === "ok" ? " ok" : ""}`;
}
