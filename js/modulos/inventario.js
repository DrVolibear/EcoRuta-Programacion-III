import { diasDesde, escapar } from "../utilidades.js";
import { guardarEstado } from "../persistencia.js";
import { ESTADOS } from "./seguimiento.js";
let estado, catalogo, avisar, confirmar;
const suc = (c) => catalogo.sucursales.find((s) => s.codigo === c),
  nombre = (e) => e.replace(/(^| )\S/g, (l) => l.toUpperCase());
function ubic(e) {
  if (e.estado === "en bodega") return e.sucursalOrigen;
  if (e.estado === "asignado a ruta") return e.sucursalOrigen;
  if (e.estado === "en ruta") return "EN-RUTA";
  return e.sucursalDestino;
}
export function iniciarInventario(e, c, a = () => {}, co = async () => true) {
  estado = e;
  catalogo = c;
  avisar = a;
  confirmar = co;
  filtroInventarioSucursal.innerHTML =
    '<option value="">Todas</option>' +
    c.sucursales
      .map((s) => `<option value="${s.codigo}">${s.nombre}</option>`)
      .join("") +
    '<option value="EN-RUTA">En ruta</option>';
  filtroInventarioEstado.innerHTML =
    '<option value="">Todos</option>' +
    [...ESTADOS,"retenido"].map((e) => `<option value="${e}">${nombre(e)}</option>`).join("");
  filtroInventarioSucursal.onchange = render;
  filtroInventarioEstado.onchange = render;
  document.addEventListener("inventarioActualizado", render);
  const contenedorPendientes = document.getElementById("pendientesIngreso");
  contenedorPendientes?.addEventListener("click", procesarIngresoBodega);
  render();
}

async function procesarIngresoBodega(ev) {
  const boton = ev.target.closest("button[data-ingresar]");
  if (!boton) return;
  ev.preventDefault();
  ev.stopPropagation();
  const envio = estado.envios.find((x) => x.codigoGuia === boton.dataset.ingresar);
  if (!envio || envio.estado !== "registrado") {
    avisar("La solicitud ya fue procesada", true);
    return render();
  }
  const sucursal = suc(envio.sucursalOrigen)?.nombre || envio.sucursalOrigen;
  if (!(await confirmar("Ingresar a bodega", `Se recibira ${envio.codigoGuia} en ${sucursal}.`))) return;
  boton.disabled = true;
  envio.historial ||= [];
  envio.historial.push({
    estadoAnterior: "registrado",
    estado: "en bodega",
    fecha: new Date().toISOString(),
    detalle: envio.envioOrigen
      ? `Reenvio recibido en bodega; guia original ${envio.envioOrigen}`
      : "Paquete recibido fisicamente en bodega",
  });
  envio.estado = "en bodega";
  envio.fechaIngresoBodega = new Date().toISOString();
  if (!guardarEstado(estado)) {
    envio.estado = "registrado";
    boton.disabled = false;
    return avisar("No se pudo guardar el ingreso a bodega", true);
  }
  avisar(`Envio ${envio.codigoGuia} ingresado a bodega`);
  render();
}

