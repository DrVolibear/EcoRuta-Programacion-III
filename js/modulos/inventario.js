// M7: inventario del centro de distribución, recepción en bodega y alertas.
import { guardarEstado } from "../persistencia.js";
import {
  ESTADOS_INVENTARIO,
  esRetenido,
  limiteRetencionDias,
  diasEnBodega,
  textoDias,
} from "../reglas.js";
import { escapar, etiquetaEstado } from "../utilidades.js";
import { etiquetaContenido, htmlEstado } from "../plantillas.js";

// Opciones del filtro de estado: solo las que describen paquetes del inventario.
// "Retenido" no es un estado guardado: se calcula con esRetenido().
const FILTROS_ESTADO = [...ESTADOS_INVENTARIO, "retenido"];

let estado, catalogo, avisar, confirmar, actualizar;
const el = {};

const sucursal = (codigo) => catalogo.sucursales.find((s) => s.codigo === codigo);
const nombreSucursal = (codigo) => sucursal(codigo)?.nombre ?? codigo;

/** Ubicación física: "en ruta" no está en ninguna sucursal. */
const ubicacion = (e) =>
  e.estado === "en ruta"
    ? "EN-RUTA"
    : e.estado === "en bodega" || e.estado === "asignado a ruta"
      ? e.sucursalOrigen
      : e.sucursalDestino;

/** Enlaza filtros, recepción en bodega y actualizaciones desde otros módulos. */
export function iniciarInventario(e, c, a = () => {}, co = async () => true, u = () => {}) {
  estado = e;
  catalogo = c;
  avisar = a;
  confirmar = co;
  actualizar = u;
  [
    "filtroInventarioSucursal",
    "filtroInventarioEstado",
    "pendientesIngreso",
    "totalPendientesIngreso",
    "ocupacionSucursales",
    "alertasInventario",
    "totalInventario",
    "tablaInventario",
    "inventarioPorContenido",
    "inventarioPorDestino",
  ].forEach((id) => (el[id] = document.getElementById(id)));

  el.filtroInventarioSucursal.innerHTML =
    '<option value="">Todas</option>' +
    c.sucursales.map((s) => `<option value="${s.codigo}">${escapar(s.nombre)}</option>`).join("") +
    '<option value="EN-RUTA">En ruta</option>';
  el.filtroInventarioEstado.innerHTML =
    '<option value="">Todos</option>' +
    FILTROS_ESTADO.map((f) => `<option value="${f}">${etiquetaEstado(f)}</option>`).join("");

  el.filtroInventarioSucursal.addEventListener("change", render);
  el.filtroInventarioEstado.addEventListener("change", render);
  document.addEventListener("inventarioActualizado", render);
  el.pendientesIngreso.addEventListener("click", procesarIngresoBodega);
  render();
}

/** Confirma la recepción física de un paquete y lo pasa de «registrado» a «en bodega». */
async function procesarIngresoBodega(ev) {
  const boton = ev.target.closest("button[data-ingresar]");
  if (!boton) return;
  const envio = estado.envios.find((x) => x.codigoGuia === boton.dataset.ingresar);
  if (!envio || envio.estado !== "registrado") {
    avisar("La solicitud ya fue procesada.", true);
    return render();
  }
  const confirmado = await confirmar(
    "Ingresar a bodega",
    `Se recibirá ${envio.codigoGuia} en ${nombreSucursal(envio.sucursalOrigen)}.`,
  );
  if (!confirmado) return;
  // Otro proceso pudo cambiar el estado mientras el diálogo estaba abierto
  if (envio.estado !== "registrado") return render();

  const ahora = new Date().toISOString();
  envio.estado = "en bodega";
  envio.fechaIngresoBodega = ahora;
  envio.historial.push({
    estadoAnterior: "registrado",
    estado: "en bodega",
    fecha: ahora,
    detalle: envio.envioOrigen
      ? `Reenvío recibido en bodega; guía original ${envio.envioOrigen}`
      : "Paquete recibido físicamente en bodega",
  });
  if (!guardarEstado(estado)) {
    envio.estado = "registrado";
    envio.fechaIngresoBodega = null;
    envio.historial.pop();
    return avisar("No se pudo guardar el ingreso a bodega.", true);
  }
  avisar(`Envío ${envio.codigoGuia} ingresado a bodega.`);
  render();
  actualizar();
  document.dispatchEvent(
    new CustomEvent("envioActualizado", { detail: { guias: [envio.codigoGuia] } }),
  );
}

/** Gráfico de barras con HTML y CSS puros. */
function barras(contenedor, datos, vacio) {
  const max = Math.max(1, ...datos.map((x) => x.n));
  contenedor.innerHTML = datos.length
    ? datos
        .map(
          (x) =>
            `<div class="barra"><span>${escapar(x.nombre)}</span><div class="barra-track"><div class="barra-fill" style="width:${(x.n / max) * 100}%"></div></div><strong>${x.n}</strong></div>`,
        )
        .join("")
    : `<p class="vacio">${vacio}</p>`;
}

