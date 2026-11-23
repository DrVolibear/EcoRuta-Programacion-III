import { descargarJSON } from "./utilidades.js";
import { validarRespaldo } from "./validaciones.js";
const CLAVE = "ecoruta_estado_v4";
export const VERSION = 4;
export function estadoInicial() {
  return {
    version: VERSION,
    contadorGuia: 1,
    contadorRuta: 1,
    clientes: [],
    envios: [],
    enviosEliminados: [],
    rutas: [],
    configuracion: {
      tema: "automatico",
      umbralOcupacion: 80,
      diasRetencion: 3,
    },
  };
}
export function normalizarEstado(d = {}) {
  const b = estadoInicial();
  return {
    ...b,
    ...d,
    version: VERSION,
    clientes: Array.isArray(d.clientes) ? d.clientes : [],
    envios: Array.isArray(d.envios) ? d.envios.map((e) => ({ ...e, envioOrigen: e.envioOrigen || null, historial: Array.isArray(e.historial) ? e.historial : [] })) : [],
    enviosEliminados: Array.isArray(d.enviosEliminados)
      ? d.enviosEliminados
      : [],
    rutas: Array.isArray(d.rutas) ? d.rutas : [],
    configuracion: { ...b.configuracion, ...d.configuracion },
  };
}
export function cargarEstado() {
  try {
    for (const clave of [CLAVE, "ecoruta_estado_v3", "ecoruta_estado_v2", "ecoruta_estado_v1"]) {
      const t = localStorage.getItem(clave);
      if (t) return normalizarEstado(JSON.parse(t));
    }
    return estadoInicial();
  } catch (e) {
    console.warn("Estado corrupto; se recuperó el inicial", e);
    return estadoInicial();
  }
}
export function guardarEstado(e) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(normalizarEstado(e)));
    return true;
  } catch (e) {
    console.error("No se pudo guardar", e);
    return false;
  }
}
export function reemplazarEstado(destino, nuevo) {
  const n = normalizarEstado(validarRespaldo(nuevo));
  Object.keys(destino).forEach((k) => delete destino[k]);
  Object.assign(destino, n);
  guardarEstado(destino);
}
export const exportarEstado = (e) =>
  descargarJSON(
    `ecoruta-respaldo-${new Date().toISOString().slice(0, 10)}.json`,
    normalizarEstado(e),
  );
