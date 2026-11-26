# Política ecológica de EcoRuta: RF-26 y RF-31

Este documento recoge, en el orden y el tono de un informe, las decisiones de diseño de dos requisitos que el enunciado deja a la política del equipo. Puede pegarse en el apartado «Decisiones técnicas» del documento escrito. Las referencias a archivos y a cifras corresponden a la v2.3.0.

## 1. Qué pide el enunciado

- **RF-26.** «Calcular el ahorro por consolidación: la diferencia entre despachar los envíos de la ruta por separado en furgoneta individual y despacharlos consolidados.»
- **RF-31.** «Aplicar el descuento ecológico a las modalidades de baja emisión y a los envíos consolidados, según la política que el equipo defina y justifique.»
- **RF-48.** Los indicadores ambientales deben mostrar las emisiones evitadas «por consolidación y por modalidad limpia».

## 2. Por qué cambió la v2.2.1

La v2.2.1 comparaba la suma de las emisiones de los envíos «por separado» con las de la ruta consolidada, ambas en el mismo vehículo. Eso se parece a lo que pide el enunciado, pero no mide la eficiencia de consolidar: no representa lo que ocurre si cada paquete sale por su cuenta. Además, el descuento ecológico solo reconocía a los vehículos limpios (bicicleta de carga y furgón eléctrico), como si la única forma de cuidar el ambiente fuera cambiar de vehículo. La retroalimentación del profesor señaló ambas cosas: consolidar una ruta ahorra recursos y genera eficiencia ecológica también con vehículos de combustión.

## 3. Política de RF-26: ahorro por consolidación

**Línea base.** Cada envío de la ruta viaja en su propia furgoneta (un viaje por paquete). **Alternativa consolidada.** Todos los envíos viajan juntos, en un solo viaje de la modalidad de la ruta.

```text
emisiones individuales  = Σ  km(i) × factor(furgoneta) × max(0,10; peso(i) / capacidad(furgoneta))
emisiones consolidadas  =    km(ruta) × factor(modalidad) × max(0,10; peso total / capacidad(modalidad))
ahorro                  = max(0; individuales − consolidadas)
ahorro %                = ahorro / individuales × 100
viajes evitados         = n.º de envíos − 1
km evitados             = Σ km(i) − km(ruta)
```

`km(ruta)` es la mayor distancia entre los envíos de la ruta (todos comparten destino). El mínimo de 0,10 de ocupación ya existía en la fórmula de emisiones de la aplicación: un vehículo que sale casi vacío sigue emitiendo.

**La furgoneta individual.** El catálogo no traía una furgoneta de combustión. En lugar de inventar un factor, `datos/datos.json` la declara en `referencias.furgonetaIndividual` reutilizando dos datos que ya estaban en el catálogo:

| Dato de la furgoneta | Valor | De dónde sale |
| --- | --- | --- |
| Factor de emisión | 0,09 | El del vehículo de combustión terrestre del catálogo (`consolidado`). |
| Capacidad | 800 kg | La de la furgoneta del catálogo (`electrico`). |

Es decir: una furgoneta del tamaño de la del catálogo, pero de combustión. Si el equipo consigue un factor propio con fuente citada (RN-14), solo debe editar esos dos números; el código no cambia. Si un catálogo anterior no trae la referencia, la aplicación usa el vehículo de la ruta como línea base (un viaje por envío) y sigue funcionando.

**Ejemplo con cifras del catálogo** (ruta de tres envíos de 300 kg a 100 km): tres furgonetas emiten 3 × 100 × 0,09 × 0,375 = 10,125 kg CO₂e; un solo camión con 900 kg emite 100 × 0,09 × 0,18 = 1,620 kg CO₂e. El ahorro es 8,505 kg CO₂e (84,0 %) y se evitan 2 viajes y 200 km.

**Dónde se ve.** En la tarjeta de cada ruta, en el aviso de confirmación del despacho y en la guía de despacho impresa. Al despachar, el resultado se guarda en la ruta (`consolidacion`) y el ahorro se reparte en partes iguales entre sus envíos (`emisionesEvitadasConsolidacionKgCO2e`), que alimenta el indicador «evitadas por consolidación» del panel (RF-48).

**Limitaciones declaradas.** Es una estimación: usa un solo factor por modalidad y un piso de ocupación fijo; no modela tráfico, carga de retorno ni consumo real. Con un solo envío no hay consolidación: las emisiones individuales y las consolidadas coinciden y el ahorro es 0. El ahorro nunca es negativo; si la modalidad de la ruta emitiera más que la furgoneta (por ejemplo, carga aérea), se informa 0 y no un valor negativo.

## 4. Política de RF-31: descuento ecológico

**Quién lo recibe.** Las modalidades de **baja emisión** (bicicleta de carga, furgón eléctrico) y la modalidad **consolidada** (camión consolidado). Se marca en el catálogo con `consolidada: true`; un catálogo anterior sin la marca se reconoce por el código `consolidado`.

**Cuánto.** El porcentaje de `tarifas.descuentoEcologico` (10 %) sobre el subtotal: `descuento = subtotal × 0,10`, y `total = subtotal + recargos − descuento`.

**Justificación.** Consolidar reduce los viajes y, con ellos, las emisiones por paquete aun con vehículos de combustión (RF-26 lo cuantifica). Reconocerlo en la tarifa alinea el precio con el objetivo ambiental: el cliente que acepta compartir viaje paga menos, y la empresa llena más sus camiones. La aérea, que no es limpia ni consolidada, no recibe descuento.

**Regla de no acumulación (RN-11).** Un envío urgente no recibe el descuento, sea cual sea su modalidad: se aplica el recargo por urgencia y el descuento vale 0. El desglose de la tarifa lo explica fila por fila.

**Efecto en los precios.** El camión consolidado cuesta un 10 % menos que en la v2.2.1. Ejemplo (5 kg, 20 km, desde San José Centro): subtotal ₡3 051; descuento ₡305; total ₡2 746. Los envíos ya registrados conservan la tarifa con la que se cobraron; su desglose lo indica.

## 5. Dónde está en el código

| Pieza | Archivo |
| --- | --- |
| `esConsolidada`, `aplicaDescuentoEcologico`, `motivoDescuento` | `js/reglas.js` |
| `calcularTarifa` (descuento) y `desgloseTarifa` (explicación) | `js/reglas.js` |
| `furgonetaIndividual`, `calcularConsolidacion` | `js/reglas.js` |
| Tarjeta de ruta, aviso y snapshot del despacho | `js/modulos/rutas.js` |
| Guía de despacho impresa | `js/plantillas.js` |
| Referencia y marca `consolidada` | `datos/datos.json` (validadas en `js/validaciones.js`) |
| Pruebas | `pruebas_matriz.mjs`, bloques `rf26`, `rf31` y `rn11` |
