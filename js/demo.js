// Generador de datos de demostración (RF-57).
// Todo se calcula con las mismas funciones que usa la aplicación (tarifa, emisiones,
// consolidación) y con el catálogo cargado de datos.json; no hay montos ni capacidades
// escritos a mano. Los datos son deterministas: el mismo catálogo genera lo mismo.
import { estadoInicial } from "./persistencia.js";
import { obtenerDistancia } from "./catalogo.js";
import { ahoraLocalMinutos, normalizarTexto } from "./utilidades.js";
import {
  ESTADO_CANCELADO,
  pesoVolumetrico,
  esSobredimensionado,
  modalidadesViables,
  calcularTarifa,
  calcularEmisiones,
  calcularConsolidacion,
  emisionesEvitadasLimpias,
  furgonetaIndividual,
} from "./reglas.js";

const HORA = 3_600_000;
const DIA = 24 * HORA;
const PROVINCIAS = [
  "San José",
  "Alajuela",
  "Cartago",
  "Heredia",
  "Guanacaste",
  "Puntarenas",
  "Limón",
];
const NOMBRES = [
  "Ana Solano",
  "Luis Vargas",
  "María Rojas",
  "Carlos Mora",
  "Elena Jiménez",
  "Diego Araya",
  "Sofía Castro",
  "Andrés Quesada",
  "Laura Chaves",
  "Jorge Campos",
  "Valeria Soto",
  "Mateo Salas",
  "Daniela Cordero",
  "Fernando Brenes",
  "Paola Umaña",
];
// Paquetes de ejemplo: algunos pesan más por volumen que por balanza (RN-01)
const PATRONES = [
  { peso: 4.5, dim: [30, 25, 20] },
  { peso: 12, dim: [40, 30, 30] },
  { peso: 2.2, dim: [20, 15, 10] },
  { peso: 18, dim: [60, 40, 30] },
  { peso: 7.5, dim: [35, 35, 25] },
  { peso: 22, dim: [50, 50, 40] },
  { peso: 3, dim: [80, 60, 50] },
  { peso: 9, dim: [45, 30, 25] },
];
const CONTENIDOS = ["general", "fragil", "frio"];

// Recorridos válidos según la tabla de transiciones
const REGISTRADO = ["registrado"];
const EN_BODEGA = ["registrado", "en bodega"];
const ASIGNADO = [...EN_BODEGA, "asignado a ruta"];
const EN_RUTA = [...ASIGNADO, "en ruta"];
const ENTREGADO = [...EN_RUTA, "entregado"];
const DEVUELTO_EN_RUTA = [...EN_RUTA, "devuelto"];
const DEVUELTO_EN_BODEGA = [...EN_BODEGA, "devuelto"];

