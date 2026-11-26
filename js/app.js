// Punto de entrada: carga el catálogo, arranca los módulos y administra navegación,
// panel de sostenibilidad, búsqueda global y configuración.
import {
  cargarEstado,
  guardarEstado,
  estadoInicial,
  reemplazarEstado,
  exportarEstado,
  normalizarEstado,
} from "./persistencia.js";
import { validarRespaldo } from "./validaciones.js";
import { cargarCatalogo } from "./catalogo.js";
import { generarDemo } from "./demo.js";
import { iniciarModales, confirmar } from "./modales.js";
import { vincularRangoFechas } from "./formularios.js";
import { iniciarClientes } from "./modulos/clientes.js";
import { iniciarEnvios, actualizarSelectores } from "./modulos/envios.js";
import { iniciarRutas } from "./modulos/rutas.js";
import { iniciarSeguimiento, consultarGuia } from "./modulos/seguimiento.js";
import { iniciarInventario } from "./modulos/inventario.js";
import { ESTADOS, ESTADO_CANCELADO, moneda, aplicaDescuentoEcologico } from "./reglas.js";
import {
  bytesLocalStorage,
  normalizarTexto,
  escapar,
  etiquetaEstado,
  hoyISO,
} from "./utilidades.js";

const estado = cargarEstado();
let catalogo;
const porId = (id) => document.getElementById(id);

// El tema se aplica de inmediato para evitar un destello con el tema equivocado
document.documentElement.dataset.tema = estado.configuracion.tema;

/* ---------- Avisos ---------- */

/** Muestra un aviso breve (toast) arriba de la pantalla; los errores usan role=alert y duran más. */
function avisar(texto, error = false) {
  const aviso = document.createElement("div");
  aviso.className = `toast ${error ? "error" : ""}`;
  aviso.textContent = texto;
  if (error) aviso.setAttribute("role", "alert");
  const zona = porId("toasts");
  zona.append(aviso);
  while (zona.children.length > 4) zona.firstElementChild.remove();
  setTimeout(() => aviso.remove(), error ? 6000 : 4000);
}

/* ---------- Navegación ---------- */

const VISTAS = [...document.querySelectorAll(".vista")].map((v) => v.id);

/** Activa una vista, marca el botón del menú y actualiza el título; el foco pasa al encabezado. */
function mostrarVista(id) {
  const seccion = porId(id);
  if (!seccion || !VISTAS.includes(id)) return;
  document.querySelectorAll(".vista").forEach((v) => v.classList.toggle("activa", v.id === id));
  document.querySelectorAll(".nav-btn").forEach((boton) => {
    const activo = boton.dataset.vista === id;
    boton.classList.toggle("activo", activo);
    if (activo) boton.setAttribute("aria-current", "page");
    else boton.removeAttribute("aria-current");
  });
  const titulo = seccion.querySelector("h1");
  porId("tituloVista").textContent = titulo?.textContent ?? "EcoRuta";
  try {
    localStorage.setItem("ecoruta_vista", id);
  } catch {
    // Sin almacenamiento disponible: la vista simplemente no se recuerda
  }
  cerrarMenu();
  if (titulo) {
    titulo.tabIndex = -1;
    titulo.focus({ preventScroll: true });
  }
  window.scrollTo({ top: 0 });
}

/** Cierra el menú lateral en pantallas angostas y avisa el cambio a los lectores de pantalla. */
function cerrarMenu() {
  document.querySelector(".lateral").classList.remove("abierto");
  porId("btnMenu").setAttribute("aria-expanded", "false");
}

/** Un solo escuchador delegado atiende todos los botones con data-vista. */
function iniciarNavegacion() {
  document.addEventListener("click", (ev) => {
    const boton = ev.target.closest("[data-vista]");
    if (boton) mostrarVista(boton.dataset.vista);
  });
  porId("btnMenu").addEventListener("click", () => {
    const abierto = document.querySelector(".lateral").classList.toggle("abierto");
    porId("btnMenu").setAttribute("aria-expanded", String(abierto));
  });
  let guardada = "panel";
  try {
    guardada = localStorage.getItem("ecoruta_vista") || "panel";
  } catch {
    // se usa la vista por defecto
  }
  mostrarVista(VISTAS.includes(guardada) ? guardada : "panel");
}

