import { validarCatalogo } from "./validaciones.js";
let cache=null;
export async function cargarCatalogo(){
  try{
    const r=await fetch("./datos/datos.json",{cache:"no-store"});
    if(!r.ok) throw Error(`HTTP ${r.status}`);
    cache=validarCatalogo(await r.json());
    localStorage.setItem("ecoruta_catalogo_cache",JSON.stringify(cache));
    return cache;
  }catch(e){
    const guardado=localStorage.getItem("ecoruta_catalogo_cache");
    if(guardado){try{return validarCatalogo(JSON.parse(guardado))}catch(cacheError){throw Error(`No fue posible cargar el catalogo. Red: ${e.message}. Cache: ${cacheError.message}`)}}
    throw Error(`No fue posible cargar el catalogo: ${e.message}`);
  }
}
export function obtenerDistancia(c,o,d){if(o===d)return 0;const n=c.distancias[o]?.[d];if(typeof n!=="number"||n<=0)throw Error(`No existe una distancia valida entre ${o} y ${d}`);return n}
