"""
Preparar para Hacienda: deja un PDF en partes de <= 1 MB sin quitarle nada.

Regla (Javier, 2026-10-21, D-09): se vale comprimir y pasar a gris o a blanco
y negro; NO se vale quitar nada (logos, sellos, firmas, texto). Por eso aquí
solo se re-codifican las imágenes del PDF: el texto, los vectores, las fuentes
y la estructura de cada página quedan como venían. Si aun así el archivo no
cabe, se divide en el menor número de partes, cortando entre páginas.

La escalera, por imagen:
  1. bajar a lo más DPI_TOPE (sin subir nunca, sin bajar del piso DPI_PISO);
  2. blanco y negro (CCITT G4) si no se pierde tinta a la escala de lectura;
  3. si no, gris JPEG con la calidad más baja que pase el umbral de parecido;
  4. si nada de eso pesa menos que la imagen original, se queda la original.

Todo es medible: cada salida trae una receta con lo que se hizo, el parecido
visual (SSIM) de cada página contra la original y la prueba de que el texto
seleccionable quedó idéntico. Funciones puras (bytes -> estructuras), igual
que `pdf_ops`.
"""
from __future__ import annotations

import hashlib
import io
import math
import os
import re
from dataclasses import dataclass, field

import cv2
import fitz  # PyMuPDF: render y ubicación de imágenes
import numpy as np
import pikepdf
from PIL import Image

VERSION_MOTOR = "hacienda-1.0 (2026-10-21)"
# Huella del código que corre: dos recetas con la misma versión y distinta huella
# salieron de motores distintos (p. ej. una copia de prueba que no se reinició).
HUELLA = hashlib.sha256(open(__file__, "rb").read()).hexdigest()[:12]

LIMITE_MB = 1.0
# Margen para que el archivo quepa también si el sistema cuenta 1 MB = 10^6.
LIMITE_BYTES = 1_000_000
DPI_TOPE = 200          # primera pasada: nunca más fino que esto
DPI_PISO = 150          # segunda pasada: nunca menos que esto
DPI_LECTURA = 100       # escala a la que se compara el parecido

# Umbrales de parecido (SSIM a DPI_LECTURA, 1 = idéntico)
UMBRAL_BN = 0.80        # blanco y negro contra la imagen en gris
UMBRAL_GRIS = 0.97      # JPEG gris contra la imagen en gris
MAX_TINTA_PERDIDA = 0.02  # blanco y negro: a lo más 2 % de la tinta visible puede quedar en blanco
CORTE_MAX = 215           # corte más conservador; más arriba el fondo del papel se volvería negro
CALIDADES_JPEG = (50, 60, 70, 80)
MIN_BYTES_IMAGEN = 8_000  # imágenes más chicas no se tocan: no vale la pena


# --------------------------------------------------------------------------- #
# Parecido visual
# --------------------------------------------------------------------------- #
def ssim(a: np.ndarray, b: np.ndarray) -> float:
    """SSIM clásico (ventana gaussiana 11x11, sigma 1.5) entre dos grises del mismo tamaño."""
    a = a.astype(np.float64)
    b = b.astype(np.float64)
    c1, c2 = (0.01 * 255) ** 2, (0.03 * 255) ** 2
    blur = lambda x: cv2.GaussianBlur(x, (11, 11), 1.5)
    mu_a, mu_b = blur(a), blur(b)
    var_a = blur(a * a) - mu_a ** 2
    var_b = blur(b * b) - mu_b ** 2
    cov = blur(a * b) - mu_a * mu_b
    num = (2 * mu_a * mu_b + c1) * (2 * cov + c2)
    den = (mu_a ** 2 + mu_b ** 2 + c1) * (var_a + var_b + c2)
    return float((num / den).mean())


def tinta_perdida(ref: np.ndarray, cmp: np.ndarray) -> float:
    """
    De lo que en el original se ve como tinta (no blanco), qué fracción quedó
    en blanco. Es lo que delata un sello tenue o una firma clara que el
    blanco y negro borró, aunque el SSIM apenas lo note.
    """
    tinta = ref < 225
    total = int(tinta.sum())
    if total == 0:
        return 0.0
    return float((tinta & (cmp >= 245)).sum() / total)


