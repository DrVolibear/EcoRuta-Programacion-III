export const ESTADOS_VALIDOS = ["registrado","en bodega","asignado a ruta","en ruta","entregado","devuelto","cancelado"];
const esNumero = (v) => typeof v === "number" && Number.isFinite(v);
const unico = (lista) => new Set(lista).size === lista.length;
export function validarCatalogo(c){
  const error=(m)=>{throw new Error(`Catalogo invalido: ${m}`)};
  if(!c||typeof c!=="object"||Array.isArray(c)) error("la raiz debe ser un objeto");
  for(const campo of ["sucursales","distancias","modalidades","tarifas","recargos","reglas"]) if(!(campo in c)) error(`falta ${campo}`);
  if(!Array.isArray(c.sucursales)||!c.sucursales.length) error("sucursales debe ser un arreglo no vacio");
  if(!Array.isArray(c.modalidades)||!c.modalidades.length) error("modalidades debe ser un arreglo no vacio");
  const codS=c.sucursales.map(s=>s.codigo),codM=c.modalidades.map(m=>m.codigo);
  if(!unico(codS)) error("hay codigos de sucursal duplicados");
  if(!unico(codM)) error("hay codigos de modalidad duplicados");
  c.modalidades.forEach((m,i)=>{
    for(const k of ["codigo","nombre"]) if(typeof m[k]!=="string"||!m[k].trim()) error(`modalidades[${i}].${k} debe ser texto no vacio`);
    for(const k of ["capacidadKg","velocidadKmH","factorEmision","factorTarifa"]) if(!esNumero(m[k])||m[k]<=0) error(`modalidades[${i}].${k} debe ser numero mayor que cero`);
    for(const k of ["minDistanciaKm","maxDistanciaKm"]) if(m[k]!==undefined&&(!esNumero(m[k])||m[k]<0)) error(`modalidades[${i}].${k} debe ser numero no negativo`);
    for(const k of ["bajaEmision","refrigerada"]) if(typeof m[k]!=="boolean") error(`modalidades[${i}].${k} debe ser booleano`);
  });
  c.sucursales.forEach((s,i)=>{
    for(const k of ["codigo","nombre","provincia"]) if(typeof s[k]!=="string"||!s[k].trim()) error(`sucursales[${i}].${k} debe ser texto no vacio`);
    for(const k of ["capacidadKg","tarifaBase"]) if(!esNumero(s[k])||s[k]<=0) error(`sucursales[${i}].${k} debe ser numero mayor que cero`);
    if(!Array.isArray(s.modalidades)||!s.modalidades.length) error(`sucursales[${i}].modalidades debe ser arreglo no vacio`);
    s.modalidades.forEach(m=>{if(!codM.includes(m)) error(`${s.codigo}.modalidades referencia ${m}, que no existe`)});
  });
  codS.forEach(o=>{
    if(!c.distancias[o]||typeof c.distancias[o]!=="object") error(`distancias.${o} no existe`);
    codS.filter(d=>d!==o).forEach(d=>{
      const v=c.distancias[o][d]; if(!esNumero(v)||v<=0) error(`distancias.${o}.${d} debe ser numero mayor que cero`);
      const inversa=c.distancias[d]?.[o]; if(esNumero(inversa)&&inversa!==v) error(`distancia ${o}-${d} no es simetrica`);
    });
  });
  for(const [grupo,campos] of Object.entries({tarifas:["porKg","porKm","descuentoEcologico"],recargos:["urgente","fragil","frio","sobredimension"],reglas:["pesoMinKg","pesoMaxKg","dimensionMaxCm","divisorVolumetrico","bicicletaPesoMaxKg","bicicletaDistanciaMaxKm","aereoDistanciaMinKm"]})) campos.forEach(k=>{if(!esNumero(c[grupo][k])||c[grupo][k]<0) error(`${grupo}.${k} debe ser numero no negativo`)});
  if(c.reglas.pesoMinKg>=c.reglas.pesoMaxKg) error("reglas.pesoMinKg debe ser menor que pesoMaxKg");
  return c;
}
export function validarRespaldo(d){
  if(!d||typeof d!=="object"||Array.isArray(d)) throw Error("El respaldo no es un objeto JSON");
  for(const k of ["clientes","envios","rutas","configuracion"]) if(!(k in d)) throw Error(`El respaldo no contiene ${k}`);
  if(![d.clientes,d.envios,d.rutas].every(Array.isArray)) throw Error("Clientes, envios y rutas deben ser arreglos");
  const ids=d.clientes.map(c=>String(c.identificacion||"").replace(/[^a-z0-9]/gi,"").toLowerCase());
  if(ids.some(x=>!x)||!unico(ids)) throw Error("Las identificaciones de clientes deben existir y ser unicas");
  const guias=d.envios.map(e=>e.codigoGuia); if(guias.some(x=>!x)||!unico(guias)) throw Error("Las guias deben existir y ser unicas");
  d.envios.forEach((e,i)=>{if(!ESTADOS_VALIDOS.includes(e.estado)) throw Error(`envios[${i}].estado no es valido`);if(!Array.isArray(e.historial)) throw Error(`envios[${i}].historial debe ser arreglo`)});
  const rutas=new Set(d.rutas.map(r=>r.codigo)); const asignadas=new Set();
  d.rutas.forEach((r,i)=>{if(!r.codigo||!Array.isArray(r.envios)) throw Error(`rutas[${i}] es invalida`);if(!unico(r.envios)) throw Error(`${r.codigo} contiene guias duplicadas`);r.envios.forEach(g=>{if(!guias.includes(g)) throw Error(`${r.codigo} referencia la guia inexistente ${g}`);if(r.estado==="abierta"&&asignadas.has(g)) throw Error(`${g} aparece en dos rutas abiertas`);if(r.estado==="abierta") asignadas.add(g)})});
  d.envios.forEach(e=>{if(e.rutaAsignada&&!rutas.has(e.rutaAsignada)) throw Error(`${e.codigoGuia} referencia una ruta inexistente`)});
  if(!Number.isInteger(+d.contadorGuia)||+d.contadorGuia<1||!Number.isInteger(+d.contadorRuta)||+d.contadorRuta<1) throw Error("Los contadores deben ser enteros positivos");
  return d;
}
export function validarEnvioFormulario(datos,reglas){
  const errores=[];
  if(!datos.remitente||!datos.destinatario) errores.push("Seleccione remitente y destinatario.");
  if(datos.remitente===datos.destinatario) errores.push("El remitente y el destinatario deben ser clientes diferentes.");
  if(!datos.origen||!datos.destino) errores.push("Seleccione origen y destino.");
  if(datos.origen===datos.destino) errores.push("La sucursal de origen y destino deben ser diferentes.");
  if(!Number.isFinite(datos.pesoReal)||datos.pesoReal<reglas.pesoMinKg||datos.pesoReal>reglas.pesoMaxKg) errores.push(`El peso debe estar entre ${reglas.pesoMinKg} y ${reglas.pesoMaxKg} kg.`);
  for(const k of ["largo","ancho","alto"]){const v=datos[k];if(!Number.isInteger(v)||v<1||v>reglas.dimensionMaxCm) errores.push(`${k} debe ser un entero entre 1 y ${reglas.dimensionMaxCm} cm.`);}
    if(datos.sobredimensionMarcada && !String(datos.responsableAutorizacion||"").trim()) errores.push("Indique el responsable que autorizo la sobredimension.");
  return errores;
}
