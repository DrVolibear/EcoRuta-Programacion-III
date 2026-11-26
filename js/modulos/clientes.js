// M2: gestión de clientes (alta, edición, inactivación, cancelación lógica e historial).
import { guardarEstado } from "../persistencia.js";
import { moneda, ESTADOS_ACTIVOS, ESTADO_CANCELADO } from "../reglas.js";
import { escapar, normalizarTexto, fechaLocal } from "../utilidades.js";
import { activarValidacion, formatearTelefono } from "../formularios.js";
import { abrirDialogo, solicitarCancelacion } from "../modales.js";
import { htmlEstado } from "../plantillas.js";

const CAMPOS = [
  "identificacion",
  "nombre",
  "telefono",
  "correo",
  "direccion",
  "codigoPostal",
  "provincia",
];
// Estos campos se recortan (sin espacios al inicio ni al final) al crear y al editar
const CAMPOS_RECORTADOS = ["identificacion", "nombre", "correo", "direccion"];

let estado, avisar, actualizar, confirmar;
let validacion;
const el = {};

const texto = (valor) => String(valor ?? "").trim();
// Para comparar duplicados: sin tildes, mayúsculas, espacios ni guiones
const idNormal = (v) => normalizarTexto(v).replace(/[^a-z0-9]/g, "");
const correoNormal = (v) => texto(v).toLowerCase();
const clientePorId = (id) => estado.clientes.find((c) => c.id === id);
const enviosDe = (c) =>
  estado.envios.filter((e) => e.clienteRemitente === c.id || e.clienteDestinatario === c.id);

/** Enlaza el formulario, la búsqueda y las acciones de la tabla de clientes. */
export function iniciarClientes(e, a, u, c) {
  estado = e;
  avisar = a;
  actualizar = u;
  confirmar = c;
  [
    "formCliente",
    "clienteId",
    "tituloCliente",
    "cancelarCliente",
    "buscarCliente",
    "listaClientes",
    "dialogoHistorialCliente",
    "tituloHistorialCliente",
    "contenidoHistorialCliente",
    "cerrarHistorialCliente",
    ...CAMPOS,
  ].forEach((id) => (el[id] = document.getElementById(id)));

  // Se recorta antes de que se valide: así "   " cuenta como vacío y " 8888-8888" como válido
  el.formCliente.addEventListener(
    "click",
    (ev) => {
      if (ev.target.closest("button:not([type]), button[type=submit]")) recortarCampos();
    },
    true,
  );
  configurarValidacion();

  el.telefono.addEventListener("input", () => {
    el.telefono.value = formatearTelefono(el.telefono.value);
  });
  CAMPOS_RECORTADOS.forEach((id) =>
    el[id].addEventListener("change", () => {
      el[id].value = texto(el[id].value);
    }),
  );

  el.formCliente.addEventListener("submit", guardar);
  el.buscarCliente.addEventListener("input", render);
  el.listaClientes.addEventListener("click", accion);
  el.cancelarCliente.addEventListener("click", limpiar);
  el.cerrarHistorialCliente.addEventListener("click", () => el.dialogoHistorialCliente.close());
  render();
}

/** Quita los espacios sobrantes antes de validar: «   » cuenta como vacío. */
function recortarCampos() {
  CAMPOS_RECORTADOS.forEach((id) => (el[id].value = texto(el[id].value)));
}

/** Mensajes en español por campo; los errores solo aparecen después de interactuar. */
function configurarValidacion() {
  const obligatorio = (mensaje) => (campo) => (!texto(campo.value) ? mensaje : "");
  const mensajes = {
    identificacion: (c) =>
      c.validity.valueMissing
        ? "La identificación es obligatoria."
        : "Use solo números y guiones, entre 7 y 20 caracteres.",
    nombre: () => "El nombre es obligatorio.",
    telefono: (c) =>
      c.validity.valueMissing ? "El teléfono es obligatorio." : "Use el formato 8888-8888.",
    correo: (c) =>
      c.validity.valueMissing
        ? "El correo es obligatorio."
        : "Ingrese un correo válido, por ejemplo nombre@dominio.com.",
    direccion: () => "La dirección es obligatoria.",
    codigoPostal: (c) =>
      c.validity.valueMissing
        ? "El código postal es obligatorio."
        : "El código postal debe tener exactamente 5 dígitos.",
    provincia: () => "Seleccione una provincia.",
  };
  validacion = activarValidacion(el.formCliente, mensajes, {
    extras: {
      identificacion: (c) =>
        obligatorio("La identificación es obligatoria.")(c) ||
        (c.value &&
        estado.clientes.some(
          (x) => idNormal(x.identificacion) === idNormal(c.value) && x.id !== el.clienteId.value,
        )
          ? "La identificación ya está registrada."
          : ""),
      nombre: obligatorio("El nombre es obligatorio."),
      direccion: obligatorio("La dirección es obligatoria."),
      correo: (c) =>
        obligatorio("El correo es obligatorio.")(c) ||
        (c.value &&
        estado.clientes.some(
          (x) => correoNormal(x.correo) === correoNormal(c.value) && x.id !== el.clienteId.value,
        )
          ? "El correo ya está registrado."
          : ""),
    },
    alInvalido: (_campo, mensaje) => avisar(mensaje, true),
  });
}

