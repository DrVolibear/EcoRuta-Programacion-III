import { guardarEstado } from "../persistencia.js";
import { calcularEmisiones, moneda } from "../reglas.js";
let estado, catalogo, avisar, actualizar, confirmar;
const mod = (c) => catalogo.modalidades.find((m) => m.codigo === c),
  suc = (c) => catalogo.sucursales.find((s) => s.codigo === c)?.nombre || c;
export function iniciarRutas(e, c, a, u, co) {
  estado = e;
  catalogo = c;
  avisar = a;
  actualizar = u;
  confirmar = co;
  rutaDestino.innerHTML =
    '<option value="">Seleccione</option>' +
    c.sucursales
      .map((s) => `<option value="${s.codigo}">${s.nombre}</option>`)
      .join("");
  rutaModalidad.innerHTML =
    '<option value="">Seleccione</option>' +
    c.modalidades
      .map((m) => `<option value="${m.codigo}">${m.nombre}</option>`)
      .join("");
  formRuta.addEventListener("submit", crear);
  listaRutas.addEventListener("click", accionRuta);
  enviosDisponiblesRuta.addEventListener("click", asignar);
  render();
}
function crear(ev) {
  ev.preventDefault();
  const codigo = `RUTA-${new Date().getFullYear()}-${String(estado.contadorRuta++).padStart(4, "0")}`;
  estado.rutas.push({
    codigo,
    sucursalDestino: rutaDestino.value,
    modalidad: rutaModalidad.value,
    fechaSalida: rutaFechaSalida.value,
    capacidadPeso: +rutaCapacidadPeso.value,
    capacidadCantidad: +rutaCapacidadCantidad.value,
    envios: [],
    estado: "abierta",
    emisionesTotales: 0,
    ahorroConsolidacion: 0,
    fechaCreacion: new Date().toISOString(),
  });
  guardarEstado(estado);
  formRuta.reset();
  render();
  actualizar();
  avisar(`Ruta ${codigo} creada`);
}
function calculos(r) {
  const envios = r.envios
      .map((g) => estado.envios.find((e) => e.codigoGuia === g))
      .filter(Boolean),
    peso = envios.reduce((s, e) => s + e.pesoFacturable, 0),
    emisionesSeparadas = envios.reduce((s, e) => s + e.emisionesKgCO2e, 0),
    m = mod(r.modalidad),
    dist = Math.max(0, ...envios.map((e) => e.distanciaKm)),
    consol = envios.length ? calcularEmisiones(dist, peso, m) : 0;
  return {
    envios,
    peso,
    cantidad: envios.length,
    librePeso: r.capacidadPeso - peso,
    libreCantidad: r.capacidadCantidad - envios.length,
    emisionesSeparadas,
    consol,
    ahorro: Math.max(0, emisionesSeparadas - consol),
  };
}
async function asignar(ev) {
  const b = ev.target.closest("button[data-guia][data-ruta]");
  if (!b) return;
  const r = estado.rutas.find((x) => x.codigo === b.dataset.ruta),
    e = estado.envios.find((x) => x.codigoGuia === b.dataset.guia),
    c = calculos(r);
  if (r.estado !== "abierta") return avisar("La ruta no admite cambios", true);
  if (e.sucursalDestino !== r.sucursalDestino || e.modalidad !== r.modalidad)
    return avisar("Destino o modalidad incompatible", true);
  if (c.librePeso < e.pesoFacturable || c.libreCantidad < 1)
    return avisar(
      `Capacidad insuficiente. Libre: ${c.librePeso.toFixed(1)} kg y ${c.libreCantidad} paquetes`,
      true,
    );
  r.envios.push(e.codigoGuia);
  const anterior = e.estado;
  e.estado = "asignado a ruta";
  e.rutaAsignada = r.codigo;
  e.historial.push({
    estadoAnterior: anterior,
    estado: e.estado,
    fecha: new Date().toISOString(),
    detalle: `Asignado a ${r.codigo}`,
  });
  guardarEstado(estado);
  render();
  actualizar();
  document.dispatchEvent(new Event("inventarioActualizado"));
  avisar("Envio asignado");
}
async function accionRuta(ev) {
  const b = ev.target.closest("button[data-accion]");
  if (!b) return;
  const r = estado.rutas.find((x) => x.codigo === b.dataset.ruta);
  if (!r) return;
  if (b.dataset.accion === "retirar") {
    if (r.estado !== "abierta")
      return avisar("Solo se retira antes de la salida", true);
    const e = estado.envios.find((x) => x.codigoGuia === b.dataset.guia);
    r.envios = r.envios.filter((g) => g !== e.codigoGuia);
    const anterior = e.estado;
    e.estado = "en bodega";
    e.rutaAsignada = null;
    e.historial.push({
      estadoAnterior: anterior,
      estado: e.estado,
      fecha: new Date().toISOString(),
      detalle: `Retirado de ${r.codigo}`,
    });
    guardarEstado(estado);
    render();
    actualizar();
    return;
  }
  if (b.dataset.accion === "cerrar") {
    if (!r.envios.length) return avisar("La ruta no tiene envios", true);
    if (
      !(await confirmar(
        "Cerrar ruta",
        `¿Despachar ${r.codigo} y cambiar sus envios a en ruta?`,
      ))
    )
      return;
    r.estado = "en ruta";
    const c = calculos(r);
    r.emisionesTotales = c.consol;
    r.ahorroConsolidacion = c.ahorro;
    r.fechaSalidaReal = new Date().toISOString();
    c.envios.forEach((e) => {
      const anterior = e.estado;
      e.estado = "en ruta";
      e.emisionesEvitadasConsolidacionKgCO2e = +(
        c.ahorro / c.envios.length
      ).toFixed(3);
      e.historial.push({
        estadoAnterior: anterior,
        estado: e.estado,
        fecha: new Date().toISOString(),
        detalle: `Salida en ${r.codigo}`,
      });
    });
    guardarEstado(estado);
    render();
    actualizar();
    document.dispatchEvent(new Event("inventarioActualizado"));
    avisar("Ruta despachada");
  }
}
function render() {
  const abiertas = estado.rutas.filter((r) => r.estado === "abierta");
  enviosDisponiblesRuta.innerHTML =
    abiertas
      .map((r) => {
        const compatibles = estado.envios.filter(
          (e) =>
            e.estado === "en bodega" &&
            e.sucursalDestino === r.sucursalDestino &&
            e.modalidad === r.modalidad,
        );
        return `<section><h3>${r.codigo}: ${suc(r.sucursalDestino)} · ${mod(r.modalidad)?.nombre}</h3>${compatibles.map((e) => `<p>${e.codigoGuia} · ${e.pesoFacturable} kg <button data-ruta="${r.codigo}" data-guia="${e.codigoGuia}">Asignar</button></p>`).join("") || '<p class="vacio">Sin envios compatibles.</p>'}</section>`;
      })
      .join("") || '<p class="vacio">Cree una ruta abierta.</p>';
  listaRutas.innerHTML = estado.rutas.length
    ? estado.rutas
        .map((r) => {
          const c = calculos(r);
          return `<article class="tarjeta" data-seleccionable="true"><header class="fila"><div><h3>${r.codigo}</h3><p>${suc(r.sucursalDestino)} · ${mod(r.modalidad)?.nombre} · ${r.estado}</p></div>${r.estado === "abierta" ? `<button data-accion="cerrar" data-ruta="${r.codigo}">Cerrar y despachar</button>` : ""}</header><p>Peso ${c.peso.toFixed(1)}/${r.capacidadPeso} kg · Paquetes ${c.cantidad}/${r.capacidadCantidad} · Libre ${c.librePeso.toFixed(1)} kg y ${c.libreCantidad} paquetes</p><p>Emisiones consolidadas: ${c.consol.toFixed(3)} kg CO2e · Ahorro: ${c.ahorro.toFixed(3)} kg CO2e</p>${c.envios.map((e) => `<p>${e.codigoGuia}${r.estado === "abierta" ? ` <button class="secundario" data-accion="retirar" data-ruta="${r.codigo}" data-guia="${e.codigoGuia}">Retirar</button>` : ""}</p>`).join("")}</article>`;
        })
        .join("")
    : '<p class="vacio">No hay rutas.</p>';
}
