import { descargarJSON } from "./utilidades.js";
import { validarRespaldo } from "./validaciones.js";
const CLAVE="ecoruta_estado_v5"; export const VERSION=5;
export function estadoInicial(){return{version:VERSION,contadorGuia:1,contadorRuta:1,clientes:[],envios:[],enviosEliminados:[],rutas:[],configuracion:{tema:"automatico",umbralOcupacion:80,diasRetencion:3,diasRetencionFrio:1}}}
const unicas=(a=[])=>[...new Set(a.filter(Boolean))];
export function normalizarEstado(d={}){
 const b=estadoInicial(),envios=Array.isArray(d.envios)?d.envios.map(e=>({...e,envioOrigen:e.envioOrigen||null,rutaAsignada:e.rutaAsignada||null,historial:Array.isArray(e.historial)?e.historial:[]})):[];
 const guiaMap=new Map(envios.map(e=>[e.codigoGuia,e]));
 const rutas=Array.isArray(d.rutas)?d.rutas.map(r=>({...r,envios:unicas(r.envios).filter(g=>guiaMap.has(g))})):[];
 rutas.filter(r=>r.estado==="abierta").forEach(r=>r.envios=r.envios.filter(g=>{const e=guiaMap.get(g);return e?.estado==="asignado a ruta"&&e.rutaAsignada===r.codigo}));
 return{...b,...d,version:VERSION,clientes:Array.isArray(d.clientes)?d.clientes:[],envios,enviosEliminados:Array.isArray(d.enviosEliminados)?d.enviosEliminados:[],rutas,configuracion:{...b.configuracion,...d.configuracion}};
}
export function cargarEstado(){try{for(const clave of [CLAVE,"ecoruta_estado_v4","ecoruta_estado_v3","ecoruta_estado_v2","ecoruta_estado_v1"]){const t=localStorage.getItem(clave);if(t)return normalizarEstado(JSON.parse(t))}return estadoInicial()}catch(e){console.warn("Estado corrupto; se recupero el estado inicial",e);return estadoInicial()}}
export function guardarEstado(e){try{localStorage.setItem(CLAVE,JSON.stringify(normalizarEstado(e)));return true}catch(error){console.error("No se pudo guardar",error);return false}}
export function reemplazarEstado(destino,nuevo){const n=normalizarEstado(validarRespaldo(nuevo));Object.keys(destino).forEach(k=>delete destino[k]);Object.assign(destino,n);if(!guardarEstado(destino))throw Error("No hay espacio suficiente para guardar el respaldo")}
export const exportarEstado=e=>descargarJSON(`ecoruta-respaldo-${new Date().toISOString().slice(0,10)}.json`,normalizarEstado(e));