/* ---------- Catálogo ---------- */

/** Dibuja la vista de solo lectura del catálogo (sucursales, modalidades y tarifas). */
function renderCatalogo() {
  const nombreModalidad = (codigo) =>
    catalogo.modalidades.find((m) => m.codigo === codigo)?.nombre ?? codigo;
  porId("catalogoSucursales").innerHTML = catalogo.sucursales
    .map(
      (s) =>
        `<article class="tarjeta"><h2>${escapar(s.nombre)}</h2><p>${escapar(s.codigo)} · Capacidad ${s.capacidadKg.toLocaleString("es-CR")} kg · Tarifa base ${moneda(s.tarifaBase)}</p><p>Modalidades: ${s.modalidades.map((c) => escapar(nombreModalidad(c))).join(", ")}</p></article>`,
    )
    .join("");
  porId("catalogoModalidades").innerHTML = catalogo.modalidades
    .map(
      (m) =>
        `<article class="tarjeta"><h3>${escapar(m.nombre)}</h3><p>Capacidad ${m.capacidadKg.toLocaleString("es-CR")} kg · Velocidad ${m.velocidadKmH} km/h · Factor de emisión ${m.factorEmision} · Factor tarifario ${m.factorTarifa}${aplicaDescuentoEcologico(m) ? " · Con descuento ecológico" : ""}</p></article>`,
    )
    .join("");
  const furgoneta = catalogo.referencias?.furgonetaIndividual;
  if (furgoneta)
    porId("catalogoModalidades").insertAdjacentHTML(
      "beforeend",
      `<article class="tarjeta"><h3>${escapar(furgoneta.nombre ?? "Furgoneta individual")} <small>(referencia del ahorro por consolidación)</small></h3><p>Capacidad ${furgoneta.capacidadKg.toLocaleString("es-CR")} kg · Factor de emisión ${furgoneta.factorEmision}</p>${furgoneta.supuesto ? `<p class="nota">${escapar(furgoneta.supuesto)}</p>` : ""}</article>`,
    );
  const { tarifas, recargos, reglas } = catalogo;
  const porcentaje = (x) => `${(x * 100).toFixed(0)}%`;
  porId("catalogoTarifas").innerHTML =
    `<dl class="datos"><div class="dato"><dt>Por kg facturable</dt><dd>${moneda(tarifas.porKg)}</dd></div><div class="dato"><dt>Por km</dt><dd>${moneda(tarifas.porKm)}</dd></div><div class="dato"><dt>Descuento ecológico</dt><dd>${porcentaje(tarifas.descuentoEcologico)} (modalidades de baja emisión y consolidada, sin urgencia)</dd></div><div class="dato"><dt>Recargos</dt><dd>Urgente ${porcentaje(recargos.urgente)} · Frágil ${porcentaje(recargos.fragil)} · Cadena de frío ${porcentaje(recargos.frio)} · Sobredimensión ${porcentaje(recargos.sobredimension)}</dd></div><div class="dato"><dt>Reglas del paquete</dt><dd>Peso ${reglas.pesoMinKg}–${reglas.pesoMaxKg} kg · Dimensión máxima sin autorización ${reglas.dimensionMaxCm} cm · Divisor volumétrico ${reglas.divisorVolumetrico}</dd></div></dl>`;
  porId("panelSucursal").innerHTML =
    '<option value="">Todas</option>' +
    catalogo.sucursales
      .map((s) => `<option value="${s.codigo}">${escapar(s.nombre)}</option>`)
      .join("");
}

/* ---------- Panel de sostenibilidad (M8) ---------- */

const sumar = (lista, valor) => lista.reduce((suma, e) => suma + (valor(e) || 0), 0);
let rangoPanel;