/** Vuelve el formulario al modo «Nuevo cliente». */
function limpiar() {
  el.formCliente.reset();
  el.clienteId.value = "";
  el.tituloCliente.textContent = "Nuevo cliente";
  el.cancelarCliente.hidden = true;
  validacion.reiniciar();
}

/** Crea o edita un cliente aplicando las mismas reglas (identificación y correo únicos). */
function guardar(ev) {
  ev.preventDefault();
  const id = el.clienteId.value;
  const datos = {
    identificacion: texto(el.identificacion.value),
    nombre: texto(el.nombre.value),
    telefono: texto(el.telefono.value),
    correo: correoNormal(el.correo.value),
    direccion: texto(el.direccion.value),
    codigoPostal: texto(el.codigoPostal.value),
    provincia: texto(el.provincia.value),
  };
  const existente = id ? clientePorId(id) : null;
  if (id && !existente) return avisar("El cliente ya no existe.", true);
  if (existente?.estado === ESTADO_CANCELADO)
    return avisar("Un cliente cancelado no se puede editar.", true);

  if (existente) {
    Object.assign(existente, datos);
  } else {
    estado.clientes.push({
      id: crypto.randomUUID(),
      ...datos,
      activo: true,
      estado: "activo",
      fechaRegistro: new Date().toISOString(),
    });
  }
  guardarEstado(estado);
  limpiar();
  render();
  actualizar();
  avisar(existente ? "Cliente actualizado." : "Cliente guardado.");
}

/** Pasa los datos del cliente al formulario para editarlo. */
function cargarEnFormulario(c) {
  el.clienteId.value = c.id;
  CAMPOS.forEach((campo) => (el[campo].value = c[campo] ?? ""));
  el.tituloCliente.textContent = "Editar cliente";
  el.cancelarCliente.hidden = false;
  validacion.reiniciar();
  el.identificacion.focus();
}

/** Abre el historial de envíos del cliente con el total facturado (sin cancelados). */
function mostrarHistorial(c, origen) {
  const envios = enviosDe(c);
  const vigentes = envios.filter((e) => e.estado !== ESTADO_CANCELADO);
  const total = vigentes.reduce((suma, e) => suma + (e.tarifa?.total || 0), 0);
  const filas = envios
    .slice()
    .sort((a, b) => new Date(b.fechaRegistro) - new Date(a.fechaRegistro))
    .map(
      (e) =>
        `<tr><td>${escapar(e.codigoGuia)}</td><td>${e.clienteRemitente === c.id ? "Remitente" : "Destinatario"}</td><td>${fechaLocal(e.fechaRegistro)}</td><td class="numero">${moneda(e.tarifa?.total || 0)}</td><td>${htmlEstado(e.estado)}</td></tr>`,
    )
    .join("");
  el.tituloHistorialCliente.textContent = `Historial de envíos de ${c.nombre}`;
  el.contenidoHistorialCliente.innerHTML = envios.length
    ? `<p><strong>${envios.length}</strong> ${envios.length === 1 ? "envío" : "envíos"} · Total facturado (sin cancelados): <strong>${moneda(total)}</strong></p><div class="tabla-scroll"><table><caption class="sr-only">Envíos de ${escapar(c.nombre)}</caption><thead><tr><th scope="col">Guía</th><th scope="col">Rol</th><th scope="col">Fecha</th><th scope="col" class="numero">Total</th><th scope="col">Estado</th></tr></thead><tbody>${filas}</tbody></table></div>`
    : '<p class="vacio">Este cliente todavía no tiene envíos.</p>';
  abrirDialogo(el.dialogoHistorialCliente, { origen, enfocar: el.cerrarHistorialCliente });
}

