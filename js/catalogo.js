// Carga del catálogo institucional (datos/datos.json) con fetch y async/await.
import { validarCatalogo } from "./validaciones.js";

const CLAVE_CACHE = "ecoruta_catalogo_cache";
let cache = null;

/**
 * Descarga y valida el catálogo. Si la red falla, usa la última copia válida
 * guardada en localStorage para que la operación continúe sin conexión.
 */
export async function cargarCatalogo() {
  try {
    const respuesta = await fetch("./datos/datos.json", { cache: "no-store" });
    if (!respuesta.ok) throw Error(`HTTP ${respuesta.status}`);
    cache = validarCatalogo(await respuesta.json());
    localStorage.setItem(CLAVE_CACHE, JSON.stringify(cache));
    return cache;
  } catch (errorRed) {
    const guardado = localStorage.getItem(CLAVE_CACHE);
    if (guardado) {
      try {
        return validarCatalogo(JSON.parse(guardado));
      } catch (errorCache) {
        throw Error(
          `No fue posible cargar el catálogo. Red: ${errorRed.message}. Copia local: ${errorCache.message}`,
        );
      }
    }
    throw Error(`No fue posible cargar el catálogo: ${errorRed.message}`);
  }
}

/** RF-20: la distancia sale de la matriz del catálogo, nunca del código. */
export function obtenerDistancia(catalogo, origen, destino) {
  if (origen === destino) return 0;
  const km = catalogo.distancias[origen]?.[destino];
  if (typeof km !== "number" || km <= 0) {
    throw Error(`No existe una distancia válida entre ${origen} y ${destino}`);
  }
  return km;
}