/** Calcula y pinta todos los indicadores del panel con map/filter/reduce (RF-47 a RF-53). */
function renderPanel() {
  if (!rangoPanel.esValido()) return;
  const desde = porId("panelFechaDesde").value
    ? new Date(`${porId("panelFechaDesde").value}T00:00:00`).getTime()
    : 0;
  const hasta = porId("panelFechaHasta").value
    ? new Date(`${porId("panelFechaHasta").value}T23:59:59.999`).getTime()
    : Infinity;
  const sucursal = porId("panelSucursal").value;
  const filtrados = estado.envios.filter((e) => {
    const fecha = new Date(e.fechaRegistro).getTime();
    return (
      fecha >= desde &&
      fecha <= hasta &&
      (!sucursal || e.sucursalOrigen === sucursal || e.sucursalDestino === sucursal)
    );
  });
  // Un envío cancelado no se factura ni emite: queda fuera de los indicadores
  const lista = filtrados.filter((e) => e.estado !== ESTADO_CANCELADO);
  const total = lista.length;
  const facturado = sumar(lista, (e) => e.tarifa?.total);
  const bajaEmision = lista.filter(
    (e) => catalogo.modalidades.find((m) => m.codigo === e.modalidad)?.bajaEmision,
  ).length;

  porId("kpiEnvios").textContent = total;
  porId("kpiFacturado").textContent = moneda(facturado);
  porId("kpiPromedio").textContent = moneda(total ? facturado / total : 0);
  porId("kpiPeso").textContent = `${sumar(lista, (e) => e.pesoFacturable).toFixed(1)} kg`;
  porId("kpiEmisiones").textContent = `${sumar(lista, (e) => e.emisionesKgCO2e).toFixed(3)} kg`;
  porId("kpiEvitadasLimpias").textContent =
    `${sumar(lista, (e) => e.emisionesEvitadasLimpiasKgCO2e).toFixed(3)} kg`;
  porId("kpiEvitadasConsolidadas").textContent =
    `${sumar(lista, (e) => e.emisionesEvitadasConsolidacionKgCO2e).toFixed(3)} kg`;
  porId("kpiPorcentajeLimpio").textContent =
    `${total ? ((bajaEmision / total) * 100).toFixed(1) : 0}%`;

  const porSucursal = catalogo.sucursales.map((s) => ({
    s,
    n: lista.filter((e) => e.sucursalOrigen === s.codigo).length,
  }));
  const maximo = Math.max(1, ...porSucursal.map((x) => x.n));
  porId("graficoSucursales").innerHTML = porSucursal
    .map(
      (x) =>
        `<div class="barra"><span title="${escapar(x.s.nombre)}">${escapar(x.s.codigo)}</span><div class="barra-track"><div class="barra-fill" style="width:${(x.n / maximo) * 100}%"></div></div><strong>${x.n}</strong></div>`,
    )
    .join("");

  // Dona: cada tramo empieza donde terminó el anterior (reduce, sin variable externa)
  const modalidades = catalogo.modalidades.map((m, i) => ({
    m,
    n: lista.filter((e) => e.modalidad === m.codigo).length,
    color: `var(--serie-${(i % 4) + 1})`,
  }));
  const tramos = modalidades
    .filter((x) => x.n)
    .reduce(
      (acum, x) => {
        const fin = acum.fin + (x.n / total) * 100;
        return { fin, partes: [...acum.partes, `${x.color} ${acum.fin}% ${fin}%`] };
      },
      { fin: 0, partes: [] },
    ).partes;
  const dona = porId("graficoModalidades");
  dona.style.setProperty("--segmentos", tramos.length ? tramos.join(", ") : "var(--borde) 0% 100%");
  dona.innerHTML = `<span class="dona-centro"><strong>${total}</strong><small>${total === 1 ? "envío" : "envíos"}</small></span>`;
  dona.setAttribute(
    "aria-label",
    total
      ? `Participación por modalidad: ${modalidades
          .filter((x) => x.n)
          .map((x) => `${x.m.nombre} ${((x.n / total) * 100).toFixed(1)}%`)
          .join(", ")}`
      : "Participación por modalidad: sin envíos",
  );
  porId("leyendaModalidades").innerHTML = modalidades
    .map(
      (x) =>
        `<li style="--color-modalidad:${x.color}"><span class="muestra-color" aria-hidden="true"></span><span><strong>${escapar(x.m.nombre)}</strong><small>${x.n} · ${total ? ((x.n / total) * 100).toFixed(1) : "0.0"}%</small></span></li>`,
    )
    .join("");

  porId("resumenEstados").innerHTML = [...ESTADOS, ESTADO_CANCELADO]
    .map(
      (e) =>
        `<p>${etiquetaEstado(e)}: <strong>${filtrados.filter((x) => x.estado === e).length}</strong></p>`,
    )
    .join("");

  const ranking = catalogo.sucursales
    .map((s) => {
      const propios = lista.filter((e) => e.sucursalOrigen === s.codigo);
      return {
        s,
        cantidad: propios.length,
        promedio: sumar(propios, (e) => e.emisionesKgCO2e) / (propios.length || 1),
      };
    })
    .filter((x) => x.cantidad)
    .sort((a, b) => a.promedio - b.promedio)
    .slice(0, 3);
  porId("rankingSucursales").innerHTML =
    ranking
      .map((x) => `<li>${escapar(x.s.nombre)}: ${x.promedio.toFixed(3)} kg CO₂e por envío</li>`)
      .join("") || "<li>Sin datos.</li>";
}

