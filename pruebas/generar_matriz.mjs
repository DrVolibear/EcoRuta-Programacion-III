// Genera docs/MATRIZ_CUMPLIMIENTO.md a partir de matriz.mjs y de los resultados reales de las pruebas.
// Uso: node generar_matriz.mjs [carpeta-del-proyecto]
import fs from "node:fs";
import path from "node:path";
import { FILAS } from "./matriz.mjs";

const RAIZ = process.argv[2] || path.resolve(import.meta.dirname, "..", fs.existsSync(path.resolve(import.meta.dirname, "../EcoRuta_v2.3.0")) ? "EcoRuta_v2.3.0" : "proyecto");
const leerJSON = (f) => JSON.parse(fs.readFileSync(path.join(import.meta.dirname, f), "utf8"));
const aceptacion = leerJSON("resultados_pruebas.json"); // P01–P14, E01–E06
const porRequisito = leerJSON("resultados_matriz.json"); // [etiqueta] …

// Etiquetas que se resuelven contra las pruebas de aceptación del encargo (pruebas_v221.mjs)
const ALIAS = {
  f1: /^P0[12] /, f3: /^P04 /, p8: /^P12 /, p9: /^P08 /, p10: /^P09 /, p15: /^E01 /, p31: /^P10 /,
  rf37: /^E01 /, rf41: /^P08 /, rf44: /^P04 .*días/, rf54: /^E03 /,
  print: /^P13 /, dirigida: /^E02 7\.3/, peso: /^E05 la aplicación pesa/,
};
const resolver = (etiqueta) => {
  const propias = porRequisito.filter((r) => r.nombre.startsWith(`[${etiqueta}] `));
  const alias = ALIAS[etiqueta] ? aceptacion.filter((r) => ALIAS[etiqueta].test(r.nombre)) : [];
  return [...propias, ...alias];
};

// Requisitos que no se pueden comprobar con una prueba automática: veredicto final razonado
const MANUAL = {
  "RN-14": ["Parcial (informe)", "El documento escrito (sección 8.2) cita las fuentes (GLEC 3.1 y los factores del IMN) con su fecha de consulta, pero los cuatro factores de `datos.json` son parámetros indicativos que no se derivan de ellas con un cálculo trazable; la diferencia de escala se declara en la sección 8.4. Para cerrarlo, recalibrar los factores en `datos.json` con un consumo medido por vehículo."],
  "7.1-i": ["No verificable aquí", "No hay acceso al validador del W3C sin red. Se hizo una revisión estructural propia (etiquetas cerradas y anidadas, ids únicos, `for`/`id`, sin atributos obsoletos). Validar `index.html` en validator.w3.org antes de entregar."],
  "7.4-g": ["Cumple (revisión manual)", "Funciones, variables y archivos están en español y siguen el mismo criterio (`calcularTarifa`, `esRetenido`, `sucursalOrigen`, …)."],
  "8-a": ["Cumple con diferencias documentadas", "Las cuatro entidades existen con todos sus atributos; algunos nombres difieren del ejemplo (p. ej. `pesoReal` y no `pesoRealKg`) y se conservaron para no romper los datos guardados. Correspondencia completa en `docs/MODELO_DATOS.md`."],
  "OE-9": ["No verificable desde el código", "Ramas, pull requests revisados, commits repartidos y bitácora dependen del repositorio Git del equipo. El README trae la plantilla de bitácora."],
  "OE-10": ["Parcial (documentos)", "El manual de usuario ya está hecho (`docs/MANUAL_DE_USUARIO.docx`, `.pdf` y `.md`, con capturas en `docs/manual/`). El informe técnico en Word (APA 7) está en `docs/`. Siguen fuera del código: la presentación, las bitácoras firmadas y la defensa oral."],
};

const ESTADO = { C: "Cumple", P: "Cumple parcialmente", N: "No cumple" };
const esc = (t) => String(t).replace(/\|/g, "\\|").replace(/\n/g, " ");
const corto = (t, n = 95) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

