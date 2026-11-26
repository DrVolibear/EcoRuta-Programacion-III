// Reglas de negocio y cálculos del dominio.
// Todo lo exportado aquí son funciones puras: dependen solo de sus parámetros
// y no leen el DOM ni localStorage (requisito 7.3 del enunciado).

/* ---------- Estados del ciclo de vida (RF-34, RF-35, RN-08) ---------- */

export const ESTADOS = [
  "registrado",
  "en bodega",
  "asignado a ruta",
  "en ruta",
  "entregado",
  "devuelto",
];

// Baja lógica de un envío (RF-41). No es un estado del ciclo de vida: es un
// estado terminal que conserva la guía y el historial para auditoría (RN-07).
export const ESTADO_CANCELADO = "cancelado";

// Tabla explícita de transiciones válidas. Cualquier otra se rechaza.
export const TRANSICIONES = {
  registrado: ["en bodega", "devuelto"],
  "en bodega": ["devuelto"],
  "asignado a ruta": ["en bodega"],
  "en ruta": ["entregado", "devuelto"],
  entregado: [],
  devuelto: [],
  [ESTADO_CANCELADO]: [],
};

export const ESTADOS_ACTIVOS = ["registrado", "en bodega", "asignado a ruta", "en ruta"];
export const ESTADOS_HISTORICOS = ["entregado", "devuelto"];
// Paquetes que ocupan espacio físico o están bajo custodia (inventario operativo)
export const ESTADOS_INVENTARIO = ["en bodega", "asignado a ruta", "en ruta"];

/** RN-09: un envío en ruta o entregado no se edita ni se elimina. */
export const puedeCancelarse = (envio) =>
  !["en ruta", "entregado", ESTADO_CANCELADO].includes(envio.estado);

/** Agrupa un envío para los conteos: activo, histórico o cancelado. */
export const clasificarEnvio = (envio) =>
  envio.estado === ESTADO_CANCELADO
    ? "cancelado"
    : ESTADOS_HISTORICOS.includes(envio.estado)
      ? "historico"
      : "activo";

/* ---------- Dimensiones y peso (RF-04, RN-01, RN-03) ---------- */

// Tope físico absoluto por dimensión. Ya existía como max="300" en el formulario;
// se centraliza aquí. La regla institucional (dimensionMaxCm) sigue viniendo del catálogo.
export const DIMENSION_MAX_ABSOLUTA_CM = 300;

/** Peso volumétrico = largo × ancho × alto ÷ divisor del catálogo, con dos decimales. */
export const pesoVolumetrico = (largo, ancho, alto, divisor) =>
  Number(((largo * ancho * alto) / divisor).toFixed(2));

/** RN-03: una dimensión que supera el límite del catálogo requiere autorización. */
export const esSobredimensionado = (dimensiones, reglas) =>
  Object.values(dimensiones).some((valor) => valor > reglas.dimensionMaxCm);

/* ---------- Moneda (RF-33): única función de formato de toda la aplicación ---------- */

const formatoMoneda = new Intl.NumberFormat("es-CR", {
  style: "currency",
  currency: "CRC",
  maximumFractionDigits: 0,
});
/** Formato de colones (₡) con separador de miles. */
export const moneda = (monto) => formatoMoneda.format(monto);

/* ---------- Modalidades viables (RF-21, RN-04, RN-05, RN-06) ---------- */

/** Modalidades del catálogo que cumplen peso, distancia, origen, refrigeración y reglas de bicicleta/aéreo. */
export function modalidadesViables(catalogo, paquete, sucursalOrigen, distanciaKm) {
  const { reglas } = catalogo;
  return catalogo.modalidades.filter((m) => {
    if (!sucursalOrigen?.modalidades.includes(m.codigo)) return false;
    if (paquete.pesoFacturable > m.capacidadKg) return false;
    if (m.maxDistanciaKm && distanciaKm > m.maxDistanciaKm) return false;
    if (m.minDistanciaKm && distanciaKm < m.minDistanciaKm) return false;
    // RN-04: la bicicleta tiene un tope de peso y de distancia propios
    if (
      m.codigo === "bicicleta" &&
      (paquete.pesoFacturable > reglas.bicicletaPesoMaxKg ||
        distanciaKm > reglas.bicicletaDistanciaMaxKm)
    )
      return false;
    // RN-06: la cadena de frío exige una modalidad refrigerada
    if (paquete.contenido === "frio" && !m.refrigerada) return false;
    return true;
  });
}

/* ---------- Política ecológica (RF-31) ---------- */

/**
 * Una modalidad es «consolidada» cuando varios envíos comparten un mismo viaje.
 * El catálogo la marca con `consolidada: true`; los catálogos anteriores no traen
 * la marca, así que el camión consolidado se reconoce también por su código.
 */
export const esConsolidada = (modalidad) =>
  Boolean(modalidad) && (modalidad.consolidada === true || modalidad.codigo === "consolidado");

/**
 * Política de descuento ecológico (RF-31): lo reciben las modalidades de baja
 * emisión y las consolidadas. Consolidar reduce viajes y emisiones por paquete
 * aun con vehículos de combustión, así que merece el mismo reconocimiento.
 */
