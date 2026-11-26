// Validaciones programáticas: estructura del catálogo, respaldos y reglas de negocio
// que las restricciones nativas de HTML5 no pueden conocer (validación en dos niveles).
import {
  ESTADOS,
  ESTADO_CANCELADO,
  DIMENSION_MAX_ABSOLUTA_CM,
  esSobredimensionado,
} from "./reglas.js";

export const ESTADOS_VALIDOS = [...ESTADOS, ESTADO_CANCELADO];

const esNumero = (v) => typeof v === "number" && Number.isFinite(v);
const sinDuplicados = (lista) => new Set(lista).size === lista.length;

/* ---------- Catálogo (RF-18) ---------- */

/** Revisa la estructura del catálogo y lanza un error que nombra el campo que falla (RF-18). */
export function validarCatalogo(c) {
  const fallar = (mensaje) => {
    throw new Error(`Catálogo inválido: ${mensaje}`);
  };
  if (!c || typeof c !== "object" || Array.isArray(c)) fallar("la raíz debe ser un objeto");
  for (const campo of [
    "sucursales",
    "distancias",
    "modalidades",
    "tarifas",
    "recargos",
    "reglas",
  ]) {
    if (!(campo in c)) fallar(`falta ${campo}`);
  }
  if (!Array.isArray(c.sucursales) || !c.sucursales.length)
    fallar("sucursales debe ser un arreglo no vacío");
  if (!Array.isArray(c.modalidades) || !c.modalidades.length)
    fallar("modalidades debe ser un arreglo no vacío");

  const codigosSucursal = c.sucursales.map((s) => s.codigo);
  const codigosModalidad = c.modalidades.map((m) => m.codigo);
  if (!sinDuplicados(codigosSucursal)) fallar("hay códigos de sucursal duplicados");
  if (!sinDuplicados(codigosModalidad)) fallar("hay códigos de modalidad duplicados");

  c.modalidades.forEach((m, i) => {
    for (const k of ["codigo", "nombre"])
      if (typeof m[k] !== "string" || !m[k].trim())
        fallar(`modalidades[${i}].${k} debe ser texto no vacío`);
    for (const k of ["capacidadKg", "velocidadKmH", "factorEmision", "factorTarifa"])
      if (!esNumero(m[k]) || m[k] <= 0)
        fallar(`modalidades[${i}].${k} debe ser un número mayor que cero`);
    for (const k of ["minDistanciaKm", "maxDistanciaKm"])
      if (m[k] !== undefined && (!esNumero(m[k]) || m[k] < 0))
        fallar(`modalidades[${i}].${k} debe ser un número no negativo`);
    for (const k of ["bajaEmision", "refrigerada"])
      if (typeof m[k] !== "boolean") fallar(`modalidades[${i}].${k} debe ser booleano`);
    // RF-31: marca opcional de modalidad consolidada (catálogos anteriores no la traen)
    if (m.consolidada !== undefined && typeof m.consolidada !== "boolean")
      fallar(`modalidades[${i}].consolidada debe ser booleano`);
  });

  // RF-26: referencia opcional de «furgoneta individual» (línea base del ahorro por consolidación)
  const furgoneta = c.referencias?.furgonetaIndividual;
  if (furgoneta !== undefined) {
    for (const k of ["factorEmision", "capacidadKg"])
      if (!esNumero(furgoneta[k]) || furgoneta[k] <= 0)
        fallar(`referencias.furgonetaIndividual.${k} debe ser un número mayor que cero`);
  }

  c.sucursales.forEach((s, i) => {
    for (const k of ["codigo", "nombre", "provincia"])
      if (typeof s[k] !== "string" || !s[k].trim())
        fallar(`sucursales[${i}].${k} debe ser texto no vacío`);
    for (const k of ["capacidadKg", "tarifaBase"])
      if (!esNumero(s[k]) || s[k] <= 0)
        fallar(`sucursales[${i}].${k} debe ser un número mayor que cero`);
    if (!Array.isArray(s.modalidades) || !s.modalidades.length)
      fallar(`sucursales[${i}].modalidades debe ser un arreglo no vacío`);
    s.modalidades.forEach((m) => {
      if (!codigosModalidad.includes(m))
        fallar(`${s.codigo}.modalidades referencia ${m}, que no existe`);
    });
  });

  codigosSucursal.forEach((origen) => {
    if (!c.distancias[origen] || typeof c.distancias[origen] !== "object")
      fallar(`distancias.${origen} no existe`);
    codigosSucursal
      .filter((destino) => destino !== origen)
      .forEach((destino) => {
        const km = c.distancias[origen][destino];
        if (!esNumero(km) || km <= 0)
          fallar(`distancias.${origen}.${destino} debe ser un número mayor que cero`);
        const inversa = c.distancias[destino]?.[origen];
        if (esNumero(inversa) && inversa !== km)
          fallar(`la distancia ${origen}-${destino} no es simétrica`);
      });
  });

  const gruposNumericos = {
    tarifas: ["porKg", "porKm", "descuentoEcologico"],
    recargos: ["urgente", "fragil", "frio", "sobredimension"],
    reglas: [
      "pesoMinKg",
      "pesoMaxKg",
      "dimensionMaxCm",
      "divisorVolumetrico",
      "bicicletaPesoMaxKg",
      "bicicletaDistanciaMaxKm",
      "aereoDistanciaMinKm",
    ],
  };
  for (const [grupo, campos] of Object.entries(gruposNumericos)) {
    campos.forEach((k) => {
      if (!esNumero(c[grupo][k]) || c[grupo][k] < 0)
        fallar(`${grupo}.${k} debe ser un número no negativo`);
    });
  }
  if (c.reglas.pesoMinKg >= c.reglas.pesoMaxKg)
    fallar("reglas.pesoMinKg debe ser menor que pesoMaxKg");
  return c;
}

