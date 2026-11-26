// Impresión: la ficha o la guía se copia a una zona exclusiva y la hoja de estilos
// de impresión oculta todo lo demás. Así no quedan páginas en blanco.
import { fechaLocal } from "./utilidades.js";

/** Pone el HTML en la zona de impresión, abre el diálogo del navegador y la limpia al terminar. */
export function imprimir(html, titulo) {
  const zona = document.getElementById("zonaImpresion");
  const tituloOriginal = document.title;
  zona.innerHTML = `<p class="fecha-impresion">Fecha de impresión: ${fechaLocal(new Date())}</p>${html}`;
  document.title = titulo; // el navegador lo usa como nombre sugerido del PDF
  window.addEventListener(
    "afterprint",
    () => {
      zona.innerHTML = "";
      document.title = tituloOriginal;
    },
    { once: true },
  );
  window.print();
}