export const aplicaDescuentoEcologico = (modalidad) =>
  Boolean(modalidad) && (modalidad.bajaEmision === true || esConsolidada(modalidad));

/* ---------- Tarifa (RF-29 a RF-32, RN-11) ---------- */

/** (base + peso×tarifa/kg + km×tarifa/km) × factor de modalidad, más recargos y descuento ecológico. */
export function calcularTarifa(catalogo, sucursalOrigen, paquete, distanciaKm, modalidad) {
  const base = sucursalOrigen.tarifaBase;
  const peso = paquete.pesoFacturable * catalogo.tarifas.porKg;
  const distancia = distanciaKm * catalogo.tarifas.porKm;
  const subtotal = (base + peso + distancia) * modalidad.factorTarifa;
  const { recargos: pct } = catalogo;
  const recargos = {
    urgente: paquete.urgente ? subtotal * pct.urgente : 0,
    fragil: paquete.contenido === "fragil" ? subtotal * pct.fragil : 0,
    frio: paquete.contenido === "frio" ? subtotal * pct.frio : 0,
    sobredimension: paquete.sobredimension ? subtotal * pct.sobredimension : 0,
  };
  // RF-31: baja emisión o consolidada. RN-11: no se acumula con el recargo por urgencia
  const descuento =
    aplicaDescuentoEcologico(modalidad) && !paquete.urgente
      ? subtotal * catalogo.tarifas.descuentoEcologico
      : 0;
  const sumaRecargos = Object.values(recargos).reduce((a, b) => a + b, 0);
  return {
    base,
    peso,
    distancia,
    subtotal,
    recargos,
    descuento,
    total: Math.round(subtotal + sumaRecargos - descuento),
  };
}

/** Por qué una modalidad recibe el descuento ecológico (texto del desglose y de las comparaciones). */
export const motivoDescuento = (modalidad) =>
  modalidad?.bajaEmision
    ? "modalidad de baja emisión"
    : esConsolidada(modalidad)
      ? "modalidad consolidada: varios envíos comparten un viaje"
      : "descuento ecológico";

/**
 * Desglose por filas de una tarifa ya calculada (RF-32). Reconstruye el
 * porcentaje aplicado a partir de los montos guardados, de modo que las
 * guías antiguas se explican igual aunque el catálogo cambie.
 */
export function desgloseTarifa(catalogo, envio, modalidad) {
  const t = envio.tarifa;
  const porcentaje = (monto) => (t.subtotal > 0 ? Math.round((monto / t.subtotal) * 100) : 0);
  const ajuste = t.subtotal - (t.base + t.peso + t.distancia);
  const recargo = (clave, aplica, etiquetaNoAplica) => ({
    clave: `recargo-${clave}`,
    monto: t.recargos?.[clave] || 0,
    regla: aplica
      ? `${porcentaje(t.recargos[clave])} % del subtotal`
      : `No aplica: ${etiquetaNoAplica}`,
  });
  const descuentoAplicado = t.descuento > 0;
  return [
    {
      clave: "base",
      etiqueta: "Base",
      monto: t.base,
      regla: "Tarifa base de la sucursal de origen",
    },
    {
      clave: "peso",
      etiqueta: "Peso facturable",
      monto: t.peso,
      regla: `${envio.pesoFacturable} kg × ${moneda(catalogo.tarifas.porKg)} por kg`,
    },
    {
      clave: "distancia",
      etiqueta: "Distancia",
      monto: t.distancia,
      regla: `${envio.distanciaKm} km × ${moneda(catalogo.tarifas.porKm)} por km`,
    },
    {
      clave: "modalidad",
      etiqueta: "Ajuste por modalidad",
      monto: ajuste,
      regla: `Factor tarifario de ${modalidad?.nombre ?? envio.modalidad}: × ${modalidad?.factorTarifa ?? "?"}`,
    },
    {
      clave: "subtotal",
      etiqueta: "Subtotal",
      monto: t.subtotal,
      regla: "Suma de los componentes anteriores",
      tipo: "subtotal",
    },
    { etiqueta: "Recargo urgente", ...recargo("urgente", envio.urgente, "el envío no es urgente") },
    {
      etiqueta: "Recargo frágil",
      ...recargo("fragil", envio.contenido === "fragil", "el contenido no es frágil"),
    },
    {
      etiqueta: "Recargo frío",
      ...recargo("frio", envio.contenido === "frio", "no requiere cadena de frío"),
    },
    {
      etiqueta: "Recargo sobredimensión",
      ...recargo("sobredimension", envio.sobredimension, "dimensiones dentro del límite"),
    },
    {
      clave: "descuento",
      etiqueta: "Descuento ecológico",
      monto: -t.descuento,
      regla: descuentoAplicado
        ? `${porcentaje(t.descuento)} % del subtotal (${motivoDescuento(modalidad)})`
        : envio.urgente
          ? "No aplica: no se acumula con el recargo por urgencia (RN-11)"
          : aplicaDescuentoEcologico(modalidad)
            ? "No aplica: guía registrada antes de extender el descuento a modalidades consolidadas"
            : "No aplica: la modalidad no es de baja emisión ni consolidada",
      tipo: "descuento",
    },
    {
      clave: "total",
      etiqueta: "Total",
      monto: t.total,
      regla: "Subtotal + recargos − descuento, redondeado",
      tipo: "total",
    },
  ];
}