/* ---------- Respaldo importado (RF-56) ---------- */

/** Revisa un respaldo importado antes de reemplazar los datos. */
export function validarRespaldo(d) {
  if (!d || typeof d !== "object" || Array.isArray(d))
    throw Error("El respaldo no es un objeto JSON");
  for (const k of ["clientes", "envios", "rutas", "configuracion"])
    if (!(k in d)) throw Error(`El respaldo no contiene ${k}`);
  if (![d.clientes, d.envios, d.rutas].every(Array.isArray))
    throw Error("Clientes, envíos y rutas deben ser arreglos");

  const identificaciones = d.clientes.map((c) =>
    String(c.identificacion || "")
      .replace(/[^a-z0-9]/gi, "")
      .toLowerCase(),
  );
  if (identificaciones.some((x) => !x) || !sinDuplicados(identificaciones))
    throw Error("Las identificaciones de clientes deben existir y ser únicas");

  const guias = d.envios.map((e) => e.codigoGuia);
  if (guias.some((x) => !x) || !sinDuplicados(guias))
    throw Error("Las guías deben existir y ser únicas");
  d.envios.forEach((e, i) => {
    if (!ESTADOS_VALIDOS.includes(e.estado)) throw Error(`envios[${i}].estado no es válido`);
    if (!Array.isArray(e.historial)) throw Error(`envios[${i}].historial debe ser un arreglo`);
  });

  const codigosRuta = new Set(d.rutas.map((r) => r.codigo));
  const asignadas = new Set();
  d.rutas.forEach((r, i) => {
    if (!r.codigo || !Array.isArray(r.envios)) throw Error(`rutas[${i}] es inválida`);
    if (!sinDuplicados(r.envios)) throw Error(`${r.codigo} contiene guías duplicadas`);
    r.envios.forEach((guia) => {
      if (!guias.includes(guia)) throw Error(`${r.codigo} referencia la guía inexistente ${guia}`);
      if (r.estado === "abierta") {
        if (asignadas.has(guia)) throw Error(`${guia} aparece en dos rutas abiertas`);
        asignadas.add(guia);
      }
    });
  });
  d.envios.forEach((e) => {
    if (e.rutaAsignada && !codigosRuta.has(e.rutaAsignada))
      throw Error(`${e.codigoGuia} referencia una ruta inexistente`);
  });
  if (
    !Number.isInteger(+d.contadorGuia) ||
    +d.contadorGuia < 1 ||
    !Number.isInteger(+d.contadorRuta) ||
    +d.contadorRuta < 1
  )
    throw Error("Los contadores deben ser enteros positivos");
  return d;
}

/* ---------- Solicitud de envío (RF-07, RN-02, RN-03) ---------- */

/**
 * Valida las reglas de negocio de una solicitud. Devuelve una lista de
 * { campo, mensaje }: cada error indica qué regla falló y en qué campo (RF-07).
 */
export function validarEnvioFormulario(datos, reglas) {
  const errores = [];
  const error = (campo, mensaje) => errores.push({ campo, mensaje });

  if (!datos.remitente) error("remitente", "Seleccione el remitente.");
  if (!datos.destinatario) error("destinatario", "Seleccione el destinatario.");
  if (datos.remitente && datos.remitente === datos.destinatario)
    error("destinatario", "El remitente y el destinatario deben ser clientes diferentes.");

  if (!datos.origen) error("origen", "Seleccione la sucursal de origen.");
  if (!datos.destino) error("destino", "Seleccione la sucursal de destino.");
  if (datos.origen && datos.origen === datos.destino)
    error("destino", "La sucursal de origen y la de destino deben ser diferentes.");

  if (!Number.isFinite(datos.pesoReal) || datos.pesoReal < reglas.pesoMinKg)
    error("peso", `El peso mínimo es ${reglas.pesoMinKg} kg.`);
  else if (datos.pesoReal > reglas.pesoMaxKg)
    error("peso", `El peso máximo es ${reglas.pesoMaxKg} kg.`);

  for (const [campo, etiqueta] of [
    ["largo", "Largo"],
    ["ancho", "Ancho"],
    ["alto", "Alto"],
  ]) {
    const valor = datos[campo];
    if (!Number.isInteger(valor) || valor < 1)
      error(campo, `${etiqueta}: use un número entero, mínimo 1 cm.`);
    else if (valor > DIMENSION_MAX_ABSOLUTA_CM)
      error(campo, `${etiqueta}: no puede superar ${DIMENSION_MAX_ABSOLUTA_CM} cm.`);
  }

  // RN-03: sobre el límite del catálogo se exige autorización
  const dimensiones = { largo: datos.largo, ancho: datos.ancho, alto: datos.alto };
  if (esSobredimensionado(dimensiones, reglas) && !datos.sobredimensionMarcada)
    error(
      "autorizacionSobredimension",
      `Una dimensión supera ${reglas.dimensionMaxCm} cm: marque Sobredimensión autorizada e indique el responsable.`,
    );

  // Si la casilla está marcada, el responsable es obligatorio y no puede ser solo espacios
  if (datos.sobredimensionMarcada && !String(datos.responsableAutorizacion ?? "").trim())
    error("responsableAutorizacion", "Indique el responsable que autorizó la sobredimensión.");

  return errores;
}