const htmlPendiente = (e) =>
  `<article class="tarjeta pendiente-card"><span class="estado estado-registrado">Registrado</span><h3>${escapar(e.codigoGuia)}</h3>${
    e.envioOrigen ? `<p><strong>Reenvío de:</strong> ${escapar(e.envioOrigen)}</p>` : ""
  }<p>${escapar(nombreSucursal(e.sucursalOrigen))} → ${escapar(nombreSucursal(e.sucursalDestino))}</p><p>${escapar(etiquetaContenido(e.contenido))} · ${e.pesoFacturable} kg facturables</p><button type="button" data-ingresar="${escapar(e.codigoGuia)}">Ingresar a bodega</button></article>`;

/** Una fila de inventario. Los retenidos se resaltan y se rotulan "Retenido". */
function htmlFila(e) {
  const retenido = esRetenido(e, estado.configuracion);
  const limite = limiteRetencionDias(e, estado.configuracion);
  const tiempo = e.estado === "en ruta" ? "—" : textoDias(diasEnBodega(e));
  const situacion = retenido
    ? `<strong class="etiqueta-retenido">Retenido</strong> <small>excede ${textoDias(limite)}</small>`
    : htmlEstado(e.estado);
  return `<tr class="${retenido ? "fila-retenida" : ""}"><td>${escapar(e.codigoGuia)}</td><td>${escapar(ubicacion(e) === "EN-RUTA" ? "En ruta" : nombreSucursal(ubicacion(e)))}</td><td>${escapar(nombreSucursal(e.sucursalDestino))}</td><td>${escapar(etiquetaContenido(e.contenido))}</td><td>${e.pesoFacturable} kg</td><td>${tiempo}</td><td>${situacion}</td></tr>`;
}

/** Pinta pendientes de ingreso, ocupación por sucursal, alertas, tabla filtrada y distribuciones. */
function render() {
  const pendientes = estado.envios.filter((e) => e.estado === "registrado");
  el.totalPendientesIngreso.textContent = `${pendientes.length} ${pendientes.length === 1 ? "pendiente" : "pendientes"}`;
  el.pendientesIngreso.innerHTML = pendientes.length
    ? pendientes.map(htmlPendiente).join("")
    : '<p class="vacio">No hay paquetes pendientes de recepción.</p>';

  const enInventario = estado.envios.filter((e) => ESTADOS_INVENTARIO.includes(e.estado));
  const umbral = estado.configuracion.umbralOcupacion;
  const ocupaciones = catalogo.sucursales.map((s) => {
    const lista = enInventario.filter((e) => ubicacion(e) === s.codigo);
    const peso = lista.reduce((suma, e) => suma + e.pesoFacturable, 0);
    return { s, lista, peso, porcentaje: (peso / s.capacidadKg) * 100 };
  });
  el.ocupacionSucursales.innerHTML = ocupaciones
    .map(
      (o) =>
        `<article class="tarjeta ${o.porcentaje >= umbral ? "alerta-ocupacion" : ""}"><h2>${escapar(o.s.nombre)}</h2><p>${o.lista.length} ${o.lista.length === 1 ? "paquete" : "paquetes"} · ${o.peso.toFixed(1)} kg · ${o.porcentaje.toFixed(1)}%</p><progress max="100" value="${Math.min(100, o.porcentaje)}" aria-label="Ocupación de ${escapar(o.s.nombre)}"></progress></article>`,
    )
    .join("");
  const alertas = ocupaciones.filter((o) => o.porcentaje >= umbral);
  el.alertasInventario.innerHTML = alertas.length
    ? `<p class="alerta error"><strong>Alerta:</strong> ${alertas.map((x) => escapar(x.s.nombre)).join(", ")} ${alertas.length === 1 ? "supera" : "superan"} el umbral de ocupación (${umbral}%).</p>`
    : "";

  const filtroSucursal = el.filtroInventarioSucursal.value;
  const filtroEstado = el.filtroInventarioEstado.value;
  const hayFiltros = Boolean(filtroSucursal || filtroEstado);
  const lista = enInventario
    .filter(
      (e) =>
        (!filtroSucursal || ubicacion(e) === filtroSucursal) &&
        (!filtroEstado ||
          (filtroEstado === "retenido"
            ? esRetenido(e, estado.configuracion)
            : e.estado === filtroEstado)),
    )
    // Del más antiguo al más reciente: lo urgente queda arriba
    .sort(
      (a, b) =>
        new Date(a.fechaIngresoBodega || a.fechaRegistro) -
        new Date(b.fechaIngresoBodega || b.fechaRegistro),
    );

  el.totalInventario.textContent = `${lista.length} ${lista.length === 1 ? "paquete" : "paquetes"}`;
  el.tablaInventario.innerHTML = lista.length
    ? lista.map(htmlFila).join("")
    : `<tr><td colspan="7" class="vacio">${hayFiltros ? "No hay paquetes que coincidan con los filtros." : "No hay paquetes en inventario."}</td></tr>`;

  barras(
    el.inventarioPorContenido,
    ["general", "fragil", "frio"].map((c) => ({
      nombre: etiquetaContenido(c),
      n: lista.filter((e) => e.contenido === c).length,
    })),
  );
  barras(
    el.inventarioPorDestino,
    catalogo.sucursales
      .map((s) => ({
        nombre: s.nombre,
        n: lista.filter((e) => e.sucursalDestino === s.codigo).length,
      }))
      .filter((x) => x.n),
    "Sin paquetes para mostrar.",
  );
}
