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
const contenedorDiasMovil = document.querySelector("#dias-movil");
const contenedorResultados = document.querySelector("#resultados");
const contenedorDisponibilidad = document.querySelector("#disponibilidad");
const resumenResultados = document.querySelector("#resumen-resultados");
const estadoConexion = document.querySelector("#estado-conexion");
const mensaje = document.querySelector("#mensaje");
const formularioParticipante = document.querySelector("#form-participante");
const inputParticipante = document.querySelector("#nuevo-participante");
const listaParticipantes = document.querySelector("#lista-participantes");
const formularioHora = document.querySelector("#form-hora");
const inputHora = document.querySelector("#nueva-hora");
const listaHoras = document.querySelector("#lista-horas");
const mensajeAdministracion = document.querySelector("#mensaje-administracion");
const consultaMovil = window.matchMedia("(max-width: 719px)");

let participantes = [...PARTICIPANTES];
let horarios = HORAS.map((etiqueta, orden) => ({
  id: idDeHora(etiqueta),
  etiqueta,
  orden,
}));
let configuracionRemota = { participantes: {}, horas: {} };
let personaSeleccionada = "";
let diaMovilSeleccionado = "";
let disponibilidades = {};
let baseDeDatos = null;
let apiBaseDeDatos = null;
let cancelarDisponibilidades = null;
let cancelarConfiguracion = null;
let cancelarConexion = null;
let firebaseDisponible = false;

inicializar();

async function inicializar() {
  cargarDiasMovil();
  recuperarPersonaGuardada();
  configurarEventos();
  renderizarTodo();

  if (!configuracionFirebaseCompleta()) {
    mostrarConfiguracionPendiente();
    return;
  }

  await conectarFirebase();
}

function cargarDiasMovil() {
  const idDiaActual = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"][
    new Date().getDay()
  ];
  diaMovilSeleccionado = DIAS.some(({ id }) => id === idDiaActual) ? idDiaActual : DIAS[0]?.id || "";

  DIAS.forEach((dia) => {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "dia-movil";
    boton.dataset.dia = dia.id;
    boton.textContent = dia.nombre.slice(0, 3);
    boton.setAttribute("aria-label", `Mostrar ${dia.nombre}`);
    boton.addEventListener("click", () => seleccionarDiaMovil(dia.id));
    contenedorDiasMovil.appendChild(boton);
  });

  actualizarBotonesDias();
}

function recuperarPersonaGuardada() {
  const personaGuardada = localStorage.getItem(CLAVE_PERSONA);
  if (participantes.some(({ id }) => id === personaGuardada)) {
    personaSeleccionada = personaGuardada;
  }
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

  consultaMovil.addEventListener("change", renderizarTodo);
  formularioParticipante.addEventListener("submit", agregarParticipante);
  formularioHora.addEventListener("submit", agregarHora);
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
    await prepararConfiguracionCompartida();
    await migrarDisponibilidadActual();
    escucharConfiguracion();
    escucharDisponibilidad();
  } catch (error) {
    console.error("No se pudo iniciar Firebase:", error);
    firebaseDisponible = false;
    actualizarEstado("Sin conexión", "error");
    resumenResultados.textContent = "No se pudieron cargar los datos compartidos.";
    mostrarMensaje("Revisá la configuración, las reglas de Firebase y la conexión a internet.");
    renderizarTodo();
  }
}

function escucharEstadoConexion() {
  if (cancelarConexion) cancelarConexion();
  const referencia = apiBaseDeDatos.ref(baseDeDatos, ".info/connected");
  cancelarConexion = apiBaseDeDatos.onValue(referencia, (snapshot) => {
    actualizarEstado(snapshot.val() ? "En vivo" : "Sin conexión", snapshot.val() ? "conectado" : "error");
  });
}