/** Genera 15 clientes, 43 envíos en todos los estados y 5 rutas coherentes entre sí, usando solo datos del catálogo. */
export function generarDemo(catalogo) {
  const ahora = Date.now();
  const d = estadoInicial();
  const { sucursales } = catalogo;
  const consolidado = catalogo.modalidades.find((m) => m.codigo === "consolidado");
  const provinciaDe = (s) =>
    PROVINCIAS.find((p) => normalizarTexto(p) === normalizarTexto(s.provincia)) ?? PROVINCIAS[0];

  /* ---------- Clientes: 15, de los cuales uno inactivo y uno cancelado ---------- */
  d.clientes = NOMBRES.map((nombre, i) => {
    const estadoCliente = i === 12 ? "inactivo" : i === 14 ? "cancelado" : "activo";
    return {
      id: `CLI-DEMO-${i + 1}`,
      identificacion: `1-${String(1000 + i * 37).padStart(4, "0")}-${String(2000 + i * 53).padStart(4, "0")}`,
      nombre,
      telefono: `${8000 + i * 37}-${1000 + i * 13}`,
      correo: `${normalizarTexto(nombre).replace(/\s+/g, ".")}@demo.cr`,
      direccion: `Calle ${i + 1}, 100 m norte de la sucursal`,
      codigoPostal: String(10101 + i * 111),
      provincia: provinciaDe(sucursales[i % sucursales.length]),
      estado: estadoCliente,
      activo: estadoCliente === "activo",
      fechaRegistro: new Date(ahora - (30 + i) * DIA).toISOString(),
      ...(estadoCliente === "cancelado"
        ? {
            estadoAnterior: "activo",
            fechaCancelacion: new Date(ahora - 3 * DIA).toISOString(),
            motivoCancelacion: "Cliente dado de baja a su solicitud (demostración)",
          }
        : {}),
    };
  });
  const vigentes = d.clientes.filter((c) => c.estado === "activo");

  /* ---------- Envíos ---------- */
  let n = 0;
  const guias = {};

  /**
   * Crea un envío completo y coherente: modalidad viable, tarifa, emisiones e historial
   * que respetan el recorrido de estados indicado.
   */
  function crearEnvio({
    origen,
    destino,
    recorrido,
    registroHace,
    ingresoHace = 0,
    ruta = null,
    modalidad: forzada = null,
    patron = n,
    contenido,
    urgente = n % 7 === 0,
    envioOrigen = null,
    motivo = "Solicitud duplicada (demostración)",
    autorizacion = null,
  }) {
    n += 1;
    const codigoGuia = `ENV-${new Date().getFullYear()}-${String(n).padStart(5, "0")}`;
    const o = sucursales.find((s) => s.codigo === origen);
    const distancia = obtenerDistancia(catalogo, origen, destino);
    const base = PATRONES[patron % PATRONES.length];
    const dimensiones = autorizacion
      ? { largo: 210, ancho: 40, alto: 30 }
      : { largo: base.dim[0], ancho: base.dim[1], alto: base.dim[2] };
    const pv = pesoVolumetrico(
      dimensiones.largo,
      dimensiones.ancho,
      dimensiones.alto,
      catalogo.reglas.divisorVolumetrico,
    );
    const paquete = {
      pesoReal: base.peso,
      pesoVolumetrico: pv,
      pesoFacturable: Math.max(base.peso, pv),
      dimensiones,
      contenido: contenido ?? CONTENIDOS[n % CONTENIDOS.length],
      urgente,
      sobredimension: esSobredimensionado(dimensiones, catalogo.reglas),
      autorizacionSobredimension: autorizacion
        ? { autorizada: true, responsable: autorizacion }
        : null,
    };
    // Las opciones viables, de menor a mayor emisión (como en la comparación del Registro)
    const opciones = modalidadesViables(catalogo, paquete, o, distancia)
      .map((m) => ({ m, emisiones: calcularEmisiones(distancia, paquete.pesoFacturable, m) }))
      .sort((a, b) => a.emisiones - b.emisiones);
    const menor = opciones[0];
    const elegida =
      opciones.find((x) => x.m.codigo === forzada) ??
      (n % 5 === 3 && opciones.length > 1 ? opciones[1] : menor);

    const t0 = ahora - registroHace;
    const ingreso = ahora - ingresoHace;
    const posBodega = recorrido.indexOf("en bodega");
    const restantes = recorrido.length - 1 - posBodega;
    const tiempoDe = (k) =>
      k === 0
        ? t0
        : posBodega < 0
          ? t0 + (k / (recorrido.length - 1)) * Math.max(0, registroHace - 10 * 60_000)
          : k === posBodega
            ? ingreso
            : ingreso +
              ((k - posBodega) / Math.max(1, restantes)) * Math.max(0, ingresoHace - 10 * 60_000);
    const detalleDe = (estadoPaso) =>
      ({
        registrado: envioOrigen
          ? `Reenvío creado desde ${envioOrigen}`
          : "Solicitud registrada (demostración)",
        "en bodega": "Paquete recibido físicamente en bodega",
        "asignado a ruta": `Asignado a ${ruta}`,
        "en ruta": `Salida en ${ruta}`,
        entregado: "Entrega confirmada al destinatario",
        devuelto: "Devuelto al remitente",
        [ESTADO_CANCELADO]: `Cancelado: ${motivo}`,
      })[estadoPaso];

    const historial = recorrido.map((paso, k) => ({
      estadoAnterior: k === 0 ? null : recorrido[k - 1],
      estado: paso,
      fecha: new Date(tiempoDe(k)).toISOString(),
      detalle: detalleDe(paso),
    }));
    const final = recorrido.at(-1);
    const i = n - 1;
    const envio = {
      codigoGuia,
      clienteRemitente: vigentes[i % vigentes.length].id,
      clienteDestinatario: vigentes[(i + 5) % vigentes.length].id,
      sucursalOrigen: origen,
      sucursalDestino: destino,
      ...paquete,
      distanciaKm: distancia,
      modalidad: elegida.m.codigo,
      tarifa: calcularTarifa(catalogo, o, paquete, distancia, elegida.m),
      emisionesKgCO2e: elegida.emisiones,
      emisionesEvitadasLimpiasKgCO2e: emisionesEvitadasLimpias(
        catalogo,
        distancia,
        paquete.pesoFacturable,
        elegida.emisiones,
      ),
      emisionesEvitadasConsolidacionKgCO2e: 0,
      modalidadMenorEmision: menor.m.codigo,
      eligioMenorEmision: elegida === menor,
      estado: final,
      rutaAsignada: final === ESTADO_CANCELADO ? null : ruta,
      envioOrigen,
      fechaIngresoBodega: posBodega >= 0 ? new Date(ingreso).toISOString() : null,
      historial,
      fechaRegistro: new Date(t0).toISOString(),
    };
    if (final === ESTADO_CANCELADO) {
      envio.estadoAnterior = recorrido.at(-2);
      envio.fechaCancelacion = historial.at(-1).fecha;
      envio.motivoCancelacion = motivo;
    }
    d.envios.push(envio);
    guias[codigoGuia] = envio;
    return envio;
  }

  // Sucursal de origen que rota para que haya variedad de trayectos
  const origenPara = (k, destino) => {
    const candidatas = sucursales.filter((s) => s.codigo !== destino);
    return candidatas[k % candidatas.length].codigo;
  };
  const destinoNo = (origen, k) => {
    const candidatas = sucursales.filter((s) => s.codigo !== origen);
    return candidatas[(k * 3 + 1) % candidatas.length].codigo;
  };

  /* ---------- Rutas con sus envíos (todos con el mismo destino y modalidad) ---------- */
  const modalidadRuta = consolidado.codigo;
  const grupos = [
    // Despachadas: incluyen envíos ya entregados o devueltos desde ese viaje
    {
      destino: sucursales[0].codigo,
      estado: "en ruta",
      salida: -5 * DIA,
      envios: [ENTREGADO, ENTREGADO, ENTREGADO, ENTREGADO, EN_RUTA, EN_RUTA],
    },
    {
      destino: sucursales[3].codigo,
      estado: "en ruta",
      salida: -1 * DIA,
      envios: [ENTREGADO, EN_RUTA, EN_RUTA, EN_RUTA, DEVUELTO_EN_RUTA],
    },
    // Abiertas: algunos envíos asignados y otros en bodega que aún pueden asignarse
    {
      destino: sucursales[2].codigo,
      estado: "abierta",
      salida: 1 * DIA,
      envios: [ASIGNADO, ASIGNADO, ASIGNADO],
      disponibles: 2,
    },
    {
      destino: sucursales[4].codigo,
      estado: "abierta",
      salida: 2 * DIA,
      envios: [ASIGNADO, ASIGNADO],
      disponibles: 1,
    },
    {
      destino: sucursales[5].codigo,
      estado: "abierta",
      salida: 3 * DIA,
      envios: [],
      disponibles: 1,
    },
  ];
  grupos.forEach((g, r) => {
    const codigo = `RUTA-${new Date().getFullYear()}-${String(r + 1).padStart(4, "0")}`;
    const creados = g.envios.map((recorrido, k) =>
      crearEnvio({
        origen: origenPara(r + k, g.destino),
        destino: g.destino,
        recorrido,
        registroHace: (14 - r * 2 - k) * DIA,
        ingresoHace: recorrido.includes("en ruta") ? (12 - r * 2 - k) * DIA : 1.5 * DIA - k * HORA,
        ruta: codigo,
        modalidad: modalidadRuta,
      }),
    );
    // Envíos en bodega compatibles (mismo destino y modalidad) que todavía no se asignan
    for (let k = 0; k < (g.disponibles ?? 0); k++) {
      crearEnvio({
        origen: origenPara(r + k + 3, g.destino),
        destino: g.destino,
        recorrido: EN_BODEGA,
        registroHace: 2 * DIA + k * HORA,
        ingresoHace: 1 * DIA - k * HORA,
        modalidad: modalidadRuta,
      });
    }
    const ruta = {
      codigo,
      sucursalDestino: g.destino,
      modalidad: modalidadRuta,
      fechaSalida: ahoraLocalMinutos(g.salida),
      capacidadPeso: 1000,
      capacidadCantidad: 10,
      envios: creados.map((e) => e.codigoGuia),
      estado: g.estado,
      emisionesTotales: 0,
      ahorroConsolidacion: 0,
      fechaCreacion: new Date(ahora - 15 * DIA).toISOString(),
    };
    if (g.estado === "en ruta") {
      const c = calcularConsolidacion(
        creados,
        consolidado,
        furgonetaIndividual(catalogo, consolidado),
      );
      ruta.emisionesTotales = c.emisionesConsolidadas;
      ruta.ahorroConsolidacion = c.ahorro;
      ruta.consolidacion = {
        emisionesIndividuales: c.emisionesIndividuales,
        emisionesConsolidadas: c.emisionesConsolidadas,
        ahorro: c.ahorro,
        ahorroPorcentaje: c.ahorroPorcentaje,
        viajesIndividuales: c.viajesIndividuales,
        viajesConsolidados: c.viajesConsolidados,
        viajesEvitados: c.viajesEvitados,
        kmEvitados: c.kmEvitados,
      };
      ruta.fechaSalidaReal = new Date(ahora + g.salida).toISOString();
      creados.forEach((e) => {
        e.emisionesEvitadasConsolidacionKgCO2e = Number((c.ahorro / creados.length).toFixed(3));
      });
    }
    d.rutas.push(ruta);
  });
  d.contadorRuta = grupos.length + 1;

  /* ---------- Envíos sueltos: bodega (con retenidos), registrados, devueltos, cancelados ---------- */
  // En bodega: los tres primeros superan los 3 días permitidos; el cuarto es cadena de frío (1 día)
  const enBodega = [
    { ingresoHace: 6 * DIA },
    { ingresoHace: 5 * DIA },
    { ingresoHace: 4.2 * DIA },
    { ingresoHace: 2.2 * DIA, contenido: "frio" },
    { ingresoHace: 2 * DIA },
    { ingresoHace: 1 * DIA },
    { ingresoHace: 5 * HORA },
    { ingresoHace: 3 * HORA, contenido: "frio" },
  ];
  enBodega.forEach((b, k) => {
    const destino = destinoNo(sucursales[k % sucursales.length].codigo, k);
    crearEnvio({
      origen: sucursales[k % sucursales.length].codigo,
      destino,
      recorrido: EN_BODEGA,
      registroHace: b.ingresoHace + 2 * HORA,
      ingresoHace: b.ingresoHace,
      contenido: b.contenido,
    });
  });

  // Uno con sobredimensión autorizada y responsable registrado (RN-03)
  crearEnvio({
    origen: sucursales[0].codigo,
    destino: sucursales[6].codigo,
    recorrido: EN_BODEGA,
    registroHace: 20 * HORA,
    ingresoHace: 18 * HORA,
    contenido: "general",
    modalidad: "consolidado",
    autorizacion: "Marta Rojas Quesada",
  });

  // Devueltos antes de salir; el primero ya tiene su reenvío
  const devueltos = [0, 1].map((k) =>
    crearEnvio({
      origen: sucursales[k + 1].codigo,
      destino: destinoNo(sucursales[k + 1].codigo, k + 2),
      recorrido: DEVUELTO_EN_BODEGA,
      registroHace: (9 + k) * DIA,
      ingresoHace: (8 + k) * DIA,
    }),
  );
  crearEnvio({
    origen: devueltos[0].sucursalOrigen,
    destino: devueltos[0].sucursalDestino,
    recorrido: REGISTRADO,
    registroHace: 1 * DIA,
    envioOrigen: devueltos[0].codigoGuia,
    patron: 1,
    contenido: devueltos[0].contenido,
  });

  // Registrados, pendientes de recepción física
  for (let k = 0; k < 9; k++) {
    const origen = sucursales[(k + 2) % sucursales.length].codigo;
    crearEnvio({
      origen,
      destino: destinoNo(origen, k + 4),
      recorrido: REGISTRADO,
      registroHace: (k % 4) * DIA + (k + 1) * HORA,
    });
  }

  // Dos cancelados: se conservan para auditoría
  crearEnvio({
    origen: sucursales[1].codigo,
    destino: sucursales[2].codigo,
    recorrido: [...REGISTRADO, ESTADO_CANCELADO],
    registroHace: 4 * DIA,
    motivo: "El cliente pidió anular la solicitud antes de entregar el paquete",
  });
  crearEnvio({
    origen: sucursales[3].codigo,
    destino: sucursales[0].codigo,
    recorrido: [...EN_BODEGA, ESTADO_CANCELADO],
    registroHace: 6 * DIA,
    ingresoHace: 5.5 * DIA,
    motivo: "Datos del destinatario incorrectos; se registrará una solicitud nueva",
  });

  d.contadorGuia = n + 1;
  return d;
}
