export const $=(selector,raiz=document)=>raiz.querySelector(selector);
export const $$=(selector,raiz=document)=>[...raiz.querySelectorAll(selector)];
export const escapar=(valor="")=>String(valor).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
export const fechaLocal=fecha=>fecha?new Date(fecha).toLocaleString("es-CR"):"No disponible";
export const diasDesde=fecha=>Math.max(0,Math.floor((Date.now()-new Date(fecha).getTime())/86400000));
export const normalizarTexto=texto=>String(texto??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
export const descargarJSON=(nombre,datos)=>{const url=URL.createObjectURL(new Blob([JSON.stringify(datos,null,2)],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download=nombre;a.click();URL.revokeObjectURL(url)};
export const bytesLocalStorage=()=>Object.keys(localStorage).reduce((total,clave)=>total+((clave.length+(localStorage.getItem(clave)?.length||0))*2),0);
