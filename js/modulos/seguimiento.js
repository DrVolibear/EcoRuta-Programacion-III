import { guardarEstado } from "../persistencia.js";
import { fechaLocal } from "../utilidades.js";
export const ESTADOS = [
  "registrado",
  "en bodega",
  "asignado a ruta",
  "en ruta",
  "entregado",
  "devuelto",
];
export const TRANSICIONES = {
  registrado: ["en bodega", "devuelto"],
  "en bodega": ["devuelto"],
  "asignado a ruta": ["en bodega"],
  "en ruta": ["entregado", "devuelto"],
  entregado: [],
  devuelto: [],
};
let estado,
  catalogo,
  avisar,
  actualizar,
  confirmar,
  seleccionado = null;
const nombre = (e) => e.replace(/(^| )\S/g, (l) => l.toUpperCase());
const suc = (c) => catalogo.sucursales.find((s) => s.codigo === c)?.nombre || c;
export function iniciarSeguimiento(e, c, a, u, co) {
  estado = e;
  catalogo = c;
  avisar = a;
  actualizar = u;
  confirmar = co;
  formSeguimiento.addEventListener("submit", buscar);
    guiaSeguimiento.addEventListener("input",()=>{resultadoSeguimiento.innerHTML="";historialSeguimiento.innerHTML="";seleccionado=null;});
  resultadoSeguimiento.addEventListener("click", cambiar);
}
function buscar(ev) {
  ev.preventDefault();
  seleccionado = estado.envios.find(
    (e) =>
      e.codigoGuia.toUpperCase() === guiaSeguimiento.value.trim().toUpperCase(),
  );
  if (!seleccionado) {
    resultadoSeguimiento.innerHTML =
      '<p class="vacio">No se encontro la guia.</p>';
    historialSeguimiento.innerHTML = "";
    return avisar("Guia no encontrada", true);
  }
  render();
}
function render() {
  const opciones = TRANSICIONES[seleccionado.estado] || [];
  const cli=id=>estado.clientes.find(c=>c.id===id)?.nombre||"No disponible";
    const modalidad=catalogo.modalidades.find(m=>m.codigo===seleccionado.modalidad)?.nombre||seleccionado.modalidad;
    const reenvio=estado.envios.find(e=>e.envioOrigen===seleccionado.codigoGuia);
    resultadoSeguimiento.innerHTML = `<article class="tarjeta"><h2>${seleccionado.codigoGuia}</h2><p><strong>${suc(seleccionado.sucursalOrigen)} → ${suc(seleccionado.sucursalDestino)}</strong></p><p><span class="estado">${nombre(seleccionado.estado)}</span></p><div class="detalle-seguimiento"><p>Remitente: ${cli(seleccionado.clienteRemitente)}</p><p>Destinatario: ${cli(seleccionado.clienteDestinatario)}</p><p>Modalidad: ${modalidad}</p><p>Ruta: ${seleccionado.rutaAsignada||"Sin asignar"}</p><p>Peso real: ${seleccionado.pesoReal} kg</p><p>Peso volumetrico: ${seleccionado.pesoVolumetrico} kg</p><p>Peso facturable: ${seleccionado.pesoFacturable} kg</p><p>Largo × Ancho × Alto: ${seleccionado.dimensiones?.largo} × ${seleccionado.dimensiones?.ancho} × ${seleccionado.dimensiones?.alto} cm</p><p>Contenido: ${seleccionado.contenido}</p><p>Total: ₡${Number(seleccionado.tarifa?.total||0).toLocaleString("es-CR")}</p>${seleccionado.envioOrigen?`<p>Guia original: ${seleccionado.envioOrigen}</p>`:""}${reenvio?`<p>Reenvio asociado: ${reenvio.codigoGuia}</p>`:""}</div>${opciones.map((e) => `<button data-estado="${e}">Cambiar a ${nombre(e)}</button>`).join(" ") || "<p>Estado final o controlado por la ruta.</p>"}</article>`;
  historialSeguimiento.innerHTML = (seleccionado.historial || [])
    .slice()
    .reverse()
    .map(
      (h) =>
        `<article class="linea-tiempo"><strong>${nombre(h.estadoAnterior || "inicio")} → ${nombre(h.estado)}</strong><p>${h.detalle || "Cambio de estado"}</p><small>${fechaLocal(h.fecha)}</small></article>`,
    )
    .join("");
}
async function cambiar(ev) {
  const b = ev.target.closest("button[data-estado]");
  if (!b) return;
  const nuevo = b.dataset.estado;
  if (!(TRANSICIONES[seleccionado.estado] || []).includes(nuevo))
    return avisar("Transicion no valida", true);
  if (
    !(await confirmar(
      "Cambiar estado",
      `¿Cambiar ${seleccionado.codigoGuia} a ${nuevo}?`,
    ))
  )
    return;
  const anterior = seleccionado.estado;
  let detalleRuta = "";
  if (anterior === "asignado a ruta" && nuevo === "en bodega") {
      const codigoRuta = seleccionado.rutaAsignada;
      const ruta = estado.rutas.find((r) => r.codigo === codigoRuta);
      if (ruta) {
        ruta.envios = [...new Set(ruta.envios || [])].filter(
          (guia) => guia !== seleccionado.codigoGuia,
        );
        detalleRuta = `; retirado automaticamente de ${ruta.codigo}`;
      }
      seleccionado.rutaAsignada = null;
      seleccionado.fechaIngresoBodega = new Date().toISOString();
    }
  if (anterior === "registrado" && nuevo === "en bodega") seleccionado.fechaIngresoBodega = new Date().toISOString();
  seleccionado.estado = nuevo;
  seleccionado.historial.push({
    estadoAnterior: anterior,
    estado: nuevo,
    fecha: new Date().toISOString(),
      detalle: `Cambio manual de ${anterior} a ${nuevo}${detalleRuta}`,
  });
  guardarEstado(estado);
  render();
  actualizar();
  document.dispatchEvent(new Event("inventarioActualizado"));
  avisar("Estado actualizado");
}