const filas = [];
const sinPrueba = [];
for (const [id, requisito, modulo, ini, cambio, prueba] of FILAS) {
  let evidencia, pruebaTexto, veredicto;
  if (prueba.startsWith("t:")) {
    const etiquetas = prueba.slice(2).split(",");
    const rs = etiquetas.flatMap(resolver);
    const faltan = etiquetas.filter((e) => resolver(e).length === 0);
    if (faltan.length) sinPrueba.push(`${id}: ${faltan.join(",")}`);
    const ok = rs.filter((r) => r.ok).length;
    veredicto = rs.length && ok === rs.length ? "Cumple" : "FALLA";
    const nombres = [...new Set(rs.map((r) => r.nombre.replace(/^\[[^\]]+\] /, "")))];
    pruebaTexto = `${etiquetas.map((e) => `\`${e}\``).join(" ")} · ${corto(nombres[0] ?? "—")}${nombres.length > 1 ? ` (+${nombres.length - 1})` : ""}`;
    evidencia = `${veredicto === "Cumple" ? "✅" : "❌"} ${veredicto} · ${ok}/${rs.length} comprobaciones`;
  } else {
    const [v, detalle] = MANUAL[id] ?? ["Sin evaluar", ""];
    veredicto = v;
    pruebaTexto = "Revisión manual / documental";
    evidencia = `${/^Cumple/.test(v) ? "✅" : "⚠️"} ${v}. ${detalle}`;
  }
  filas.push({ id, requisito, modulo, ini: ESTADO[ini], cambio, pruebaTexto, evidencia, veredicto, ini0: ini });
}

const cuenta = (f) => filas.filter(f).length;
const total = filas.length;
const automatizadas = filas.filter((f) => !f.pruebaTexto.startsWith("Revisión"));
const cumple = cuenta((f) => f.veredicto === "Cumple" || /^Cumple/.test(f.veredicto));
const pendientes = filas.filter((f) => !(f.veredicto === "Cumple" || /^Cumple/.test(f.veredicto)));
const falla = cuenta((f) => f.veredicto === "FALLA");

const grupos = {};
for (const r of aceptacion) {
  const g = r.nombre.match(/^([PE]\d\d) /)?.[1];
  if (!g) continue;
  (grupos[g] ??= { ok: 0, n: 0, ejemplo: r.nombre.slice(4) });
  grupos[g].n++;
  if (r.ok) grupos[g].ok++;
}
const resMatriz = { ok: porRequisito.filter((r) => r.ok).length, n: porRequisito.length };
const resAcept = { ok: aceptacion.filter((r) => r.ok).length, n: aceptacion.length };

let md = `# Matriz de cumplimiento del enunciado · EcoRuta v2.3.0

Cada fila es un requisito del enunciado (RF, RN, 7.x, 8 y entregables). «**Estado actual**» es el estado **antes** de este trabajo, comprobado sobre los archivos de la v2.2.0. «**Evidencia final**» es el resultado de las pruebas ejecutadas sobre la v2.3.0 (que incorpora, además, la política de consolidación de RF-26 y RF-31 acordada con el profesor).

Los objetivos específicos **OE-1 a OE-8** se evalúan a través de los requisitos que los concretan (7.1 a 7.4, RF-48, RF-49 y RN-14); OE-9 y OE-10 son entregables y se listan aparte.

## Resumen

