import { guardarEstado } from "../persistencia.js";
import { obtenerDistancia } from "../catalogo.js";
import {
  moneda,
  pesoVolumetrico,
  modalidadesViables,
  calcularTarifa,
  calcularEmisiones,
} from "../reglas.js";
import { validarEnvioFormulario } from "../validaciones.js";
import { normalizarTexto, fechaLocal, escapar } from "../utilidades.js";
import { ESTADOS } from "./seguimiento.js";
let estado,
  catalogo,
  avisar,
  actualizar,
  confirmar,
  opciones = [],
  pagina = 1,
  orden = { campo: "fecha", direccion: "desc" },
  guiaDetalle = "",
  guiaEliminar = "",
  guiaOrigenReenvio = "",
    firmaComparacion = "";
const $ = (s) => document.querySelector(s),
  suc = (c) => catalogo.sucursales.find((s) => s.codigo === c),
  mod = (c) => catalogo.modalidades.find((m) => m.codigo === c),
  nombreEstado = (e) => e.replace(/(^| )\S/g, (l) => l.toUpperCase());
export function iniciarEnvios(e, c, a, u, co) {
  estado = e;
  catalogo = c;
  avisar = a;
  actualizar = u;
  confirmar = co;
  formEnvio.addEventListener("submit", comparar);
    formEnvio.addEventListener("input", invalidarComparacion);
    formEnvio.addEventListener("change", invalidarComparacion);
  comparacion.addEventListener("click", (ev) => {
    const b = ev.target.closest("button[data-opcion]");
    if (b) confirmarOpcion(+b.dataset.opcion);
  });
  tablaEnvios.addEventListener("click", accionTabla);
  document.querySelectorAll(".orden-columna").forEach((b) =>
    b.addEventListener("click", () => {
      orden =
        orden.campo === b.dataset.orden
          ? {
              campo: orden.campo,
              direccion: orden.direccion === "asc" ? "desc" : "asc",
            }
          : { campo: b.dataset.orden, direccion: "asc" };
      pagina = 1;
      renderEnvios();
    }),
  );
  [
    buscarEnvio,
    filtroModalidadEnvio,
    filtroEstadoEnvio,
    filtroSucursalEnvio,
    filtroFechaDesde,
    filtroFechaHasta,
    cantidadEnviosPagina,
  ].forEach((x) =>
    x.addEventListener(x === buscarEnvio ? "input" : "change", () => {
      pagina = 1;
      renderEnvios();
    }),
  );
  limpiarFiltrosEnvios.onclick = limpiarFiltros;
  paginaAnteriorEnvios.onclick = () => {
    if (pagina > 1) {
      pagina--;
      renderEnvios();
    }
  };
  paginaSiguienteEnvios.onclick = () => {
    pagina++;
    renderEnvios();
  };
  cancelarEdicionEnvio.onclick = cancelarEdicion;
  cerrarDetalleEnvio.onclick = () => dialogoEnvio.close();
  imprimirDetalleEnvio.onclick = () => print();
  irSeguimientoEnvio.onclick = () => {
    dialogoEnvio.close();
    guiaSeguimiento.value = guiaDetalle;
    document.querySelector('[data-vista="seguimiento"]').click();
    formSeguimiento.requestSubmit();
  };
  formEliminarEnvio.addEventListener("submit", eliminarConfirmado);
    motivoEliminacion.addEventListener("input", actualizarMotivo);
  buscarRemitente.addEventListener("input", () =>
    cargarClientes("remitente", buscarRemitente.value),
  );
  buscarDestinatario.addEventListener("input", () =>
    cargarClientes("destinatario", buscarDestinatario.value),
  );
  actualizarSelectores();
  renderEnvios();
}
function cargarClientes(id, q = "") {
  const sel = document.getElementById(id),
    actual = sel.value,
    texto = normalizarTexto(q),
    lista = estado.clientes.filter(
      (c) =>
        c.activo &&
        normalizarTexto(
          [c.nombre, c.identificacion, c.correo].join(" "),
        ).includes(texto),
    );
  sel.innerHTML =
    '<option value="">Seleccione</option>' +
    lista
      .map(
        (c) =>
          `<option value="${c.id}">${escapar(c.nombre)} (${escapar(c.identificacion)})</option>`,
      )
      .join("");
  if (lista.some((c) => c.id === actual)) sel.value = actual;
}
export function actualizarSelectores() {
  if (!estado || !catalogo) return;
  cargarClientes("remitente");
  cargarClientes("destinatario");
  const su =
    '<option value="">Seleccione</option>' +
    catalogo.sucursales
      .map((s) => `<option value="${s.codigo}">${s.nombre}</option>`)
      .join("");
  origen.innerHTML = su;
  destino.innerHTML = su;
  filtroSucursalEnvio.innerHTML =
    '<option value="">Todas</option>' +
    catalogo.sucursales
      .map((s) => `<option value="${s.codigo}">${s.nombre}</option>`)
      .join("");
  filtroModalidadEnvio.innerHTML =
    '<option value="">Todas</option>' +
    catalogo.modalidades
      .map((m) => `<option value="${m.codigo}">${m.nombre}</option>`)
      .join("");
  filtroEstadoEnvio.innerHTML =
    '<option value="">Todos</option>' +
    [...ESTADOS,"cancelado"].filter((v,i,a)=>a.indexOf(v)===i).map((e) => `<option value="${e}">${nombreEstado(e)}</option>`).join(
      "",
    );
}
function datosFormulario() {
  return {
    remitente: remitente.value,
    destinatario: destinatario.value,
    origen: origen.value,
    destino: destino.value,
    pesoReal: +peso.value,
    largo: +largo.value,
    ancho: +ancho.value,
    alto: +alto.value,
    contenido: contenido.value,
    urgente: urgente.checked,
  };
}
function firmaActual(){const d=datosFormulario();return JSON.stringify({...d,responsableAutorizacion:(d.responsableAutorizacion||"").trim()})}
function invalidarComparacion(){if(!opciones.length)return;opciones=[];firmaComparacion="";comparacion.innerHTML='<p class="vacio alerta">Los datos cambiaron. Vuelva a comparar las modalidades.</p>'}
function actualizarMotivo(){const n=motivoEliminacion.value.trim().length;contadorMotivoEliminacion.textContent=`${Math.min(n,10)}/10`;confirmarEliminacionEnvio.disabled=n<10}
function comparar(ev) {
  ev.preventDefault();
  const d = datosFormulario(),
    errores = validarEnvioFormulario(d, catalogo.reglas);
  if (errores.length) return avisar(errores[0], true);
  let distancia;
  try {
    distancia = obtenerDistancia(catalogo, d.origen, d.destino);
  } catch (e) {
    return avisar(e.message, true);
  }
  const sobredimension = [d.largo, d.ancho, d.alto].some(
    (x) => x > catalogo.reglas.dimensionMaxCm,
  );
  if (
    sobredimension &&
    (!autorizacionSobredimension.checked ||
      !responsableAutorizacion.value.trim())
  )
    return avisar(
      "La sobredimension requiere autorizacion y responsable",
      true,
    );
  const pv = pesoVolumetrico(
      d.largo,
      d.ancho,
      d.alto,
      catalogo.reglas.divisorVolumetrico,
    ),
    paquete = {
      pesoReal: d.pesoReal,
      pesoVolumetrico: pv,
      pesoFacturable: Math.max(d.pesoReal, pv),
      dimensiones: { largo: d.largo, ancho: d.ancho, alto: d.alto },
      contenido: d.contenido,
      urgente: d.urgente,
      sobredimension,
      autorizacionSobredimension: sobredimension
        ? {
            autorizada: true,
            responsable: responsableAutorizacion.value.trim(),
          }
        : null,
    };
  opciones = modalidadesViables(catalogo, paquete, suc(d.origen), distancia)
    .map((m) => ({
      modalidad: m,
      tarifa: calcularTarifa(catalogo, suc(d.origen), paquete, distancia, m),
      emisiones: calcularEmisiones(distancia, paquete.pesoFacturable, m),
      paquete,
      distancia,
      origen: d.origen,
      destino: d.destino,
    }))
    .sort((a, b) => a.emisiones - b.emisiones);
  firmaComparacion = firmaActual();
  comparacion.innerHTML = opciones.length
    ? `<p><strong>Peso real:</strong> ${paquete.pesoReal} kg · <strong>Peso volumetrico:</strong> ${paquete.pesoVolumetrico} kg · <strong>Peso facturable:</strong> ${paquete.pesoFacturable} kg · <strong>Distancia:</strong> ${distancia} km</p>` +
      opciones
        .map(
          (o, i) =>
            `<article class="opcion ${i === 0 ? "recomendada" : ""}"><header><strong>${o.modalidad.nombre}</strong><span>${i === 0 ? "Menor emision" : ""}</span></header><dl><dt>Base</dt><dd>${moneda(o.tarifa.base)}</dd><dt>Peso</dt><dd>${moneda(o.tarifa.peso)}</dd><dt>Distancia</dt><dd>${moneda(o.tarifa.distancia)}</dd>${Object.entries(o.tarifa.recargos).map(([k,v])=>`<dt>Recargo ${k}</dt><dd>${moneda(v)}${v?` (${Math.round((catalogo.recargos[k]||0)*100)}%)`:""}</dd>`).join("")}<dt>Descuento</dt><dd>${moneda(o.tarifa.descuento)}</dd><dt>Total</dt><dd>${moneda(o.tarifa.total)}</dd><dt>Emisiones</dt><dd>${o.emisiones} kg CO2e</dd><dt>Entrega</dt><dd>${Math.max(1, Math.ceil(o.distancia / o.modalidad.velocidadKmH))} h</dd></dl><button data-opcion="${i}">${guiaEdicion.value ? "Guardar correccion" : "Elegir y registrar"}</button></article>`,
        )
        .join("")
    : `<p class="vacio alerta error">${paquete.contenido === "frio" ? "No existe una modalidad refrigerada compatible con el peso, la distancia y la sucursal de origen." : "No existe modalidad viable para el peso, dimensiones, distancia y sucursal seleccionados."}</p>`;
}
function confirmarOpcion(i) {
  const o = opciones[i];
  if (!o) return;
  if(!formEnvio.checkValidity()){formEnvio.reportValidity();return avisar("Corrija los datos del formulario antes de registrar",true)}
  const errores=validarEnvioFormulario(datosFormulario(),catalogo.reglas);if(errores.length)return avisar(errores[0],true);
  if(firmaComparacion!==firmaActual())return avisar("Los datos cambiaron. Compare nuevamente las modalidades antes de registrar.",true);
  const existente = estado.envios.find(
    (e) => e.codigoGuia === guiaEdicion.value,
  );
  if (existente) {
    if (existente.estado !== "registrado")
      return avisar("Solo se corrigen envios registrados", true);
    Object.assign(existente, {
      clienteRemitente: remitente.value,
      clienteDestinatario: destinatario.value,
      sucursalOrigen: o.origen,
      sucursalDestino: o.destino,
      ...o.paquete,
      distanciaKm: o.distancia,
      modalidad: o.modalidad.codigo,
      tarifa: o.tarifa,
      emisionesKgCO2e: o.emisiones,
      fechaModificacion: new Date().toISOString(),
    });
    existente.historial.push({
      estadoAnterior: "registrado",
      estado: "registrado",
      fecha: new Date().toISOString(),
      detalle: "Solicitud corregida conservando la guia",
    });
    avisar(`Envio ${existente.codigoGuia} corregido`);
  } else {
    const codigo = `ENV-${new Date().getFullYear()}-${String(estado.contadorGuia++).padStart(5, "0")}`,
      conv = catalogo.modalidades.find((m) => m.codigo === "consolidado"),
      base = conv
        ? calcularEmisiones(o.distancia, o.paquete.pesoFacturable, conv)
        : o.emisiones;
    estado.envios.push({
      codigoGuia: codigo,
      clienteRemitente: remitente.value,
      clienteDestinatario: destinatario.value,
      sucursalOrigen: o.origen,
      sucursalDestino: o.destino,
      ...o.paquete,
      distanciaKm: o.distancia,
      modalidad: o.modalidad.codigo,
      tarifa: o.tarifa,
      emisionesKgCO2e: o.emisiones,
      emisionesEvitadasLimpiasKgCO2e: +Math.max(0, base - o.emisiones).toFixed(
        3,
      ),
      emisionesEvitadasConsolidacionKgCO2e: 0,
      estado: "registrado",
      rutaAsignada: null,
      envioOrigen: guiaOrigenReenvio || null,
      historial: [
        {
          estadoAnterior: null,
          estado: "registrado",
          fecha: new Date().toISOString(),
          detalle: guiaOrigenReenvio
            ? `Reenvio creado desde ${guiaOrigenReenvio}`
            : "Solicitud registrada",
        },
      ],
      fechaRegistro: new Date().toISOString(),
    });
    avisar(`Envio ${codigo} registrado`);
  }
  guardarEstado(estado);
  cancelarEdicion();
  pagina = 1;
  insertarOActualizarTrasRegistro();
  actualizar();
  document.dispatchEvent(new Event("inventarioActualizado"));
}
function insertarOActualizarTrasRegistro() {
  renderEnvios();
}
function cancelarEdicion() {
  formEnvio.reset();
  guiaEdicion.value = "";
  guiaOrigenReenvio = "",
    firmaComparacion = "";
  cancelarEdicionEnvio.hidden = true;
  btnComparar.textContent = "Comparar modalidades";
  comparacion.innerHTML = '<p class="vacio">Complete el formulario.</p>';
  opciones = [];
}
function accionTabla(ev) {
  const b = ev.target.closest("button[data-accion]");
  if (!b) return;
  const e = estado.envios.find((x) => x.codigoGuia === b.dataset.guia);
  if (!e) return;
  if (b.dataset.accion === "detalle") return detalle(e);
  if (b.dataset.accion === "reenviar") {
      if (e.estado !== "devuelto")
        return avisar("Solo se reenvian solicitudes devueltas", true);
      guiaOrigenReenvio = e.codigoGuia;
      guiaEdicion.value = "";
      remitente.value = e.clienteRemitente;
      destinatario.value = e.clienteDestinatario;
      origen.value = e.sucursalOrigen;
      destino.value = e.sucursalDestino;
      peso.value = e.pesoReal;
      largo.value = e.dimensiones.largo;
      ancho.value = e.dimensiones.ancho;
      alto.value = e.dimensiones.alto;
      contenido.value = e.contenido;
      urgente.checked = e.urgente;
      autorizacionSobredimension.checked = !!e.autorizacionSobredimension;
      responsableAutorizacion.value =
        e.autorizacionSobredimension?.responsable || "";
      cancelarEdicionEnvio.hidden = false;
      btnComparar.textContent = "Comparar para reenviar";
      comparacion.innerHTML = `<p class="alerta">Reenvio basado en ${e.codigoGuia}. Se generara una guia nueva.</p>`;
      formEnvio.scrollIntoView({ behavior: "smooth" });
      return avisar("Datos copiados. Revise y compare las modalidades");
    }
    if (b.dataset.accion === "editar") {
    if (e.estado !== "registrado")
      return avisar("Solo se editan envios registrados", true);
    guiaEdicion.value = e.codigoGuia;
    remitente.value = e.clienteRemitente;
    destinatario.value = e.clienteDestinatario;
    origen.value = e.sucursalOrigen;
    destino.value = e.sucursalDestino;
    peso.value = e.pesoReal;
    largo.value = e.dimensiones.largo;
    ancho.value = e.dimensiones.ancho;
    alto.value = e.dimensiones.alto;
    contenido.value = e.contenido;
    urgente.checked = e.urgente;
    autorizacionSobredimension.checked = !!e.autorizacionSobredimension;
    responsableAutorizacion.value =
      e.autorizacionSobredimension?.responsable || "";
    cancelarEdicionEnvio.hidden = false;
    btnComparar.textContent = "Recalcular y guardar";
    formEnvio.scrollIntoView({ behavior: "smooth" });
    return;
  }
  if (b.dataset.accion === "eliminar") {
    if (["en ruta", "entregado"].includes(e.estado))
      return avisar("No se elimina un envio en ruta o entregado", true);
    guiaEliminar = e.codigoGuia;
    motivoEliminacion.value = "";
    dialogoEliminarEnvio.showModal();
    motivoEliminacion.focus();
  }
}
function eliminarConfirmado(ev) {
  if (ev.submitter?.value !== "confirm") return;
  ev.preventDefault();
  if (motivoEliminacion.value.trim().length < 10)
    return motivoEliminacion.reportValidity();
  const e = estado.envios.find((x) => x.codigoGuia === guiaEliminar);
  estado.enviosEliminados.push({
    ...e,
    motivoEliminacion: motivoEliminacion.value.trim(),
    fechaEliminacion: new Date().toISOString(),
  });
  estado.rutas.forEach((ruta) => {
    ruta.envios = (ruta.envios || []).filter((guia) => guia !== guiaEliminar);
  });
  estado.envios = estado.envios.filter((x) => x.codigoGuia !== guiaEliminar);
  guardarEstado(estado);
  dialogoEliminarEnvio.close();
  renderEnvios();
  actualizar();
  document.dispatchEvent(new Event("inventarioActualizado"));
  avisar("Envio cancelado; la guia se conserva para auditoria");
}
function sincronizarFechas(){filtroFechaHasta.min=filtroFechaDesde.value||"";filtroFechaDesde.max=filtroFechaHasta.value||"";}
  function lista() {
    sincronizarFechas();
    if(filtroFechaDesde.value&&filtroFechaHasta.value&&filtroFechaHasta.value<filtroFechaDesde.value){avisar("Hasta no puede ser anterior a Desde",true);return [];}
  const q = normalizarTexto(buscarEnvio.value),
    desde = filtroFechaDesde.value
      ? new Date(filtroFechaDesde.value).getTime()
      : 0,
    hasta = filtroFechaHasta.value
      ? new Date(filtroFechaHasta.value + "T23:59:59").getTime()
      : Infinity;
  let a = estado.envios.filter((e) => {
    const t = new Date(e.fechaRegistro).getTime(),
      texto = normalizarTexto(
        [
          e.codigoGuia,
          e.sucursalOrigen,
          e.sucursalDestino,
          suc(e.sucursalOrigen)?.nombre,
          suc(e.sucursalDestino)?.nombre,
          mod(e.modalidad)?.nombre,
          e.estado,
        ].join(" "),
      );
    return (
      texto.includes(q) &&
      (!filtroModalidadEnvio.value ||
        e.modalidad === filtroModalidadEnvio.value) &&
      (!filtroEstadoEnvio.value || e.estado === filtroEstadoEnvio.value) &&
      (!filtroSucursalEnvio.value ||
        e.sucursalOrigen === filtroSucursalEnvio.value ||
        e.sucursalDestino === filtroSucursalEnvio.value) &&
      t >= desde &&
      t <= hasta
    );
  });
  const valor = (e, c) =>
    c === "guia"
      ? e.codigoGuia
      : c === "trayecto"
        ? `${e.sucursalOrigen}-${e.sucursalDestino}`
        : c === "modalidad"
          ? mod(e.modalidad)?.nombre
          : c === "total"
            ? e.tarifa.total
            : c === "estado"
              ? e.estado
              : new Date(e.fechaRegistro).getTime();
  return a.slice().sort((x, y) => {
    const A = valor(x, orden.campo),
      B = valor(y, orden.campo),
      r =
        typeof A === "number"
          ? A - B
          : String(A).localeCompare(String(B), "es", { numeric: true });
    return orden.direccion === "asc" ? r : -r;
  });
}
export function renderEnvios() {
  if (!estado) return;
  const a = lista(),
    n = +cantidadEnviosPagina.value,
    pags = Math.ceil(a.length / n);
  pagina = Math.max(1, Math.min(pagina, pags || 1));
  contadorSolicitudes.textContent =
    a.length === estado.envios.length
      ? `${a.length} solicitudes`
      : `${a.length} de ${estado.envios.length} solicitudes`;
  const p = a.slice((pagina - 1) * n, pagina * n);
  tablaEnvios.innerHTML = p.length
    ? p
        .map(
          (e) =>
            `<tr><td><strong>${e.codigoGuia}</strong></td><td>${e.sucursalOrigen} → ${e.sucursalDestino}</td><td>${mod(e.modalidad)?.nombre || e.modalidad}</td><td>${moneda(e.tarifa?.total || 0)}</td><td><span class="estado">${nombreEstado(e.estado)}</span></td><td>${fechaLocal(e.fechaRegistro)}</td><td><div class="acciones"><button data-accion="detalle" data-guia="${e.codigoGuia}">Ver</button>${e.estado === "devuelto" ? `<button data-accion="reenviar" data-guia="${e.codigoGuia}">Reenviar</button>` : `<button data-accion="editar" data-guia="${e.codigoGuia}" ${e.estado !== "registrado" ? "disabled" : ""}>Editar</button>`}<button class="peligro" data-accion="eliminar" data-guia="${e.codigoGuia}" ${["en ruta", "entregado"].includes(e.estado) ? "disabled" : ""}>Eliminar</button></div></td></tr>`,
        )
        .join("")
    : '<tr><td colspan="7" class="vacio">No hay resultados.</td></tr>';
  informacionPaginaEnvios.textContent = pags
    ? `Pagina ${pagina} de ${pags}`
    : "Pagina 0 de 0";
  paginaAnteriorEnvios.disabled = pagina <= 1;
  paginaSiguienteEnvios.disabled = !pags || pagina >= pags;
  document
    .querySelectorAll(".orden-columna span")
    .forEach((s) => (s.textContent = ""));
  document.querySelector(
    `.orden-columna[data-orden="${orden.campo}"] span`,
  ).textContent = orden.direccion === "asc" ? "▲" : "▼";
}
function limpiarFiltros() {
  [
    buscarEnvio,
    filtroModalidadEnvio,
    filtroEstadoEnvio,
    filtroSucursalEnvio,
    filtroFechaDesde,
    filtroFechaHasta,
  ].forEach((x) => (x.value = ""));
  pagina = 1;
  renderEnvios();
}
function detalle(e) {
  guiaDetalle = e.codigoGuia;
  const cli = (id) =>
      estado.clientes.find((c) => c.id === id)?.nombre || "No disponible",
    rec = Object.values(e.tarifa?.recargos || {}).reduce((a, b) => a + b, 0);
  tituloDetalleEnvio.textContent = e.codigoGuia;
  contenidoDetalleEnvio.innerHTML = `<div class="detalle-envio-grid"><section class="detalle-envio-seccion"><h3>Personas</h3><p>Remitente: ${cli(e.clienteRemitente)}</p><p>Destinatario: ${cli(e.clienteDestinatario)}</p></section><section class="detalle-envio-seccion"><h3>Trayecto</h3><p>${suc(e.sucursalOrigen)?.nombre} → ${suc(e.sucursalDestino)?.nombre}</p><p>${e.distanciaKm} km</p></section><section class="detalle-envio-seccion"><h3>Paquete</h3><p>${e.contenido}</p><p>Peso real: ${e.pesoReal} kg</p><p>Peso volumetrico: ${e.pesoVolumetrico} kg</p><p>Peso facturable: ${e.pesoFacturable} kg</p><p>Largo × Ancho × Alto: ${e.dimensiones.largo} × ${e.dimensiones.ancho} × ${e.dimensiones.alto} cm</p>${e.envioOrigen?`<p>Guia original: <strong>${escapar(e.envioOrigen)}</strong></p>`:""}${estado.envios.find(x=>x.envioOrigen===e.codigoGuia)?`<p>Reenvio asociado: <strong>${escapar(estado.envios.find(x=>x.envioOrigen===e.codigoGuia).codigoGuia)}</strong></p>`:""}</section><section class="detalle-envio-seccion"><h3>Operacion</h3><p>${mod(e.modalidad)?.nombre}</p><p>${nombreEstado(e.estado)}</p><p>${e.emisionesKgCO2e} kg CO2e</p></section><section class="detalle-envio-seccion detalle-tarifa"><h3>Tarifa</h3><p>Base ${moneda(e.tarifa.base)} · Peso facturable ${moneda(e.tarifa.peso)} · Distancia ${moneda(e.tarifa.distancia)} · Recargos ${moneda(rec)} · Descuento ${moneda(e.tarifa.descuento)}</p><p><strong>Total ${moneda(e.tarifa.total)}</strong></p></section></div>`;
  dialogoEnvio.showModal();
  cerrarDetalleEnvio.focus();
}