/** Muestra el espacio usado en localStorage y advierte al llegar al 80 % (RF-59). */
function renderAlmacenamiento() {
  const bytes = bytesLocalStorage();
  const limite = 5 * 1024 * 1024;
  const porcentaje = (bytes / limite) * 100;
  const zona = porId("usoAlmacenamiento");
  zona.textContent = `Uso aproximado: ${(bytes / 1024).toFixed(1)} KB de 5 MB (${porcentaje.toFixed(2)}%). ${porcentaje >= 80 ? "Advertencia: cerca del límite estimado." : "Capacidad disponible."}`;
  zona.classList.toggle("alerta", porcentaje >= 80);
}

/** Lo que cambia cuando cualquier módulo modifica datos. La tabla de envíos se actualiza sola. */
function refrescar() {
  actualizarSelectores();
  renderPanel();
  renderAlmacenamiento();
}

/* ---------- Búsqueda global (guía, cliente o ruta) ---------- */

/** Desplaza la vista hasta el elemento y lo resalta unos segundos. */
function resaltar(elemento) {
  if (!elemento) return;
  elemento.classList.add("resaltado");
  elemento.scrollIntoView({ block: "center", behavior: "smooth" });
  setTimeout(() => elemento.classList.remove("resaltado"), 2500);
}

/** Busca el texto en guías, clientes y rutas y devuelve unos pocos resultados por tipo. */
function buscarGlobal(q) {
  const nombreSucursal = (codigo) =>
    catalogo.sucursales.find((s) => s.codigo === codigo)?.nombre ?? codigo;
  const guias = estado.envios
    .filter((e) =>
      normalizarTexto([e.codigoGuia, e.envioOrigen, e.rutaAsignada].join(" ")).includes(q),
    )
    .slice(0, 5)
    .map((e) => ({
      tipo: "Guía",
      titulo: e.codigoGuia,
      detalle: `${etiquetaEstado(e.estado)} · ${e.sucursalOrigen} → ${e.sucursalDestino}`,
      ir: () => {
        mostrarVista("seguimiento");
        consultarGuia(e.codigoGuia);
      },
    }));
  const clientes = estado.clientes
    .filter((c) => normalizarTexto([c.nombre, c.identificacion, c.correo].join(" ")).includes(q))
    .slice(0, 4)
    .map((c) => ({
      tipo: "Cliente",
      titulo: c.nombre,
      detalle: `${c.identificacion} · ${etiquetaEstado(c.estado)}`,
      ir: () => {
        mostrarVista("clientes");
        const buscador = porId("buscarCliente");
        buscador.value = c.nombre;
        buscador.dispatchEvent(new Event("input", { bubbles: true }));
        resaltar(porId("listaClientes").querySelector("tr"));
      },
    }));
  const rutas = estado.rutas
    .filter((r) =>
      normalizarTexto(
        [r.codigo, r.sucursalDestino, nombreSucursal(r.sucursalDestino)].join(" "),
      ).includes(q),
    )
    .slice(0, 4)
    .map((r) => ({
      tipo: "Ruta",
      titulo: r.codigo,
      detalle: `${nombreSucursal(r.sucursalDestino)} · ${etiquetaEstado(r.estado)}`,
      ir: () => {
        mostrarVista("rutas");
        resaltar(porId(`ruta-${r.codigo}`));
      },
    }));
  return [...guias, ...clientes, ...rutas];
}