| | Cantidad |
| --- | --- |
| Requisitos evaluados | ${total} |
| Estado actual (v2.2.0): Cumple | ${cuenta((f) => f.ini0 === "C")} |
| Estado actual (v2.2.0): Cumple parcialmente | ${cuenta((f) => f.ini0 === "P")} |
| Estado actual (v2.2.0): No cumple | ${cuenta((f) => f.ini0 === "N")} |
| **Con evidencia final de cumplimiento (v2.3.0)** | **${cumple}** |
| Con prueba automática y todas sus comprobaciones correctas | ${automatizadas.length - falla} de ${automatizadas.length} |
| Pendientes o no verificables sin decisión del equipo / documentos | ${pendientes.length} |
| Pruebas automáticas por requisito (\`pruebas_matriz.mjs\`) | ${resMatriz.ok}/${resMatriz.n} correctas |
| Pruebas de aceptación del encargo (\`pruebas_v221.mjs\`) | ${resAcept.ok}/${resAcept.n} correctas |

> Un requisito **no** se declara cumplido sin evidencia. Los ${pendientes.length} que quedan abiertos (tabla al final) dependen de una decisión del equipo, de un documento o de un servicio externo; no se resolvieron inventando datos.

## Cómo reproducir

Las pruebas viven en la carpeta \`pruebas/\` (no son parte de la aplicación) y usan Playwright con Chromium, instalados aparte:

\`\`\`bash
node pruebas/pruebas_v221.mjs   .   # aceptación del encargo
node pruebas/pruebas_matriz.mjs .   # una o más comprobaciones por requisito
node pruebas/humo.mjs           .   # prueba de humo
node pruebas/generar_matriz.mjs .   # regenera este documento
\`\`\`

La etiqueta de la columna «Prueba» (\`rf01\`, \`css\`, \`f1\`…) es el prefijo \`[etiqueta]\` de las comprobaciones en \`pruebas_matriz.mjs\`; las etiquetas \`f1\`, \`f3\`, \`p8\`… remiten a los grupos P01–P14 y E01–E06 de \`pruebas_v221.mjs\`.

## Matriz

| N.º | Requisito textual | Archivo / módulo | Estado actual (v2.2.0) | Cambio requerido | Prueba de aceptación | Evidencia final |
| --- | --- | --- | --- | --- | --- | --- |
`;
for (const f of filas) md += `| ${f.id} | ${esc(f.requisito)} | ${esc(f.modulo)} | ${f.ini} | ${esc(f.cambio)} | ${esc(f.pruebaTexto)} | ${esc(f.evidencia)} |\n`;

md += `
## Pruebas de aceptación del encargo (puntos 1–31)

| Grupo | Comprobaciones | Resultado | Primera comprobación |
| --- | --- | --- | --- |
`;
for (const [g, x] of Object.entries(grupos)) md += `| ${g} | ${x.n} | ${x.ok === x.n ? "✅" : "❌"} ${x.ok}/${x.n} | ${esc(corto(x.ejemplo, 90))} |\n`;

md += `
## Requisitos abiertos o no verificables

| N.º | Situación | Qué falta |
| --- | --- | --- |
`;
for (const f of pendientes) md += `| ${f.id} | ${esc(f.veredicto)} | ${esc(f.evidencia.replace(/^[^ ]+ [^.]+\. ?/, ""))} |\n`;

md += `
## Decisiones que el equipo debe conocer

1. **\`cancelado\` es un séptimo estado terminal.** RF-34 enumera seis estados; RF-41 exige eliminar con motivo y RN-07 que la guía no se reutilice. La baja lógica (\`estado: "cancelado"\` + motivo, fecha y estado anterior) cumple ambas; no forma parte del ciclo de vida y las transiciones lo tratan como estado final.
2. **\`DIMENSION_MAX_ABSOLUTA_CM = 300\`** (tope físico por dimensión) está en \`reglas.js\` porque ya existía como \`max="300"\` en el formulario. El límite institucional (200 cm) sigue saliendo de \`datos.json\`. Si el profesor lo prefiere, puede moverse al catálogo.
3. **Nombres de atributos**: se conservaron los de la v2.2.0 para no romper los datos guardados; la correspondencia con el ejemplo del enunciado está en \`docs/MODELO_DATOS.md\`.
4. **RF-26 (ahorro por consolidación).** La línea base es una «furgoneta individual» por envío (un viaje por paquete) frente a un solo viaje consolidado. El catálogo no traía esa referencia, así que se declaró en \`datos.json\` (\`referencias.furgonetaIndividual\`) **reutilizando datos que ya estaban allí**: el factor de emisión del vehículo de combustión terrestre (\`consolidado\`, 0,09) y la capacidad de la furgoneta del catálogo (\`electrico\`, 800 kg). La app informa kg CO₂e, porcentaje, viajes y km evitados. Si el equipo consigue un factor propio con fuente (RN-14), basta con editar esos dos números.
5. **RF-31 (descuento ecológico).** Reciben el descuento (10 % del subtotal, \`descuentoEcologico\`) las modalidades de **baja emisión** y la **consolidada** (marca \`consolidada: true\` en \`datos.json\`), porque consolidar reduce viajes y emisiones por paquete aun con vehículos de combustión. Sigue sin acumularse con el recargo por urgencia (RN-11). Efecto: el camión consolidado cuesta 10 % menos que antes.
6. **Cambios en \`datos/datos.json\`**: solo se agregaron dos campos opcionales (\`consolidada\` y \`referencias.furgonetaIndividual\`). Las tarifas, capacidades, sucursales, distancias, recargos y reglas institucionales no cambiaron. Un catálogo anterior sin esos campos sigue funcionando (el camión consolidado se reconoce por su código y el ahorro usa el vehículo de la ruta como línea base).
7. **Sin cambios en**: la clave de \`localStorage\` (\`ecoruta_estado_v5\`) ni en el formato de las guías ya guardadas; los envíos registrados antes de este cambio conservan la tarifa con la que se cobraron.
`;

fs.mkdirSync(path.join(RAIZ, "docs"), { recursive: true });
fs.writeFileSync(path.join(RAIZ, "docs/MATRIZ_CUMPLIMIENTO.md"), md);
console.log(`filas: ${total} · cumplen: ${cumple} · pendientes: ${pendientes.length} · fallan: ${falla}`);
if (sinPrueba.length) console.log("SIN PRUEBA RESUELTA:", sinPrueba.join(" | "));
process.exit(falla || sinPrueba.length ? 1 : 0);