function barras(contenedor, datos) {
  const max = Math.max(1, ...datos.map((x) => x.n));
  contenedor.innerHTML = datos
    .map(
      (x) =>
        `<div class="barra"><span>${x.nombre}</span><div class="barra-track"><div class="barra-fill" style="width:${(x.n / max) * 100}%"></div></div><strong>${x.n}</strong></div>`,
    )
    .join("");
}
function render() {
  const pendientes = estado.envios.filter((e) => e.estado === "registrado");
  const totalPendientes = document.getElementById("totalPendientesIngreso");
  const contenedorPendientes = document.getElementById("pendientesIngreso");
  if (totalPendientes) totalPendientes.textContent = `${pendientes.length} ${pendientes.length === 1 ? "pendiente" : "pendientes"}`;
  if (contenedorPendientes) contenedorPendientes.innerHTML = pendientes.length ? pendientes.map((e) => `<article class="tarjeta pendiente-card"><span class="estado">Registrado</span><h3>${escapar(e.codigoGuia)}</h3>${e.envioOrigen ? `<p><strong>Reenvio de:</strong> ${escapar(e.envioOrigen)}</p>` : ""}<p>${escapar(suc(e.sucursalOrigen)?.nombre || e.sucursalOrigen)} → ${escapar(suc(e.sucursalDestino)?.nombre || e.sucursalDestino)}</p><p>${escapar(e.contenido)} · ${e.pesoFacturable} kg</p><button data-ingresar="${escapar(e.codigoGuia)}">Ingresar a bodega</button></article>`).join("") : `<p class="vacio">No hay paquetes pendientes de recepcion.</p>`;
    const enInventario = estado.envios.filter(
      (e) => !["registrado", "entregado", "devuelto"].includes(e.estado),
    ),
    ocupaciones = catalogo.sucursales.map((s) => {
      const lista = enInventario.filter((e) => ubic(e) === s.codigo),
        peso = lista.reduce((a, e) => a + e.pesoFacturable, 0),
        porcentaje = (peso / s.capacidadKg) * 100;
      return { s, lista, peso, porcentaje };
    });
  ocupacionSucursales.innerHTML = ocupaciones
    .map(
      (o) =>
        `<article class="tarjeta ${o.porcentaje >= estado.configuracion.umbralOcupacion ? "alerta-ocupacion" : ""}" data-seleccionable="true"><h2>${o.s.nombre}</h2><p>${o.lista.length} paquetes · ${o.peso.toFixed(1)} kg · ${o.porcentaje.toFixed(1)}%</p><progress max="100" value="${Math.min(100, o.porcentaje)}"></progress></article>`,
    )
    .join("");
  const alertas = ocupaciones.filter(
    (o) => o.porcentaje >= estado.configuracion.umbralOcupacion,
  );
  alertasInventario.innerHTML = alertas.length
    ? `<p class="alerta error"><strong>Alerta:</strong> ${alertas.map((x) => x.s.nombre).join(", ")} supera el umbral de ocupacion.</p>`
    : "";
  const lista = enInventario
    .filter(
      (e) =>
        (!filtroInventarioSucursal.value ||
          ubic(e) === filtroInventarioSucursal.value) &&
        (!filtroInventarioEstado.value ||
          e.estado === filtroInventarioEstado.value),
    )
    .sort((a, b) => new Date(a.fechaIngresoBodega || a.fechaRegistro) - new Date(b.fechaIngresoBodega || b.fechaRegistro));
  totalInventario.textContent = `${lista.length} paquetes`;
  tablaInventario.innerHTML = lista.length
    ? lista
        .map((e) => {
          const fechaBase = e.fechaIngresoBodega || e.fechaRegistro,
            dias = diasDesde(fechaBase),
            limite = e.contenido === "frio" ? (estado.configuracion.diasRetencionFrio ?? 1) : estado.configuracion.diasRetencion,
            retenido = e.estado === "en bodega" && dias > limite;
          return `<tr class="${retenido?"fila-retenida":""}"><td>${e.codigoGuia}</td><td>${ubic(e) === "EN-RUTA" ? "En ruta" : suc(ubic(e))?.nombre}</td><td>${suc(e.sucursalDestino)?.nombre}</td><td>${escapar(e.contenido)}${e.contenido === "frio" ? " <strong>(cadena de frio)</strong>" : ""}</td><td>${e.pesoFacturable} kg <small>(facturable)</small></td><td>${dias}</td><td>${retenido ? `<strong>RETENIDO: excede ${limite} ${limite===1?"dia":"dias"}</strong>` : nombre(e.estado)}</td></tr>`;
        })
        .join("")
    : '<tr><td colspan="7" class="vacio">No hay paquetes.</td></tr>';
  const contenido = ["general", "fragil", "frio"].map((x) => ({
    nombre: x,
    n: lista.filter((e) => e.contenido === x).length,
  }));
  barras(inventarioPorContenido, contenido);
  const destinos = catalogo.sucursales
    .map((s) => ({
      nombre: s.nombre,
      n: lista.filter((e) => e.sucursalDestino === s.codigo).length,
    }))
    .filter((x) => x.n);
  barras(inventarioPorDestino, destinos);
}