def _a_lectura(gris: np.ndarray, dpi: float) -> np.ndarray:
    """Lleva un gris a DPI_LECTURA promediando (como lo vería el ojo)."""
    f = DPI_LECTURA / dpi
    w = max(8, round(gris.shape[1] * f))
    h = max(8, round(gris.shape[0] * f))
    return cv2.resize(gris, (w, h), interpolation=cv2.INTER_AREA)


# --------------------------------------------------------------------------- #
# Codificación de una imagen
# --------------------------------------------------------------------------- #
@dataclass
class Decision:
    xref: int
    dpi_original: float
    dpi_final: float
    codificacion: str        # "original", "bn_g4", "gris_jpeg_q60", ...
    bytes_antes: int
    bytes_despues: int
    parecido: float          # SSIM a escala de lectura contra el original en gris


def _g4(bn: Image.Image) -> bytes:
    """Datos CCITT G4 (K=-1) de una imagen modo '1', en una sola franja."""
    buf = io.BytesIO()
    bn.save(buf, "TIFF", compression="group4", strip_size=2 ** 30)
    tif = Image.open(io.BytesIO(buf.getvalue()))
    offset = tif.tag_v2[273][0]
    largo = tif.tag_v2[279][0]
    return buf.getvalue()[offset:offset + largo]


def _jpeg(gris: Image.Image, calidad: int) -> bytes:
    buf = io.BytesIO()
    gris.save(buf, "JPEG", quality=calidad, optimize=True)
    return buf.getvalue()


