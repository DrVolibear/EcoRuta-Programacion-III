// Utilidades generales sin lógica de negocio.

export const $ = (selector, raiz = document) => raiz.querySelector(selector);
export const $$ = (selector, raiz = document) => [...raiz.querySelectorAll(selector)];

const ENTIDADES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" };

/** Escapa texto antes de insertarlo en innerHTML (evita inyección de HTML). */
export const escapar = (valor = "") => String(valor).replace(/[&<>'"]/g, (c) => ENTIDADES[c]);

/** Fecha y hora en formato local (es-CR). */
export const fechaLocal = (fecha) =>
  fecha ? new Date(fecha).toLocaleString("es-CR") : "No disponible";

/** Quita tildes y mayúsculas para comparar texto en las búsquedas. */
export const normalizarTexto = (texto) =>
  String(texto ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** "en bodega" → "En bodega" (solo la primera letra, como pide la interfaz). */
export const etiquetaEstado = (estado = "") => estado.charAt(0).toUpperCase() + estado.slice(1);

/** Clase CSS del estado: "asignado a ruta" → "estado-asignado-a-ruta". */
export const claseEstado = (estado = "") =>
  `estado-${normalizarTexto(estado).replace(/\s+/g, "-")}`;

/** Fecha de hoy en formato AAAA-MM-DD según la zona horaria local. */
export const hoyISO = () => {
  const ahora = new Date();
  ahora.setMinutes(ahora.getMinutes() - ahora.getTimezoneOffset());
  return ahora.toISOString().slice(0, 10);
};

/** Fecha y hora local (minutos) para el atributo min de datetime-local. */
export const ahoraLocalMinutos = (desfaseMs = 0) => {
  const ahora = new Date(Date.now() + desfaseMs);
  ahora.setMinutes(ahora.getMinutes() - ahora.getTimezoneOffset());
  return ahora.toISOString().slice(0, 16);
};

/** Descarga un objeto como archivo JSON desde el navegador. */
export const descargarJSON = (nombre, datos) => {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(datos, null, 2)], { type: "application/json" }),
  );
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  URL.revokeObjectURL(url);
};

/** Bytes aproximados que ocupa localStorage (2 bytes por carácter, UTF-16). */
export const bytesLocalStorage = () =>
  Object.keys(localStorage).reduce(
    (total, clave) => total + (clave.length + (localStorage.getItem(clave)?.length || 0)) * 2,
    0,
  );