/** Búsqueda global con lista de resultados navegable con teclado (flechas, Enter y Escape). */
function iniciarBusquedaGlobal() {
  const campo = porId("busquedaGlobal");
  const caja = porId("resultadosGlobales");
  let resultados = [];

  const cerrar = () => {
    caja.hidden = true;
    caja.innerHTML = "";
    resultados = [];
    campo.setAttribute("aria-expanded", "false");
  };
  const elegir = (indice) => {
    const resultado = resultados[indice];
    if (!resultado) return;
    cerrar();
    campo.value = "";
    resultado.ir();
  };

  campo.addEventListener("input", () => {
    const q = normalizarTexto(campo.value);
    if (q.length < 2) return cerrar();
    resultados = buscarGlobal(q);
    caja.innerHTML = resultados.length
      ? resultados
          .map(
            (r, i) =>
              `<button type="button" data-resultado="${i}"><small>${escapar(r.tipo)}</small><strong>${escapar(r.titulo)}</strong><span>${escapar(r.detalle)}</span></button>`,
          )
          .join("")
      : '<p class="vacio">No hay coincidencias de guía, cliente ni ruta.</p>';
    caja.hidden = false;
    campo.setAttribute("aria-expanded", "true");
  });
  caja.addEventListener("click", (ev) => {
    const boton = ev.target.closest("[data-resultado]");
    if (boton) elegir(Number(boton.dataset.resultado));
  });
  // Teclado: Enter abre el primer resultado, las flechas recorren la lista y Escape la cierra
  campo.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      elegir(0);
    } else if (ev.key === "ArrowDown") {
      ev.preventDefault();
      caja.querySelector("button")?.focus();
    } else if (ev.key === "Escape") cerrar();
  });
  caja.addEventListener("keydown", (ev) => {
    const botones = [...caja.querySelectorAll("button")];
    const posicion = botones.indexOf(document.activeElement);
    if (ev.key === "ArrowDown") botones[Math.min(posicion + 1, botones.length - 1)]?.focus();
    else if (ev.key === "ArrowUp") (posicion > 0 ? botones[posicion - 1] : campo).focus();
    else if (ev.key === "Escape") {
      cerrar();
      campo.focus();
    } else return;
    ev.preventDefault();
  });
  document.addEventListener("click", (ev) => {
    if (!ev.target.closest(".busqueda-global")) cerrar();
  });
}

/* ---------- Configuración, respaldo y datos de demostración (M9) ---------- */

