"""Genera docs/MANUAL_DE_USUARIO.docx y .pdf a partir del Markdown (pandoc + python-docx + LibreOffice)."""
import subprocess, sys, os
from docx import Document
from docx.shared import Pt, RGBColor, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

RAIZ, TMP = sys.argv[1], sys.argv[2]
DOCS = os.path.join(RAIZ, "docs")
REF = os.path.join(TMP, "ref.docx")
subprocess.run(["pandoc", "-o", REF, "--print-default-data-file", "reference.docx"], check=True)

# ---- estilos de referencia: Times New Roman 12, justificado, A4 ----
d = Document(REF)
estilos = {s.name: s for s in d.styles}
def fuente(st, nombre="Times New Roman", size=None, bold=None, color=None, italic=None):
    st.font.name = nombre
    rpr = st.element.get_or_add_rPr()
    rf = rpr.find(qn("w:rFonts"))
    if rf is None:
        rf = OxmlElement("w:rFonts"); rpr.append(rf)
    for a in ("w:ascii", "w:hAnsi", "w:cs", "w:eastAsia"): rf.set(qn(a), nombre)
    for a in ("w:asciiTheme", "w:hAnsiTheme", "w:cstheme", "w:eastAsiaTheme"):
        if rf.get(qn(a)) is not None: del rf.attrib[qn(a)]
    if size: st.font.size = Pt(size)
    if bold is not None: st.font.bold = bold
    if italic is not None: st.font.italic = italic
    if color: st.font.color.rgb = RGBColor.from_string(color)
for n in ("Normal", "Body Text", "First Paragraph", "Compact", "Block Text"):
    fuente(estilos[n], size=12)
for n in ("Normal", "Body Text", "First Paragraph"):
    pf = estilos[n].paragraph_format
    pf.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY; pf.space_after = Pt(6); pf.line_spacing = 1.15
fuente(estilos["Compact"], size=10)
estilos["Compact"].paragraph_format.alignment = WD_ALIGN_PARAGRAPH.LEFT
estilos["Compact"].paragraph_format.space_after = Pt(2)
for n, sz in (("Heading 1", 16), ("Heading 2", 13), ("Heading 3", 12)):
    fuente(estilos[n], size=sz, bold=True, color="0E4D3A", italic=False)
    pf = estilos[n].paragraph_format
    pf.alignment = WD_ALIGN_PARAGRAPH.LEFT; pf.space_before = Pt(14 if n == "Heading 1" else 10)
    pf.space_after = Pt(6); pf.keep_with_next = True
fuente(estilos["Title"], size=26, bold=True, color="0E4D3A")
for n, sz in (("Subtitle", 14), ("Author", 12), ("Date", 12)):
    fuente(estilos[n], size=sz, color="333333")
for n in ("Title", "Subtitle", "Author", "Date"):
    estilos[n].paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
for n in ("Image Caption", "Captioned Figure", "Figure"):
    fuente(estilos[n], size=10, italic=True, color="444444")
    estilos[n].paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
fuente(estilos["Verbatim Char"], nombre="Courier New", size=10)
fuente(estilos["Block Text"], size=11, italic=False)
for s in d.sections:
    s.page_width, s.page_height = Cm(21), Cm(29.7)
    s.left_margin = s.right_margin = s.top_margin = s.bottom_margin = Cm(2.5)
d.save(REF)

# ---- Markdown → docx ----
BRUTO = os.path.join(TMP, "manual_bruto.docx")
subprocess.run(["pandoc", "MANUAL_DE_USUARIO.md", "-f", "markdown+pipe_tables+implicit_figures", "-o", BRUTO,
                f"--reference-doc={REF}", "--resource-path=."], cwd=DOCS, check=True)

# ---- acabado: tablas, imágenes, encabezado y pie ----
d = Document(BRUTO)
for st in d.styles:
    if st.name == "Source Code":  # lo crea pandoc al convertir los bloques de código
        fuente(st, nombre="Courier New", size=10)
        st.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.LEFT
def bordes(tbl):
    pr = tbl._tbl.tblPr
    b = OxmlElement("w:tblBorders")
    for lado in ("top", "left", "bottom", "right", "insideH", "insideV"):
        e = OxmlElement(f"w:{lado}")
        for k, v in (("val", "single"), ("sz", "4"), ("space", "0"), ("color", "9AA8A2")): e.set(qn(f"w:{k}"), v)
        b.append(e)
    pr.append(b)
    w = pr.find(qn("w:tblW"))
    if w is None:
        w = OxmlElement("w:tblW"); pr.append(w)
    w.set(qn("w:type"), "pct"); w.set(qn("w:w"), "5000")
for t in d.tables:
    bordes(t)
    for i, fila in enumerate(t.rows):
        fila._tr.get_or_add_trPr().append(OxmlElement("w:cantSplit"))
        for celda in fila.cells:
            pr = celda._tc.get_or_add_tcPr()
            mar = OxmlElement("w:tcMar")
            for lado, v in (("top", "50"), ("bottom", "50"), ("left", "90"), ("right", "90")):
                e = OxmlElement(f"w:{lado}"); e.set(qn("w:w"), v); e.set(qn("w:type"), "dxa"); mar.append(e)
            pr.append(mar)
            if i == 0:
                sh = OxmlElement("w:shd")
                for k, v in (("val", "clear"), ("color", "auto"), ("fill", "DCEBE4")): sh.set(qn(f"w:{k}"), v)
                pr.append(sh)
            for p in celda.paragraphs:
                p.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.LEFT
                for r in p.runs:
                    r.font.size = Pt(10); r.font.name = "Times New Roman"
                    if i == 0: r.font.bold = True
for p in d.paragraphs:
    if p._p.xpath(".//w:drawing"):
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.keep_with_next = True
        p.paragraph_format.space_before = Pt(6)
    if p.style.name == "Source Code":
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
sec = d.sections[0]
cab = sec.header.paragraphs[0]
cab.text = "EcoRuta v2.3.0 · Manual de usuario"; cab.alignment = WD_ALIGN_PARAGRAPH.RIGHT
for r in cab.runs:
    r.font.size = Pt(9); r.font.name = "Times New Roman"; r.font.color.rgb = RGBColor(0x55, 0x55, 0x55)
pie = sec.footer.paragraphs[0]; pie.alignment = WD_ALIGN_PARAGRAPH.CENTER
def corrida(texto=None):
    r = pie.add_run(texto); r.font.size = Pt(9); r.font.name = "Times New Roman"; return r
corrida("Página ")
r = corrida(); a = OxmlElement("w:fldChar"); a.set(qn("w:fldCharType"), "begin"); r._r.append(a)
r = corrida(); t = OxmlElement("w:instrText"); t.set(qn("xml:space"), "preserve"); t.text = "PAGE"; r._r.append(t)
r = corrida(); b = OxmlElement("w:fldChar"); b.set(qn("w:fldCharType"), "end"); r._r.append(b)
d.core_properties.title = "Manual de usuario de EcoRuta v2.3.0"
d.core_properties.author = "Equipo EcoRuta"
d.core_properties.language = "es-CR"
salida = os.path.join(DOCS, "MANUAL_DE_USUARIO.docx")
d.save(salida)
subprocess.run(["soffice", "--headless", "--convert-to", "pdf", "--outdir", DOCS, salida],
               check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
print("manual generado:", salida, "·", len(d.tables), "tablas ·", len(d.inline_shapes), "imágenes")
