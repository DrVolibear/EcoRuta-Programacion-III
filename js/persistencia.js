// Persistencia local con serialización, recuperación defensiva y versión de esquema.
import { descargarJSON } from "./utilidades.js";
import { validarRespaldo } from "./validaciones.js";
import { ESTADO_CANCELADO } from "./reglas.js";

// No cambiar: es la clave bajo la que ya están guardados los datos existentes.
const CLAVE = "ecoruta_estado_v5";
export const VERSION = 5;
const CLAVES_ANTERIORES = [
  "ecoruta_estado_v4",
  "ecoruta_estado_v3",
  "ecoruta_estado_v2",
  "ecoruta_estado_v1",
];

/** Estado vacío con la versión de esquema vigente. */
export function estadoInicial() {
  return {
    version: VERSION,
    contadorGuia: 1,
    contadorRuta: 1,
    clientes: [],
    envios: [],
    enviosEliminados: [], // heredado: v2.2.1 ya no lo usa, la cancelación es lógica
    rutas: [],
    configuracion: {
      tema: "automatico",
      umbralOcupacion: 80,
      diasRetencion: 3,
      diasRetencionFrio: 1,
    },
  };
}

const unicas = (lista = []) => [...new Set(lista.filter(Boolean))];

/** Un envío eliminado por la versión anterior pasa a ser un envío Cancelado. */
function envioEliminadoACancelado(e) {
  const fecha = e.fechaEliminacion || e.fechaRegistro;
  const motivo = e.motivoEliminacion || "Sin motivo registrado";
  return {
    ...e,
    estadoAnterior: e.estado,
    estado: ESTADO_CANCELADO,
    fechaCancelacion: fecha,
    motivoCancelacion: motivo,
    rutaAsignada: null,
    historial: [
      ...(Array.isArray(e.historial) ? e.historial : []),
      {
        estadoAnterior: e.estado,
        estado: ESTADO_CANCELADO,
        fecha,
        detalle: `Cancelado: ${motivo}`,
      },
    ],
  };
}

/** Un cliente conserva siempre coherentes el texto de estado y el indicador activo. */
function normalizarCliente(c) {
  const estado =
    c.estado === "cancelado"
      ? "cancelado"
      : c.estado === "inactivo" || c.activo === false
        ? "inactivo"
        : "activo";
  return { ...c, estado, activo: estado === "activo" };
}

/** Completa y repara un estado leído (de localStorage o de un respaldo). */
export function normalizarEstado(d = {}) {
  const base = estadoInicial();
  const enviosActuales = Array.isArray(d.envios)
    ? d.envios.map((e) => ({
        ...e,
        envioOrigen: e.envioOrigen || null,
        rutaAsignada: e.rutaAsignada || null,
        historial: Array.isArray(e.historial) ? e.historial : [],
      }))
    : [];

  // Migración: lo "eliminado" por v2.2.0 se conserva como envío Cancelado
  const guiasActuales = new Set(enviosActuales.map((e) => e.codigoGuia));
  const migrados = (Array.isArray(d.enviosEliminados) ? d.enviosEliminados : [])
    .filter((e) => e?.codigoGuia && !guiasActuales.has(e.codigoGuia))
    .map(envioEliminadoACancelado);
  const envios = [...enviosActuales, ...migrados];

  const porGuia = new Map(envios.map((e) => [e.codigoGuia, e]));
  const rutas = Array.isArray(d.rutas)
    ? d.rutas.map((r) => ({
        ...r,
        envios: unicas(r.envios).filter((guia) => porGuia.has(guia)),
      }))
    : [];
  // Una ruta abierta solo puede contener envíos realmente asignados a ella
  rutas
    .filter((r) => r.estado === "abierta")
    .forEach((r) => {
      r.envios = r.envios.filter((guia) => {
        const e = porGuia.get(guia);
        return e?.estado === "asignado a ruta" && e.rutaAsignada === r.codigo;
      });
    });

  return {
    ...base,
    ...d,
    version: VERSION,
    clientes: Array.isArray(d.clientes) ? d.clientes.map(normalizarCliente) : [],
    envios,
    enviosEliminados: [],
    rutas,
    configuracion: { ...base.configuracion, ...d.configuracion },
  };
}

/** Lee el estado (o el de una versión anterior); si está corrupto, empieza vacío sin fallar. */
export function cargarEstado() {
  try {
    for (const clave of [CLAVE, ...CLAVES_ANTERIORES]) {
      const texto = localStorage.getItem(clave);
      if (texto) return normalizarEstado(JSON.parse(texto));
    }
    return estadoInicial();
  } catch (error) {
    // Datos corruptos: la aplicación sigue funcionando con un estado limpio
    console.warn("Estado corrupto; se recuperó el estado inicial", error);
    return estadoInicial();
  }
}

/** Guarda el estado normalizado; devuelve false si el navegador no lo permite. */
export function guardarEstado(estado) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(normalizarEstado(estado)));
    return true;
  } catch (error) {
    console.error("No se pudo guardar", error);
    return false;
  }
}

/** Reemplaza el contenido de `destino` conservando su identidad (referencia compartida). */
export function reemplazarEstado(destino, nuevo) {
  const normalizado = normalizarEstado(validarRespaldo(nuevo));
  Object.keys(destino).forEach((k) => delete destino[k]);
  Object.assign(destino, normalizado);
  if (!guardarEstado(destino)) throw Error("No hay espacio suficiente para guardar el respaldo");
}

/** Descarga un respaldo JSON con la fecha del día. */
export const exportarEstado = (estado) =>
  descargarJSON(
    `ecoruta-respaldo-${new Date().toISOString().slice(0, 10)}.json`,
    normalizarEstado(estado),
  );