/** Tema, umbrales de bodega, respaldo (exportar/importar), demo y reinicio con doble confirmación. */
function iniciarConfiguracion() {
  const tema = porId("tema");
  tema.value = estado.configuracion.tema;
  tema.addEventListener("change", () => {
    estado.configuracion.tema = tema.value;
    document.documentElement.dataset.tema = tema.value;
    guardarEstado(estado);
  });

  const MENSAJES = {
    umbralOcupacion: "El umbral de ocupación debe ser un entero entre 50 y 100.",
    diasRetencion: "Los días máximos en bodega deben ser un entero entre 1 y 30.",
    diasRetencionFrio: "Los días máximos para cadena de frío deben ser un entero entre 1 y 30.",
  };
  Object.keys(MENSAJES).forEach((clave) => {
    const campo = porId(clave);
    campo.value = estado.configuracion[clave];
    campo.addEventListener("change", () => {
      const valor = Number(campo.value);
      if (!campo.checkValidity() || !Number.isInteger(valor)) {
        campo.value = estado.configuracion[clave]; // se conserva el valor anterior
        return avisar(MENSAJES[clave], true);
      }
      estado.configuracion[clave] = valor;
      guardarEstado(estado);
      document.dispatchEvent(new Event("inventarioActualizado"));
      renderAlmacenamiento();
      avisar("Configuración guardada.");
    });
  });

  porId("exportarRespaldo").addEventListener("click", () => {
    exportarEstado(estado);
    avisar("Respaldo exportado.");
  });
  porId("importarRespaldo").addEventListener("change", async (ev) => {
    const archivo = ev.target.files[0];
    if (!archivo) return;
    try {
      const datos = normalizarEstado(validarRespaldo(JSON.parse(await archivo.text())));
      const aceptado = await confirmar(
        "Importar respaldo",
        `El respaldo contiene ${datos.clientes.length} clientes, ${datos.envios.length} envíos y ${datos.rutas.length} rutas. Reemplazará todos los datos actuales.`,
      );
      if (aceptado) {
        reemplazarEstado(estado, datos);
        location.reload();
      }
    } catch (error) {
      avisar(`Respaldo inválido: ${error.message}`, true);
    }
    ev.target.value = ""; // permite elegir de nuevo el mismo archivo
  });
  porId("cargarDemo").addEventListener("click", async () => {
    const demo = generarDemo(catalogo);
    const aceptado = await confirmar(
      "Cargar datos de demostración",
      `Se cargarán ${demo.clientes.length} clientes, ${demo.envios.length} envíos y ${demo.rutas.length} rutas. Reemplazarán todos los datos actuales.`,
    );
    if (aceptado) {
      reemplazarEstado(estado, demo);
      location.reload();
    }
  });
  porId("restablecerDatos").addEventListener("click", async () => {
    if (!(await confirmar("Primera confirmación", "Se eliminarán todos los datos."))) return;
    if (
      await confirmar("Segunda confirmación", "Esta acción es irreversible. ¿Restablecer ahora?")
    ) {
      reemplazarEstado(estado, estadoInicial());
      location.reload();
    }
  });
}

/* ---------- Arranque ---------- */

/** Arranque: descarga el catálogo, inicia cada módulo y, si algo falla, ofrece reintentar. */
async function iniciar() {
  try {
    catalogo = await cargarCatalogo();
    iniciarModales();
    renderCatalogo();
    iniciarClientes(estado, avisar, refrescar, confirmar);
    iniciarEnvios(estado, catalogo, avisar, refrescar);
    iniciarRutas(estado, catalogo, avisar, refrescar, confirmar);
    iniciarSeguimiento(estado, catalogo, avisar, refrescar, confirmar);
    iniciarInventario(estado, catalogo, avisar, confirmar, refrescar);
    iniciarNavegacion();
    iniciarBusquedaGlobal();
    iniciarConfiguracion();

    rangoPanel = vincularRangoFechas(porId("panelFechaDesde"), porId("panelFechaHasta"), {
      hoy: hoyISO(),
      avisar,
    });
    ["panelFechaDesde", "panelFechaHasta", "panelSucursal"].forEach((id) =>
      porId(id).addEventListener("change", renderPanel),
    );
    porId("limpiarPanel").addEventListener("click", () => {
      ["panelFechaDesde", "panelFechaHasta", "panelSucursal"].forEach(
        (id) => (porId(id).value = ""),
      );
      rangoPanel.sincronizar();
      renderPanel();
    });

    refrescar();
    porId("estadoCarga").hidden = true;
    porId("aplicacion").hidden = false;
  } catch (error) {
    console.error(error);
    porId("textoCarga").textContent = error.message;
    porId("btnReintentar").hidden = false;
    porId("btnReintentar").onclick = () => location.reload();
  }
}

iniciar();
