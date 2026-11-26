# Verificación de contraste WCAG 2.1 de los tokens de color de css/estilos.css
def lum(h):
    h=h.lstrip('#'); r,g,b=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    f=lambda c: c/12.92 if c<=0.03928 else ((c+0.055)/1.055)**2.4
    return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b)
def ratio(a,b):
    la,lb=lum(a),lum(b); 
    if la<lb: la,lb=lb,la
    return (la+0.05)/(lb+0.05)
import re,sys,os
# Los colores se leen del propio css/estilos.css (no están copiados a mano): si un token cambia, esta verificación lo ve.
raiz=sys.argv[1] if len(sys.argv)>1 else os.path.join(os.path.dirname(os.path.abspath(__file__)),'..')
css=open(os.path.join(raiz,'css','estilos.css'),encoding='utf8').read()
css=re.sub(r'/\*[\s\S]*?\*/','',css)
def tokens(bloque):
    return dict(re.findall(r'--([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;',bloque))
bloques=re.findall(r':root([^{]*)\{([^}]*)\}',css)
base=tokens(next(b for sel,b in bloques if sel.strip()==''))
oscuro_t=tokens(next(b for sel,b in bloques if 'data-tema="oscuro"' in sel))
CLAVES=dict(verde='verde',verde_osc='verde-oscuro',fondo='fondo',sup='superficie',sup2='superficie-2',texto='texto',suave='suave',borde_campo='borde-campo',foco='foco',peligro='peligro',peligro_t='peligro-texto',exito='exito',ret_f='retenida-fondo',ret_b='retenida-borde',ret_t='retenida-texto',canc='cancelada-fondo',al_f='alerta-fondo',al_t='alerta-texto',er_f='error-fondo',s1='serie-1',s2='serie-2',s3='serie-3',s4='serie-4',rec='recomendada')
claro={k:base[v] for k,v in CLAVES.items()}
oscuro={k:{**base,**oscuro_t}[v] for k,v in CLAVES.items()}
def pares(t):
    return [
     ("texto / superficie",t["texto"],t["sup"],4.5),("texto / fondo",t["texto"],t["fondo"],4.5),("texto / superficie-2",t["texto"],t["sup2"],4.5),
     ("suave / superficie",t["suave"],t["sup"],4.5),("suave / fondo",t["suave"],t["fondo"],4.5),("suave / superficie-2",t["suave"],t["sup2"],4.5),("suave / fila cancelada",t["suave"],t["canc"],4.5),
     ("verde (enlaces, etiquetas) / superficie",t["verde"],t["sup"],4.5),("verde / fondo",t["verde"],t["fondo"],4.5),
     ("blanco / botón (verde-oscuro)","#ffffff",t["verde_osc"],4.5),("blanco / botón peligro","#ffffff",t["peligro"],4.5),
     ("texto de error / superficie",t["peligro_t"],t["sup"],4.5),("texto de error / fondo de error",t["peligro_t"],t["er_f"],4.5),
     ("fila retenida: texto / fondo",t["texto"],t["ret_f"],4.5),("«Retenido» / fondo retenido",t["ret_t"],t["ret_f"],4.5),
     ("alerta: texto / fondo",t["al_t"],t["al_f"],4.5),("exito / superficie",t["exito"],t["sup"],4.5),("superficie / etiqueta «Menor emisión»",t["sup"],t["exito"],4.5),
     ("texto / opción recomendada",t["texto"],t["rec"],4.5),
     ("borde de campo / superficie (no texto)",t["borde_campo"],t["sup"],3.0),("anillo de foco / superficie (no texto)",t["foco"],t["sup"],3.0),("anillo de foco / fondo (no texto)",t["foco"],t["fondo"],3.0),
     ("borde de fila retenida / fondo (no texto)",t["ret_b"],t["ret_f"],3.0),
     ("serie 1 / superficie (gráfico)",t["s1"],t["sup"],3.0),("serie 2 / superficie (gráfico)",t["s2"],t["sup"],3.0),("serie 3 / superficie (gráfico)",t["s3"],t["sup"],3.0),("serie 4 / superficie (gráfico)",t["s4"],t["sup"],3.0),
    ]
fallos=0
for nombre,t in (("CLARO",claro),("OSCURO",oscuro)):
    print("==",nombre)
    for n,a,b,m in pares(t):
        r=ratio(a,b); ok=r>=m; fallos+=not ok
        print(f"  {'OK   ' if ok else 'FALLA'} {r:5.2f}:1 (mín {m}) {n}")
# píldoras de estado y avisos (colores fijos en los dos temas)
P=lambda n:base[n]
for n,f,bg in [("registrado","est-registrado-texto","est-registrado-fondo"),("en bodega","est-bodega-texto","est-bodega-fondo"),("asignado a ruta","est-asignado-texto","est-asignado-fondo"),("en ruta","est-ruta-texto","est-ruta-fondo"),("entregado/activo","est-ok-texto","est-ok-fondo"),("devuelto/inactivo","est-devuelto-texto","est-devuelto-fondo"),("cancelado","est-cancelado-texto","est-cancelado-fondo"),("toast éxito","sobre-fuerte","toast-fondo"),("toast error","sobre-fuerte","toast-error"),("menú lateral: texto / fondo","sobre-fuerte","lateral-2"),("menú lateral: texto suave","lateral-suave","lateral-2"),("menú lateral: activo","lateral-activo","lateral-2")]:
    r=ratio(P(f),P(bg)); ok=r>=4.5; fallos+=not ok
    print(f"  {'OK   ' if ok else 'FALLA'} {r:5.2f}:1 {n}")
print("FALLOS:",fallos)