async function prepararConfiguracionCompartida() {
  const referencia = apiBaseDeDatos.ref(baseDeDatos, rutaConfiguracion());
  let snapshot = await apiBaseDeDatos.get(referencia);

  const configuracionExistente = snapshot.val() || {};
  const actualizaciones = {};

  PARTICIPANTES.forEach((participante, orden) => {
    if (!configuracionExistente.participantes?.[participante.id]) {
      actualizaciones[`${rutaConfiguracion()}/participantes/${participante.id}`] = {
        nombre: participante.nombre,
        activo: true,
        orden,
      };
    }
  });

  HORAS.forEach((hora, orden) => {
    if (!configuracionExistente.horas?.[idDeHora(hora)]) {
      actualizaciones[`${rutaConfiguracion()}/horas/${idDeHora(hora)}`] = {
        etiqueta: hora,
        activo: true,
        orden,
      };
    }
  });

  if (Object.keys(actualizaciones).length) {
    await apiBaseDeDatos.update(apiBaseDeDatos.ref(baseDeDatos), actualizaciones);
    snapshot = await apiBaseDeDatos.get(referencia);
  }

  aplicarConfiguracion(snapshot.val() || {});
}

async function migrarDisponibilidadActual() {
  const referenciaNueva = apiBaseDeDatos.ref(baseDeDatos, rutaDisponibilidad());
  const datosNuevos = await apiBaseDeDatos.get(referenciaNueva);
  if (datosNuevos.exists()) return;

  const referenciaAnterior = apiBaseDeDatos.ref(baseDeDatos, rutaSemanaAnterior());
  const datosAnteriores = await apiBaseDeDatos.get(referenciaAnterior);
  if (!datosAnteriores.exists()) return;

  const actualizaciones = {};
  Object.entries(datosAnteriores.val() || {}).forEach(([idPersona, seleccion]) => {
    Object.entries(seleccion || {}).forEach(([idHorario, disponible]) => {
      if (disponible === true) {
        actualizaciones[`${rutaDisponibilidad()}/${idPersona}/${idHorario}`] = true;
      }
    });
  });

  if (Object.keys(actualizaciones).length) {
    await apiBaseDeDatos.update(apiBaseDeDatos.ref(baseDeDatos), actualizaciones);
  }
}

function escucharConfiguracion() {
  if (cancelarConfiguracion) cancelarConfiguracion();
  const referencia = apiBaseDeDatos.ref(baseDeDatos, rutaConfiguracion());
  cancelarConfiguracion = apiBaseDeDatos.onValue(
    referencia,
    (snapshot) => aplicarConfiguracion(snapshot.val() || {}),
    (error) => {
      console.error("No se pudo leer la configuración:", error);
      mostrarMensajeAdministracion("No se pudo actualizar la configuración compartida.");
    }
  );
}

function escucharDisponibilidad() {
  if (cancelarDisponibilidades) cancelarDisponibilidades();
  const referencia = apiBaseDeDatos.ref(baseDeDatos, rutaDisponibilidad());
  cancelarDisponibilidades = apiBaseDeDatos.onValue(
    referencia,
    (snapshot) => {
      disponibilidades = snapshot.val() || {};
      renderizarResultados();
      renderizarDisponibilidad();
    },
    (error) => {
      console.error("No se pudo leer la disponibilidad:", error);
      actualizarEstado("Error de lectura", "error");
      resumenResultados.textContent = "No se pudo leer la disponibilidad.";
    }
  );
}

function aplicarConfiguracion(valor) {
  configuracionRemota = {
    participantes: valor.participantes || {},
    horas: valor.horas || {},
  };

  participantes = Object.entries(configuracionRemota.participantes)
    .filter(([, participante]) => participante?.activo === true)
    .map(([id, participante]) => ({ id, ...participante }))
    .sort(compararPorOrdenYNombre);

  horarios = Object.entries(configuracionRemota.horas)
    .filter(([, hora]) => hora?.activo === true)
    .map(([id, hora]) => ({ id, ...hora }))
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.etiqueta.localeCompare(b.etiqueta));

  if (personaSeleccionada && !participantes.some(({ id }) => id === personaSeleccionada)) {
    personaSeleccionada = "";
    localStorage.removeItem(CLAVE_PERSONA);
    mostrarMensaje("Tu participante ya no está activo. Elegí otro nombre.");
  }

  renderizarTodo();
}

function renderizarTodo() {
  renderizarSelectorPersonas();
  renderizarResultados();
  renderizarDisponibilidad();
  renderizarAdministracion();
}

