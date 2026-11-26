// Ayudas de formularios: mensajes específicos, errores solo tras interactuar,
// formato automático del teléfono y rangos de fechas coherentes.

/** 61681217 → 6168-1217 (también al pegar). */
export function formatearTelefono(valor) {
  const digitos = String(valor).replace(/\D/g, "").slice(0, 8);
  return digitos.length > 4 ? `${digitos.slice(0, 4)}-${digitos.slice(4)}` : digitos;
}

/** Mensaje de error bajo el campo, vinculado con aria-describedby. */
function zonaError(campo) {
  const id = `error-${campo.id}`;
  let zona = document.getElementById(id);
  if (!zona) {
    zona = document.createElement("small");
    zona.id = id;
    zona.className = "campo-error";
    zona.hidden = true;
    const ancla = campo.closest("label.check") ?? campo.closest(".campo-unidad") ?? campo;
    ancla.insertAdjacentElement("afterend", zona);
  }
  return zona;
}

/** Escribe el mensaje junto al campo y enlaza con aria-describedby; sin mensaje lo deja como válido. */
function mostrarError(campo, mensaje) {
  const zona = zonaError(campo);
  zona.textContent = mensaje;
  zona.hidden = !mensaje;
  campo.setAttribute("aria-invalid", mensaje ? "true" : "false");
  const descripcion = new Set(
    (campo.getAttribute("aria-describedby") || "").split(" ").filter(Boolean),
  );
  if (mensaje) descripcion.add(zona.id);
  else descripcion.delete(zona.id);
  if (descripcion.size) campo.setAttribute("aria-describedby", [...descripcion].join(" "));
  else campo.removeAttribute("aria-describedby");
}

/**
 * Activa validación con mensajes específicos por campo.
 *  - `mensajes[id]` recibe el campo y devuelve el texto según su `validity`.
 *  - `extras[id]` aplica una regla de negocio que el navegador no conoce
 *    (p. ej. "solo espacios") y devuelve el mensaje o "".
 * Los errores no aparecen al abrir o limpiar el formulario: solo después de que
 * la persona interactúe con el campo o intente enviar.
 */
export function activarValidacion(formulario, mensajes, { extras = {}, alInvalido } = {}) {
  const campos = () => [...formulario.elements].filter((x) => x.id && x.willValidate);

  const evaluar = (campo, forzar = false) => {
    campo.setCustomValidity("");
    const extra = extras[campo.id]?.(campo) ?? "";
    if (campo.validity.valid && !extra) return mostrarError(campo, "");
    const texto = extra || mensajes[campo.id]?.(campo) || campo.validationMessage;
    campo.setCustomValidity(texto); // el globo nativo muestra el mismo texto
    if (forzar || campo.classList.contains("tocado")) mostrarError(campo, texto);
  };
  const evaluarTodos = () => campos().forEach((campo) => evaluar(campo));

  // Antes de que el navegador valide el envío, se aplican las reglas extra
  formulario.addEventListener(
    "click",
    (ev) => {
      if (ev.target.closest("button:not([type]), button[type=submit]")) evaluarTodos();
    },
    true,
  );
  // Cuando falla el envío, el navegador dispara "invalid" en cada campo erróneo
  formulario.addEventListener(
    "invalid",
    (ev) => {
      const campo = ev.target;
      campo.classList.add("tocado");
      evaluar(campo, true);
      alInvalido?.(campo, campo.validationMessage);
    },
    true,
  );
  formulario.addEventListener("focusout", (ev) => {
    if (!ev.target.id || !ev.target.willValidate) return;
    ev.target.classList.add("tocado");
    evaluarTodos();
  });
  formulario.addEventListener("input", evaluarTodos);
  formulario.addEventListener("change", evaluarTodos);

  return {
    /** Vuelve al estado inicial: sin campos rojos ni mensajes. */
    reiniciar() {
      formulario.classList.remove("mostrar-errores");
      campos().forEach((campo) => {
        campo.classList.remove("tocado");
        campo.setCustomValidity("");
        mostrarError(campo, "");
      });
    },
    evaluarTodos,
    /** Muestra el error de un campo (p. ej. tras una validación de negocio al guardar). */
    marcar(campo, mensaje) {
      campo.classList.add("tocado");
      campo.setCustomValidity(mensaje);
      mostrarError(campo, mensaje);
    },
  };
}

/**
 * Mantiene coherente un rango Desde/Hasta (puntos 8 y 22):
 *  - Hasta.min = Desde y Desde.max = Hasta,
 *  - ninguna fecha de consulta puede ser futura,
 *  - un rango inválido escrito a mano se bloquea con un mensaje.
 * Devuelve una función que indica si el rango actual es válido.
 */
export function vincularRangoFechas(desde, hasta, { hoy, avisar }) {
  const MENSAJE = "Hasta no puede ser anterior a Desde.";
  const sincronizar = () => {
    desde.max = hasta.value && hasta.value < hoy ? hasta.value : hoy;
    hasta.min = desde.value || "";
    hasta.max = hoy;
  };
  const invalido = () => Boolean(desde.value && hasta.value && hasta.value < desde.value);
  const validar = (avisarAlUsuario) => {
    sincronizar();
    hasta.setCustomValidity(invalido() ? MENSAJE : "");
    mostrarError(hasta, invalido() ? MENSAJE : "");
    if (invalido() && avisarAlUsuario) avisar(MENSAJE, true);
    return !invalido();
  };
  desde.addEventListener("input", () => validar(true));
  hasta.addEventListener("input", () => validar(true));
  sincronizar();
  return { esValido: () => validar(false), sincronizar };
}
