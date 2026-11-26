// Simulación para el informe: usa las funciones puras reales de js/reglas.js y el catálogo real.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { tmp, raizPorDefecto } from "./lib.mjs";
const RAIZ = process.env.RAIZ || raizPorDefecto();
const R = await import(pathToFileURL(path.resolve(RAIZ, "js/reglas.js")).href);
const cat = JSON.parse(fs.readFileSync(path.join(RAIZ, "datos/datos.json"), "utf8"));
const suc = (c) => cat.sucursales.find((s) => s.codigo === c);
const dist = (a, b) => cat.distancias[a][b];

function cotizar(nombre, { origen, destino, pesoReal, dim, contenido = "general", urgente = false }) {
  const d = dist(origen, destino);
  const vol = R.pesoVolumetrico(dim.largo, dim.ancho, dim.alto, cat.reglas.divisorVolumetrico);
  const fact = Math.max(pesoReal, vol);
  const sobre = R.esSobredimensionado(dim, cat.reglas);
  const paquete = { pesoFacturable: fact, contenido, urgente, sobredimension: sobre };
  const viables = R.modalidadesViables(cat, paquete, suc(origen), d);
  const filas = viables.map((m) => {
    const t = R.calcularTarifa(cat, suc(origen), paquete, d, m);
    return { modalidad: m.nombre, codigo: m.codigo, tarifa: t.total, subtotal: Math.round(t.subtotal), recargos: Math.round(Object.values(t.recargos).reduce((a, b) => a + b, 0)), descuento: Math.round(t.descuento), emisiones: R.calcularEmisiones(d, fact, m), horas: +(d / m.velocidadKmH).toFixed(1), desc: R.aplicaDescuentoEcologico(m) };
  });
  const noViables = cat.modalidades.filter((m) => !viables.includes(m)).map((m) => m.nombre);
  return { nombre, origen, destino, distancia: d, pesoReal, volumetrico: vol, facturable: fact, sobre, contenido, urgente, filas, noViables };
}
const salida = {};
salida.A = cotizar("A", { origen: "SJO-01", destino: "LIM-01", pesoReal: 12.5, dim: { largo: 40, ancho: 30, alto: 25 } });
salida.B = cotizar("B", { origen: "SJO-01", destino: "LIM-01", pesoReal: 12.5, dim: { largo: 40, ancho: 30, alto: 25 }, urgente: true });
salida.C = cotizar("C", { origen: "SJO-01", destino: "ALA-01", pesoReal: 8, dim: { largo: 30, ancho: 20, alto: 20 }, contenido: "frio" });
salida.D = cotizar("D", { origen: "HER-01", destino: "SJO-01", pesoReal: 3, dim: { largo: 50, ancho: 40, alto: 30 } });
salida.E = cotizar("E", { origen: "CAR-01", destino: "LIM-01", pesoReal: 30, dim: { largo: 220, ancho: 40, alto: 30 }, contenido: "fragil" });
// Desglose completo de A con consolidado
{
  const a = salida.A, m = cat.modalidades.find((x) => x.codigo === "consolidado");
  const t = R.calcularTarifa(cat, suc("SJO-01"), { pesoFacturable: a.facturable, contenido: "general", urgente: false, sobredimension: false }, a.distancia, m);
  salida.desgloseA = t;
}
// Consolidación
const env = (peso, km) => ({ pesoFacturable: peso, distanciaKm: km });
const camion = cat.modalidades.find((x) => x.codigo === "consolidado");
const ref = R.furgonetaIndividual(cat, camion);
salida.consol1 = { descripcion: "3 envíos de 300 kg, 100 km (SJO-01 a PUN-01)", resultado: R.calcularConsolidacion([env(300, 100), env(300, 100), env(300, 100)], camion, ref) };
salida.consol2 = { descripcion: "6 envíos a Limón (SJO-01 → LIM-01, 160 km), 40 a 120 kg", resultado: R.calcularConsolidacion([env(40, 160), env(55, 160), env(80, 160), env(120, 160), env(95, 160), env(60, 160)], camion, ref) };
salida.consol3 = { descripcion: "1 envío de 300 kg, 100 km (sin consolidar)", resultado: R.calcularConsolidacion([env(300, 100)], camion, ref) };
salida.referencia = ref;
fs.writeFileSync(tmp("simulacion.json"), JSON.stringify(salida, null, 1));
for (const k of ["A", "B", "C", "D", "E"]) { const s = salida[k]; console.log(`\n== ${k}: ${s.origen}->${s.destino} ${s.distancia} km, real ${s.pesoReal}, vol ${s.volumetrico}, fact ${s.facturable}, ${s.contenido}${s.urgente ? ", urgente" : ""}${s.sobre ? ", sobredim." : ""}`); console.table(s.filas); console.log("no viables:", s.noViables.join(", ")); }
console.log(JSON.stringify(salida.desgloseA)); for (const k of ["consol1", "consol2", "consol3"]) console.log(salida[k].descripcion, JSON.stringify(salida[k].resultado));