function renderizarSelectorPersonas() {
  const valorAnterior = personaSeleccionada;
  selectorPersona.replaceChildren();

  const opcionInicial = document.createElement("option");
  opcionInicial.value = "";
  opcionInicial.textContent = participantes.length ? "Seleccioná tu nombre" : "No hay participantes activos";
  selectorPersona.appendChild(opcionInicial);

  participantes.forEach((participante) => {
    const opcion = document.createElement("option");
    opcion.value = participante.id;
    opcion.textContent = participante.nombre;
    selectorPersona.appendChild(opcion);
  });

  selectorPersona.value = participantes.some(({ id }) => id === valorAnterior) ? valorAnterior : "";
}

function renderizarResultados() {
  const conteos = obtenerConteos();
  const maximo = Math.max(0, ...Object.values(conteos).map(({ personas }) => personas.length));
  const dias = obtenerDiasVisibles();
  const tabla = crearTablaBase("Resultados de coincidencias por día y hora", dias);

  horarios.forEach((hora) => {
    const fila = document.createElement("tr");
    fila.appendChild(crearEncabezadoHora(hora.etiqueta));

    dias.forEach((dia) => {
      const idHorario = `${dia.id}-${hora.id}`;
      const personasDisponibles = conteos[idHorario]?.personas || [];
      const celda = document.createElement("td");
      const resultado = document.createElement("div");
      resultado.className = `resultado-celda${maximo > 0 && personasDisponibles.length === maximo ? " mejor" : ""}`;
      resultado.title = personasDisponibles.length
        ? personasDisponibles.join(", ")
        : "Nadie marcó este horario";

      const cantidad = document.createElement("span");
      cantidad.className = "cantidad";
      cantidad.textContent = personasDisponibles.length;

      const nombres = document.createElement("span");
      nombres.className = "nombres";
      nombres.textContent = personasDisponibles.length ? personasDisponibles.join(", ") : "Sin votos";

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

  horarios.forEach((hora) => {
    const fila = document.createElement("tr");
    fila.appendChild(crearEncabezadoHora(hora.etiqueta));

    dias.forEach((dia) => {
      const idHorario = `${dia.id}-${hora.id}`;
      const seleccionado = seleccionPersona[idHorario] === true;
      const celda = document.createElement("td");
      const boton = document.createElement("button");

      boton.type = "button";
      boton.className = `celda-disponibilidad${seleccionado ? " seleccionada" : ""}`;
      boton.textContent = seleccionado ? "✓ Puedo" : "—";
      boton.disabled = !sePuedeEditar;
      boton.setAttribute("aria-pressed", String(seleccionado));
      boton.setAttribute(
        "aria-label",
        `${dia.nombre} ${hora.etiqueta}: ${seleccionado ? "disponible" : "no disponible"}`
      );
      boton.addEventListener("click", () => alternarHorario(idHorario, seleccionado));

      celda.appendChild(boton);
      fila.appendChild(celda);
    });

    tabla.tBodies[0].appendChild(fila);
  });

  contenedorDisponibilidad.replaceChildren(tabla);
}

function renderizarAdministracion() {
  listaParticipantes.replaceChildren();
  listaHoras.replaceChildren();

  participantes.forEach((participante) => {
    listaParticipantes.appendChild(
      crearItemAdministracion(participante.nombre, () => desactivarParticipante(participante.id))
    );
  });

  horarios.forEach((hora) => {
    listaHoras.appendChild(crearItemAdministracion(hora.etiqueta, () => desactivarHora(hora.id)));
  });
}

function crearItemAdministracion(etiqueta, alQuitar) {
  const item = document.createElement("li");
  item.className = "item-administracion";

  const texto = document.createElement("span");
  texto.textContent = etiqueta;

  const boton = document.createElement("button");
  boton.type = "button";
  boton.className = "boton quitar";
  boton.textContent = "Quitar";
  boton.addEventListener("click", alQuitar);

  item.append(texto, boton);
  return item;
}

async function alternarHorario(idHorario, estabaSeleccionado) {
  if (!personaSeleccionada) {
    mostrarMensaje("Elegí tu nombre antes de marcar horarios.");
    selectorPersona.focus();
    return;
  }

  const referencia = apiBaseDeDatos.ref(
    baseDeDatos,
    `${rutaDisponibilidad()}/${personaSeleccionada}/${idHorario}`
  );

  disponibilidades[personaSeleccionada] ||= {};
  if (estabaSeleccionado) {
    delete disponibilidades[personaSeleccionada][idHorario];
  } else {
    disponibilidades[personaSeleccionada][idHorario] = true;
  }
  renderizarResultados();
  renderizarDisponibilidad();
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
    renderizarResultados();
    renderizarDisponibilidad();
    mostrarMensaje("No se pudo guardar. Probá nuevamente.");
  }
}

async function agregarParticipante(evento) {
  evento.preventDefault();
  if (!firebaseDisponible) return mostrarMensajeAdministracion("Firebase todavía no está conectado.");

  const nombre = inputParticipante.value.trim().replace(/\s+/g, " ");
  if (nombre.length < 2) return mostrarMensajeAdministracion("Ingresá un nombre válido.");

  const existente = Object.entries(configuracionRemota.participantes).find(
    ([, participante]) => normalizarTexto(participante.nombre) === normalizarTexto(nombre)
  );

  if (existente?.[1]?.activo === true) {
    return mostrarMensajeAdministracion("Ese participante ya está activo.");
  }

  const id = existente?.[0] || crearIdParticipante(nombre);
  const orden = existente?.[1]?.orden ?? siguienteOrden(configuracionRemota.participantes);

  try {
    await apiBaseDeDatos.set(apiBaseDeDatos.ref(baseDeDatos, `${rutaConfiguracion()}/participantes/${id}`), {
      nombre,
      activo: true,
      orden,
    });
    inputParticipante.value = "";
    mostrarMensajeAdministracion("Participante agregado. Sus votos anteriores se conservaron.", "ok");
  } catch (error) {
    console.error("No se pudo agregar el participante:", error);
    mostrarMensajeAdministracion("No se pudo agregar el participante. Revisá las reglas de Firebase.");
  }
}

async function agregarHora(evento) {
  evento.preventDefault();
  if (!firebaseDisponible) return mostrarMensajeAdministracion("Firebase todavía no está conectado.");

  const etiqueta = inputHora.value;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(etiqueta)) {
    return mostrarMensajeAdministracion("Elegí una hora válida.");
  }

  const id = idDeHora(etiqueta);
  if (configuracionRemota.horas[id]?.activo === true) {
    return mostrarMensajeAdministracion("Ese horario ya está activo.");
  }

  try {
    await apiBaseDeDatos.set(apiBaseDeDatos.ref(baseDeDatos, `${rutaConfiguracion()}/horas/${id}`), {
      etiqueta,
      activo: true,
      orden: minutosDeHora(etiqueta),
    });
    inputHora.value = "";
    mostrarMensajeAdministracion("Horario agregado. Sus votos anteriores se conservaron.", "ok");
  } catch (error) {
    console.error("No se pudo agregar el horario:", error);
    mostrarMensajeAdministracion("No se pudo agregar el horario. Revisá las reglas de Firebase.");
  }
}

async function desactivarParticipante(id) {
  try {
    await apiBaseDeDatos.set(
      apiBaseDeDatos.ref(baseDeDatos, `${rutaConfiguracion()}/participantes/${id}/activo`),
      false
    );
    mostrarMensajeAdministracion("Participante oculto; sus votos siguen guardados.", "ok");
  } catch (error) {
    console.error("No se pudo quitar el participante:", error);
    mostrarMensajeAdministracion("No se pudo quitar el participante.");
  }
}

async function desactivarHora(id) {
  try {
    await apiBaseDeDatos.set(
      apiBaseDeDatos.ref(baseDeDatos, `${rutaConfiguracion()}/horas/${id}/activo`),
      false
    );
    mostrarMensajeAdministracion("Horario oculto; sus votos siguen guardados.", "ok");
  } catch (error) {
    console.error("No se pudo quitar el horario:", error);
    mostrarMensajeAdministracion("No se pudo quitar el horario.");
  }
}

function seleccionarDiaMovil(idDia) {
  diaMovilSeleccionado = idDia;
  actualizarBotonesDias();
  renderizarResultados();
  renderizarDisponibilidad();
}

function actualizarBotonesDias() {
  contenedorDiasMovil.querySelectorAll(".dia-movil").forEach((boton) => {
    const estaActivo = boton.dataset.dia === diaMovilSeleccionado;
    boton.classList.toggle("activo", estaActivo);
    boton.setAttribute("aria-pressed", String(estaActivo));
  });
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

function crearEncabezadoHora(hora) {
  const encabezado = document.createElement("th");
  encabezado.scope = "row";
  encabezado.className = "encabezado-hora";
  encabezado.textContent = hora;
  return encabezado;
}

function obtenerConteos() {
  const conteos = {};
  const idsHorariosActivos = new Set(
    DIAS.flatMap((dia) => horarios.map((hora) => `${dia.id}-${hora.id}`))
  );
  participantes.forEach((participante) => {
    const seleccion = disponibilidades[participante.id] || {};
    Object.entries(seleccion).forEach(([idHorario, disponible]) => {
      if (!disponible || !idsHorariosActivos.has(idHorario)) return;
      conteos[idHorario] ||= { personas: [] };
      conteos[idHorario].personas.push(participante.nombre);
    });
  });
  return conteos;
}

function actualizarResumenResultados(conteos, maximo) {
  const participantesConHorarios = participantes.filter((participante) =>
    Object.values(disponibilidades[participante.id] || {}).some(Boolean)
  ).length;

  if (maximo === 0) {
    resumenResultados.textContent = `${participantesConHorarios} de ${participantes.length} marcaron al menos un horario.`;
    return;
  }

  const idsHorariosActivos = new Set(
    DIAS.flatMap((dia) => horarios.map((hora) => `${dia.id}-${hora.id}`))
  );
  const mejores = Object.entries(conteos)
    .filter(([id, valor]) => idsHorariosActivos.has(id) && valor.personas.length === maximo)
    .map(([id]) => nombreDelHorario(id));
  const detalle = mejores.slice(0, 2).join(" y ");
  const extras = mejores.length > 2 ? ` y ${mejores.length - 2} más` : "";

  resumenResultados.textContent = `${participantesConHorarios} de ${participantes.length} marcaron horarios. Mejor coincidencia: ${detalle}${extras} (${maximo}).`;
}

function nombreDelHorario(idHorario) {
  const dia = DIAS.find(({ id }) => idHorario.startsWith(`${id}-`));
  const idHora = idHorario.slice((dia?.id.length || 0) + 1);
  const hora = horarios.find(({ id }) => id === idHora);
  return `${dia?.nombre || "Horario"} ${hora?.etiqueta || ""}`.trim();
}

function obtenerDiasVisibles() {
  if (!consultaMovil.matches) return DIAS;
  return DIAS.filter(({ id }) => id === diaMovilSeleccionado);
}

function compararPorOrdenYNombre(a, b) {
  return (a.orden ?? 0) - (b.orden ?? 0) || a.nombre.localeCompare(b.nombre, "es");
}

function crearIdParticipante(nombre) {
  const base = normalizarTexto(nombre)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "participante";
  return `${base}-${Date.now().toString(36).slice(-5)}`;
}

function normalizarTexto(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function idDeHora(hora) {
  return String(hora).replace(":", "-");
}

function minutosDeHora(hora) {
  const [horas, minutos] = hora.split(":").map(Number);
  return horas * 60 + minutos;
}

function siguienteOrden(elementos) {
  return Math.max(-1, ...Object.values(elementos || {}).map((elemento) => Number(elemento?.orden) || 0)) + 1;
}

function rutaGrupo() {
  return `grupos/${ID_GRUPO}`;
}

function rutaConfiguracion() {
  return `${rutaGrupo()}/configuracion`;
}

function rutaDisponibilidad() {
  return `${rutaGrupo()}/disponibilidades`;
}

function rutaSemanaAnterior() {
  return `${rutaGrupo()}/semanas/${claveLunesActual()}/disponibilidades`;
}

function claveLunesActual() {
  const fecha = new Date();
  const lunes = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 12);
  const dia = lunes.getDay();
  lunes.setDate(lunes.getDate() + (dia === 0 ? -6 : 1 - dia));
  const anio = lunes.getFullYear();
  const mes = String(lunes.getMonth() + 1).padStart(2, "0");
  const numeroDia = String(lunes.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${numeroDia}`;
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

function mostrarMensajeAdministracion(texto, tipo = "error") {
  mensajeAdministracion.textContent = texto;
  mensajeAdministracion.className = `mensaje${tipo === "ok" ? " ok" : ""}`;
}