def _candidatos(gris_orig: np.ndarray, dpi_orig: float, dpi_obj: float):
    """
    Genera (codificación, datos, ancho, alto, parecido) válidos, del más
    ligero esperado al más pesado. El parecido siempre se mide contra la
    imagen original en gris, a escala de lectura.
    """
    ref = _a_lectura(gris_orig, dpi_orig)
    f = min(1.0, dpi_obj / dpi_orig)
    if f < 0.999:
        w = max(1, round(gris_orig.shape[1] * f))
        h = max(1, round(gris_orig.shape[0] * f))
        gris = cv2.resize(gris_orig, (w, h), interpolation=cv2.INTER_AREA)
        dpi = dpi_orig * w / gris_orig.shape[1]
    else:
        gris, dpi = gris_orig, dpi_orig
    h, w = gris.shape

    def a_ref(img: np.ndarray) -> np.ndarray:
        return cv2.resize(img, (ref.shape[1], ref.shape[0]), interpolation=cv2.INTER_AREA)

    def parecido(img: np.ndarray) -> float:
        return ssim(ref, a_ref(img))

    # Blanco y negro: del corte de Otsu hacia cortes más conservadores (en la
    # duda, la tinta tenue queda negra), el primero que se parezca y no borre
    # tinta a escala de lectura. En escaneos ya degradados Otsu borra 4-8 % de
    # la tinta y Otsu+25..45 menos de 2.5 %, con el mismo peso (medido en el
    # lote CBF-2026, 2026-10-21).
    otsu, _ = cv2.threshold(gris, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    for t in sorted({min(int(otsu) + d, CORTE_MAX) for d in (0, 25, 45, 255)}):
        bn = np.where(gris > t, 255, 0).astype(np.uint8)
        p_bn = parecido(bn)
        if p_bn >= UMBRAL_BN and tinta_perdida(ref, a_ref(bn)) <= MAX_TINTA_PERDIDA:
            yield "bn_g4", _g4(Image.fromarray(bn).convert("1")), w, h, p_bn, dpi
            break

    # Gris JPEG: la calidad más baja que pase el umbral.
    pil = Image.fromarray(gris)
    for q in CALIDADES_JPEG:
        datos = _jpeg(pil, q)
        dec = cv2.imdecode(np.frombuffer(datos, np.uint8), cv2.IMREAD_GRAYSCALE)
        p = parecido(dec)
        if p >= UMBRAL_GRIS:
            yield f"gris_jpeg_q{q}", datos, w, h, p, dpi
            return


def _dpi_de_imagenes(doc: fitz.Document) -> dict[int, float]:
    """DPI efectivo de cada imagen: el mayor de todos los lugares donde se dibuja."""
    dpi: dict[int, float] = {}
    for page in doc:
        for info in page.get_images(full=True):
            xref, ancho_px = info[0], info[2]
            try:
                rects = page.get_image_rects(xref)
            except Exception:
                rects = []
            for r in rects:
                if r.width > 1:
                    d = ancho_px / (r.width / 72.0)
                    dpi[xref] = max(dpi.get(xref, 0.0), d)
    return dpi


def _leer_gris(obj: pikepdf.Stream) -> np.ndarray:
    """
    La imagen en gris. Si pikepdf no la entiende se lee a mano: un JPEG se
    abre directo (así no estorba un perfil de color dañado, como el de los PDF
    que ya pasaron por Ghostscript) y un CalRGB se arma desde los bytes.
    """
    try:
        pil = pikepdf.PdfImage(obj).as_pil_image()
        if pil.mode != "L":
            pil = pil.convert("L")
        return np.asarray(pil, dtype=np.uint8)
    except Exception:
        pass
    if obj.get("/Filter") == "/DCTDecode":
        pil = Image.open(io.BytesIO(obj.read_raw_bytes()))
        return np.asarray(pil.convert("L"), dtype=np.uint8)
    if int(obj.get("/BitsPerComponent", 8)) != 8:
        raise ValueError("imagen no soportada")
    cs = obj.get("/ColorSpace")
    if isinstance(cs, pikepdf.Array):
        nombre = str(cs[0])
        n = {"/CalRGB": 3, "/CalGray": 1, "/Lab": 3}.get(nombre)
        if nombre == "/ICCBased":
            n = int(cs[1].get("/N"))
    else:
        n = {"/DeviceRGB": 3, "/DeviceGray": 1, "/DeviceCMYK": 4}.get(str(cs))
    if n not in (1, 3):
        raise ValueError("espacio de color no soportado")
    w, h = int(obj.Width), int(obj.Height)
    datos = np.frombuffer(obj.read_bytes(), np.uint8)[: w * h * n].reshape(h, w, n)
    return datos[:, :, 0] if n == 1 else cv2.cvtColor(datos, cv2.COLOR_RGB2GRAY)


def _recursos(pdf: pikepdf.Pdf):
    """Todos los diccionarios /XObject: de cada página y de cada formulario anidado."""
    vistos, pila = set(), [p.obj for p in pdf.pages]
    while pila:
        d = pila.pop()
        res = d.get("/Resources")
        if res is None or "/XObject" not in res:
            continue
        xo = res.XObject
        if xo.is_indirect:
            if xo.objgen in vistos:
                continue
            vistos.add(xo.objgen)
        yield xo
        for _, o in xo.items():
            if isinstance(o, pikepdf.Stream) and o.get("/Subtype") == "/Form":
                pila.append(o)


def quitar_copias(pdf: pikepdf.Pdf) -> int:
    """
    Si una misma imagen viene guardada varias veces (byte por byte igual), deja
    una sola y todas las páginas apuntan a ella. Sin pérdida: cada página se ve
    exactamente igual. Devuelve cuántas copias sobraban.
    """
    import hashlib

    canon: dict = {}

    def clave(s: pikepdf.Stream):
        smask = s.get("/SMask")
        return (hashlib.sha256(s.read_raw_bytes()).hexdigest(),
                str(s.get("/Filter")), int(s.get("/Width", 0)), int(s.get("/Height", 0)),
                str(s.get("/ColorSpace")), str(s.get("/BitsPerComponent")), str(s.get("/DecodeParms")),
                str(s.get("/Decode")), smask.objgen if smask is not None else None)

    sobran = 0
    for ronda in ("máscaras", "imágenes"):  # primero las SMask, para que las imágenes empaten
        if ronda == "imágenes":
            for xo in _recursos(pdf):
                for _, o in xo.items():
                    sm = o.get("/SMask") if isinstance(o, pikepdf.Stream) else None
                    if sm is not None and sm.objgen in canon:
                        o.SMask = canon[sm.objgen]
        por_clave: dict = {}
        for xo in _recursos(pdf):
            for nombre, o in list(xo.items()):
                if not isinstance(o, pikepdf.Stream) or o.get("/Subtype") != "/Image":
                    continue
                objetos = [o]
                if ronda == "máscaras":
                    objetos = [o.SMask] if o.get("/SMask") is not None else []
                for s in objetos:
                    if s.objgen in canon:
                        continue
                    k = clave(s)
                    if k in por_clave and por_clave[k].objgen != s.objgen:
                        canon[s.objgen] = por_clave[k]
                        sobran += 1
                    else:
                        por_clave.setdefault(k, s)
        if ronda == "imágenes":
            for xo in _recursos(pdf):
                for nombre, o in list(xo.items()):
                    if isinstance(o, pikepdf.Stream) and o.objgen in canon:
                        xo[nombre] = canon[o.objgen]
    return sobran


def recodificar_imagenes(pdf_bytes: bytes, dpi_obj: int) -> tuple[bytes, list[Decision]]:
    """
    Re-codifica cada imagen del PDF según la escalera y devuelve el PDF nuevo
    con la lista de decisiones. Lo que no es imagen no se toca.
    """
    with fitz.open(stream=pdf_bytes, filetype="pdf") as doc:
        dpis = _dpi_de_imagenes(doc)

    pdf = pikepdf.open(io.BytesIO(pdf_bytes))
    decisiones: list[Decision] = []
    for xref, dpi_orig in sorted(dpis.items()):
        obj = pdf.get_object((xref, 0))
        if obj.get("/Subtype") != "/Image" or obj.get("/ImageMask", False):
            continue
        antes = len(obj.read_raw_bytes())
        if antes < MIN_BYTES_IMAGEN:
            continue
        try:
            gris = _leer_gris(obj)
        except Exception:
            decisiones.append(Decision(xref, dpi_orig, dpi_orig, "original (no se pudo leer)", antes, antes, 1.0))
            continue

        mejor = None
        for cod, datos, w, h, p, dpi in _candidatos(gris, dpi_orig, dpi_obj):
            if mejor is None or len(datos) < len(mejor[1]):
                mejor = (cod, datos, w, h, p, dpi)
        if mejor is None or len(mejor[1]) >= antes:
            decisiones.append(Decision(xref, dpi_orig, dpi_orig, "original", antes, antes, 1.0))
            continue

        cod, datos, w, h, p, dpi = mejor
        for clave in ("/DecodeParms", "/Decode", "/Interpolate", "/Intent"):
            if clave in obj:
                del obj[clave]
        obj.Width, obj.Height = w, h
        obj.ColorSpace = pikepdf.Name.DeviceGray
        if cod == "bn_g4":
            obj.BitsPerComponent = 1
            obj.write(datos, filter=pikepdf.Name.CCITTFaxDecode,
                      decode_parms=pikepdf.Dictionary(K=-1, Columns=w, Rows=h, BlackIs1=True))
        else:
            obj.BitsPerComponent = 8
            obj.write(datos, filter=pikepdf.Name.DCTDecode)
        decisiones.append(Decision(xref, dpi_orig, dpi, cod, antes, len(datos), p))

    out = io.BytesIO()
    pdf.save(out, compress_streams=True, object_stream_mode=pikepdf.ObjectStreamMode.generate)
    return out.getvalue(), decisiones


# --------------------------------------------------------------------------- #
# División en partes
# --------------------------------------------------------------------------- #
def _armar(src: pikepdf.Pdf, desde: int, hasta: int) -> bytes:
    """PDF con las páginas [desde, hasta) de src (0-based), tal cual."""
    dst = pikepdf.new()
    for i in range(desde, hasta):
        dst.pages.append(src.pages[i])
    dst.remove_unreferenced_resources()
    out = io.BytesIO()
    dst.save(out, compress_streams=True, object_stream_mode=pikepdf.ObjectStreamMode.generate)
    return out.getvalue()


def _corte_codicioso(src: pikepdf.Pdf, n: int, tope: int, cache: dict) -> list[tuple[int, int]] | None:
    """Partes contiguas, cada una lo más larga posible sin pasar `tope` bytes."""
    def tam(a: int, b: int) -> int:
        if (a, b) not in cache:
            cache[(a, b)] = len(_armar(src, a, b))
        return cache[(a, b)]

    partes, a = [], 0
    while a < n:
        if tam(a, a + 1) > tope:
            return None  # una sola página ya no cabe
        lo, hi = a + 1, n  # la mayor b con tam(a, b) <= tope
        while lo < hi:
            mid = (lo + hi + 1) // 2
            if tam(a, mid) <= tope:
                lo = mid
            else:
                hi = mid - 1
        partes.append((a, lo))
        a = lo
    return partes


def dividir(pdf_bytes: bytes, limite: int = LIMITE_BYTES) -> list[tuple[int, int]] | None:
    """
    El menor número de partes contiguas que quepan en `limite`, con tamaños
    lo más parejos posible. None si alguna página sola no cabe.
    """
    src = pikepdf.open(io.BytesIO(pdf_bytes))
    n = len(src.pages)
    cache: dict = {}
    partes = _corte_codicioso(src, n, limite, cache)
    if partes is None or len(partes) <= 1:
        return partes
    k = len(partes)
    # Emparejar: el tope más bajo que todavía da k partes.
    lo, hi = limite // k, limite
    while hi - lo > limite // 50:
        mid = (lo + hi) // 2
        prueba = _corte_codicioso(src, n, mid, cache)
        if prueba is not None and len(prueba) <= k:
            hi, partes = mid, prueba
        else:
            lo = mid
    return partes


# --------------------------------------------------------------------------- #
# Verificación contra el original
# --------------------------------------------------------------------------- #
def _render_gris(page: fitz.Page) -> np.ndarray:
    pix = page.get_pixmap(dpi=DPI_LECTURA, colorspace=fitz.csGRAY, alpha=False)
    return np.frombuffer(pix.samples, np.uint8).reshape(pix.height, pix.width)


def verificar(original: bytes, nuevo: bytes) -> list[dict]:
    """Por página: parecido (SSIM a escala de lectura) y si el texto quedó idéntico."""
    res = []
    with fitz.open(stream=original, filetype="pdf") as a, fitz.open(stream=nuevo, filetype="pdf") as b:
        if len(a) != len(b):
            raise RuntimeError("El número de páginas cambió: no se entrega.")
        for i in range(len(a)):
            ga, gb = _render_gris(a[i]), _render_gris(b[i])
            if ga.shape != gb.shape:
                gb = cv2.resize(gb, (ga.shape[1], ga.shape[0]), interpolation=cv2.INTER_AREA)
            texto_a = a[i].get_text()
            res.append({
                "pagina": i + 1,
                "parecido": round(ssim(ga, gb), 4),
                "tinta_perdida": round(tinta_perdida(ga, gb), 4),
                "texto_identico": texto_a == b[i].get_text(),
                "tiene_texto": len(texto_a.strip()) > 10,
            })
    return res


# --------------------------------------------------------------------------- #
# Todo junto
# --------------------------------------------------------------------------- #
@dataclass
class Resultado:
    partes: list[dict]                 # {"nombre", "paginas": "1-19", "bytes", "tam"}
    receta: dict
    receta_texto: str = ""
    advertencias: list[str] = field(default_factory=list)


def nombre_base(nombre_archivo: str) -> str:
    base = os.path.splitext(os.path.basename(nombre_archivo))[0]
    return re.sub(r"[^\w.\-]+", "_", base, flags=re.UNICODE) or "documento"


def preparar(pdf_bytes: bytes, nombre_archivo: str = "documento.pdf",
             limite: int = LIMITE_BYTES) -> Resultado:
    """
    El botón «Preparar para Hacienda». Si el PDF ya cabe, se entrega tal cual.
    Si no: re-codifica imágenes a DPI_TOPE; si eso no basta para una sola
    parte, prueba también DPI_PISO y se queda con la que dé menos partes
    (a empate, la más fina). Después divide y verifica.
    """
    base = nombre_base(nombre_archivo)
    with fitz.open(stream=pdf_bytes, filetype="pdf") as doc:
        n_paginas = len(doc)
    receta: dict = {
        "motor": VERSION_MOTOR,
        "huella": HUELLA,
        "archivo": nombre_archivo,
        "paginas": n_paginas,
        "bytes_original": len(pdf_bytes),
        "limite_bytes": limite,
    }
    advertencias: list[str] = []

    if len(pdf_bytes) <= limite:
        receta.update(accion="sin cambios: ya cabe", dpi=None, imagenes={}, partes=[
            {"paginas": f"1-{n_paginas}", "bytes": len(pdf_bytes)}])
        partes = [{"nombre": f"{base}.pdf", "paginas": f"1-{n_paginas}",
                   "bytes": pdf_bytes, "tam": len(pdf_bytes)}]
        res = Resultado(partes, receta)
        res.receta_texto = receta_en_texto(receta, [])
        return res

    # Escalón 0, sin pérdida: guardar una sola vez las imágenes repetidas.
    pdf = pikepdf.open(io.BytesIO(pdf_bytes))
    copias = quitar_copias(pdf)
    buf = io.BytesIO()
    pdf.save(buf, compress_streams=True, object_stream_mode=pikepdf.ObjectStreamMode.generate)
    sin_copias = buf.getvalue()
    receta["copias_quitadas"] = copias

    intentos = []
    if len(sin_copias) <= limite:
        intentos.append((None, sin_copias, [], [(0, n_paginas)]))
    for dpi in (DPI_TOPE, DPI_PISO):
        if intentos and intentos[-1][3] is not None and len(intentos[-1][3]) == 1:
            break
        nuevo, decisiones = recodificar_imagenes(sin_copias, dpi)
        cortes = [(0, n_paginas)] if len(nuevo) <= limite else dividir(nuevo, limite)
        intentos.append((dpi, nuevo, decisiones, cortes))

    validos = [t for t in intentos if t[3] is not None]
    if not validos:
        dpi, nuevo, decisiones, _ = intentos[-1]
        raise ValueError(
            "Hay al menos una página que, aun comprimida sin perder nada, pesa más que el límite. "
            "No se puede entregar sin quitarle contenido.")
    # Menos partes primero; a empate, lo menos tocado (sin re-codificar, luego el dpi más alto).
    dpi, nuevo, decisiones, cortes = min(validos, key=lambda t: (len(t[3]), -(t[0] or 10_000)))

    pags = verificar(pdf_bytes, nuevo)
    peor = min(pags, key=lambda p: p["parecido"])
    texto_ok = all(p["texto_identico"] for p in pags)
    if not texto_ok:
        advertencias.append("El texto seleccionable de alguna página cambió; revisar antes de usar.")

    src = pikepdf.open(io.BytesIO(nuevo))
    k = len(cortes)
    partes = []
    for i, (a, b) in enumerate(cortes, start=1):
        datos = _armar(src, a, b) if k > 1 else nuevo
        nombre = f"{base}.pdf" if k == 1 else f"{base}_parte{i}de{k}.pdf"
        partes.append({"nombre": nombre, "paginas": f"{a + 1}-{b}", "bytes": datos, "tam": len(datos)})
    if k > 5:
        advertencias.append(f"Salieron {k} partes: más de 5. No hay forma de bajarlas sin quitar contenido.")

    resumen: dict[str, int] = {}
    for d in decisiones:
        clave = "gris_jpeg" if d.codificacion.startswith("gris_jpeg") else d.codificacion
        resumen[clave] = resumen.get(clave, 0) + 1
    hecho = []
    if copias:
        hecho.append(f"{copias} copias repetidas de imágenes guardadas una sola vez (sin pérdida)")
    if dpi:
        hecho.append("imágenes re-codificadas")
    if k > 1:
        hecho.append(f"dividido en {k} partes")
    receta.update(
        accion=", ".join(hecho),
        dpi=dpi,
        imagenes=resumen,
        bytes_recodificado=len(nuevo),
        parecido_minimo=peor["parecido"],
        pagina_menos_parecida=peor["pagina"],
        tinta_perdida_maxima=max(p["tinta_perdida"] for p in pags),
        texto_identico=texto_ok,
        paginas_con_texto=sum(p["tiene_texto"] for p in pags),
        partes=[{"nombre": p["nombre"], "paginas": p["paginas"], "bytes": p["tam"]} for p in partes],
        por_pagina=pags,
        por_imagen=[d.__dict__ for d in decisiones],
    )
    res = Resultado(partes, receta, advertencias=advertencias)
    res.receta_texto = receta_en_texto(receta, advertencias)
    return res


def _mb(n: int) -> str:
    return f"{n / 1_000_000:.2f} MB"


def receta_en_texto(r: dict, advertencias: list[str]) -> str:
    """La receta para personas: qué se hizo y con qué garantía."""
    lin = [
        f"Receta de NahualPDF · Preparar para Hacienda ({r['motor']} · código {r['huella']})",
        f"Archivo: {r['archivo']} · {r['paginas']} páginas · {_mb(r['bytes_original'])}",
        f"Límite por parte: {_mb(r['limite_bytes'])}",
        f"Qué se hizo: {r['accion']}.",
    ]
    if "parecido_minimo" in r:
        lin.append("No se quitó nada: texto, vectores, fuentes y estructura de cada página quedan como venían"
                   + ("; solo se re-codificaron imágenes (a gris o blanco y negro)." if r.get("dpi") else "."))
        if r.get("dpi"):
            im = ", ".join(f"{v} {k}" for k, v in sorted(r["imagenes"].items())) or "ninguna"
            lin += [
                f"Resolución de las imágenes: a lo más {r['dpi']} dpi (nunca menos de {DPI_PISO}, ni más que la original).",
                f"Imágenes: {im}.",
            ]
        lin += [
            f"Parecido con el original (SSIM a {DPI_LECTURA} dpi, 1 = idéntico): mínimo {r['parecido_minimo']:.3f}, "
            f"en la página {r['pagina_menos_parecida']}.",
            f"Tinta que quedó en blanco (lo que delataría un sello o firma borrados): "
            f"a lo más {100 * r['tinta_perdida_maxima']:.1f} % en una página.",
            f"Texto seleccionable idéntico al original: {'sí' if r['texto_identico'] else 'NO'} "
            f"({r['paginas_con_texto']} páginas con texto).",
        ]
    lin.append("Partes:")
    for p in r["partes"]:
        lin.append(f"  {p.get('nombre', r['archivo'])} · páginas {p['paginas']} · {_mb(p['bytes'])}")
    for a in advertencias:
        lin.append(f"ATENCIÓN: {a}")
    return "\n".join(lin) + "\n"


# --------------------------------------------------------------------------- #
# Línea de comandos: python -m app.hacienda entrada.pdf [...] --salida carpeta
# --------------------------------------------------------------------------- #
def _main() -> None:
    import argparse
    import json
    import time

    ap = argparse.ArgumentParser(description="Preparar PDF para Hacienda (partes de <= 1 MB, sin quitar nada).")
    ap.add_argument("pdf", nargs="+")
    ap.add_argument("--salida", required=True)
    args = ap.parse_args()
    os.makedirs(args.salida, exist_ok=True)
    for ruta in args.pdf:
        t0 = time.time()
        with open(ruta, "rb") as f:
            datos = f.read()
        try:
            res = preparar(datos, os.path.basename(ruta))
        except Exception as e:
            print(f"{os.path.basename(ruta)}\tERROR\t{e}")
            continue
        for p in res.partes:
            with open(os.path.join(args.salida, p["nombre"]), "wb") as f:
                f.write(p["bytes"])
        base = nombre_base(ruta)
        with open(os.path.join(args.salida, f"{base}_receta.txt"), "w", encoding="utf-8") as f:
            f.write(res.receta_texto)
        with open(os.path.join(args.salida, f"{base}_receta.json"), "w", encoding="utf-8") as f:
            json.dump(res.receta, f, ensure_ascii=False, indent=1)
        r = res.receta
        print(f"{os.path.basename(ruta)}\t{_mb(r['bytes_original'])}\t{len(res.partes)} partes\t"
              f"dpi={r.get('dpi')}\tparecido={r.get('parecido_minimo', 1)}\ttinta={r.get('tinta_perdida_maxima', 0)}\t"
              f"texto={r.get('texto_identico', True)}\t"
              f"{max(p['tam'] for p in res.partes) / 1e6:.2f} MB máx\t{time.time() - t0:.0f}s")


if __name__ == "__main__":
    _main()
