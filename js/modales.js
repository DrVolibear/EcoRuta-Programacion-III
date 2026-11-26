// Diálogos modales accesibles: foco, cierre con Escape / fondo / botón y bloqueo del scroll.
import { escapar } from "./utilidades.js";

const MINIMO_MOTIVO = 10;
const origenes = new WeakMap(); // diálogo → elemento que lo abrió

const bloquearFondo = () =>
  document.documentElement.classList.toggle(
    "modal-abierto",
    document.querySelector("dialog[open]") !== null,
  );

/** Abre un diálogo recordando qué elemento lo pidió para devolverle el foco al cerrar. */
export function abrirDialogo(dialogo, { origen = document.activeElement, enfocar } = {}) {
  origenes.set(dialogo, origen);
  dialogo.showModal();
  bloquearFondo();
  (
    enfocar ??
    dialogo.querySelector("[data-foco-inicial]") ??
    dialogo.querySelector("button")
  )?.focus();
}

/** Se llama una vez al arrancar: cierre por fondo, foco de retorno y bloqueo de scroll. */
export function iniciarModales() {
  document.querySelectorAll("dialog").forEach((dialogo) => {
    // Cierra solo si el clic empezó y terminó sobre el fondo (::backdrop). Los diálogos
    // no tienen relleno propio, así que un clic dentro nunca tiene como destino al <dialog>.
    let empezoEnFondo = false;
    dialogo.addEventListener("pointerdown", (ev) => {
      empezoEnFondo = ev.target === dialogo;
    });
    dialogo.addEventListener("click", (ev) => {
      if (ev.target === dialogo && empezoEnFondo) dialogo.close("cancel");
      empezoEnFondo = false;
    });
    dialogo.addEventListener("close", () => {
      bloquearFondo();
      const origen = origenes.get(dialogo);
      if (origen && origen.isConnected && !origen.disabled) origen.focus();
      origenes.delete(dialogo);
    });
  });
}

/** Confirmación genérica. Escape, fondo y "Cancelar" resuelven en false. */
export function confirmar(titulo, texto) {
  const dialogo = document.getElementById("dialogoConfirmacion");
  return new Promise((resolver) => {
    document.getElementById("tituloConfirmacion").textContent = titulo;
    document.getElementById("textoConfirmacion").textContent = texto;
    // returnValue persiste entre aperturas: sin reiniciarlo, Escape podría
    // "confirmar" con el valor de una confirmación anterior.
    dialogo.returnValue = "";
    abrirDialogo(dialogo, {
      enfocar: dialogo.querySelector('[value="cancel"]'),
    });
    dialogo.addEventListener("close", () => resolver(dialogo.returnValue === "confirm"), {
      once: true,
    });
  });
}

/** Cantidad de caracteres válidos de un motivo (sin espacios en los extremos). */
export const longitudMotivo = (texto) => texto.trim().length;

/**
 * Diálogo de cancelación segura. Muestra el resumen del registro y su impacto,
 * exige un motivo de al menos 10 caracteres y devuelve el motivo (o null si se cancela).
 */
export function solicitarCancelacion({ titulo, resumenHTML, impacto = [], etiquetaConfirmar }) {
  const dialogo = document.getElementById("dialogoCancelacion");
  const motivo = document.getElementById("motivoCancelacion");
  const contador = document.getElementById("contadorMotivo");
  const confirmarBtn = document.getElementById("confirmarCancelacion");
  const cancelarBtn = document.getElementById("cerrarCancelacion");

  document.getElementById("tituloCancelacion").textContent = titulo;
  document.getElementById("resumenCancelacion").innerHTML = resumenHTML;
  document.getElementById("impactoCancelacion").innerHTML = impacto.length
    ? `<h3>Impacto</h3><ul>${impacto.map((i) => `<li>${escapar(i)}</li>`).join("")}</ul>`
    : "";
  confirmarBtn.textContent = etiquetaConfirmar;
  motivo.value = "";

  const actualizarContador = () => {
    const n = longitudMotivo(motivo.value);
    contador.textContent = `${Math.min(n, MINIMO_MOTIVO)}/${MINIMO_MOTIVO}`;
    confirmarBtn.disabled = n < MINIMO_MOTIVO;
  };
  actualizarContador();

  return new Promise((resolver) => {
    const alEscribir = () => actualizarContador();
    // El botón "Cancelar" no valida ni modifica datos: solo cierra
    const alCancelar = () => dialogo.close("cancel");
    const alEnviar = (ev) => {
      ev.preventDefault();
      if (longitudMotivo(motivo.value) < MINIMO_MOTIVO) return;
      dialogo.close("confirm");
    };
    const formulario = dialogo.querySelector("form");
    motivo.addEventListener("input", alEscribir);
    cancelarBtn.addEventListener("click", alCancelar);
    formulario.addEventListener("submit", alEnviar);
    dialogo.addEventListener(
      "close",
      () => {
        motivo.removeEventListener("input", alEscribir);
        cancelarBtn.removeEventListener("click", alCancelar);
        formulario.removeEventListener("submit", alEnviar);
        resolver(dialogo.returnValue === "confirm" ? motivo.value.trim() : null);
      },
      { once: true },
    );
    dialogo.returnValue = "";
    abrirDialogo(dialogo, { enfocar: motivo });
  });
}
