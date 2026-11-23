export const moneda = (n) =>
  new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency: "CRC",
    maximumFractionDigits: 0,
  }).format(n);
export const pesoVolumetrico = (l, a, h, d) =>
  Number(((l * a * h) / d).toFixed(2));
export function modalidadesViables(c, p, o, dist) {
  return c.modalidades.filter(
    (m) =>
      o?.modalidades.includes(m.codigo) &&
      p.pesoFacturable <= m.capacidadKg &&
      (!m.maxDistanciaKm || dist <= m.maxDistanciaKm) &&
      (!m.minDistanciaKm || dist >= m.minDistanciaKm) &&
      !(
        m.codigo === "bicicleta" &&
        (p.pesoFacturable > c.reglas.bicicletaPesoMaxKg ||
          dist > c.reglas.bicicletaDistanciaMaxKm)
      ) &&
      !(p.contenido === "frio" && !m.refrigerada),
  );
}
export function calcularTarifa(c, o, p, d, m) {
  const base = o.tarifaBase,
    peso = p.pesoFacturable * c.tarifas.porKg,
    distancia = d * c.tarifas.porKm,
    subtotal = (base + peso + distancia) * m.factorTarifa;
  const recargos = {
    urgente: p.urgente ? subtotal * c.recargos.urgente : 0,
    fragil: p.contenido === "fragil" ? subtotal * c.recargos.fragil : 0,
    frio: p.contenido === "frio" ? subtotal * c.recargos.frio : 0,
    sobredimension: p.sobredimension ? subtotal * c.recargos.sobredimension : 0,
  };
  const descuento =
    m.bajaEmision && !p.urgente ? subtotal * c.tarifas.descuentoEcologico : 0;
  return {
    base,
    peso,
    distancia,
    subtotal,
    recargos,
    descuento,
    total: Math.round(
      subtotal + Object.values(recargos).reduce((a, b) => a + b, 0) - descuento,
    ),
  };
}
export function calcularEmisiones(d, p, m) {
  return Number(
    (d * m.factorEmision * Math.max(0.1, p / m.capacidadKg)).toFixed(3),
  );
}