/** Baja lógica del cliente con motivo; se bloquea si tiene envíos activos (RN-12). */
async function cancelarCliente(c) {
  const relacionados = enviosDe(c);
  const activos = relacionados.filter((e) => ESTADOS_ACTIVOS.includes(e.estado));
  if (activos.length)
    return avisar(
      `No se puede cancelar: tiene ${activos.length} ${activos.length === 1 ? "envío activo" : "envíos activos"} (${activos.map((e) => e.codigoGuia).join(", ")}). Marque al cliente como inactivo.`,
      true,
    );
  const dato = (etiqueta, valor) => `<div class="dato"><dt>${etiqueta}</dt><dd>${valor}</dd></div>`;
  const motivo = await solicitarCancelacion({
    titulo: "Cancelar cliente",
    resumenHTML: `<dl class="datos">${dato("Cliente", `<strong>${escapar(c.nombre)}</strong>`)}${dato("Identificación", escapar(c.identificacion))}${dato("Estado actual", c.estado === "inactivo" ? "Inactivo" : "Activo")}${dato("Envíos asociados", String(relacionados.length))}</dl>`,
    impacto: [
      "El cliente quedará Cancelado y no se podrá usar en solicitudes nuevas.",
      "Sus datos y su historial de envíos se conservan para auditoría.",
      relacionados.length
        ? "Los envíos ya finalizados no se modifican."
        : "No tiene envíos asociados.",
    ],
    etiquetaConfirmar: "Confirmar cancelación",
  });
  if (motivo === null) return;
  c.estadoAnterior = c.estado;
  c.activo = false;
  c.estado = ESTADO_CANCELADO;
  c.fechaCancelacion = new Date().toISOString();
  c.motivoCancelacion = motivo;
  guardarEstado(estado);
  render();
  actualizar();
  avisar("Cliente cancelado. Sus datos se conservan para auditoría.");
}

/** Delegación de eventos de los botones de cada fila de clientes. */
function accion(ev) {
  const boton = ev.target.closest("button[data-accion]");
  const c = boton && clientePorId(boton.dataset.id);
  if (!c) return;
  switch (boton.dataset.accion) {
    case "editar":
      return cargarEnFormulario(c);
    case "historial":
      return mostrarHistorial(c, boton);
    case "estado":
      c.activo = !c.activo;
      c.estado = c.activo ? "activo" : "inactivo";
      guardarEstado(estado);
      render();
      actualizar();
      return avisar(c.activo ? "Cliente activado." : "Cliente inactivado.");
    case "cancelar":
      return cancelarCliente(c);
  }
}

const ETIQUETAS = { activo: "Activo", inactivo: "Inactivo", cancelado: "Cancelado" };

/** Una fila de la tabla de clientes. */
function htmlFila(c) {
  const cancelado = c.estado === ESTADO_CANCELADO;
  const nombre = escapar(c.nombre || "Cliente sin nombre");
  const id = escapar(c.id);
  return `<tr class="${c.estado === "activo" ? "" : `cliente-${c.estado}`}"><td><strong>${nombre}</strong><small>${escapar(c.identificacion)}</small></td><td>${escapar(c.telefono)}<small>${escapar(c.correo)}</small></td><td>${escapar(c.provincia)} · CP ${escapar(c.codigoPostal || "")}<small>${escapar(c.direccion || "")}</small></td><td><span class="estado estado-cliente-${c.estado}">${ETIQUETAS[c.estado] ?? c.estado}</span></td><td><div class="acciones"><button type="button" data-accion="historial" data-id="${id}" aria-label="Ver historial de envíos de ${nombre}">Historial</button><button type="button" data-accion="editar" data-id="${id}" aria-label="Editar ${nombre}" ${cancelado ? "disabled" : ""}>Editar</button><button type="button" class="secundario" data-accion="estado" data-id="${id}" aria-label="${c.activo ? "Inactivar" : "Activar"} ${nombre}" ${cancelado ? "disabled" : ""}>${c.activo ? "Inactivar" : "Activar"}</button><button type="button" class="peligro" data-accion="cancelar" data-id="${id}" aria-label="Cancelar ${nombre}" ${cancelado ? "disabled" : ""}>Cancelar</button></div></td></tr>`;
}

/** Filtra por texto (nombre, identificación o correo) y pinta la tabla. */
export function render() {
  const q = normalizarTexto(el.buscarCliente.value);
  const lista = estado.clientes.filter((c) =>
    normalizarTexto([c.nombre, c.identificacion, c.correo].join(" ")).includes(q),
  );
  el.listaClientes.innerHTML = lista.length
    ? lista.map(htmlFila).join("")
    : `<tr><td colspan="5" class="vacio">${q ? "No se encontraron clientes que coincidan con la búsqueda." : "No hay clientes registrados."}</td></tr>`;
}