/* ---------- Emisiones y consolidación (RF-26, RF-48) ---------- */

/** kg CO₂e = km × factor de emisión × proporción de la capacidad usada (mínimo 10 %). */
export const calcularEmisiones = (distanciaKm, pesoKg, modalidad) =>
  Number(
    (distanciaKm * modalidad.factorEmision * Math.max(0.1, pesoKg / modalidad.capacidadKg)).toFixed(
      3,
    ),
  );

/**
 * Emisiones evitadas por usar una modalidad más limpia que la convencional
 * (el camión consolidado del catálogo hace de referencia). Nunca es negativa.
 */
export function emisionesEvitadasLimpias(catalogo, distanciaKm, pesoKg, emisiones) {
  const referencia = catalogo.modalidades.find((m) => m.codigo === "consolidado");
  const base = referencia ? calcularEmisiones(distanciaKm, pesoKg, referencia) : emisiones;
  return Number(Math.max(0, base - emisiones).toFixed(3));
}

/**
 * Línea base de RF-26: la «furgoneta individual». El catálogo la declara en
 * `referencias.furgonetaIndividual`; si falta (catálogo anterior), se usa el
 * propio vehículo de la ruta, un viaje por envío.
 */
export function furgonetaIndividual(catalogo, modalidadRuta) {
  const ref = catalogo?.referencias?.furgonetaIndividual;
  if (ref && ref.factorEmision > 0 && ref.capacidadKg > 0)
    return {
      nombre: ref.nombre ?? "Furgoneta individual",
      factorEmision: ref.factorEmision,
      capacidadKg: ref.capacidadKg,
    };
  return modalidadRuta;
}

/**
 * Ahorro por consolidación (RF-26): diferencia entre despachar cada envío de la
 * ruta en su propia furgoneta (un viaje por envío) y despacharlos todos en un
 * solo viaje de la modalidad de la ruta. Se informa también en viajes y km
 * evitados. Nunca es negativo, y con menos de dos envíos es cero.
 */
export function calcularConsolidacion(envios, modalidad, referencia = modalidad) {
  const cantidad = envios.length;
  const peso = envios.reduce((suma, e) => suma + (e.pesoFacturable || 0), 0);
  const distancia = Math.max(0, ...envios.map((e) => e.distanciaKm || 0));
  const kmIndividuales = envios.reduce((suma, e) => suma + (e.distanciaKm || 0), 0);
  const consolidadas = cantidad && modalidad ? calcularEmisiones(distancia, peso, modalidad) : 0;
  // Con un solo envío no hay nada que consolidar: el viaje es el mismo y el ahorro es cero.
  const individuales =
    cantidad < 2
      ? consolidadas
      : referencia
        ? envios.reduce(
            (suma, e) =>
              suma + calcularEmisiones(e.distanciaKm || 0, e.pesoFacturable || 0, referencia),
            0,
          )
        : 0;
  const ahorro = Math.max(0, individuales - consolidadas);
  return {
    peso,
    cantidad,
    emisionesIndividuales: Number(individuales.toFixed(3)),
    emisionesConsolidadas: consolidadas,
    ahorro: Number(ahorro.toFixed(3)),
    ahorroPorcentaje: individuales > 0 ? Number(((ahorro / individuales) * 100).toFixed(1)) : 0,
    viajesIndividuales: cantidad,
    viajesConsolidados: cantidad ? 1 : 0,
    viajesEvitados: Math.max(0, cantidad - 1),
    kmEvitados: Math.max(0, kmIndividuales - distancia),
  };
}

/* ---------- Retención en bodega (RF-44, RF-45, RN-06, RN-13) ---------- */

const MS_POR_DIA = 86_400_000;

/** Días completos transcurridos desde el ingreso físico a bodega (o el registro). */
export function diasEnBodega(envio, ahora = Date.now()) {
  const inicio = new Date(envio.fechaIngresoBodega || envio.fechaRegistro).getTime();
  return Math.max(0, Math.floor((ahora - inicio) / MS_POR_DIA));
}

/** Plazo máximo: uno especial para cadena de frío y uno normal para el resto. */
export const limiteRetencionDias = (envio, configuracion) =>
  envio.contenido === "frio" ? (configuracion.diasRetencionFrio ?? 1) : configuracion.diasRetencion;

/**
 * Un envío está retenido cuando está en bodega y excede su plazo máximo.
 * No es un estado guardado: es una condición calculada.
 */
export const esRetenido = (envio, configuracion, ahora = Date.now()) =>
  envio.estado === "en bodega" &&
  diasEnBodega(envio, ahora) > limiteRetencionDias(envio, configuracion);

/** "1 día", "2 días" (nunca "día(s)"). */
export const textoDias = (n) => `${n} ${n === 1 ? "día" : "días"}`;
