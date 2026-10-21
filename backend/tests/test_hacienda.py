"""
Pruebas del motor «Preparar para Hacienda» (app/hacienda.py, D-09).

La regla que se prueba: se vale comprimir y pasar a gris o blanco y negro,
NO se vale quitar nada. Todo con PDFs generados al vuelo.
"""
from __future__ import annotations

import io

import fitz
import numpy as np
import pikepdf
import pytest
from PIL import Image, ImageDraw
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

from app import hacienda
from conftest import make_text_pdf


SELLO = (150, 190, 235)  # color del sello tenue de prueba


def _hoja_escaneada(seed: int, sello_tenue: bool = False) -> Image.Image:
    """Una hoja carta a 150 dpi, a color, con renglones de «texto» y ruido de escáner."""
    rnd = np.random.default_rng(seed)
    w, h = 1275, 1650
    img = Image.new("RGB", (w, h), (250, 248, 240))
    d = ImageDraw.Draw(img)
    for renglon in range(60, h - 80, 26):
        x = 90
        while x < w - 120:
            largo = int(rnd.integers(20, 90))
            d.rectangle([x, renglon, x + largo, renglon + 12], fill=(20, 20, 30))
            x += largo + int(rnd.integers(8, 20))
    if sello_tenue:
        # Sello azul claro grande: en gris queda ~185 (o ~218, muy tenue); Otsu lo mandaría a blanco.
        d.ellipse([700, 1150, 1150, 1600], outline=SELLO, width=40)
    arr = np.asarray(img).astype(np.int16) + rnd.integers(-12, 12, (h, w, 3))
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))


def make_scan_pdf(num_pages: int, sello_tenue: bool = False) -> bytes:
    """PDF como los del grupo B: cada página es una foto a color, sin texto, sin pérdida."""
    pdf = pikepdf.new()
    for i in range(num_pages):
        hoja = _hoja_escaneada(i, sello_tenue)
        # Flate sin pérdida, como los PDF impresos desde Chrome
        im = pikepdf.Stream(pdf, hoja.tobytes())
        im.Type, im.Subtype = pikepdf.Name.XObject, pikepdf.Name.Image
        im.Width, im.Height = hoja.width, hoja.height
        im.ColorSpace, im.BitsPerComponent = pikepdf.Name.DeviceRGB, 8
        contenido = pikepdf.Stream(pdf, b"q 612 0 0 792 0 0 cm /Im0 Do Q")
        pagina = pikepdf.Dictionary(
            Type=pikepdf.Name.Page, MediaBox=[0, 0, 612, 792], Contents=contenido,
            Resources=pikepdf.Dictionary(XObject=pikepdf.Dictionary(Im0=im)))
        pdf.pages.append(pikepdf.Page(pagina))
    out = io.BytesIO()
    pdf.save(out, compress_streams=True)
    return out.getvalue()


def make_native_with_logo_copies(num_pages: int = 8) -> bytes:
    """Como el grupo A: texto real y un logo pesado guardado como copia aparte en cada página."""
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    for i in range(num_pages):
        c.setFont("Helvetica", 11)
        for r in range(40):
            c.drawString(72, 660 - r * 14, f"Cláusula {i}.{r}: texto del convenio que no se debe tocar.")
        c.showPage()
    c.save()

    # Logo con degradado y figuras (comprimible, como uno real), a ~300 dpi.
    yy, xx = np.mgrid[0:296, 0:2400]
    logo = np.stack([(xx % 256), (yy * 255 // 296), np.full_like(xx, 120)], axis=-1).astype(np.uint8)
    logo[100:200, 200:2200] = (90, 20, 40)
    pdf = pikepdf.open(io.BytesIO(buf.getvalue()))
    for page in pdf.pages:
        # Una copia nueva del mismo logo por página, como hace iText.
        im = pikepdf.Stream(pdf, logo.tobytes())
        im.Type, im.Subtype = pikepdf.Name.XObject, pikepdf.Name.Image
        im.Width, im.Height = 2400, 296
        im.ColorSpace, im.BitsPerComponent = pikepdf.Name.DeviceRGB, 8
        page.add_resource(im, pikepdf.Name.XObject, pikepdf.Name.Logo)
        page.contents_add(pikepdf.Stream(pdf, b"q 540 0 0 66 36 700 cm /Logo Do Q"), prepend=False)
    out = io.BytesIO()
    pdf.save(out, compress_streams=True)
    return out.getvalue()


def _paginas(res: hacienda.Resultado) -> int:
    return sum(len(pikepdf.open(io.BytesIO(p["bytes"])).pages) for p in res.partes)


# --------------------------------------------------------------------------- #
def test_si_ya_cabe_se_entrega_tal_cual():
    pdf = make_text_pdf(3)
    res = hacienda.preparar(pdf, "chico.pdf")
    assert len(res.partes) == 1
    assert res.partes[0]["bytes"] == pdf
    assert res.partes[0]["nombre"] == "chico.pdf"


def test_escaneo_pesado_cabe_sin_perder_paginas():
    pdf = make_scan_pdf(12)
    assert len(pdf) > 3 * hacienda.LIMITE_BYTES
    res = hacienda.preparar(pdf, "CBF-2026-1_CAR.pdf")
    assert all(p["tam"] <= hacienda.LIMITE_BYTES for p in res.partes)
    assert _paginas(res) == 12
    assert len(res.partes) <= 5
    # Partes contiguas, en orden y sin huecos
    rangos = [tuple(map(int, p["paginas"].split("-"))) for p in res.partes]
    assert rangos[0][0] == 1 and rangos[-1][1] == 12
    assert all(b[0] == a[1] + 1 for a, b in zip(rangos, rangos[1:]))
    if len(res.partes) > 1:
        assert res.partes[0]["nombre"] == f"CBF-2026-1_CAR_parte1de{len(res.partes)}.pdf"
    assert res.receta["parecido_minimo"] >= 0.75
    assert "partes" in res.receta_texto.lower()


def test_texto_y_logo_quedan_intactos():
    pdf = make_native_with_logo_copies(8)
    res = hacienda.preparar(pdf, "nativo.pdf", limite=len(pdf) // 3)
    assert res.receta["copias_quitadas"] == 7
    assert res.receta["dpi"] is None, "quitar las copias basta: no debe re-codificar nada"
    assert res.receta["parecido_minimo"] == 1.0
    assert res.receta["texto_identico"] is True
    with fitz.open(stream=pdf, filetype="pdf") as orig:
        for p in res.partes:
            with fitz.open(stream=p["bytes"], filetype="pdf") as parte:
                a, b = map(int, p["paginas"].split("-"))
                for j, i in enumerate(range(a - 1, b)):
                    assert parte[j].get_text() == orig[i].get_text()
                    # El logo sigue dibujado en cada página
                    assert len(parte[j].get_images()) == 1


def _sello_conservado(pdf: bytes, nuevo: bytes) -> float:
    """Qué tan oscuro sigue el anillo del sello (0 = negro, 255 = desapareció)."""
    with fitz.open(stream=nuevo, filetype="pdf") as d:
        pix = d[0].get_pixmap(dpi=150, colorspace=fitz.csGRAY)
    g = np.frombuffer(pix.samples, np.uint8).reshape(pix.height, pix.width)
    return float(g[1150 + 5:1150 + 35, 925 - 20:925 + 20].mean())  # borde superior del anillo


@pytest.mark.parametrize("color", [(150, 190, 235), (205, 220, 240)], ids=["tenue", "muy_tenue"])
def test_sello_tenue_no_se_borra(color, monkeypatch):
    """Un sello claro no puede desaparecer, sea en blanco y negro (queda negro) o en gris."""
    monkeypatch.setattr("test_hacienda.SELLO", color)
    pdf = make_scan_pdf(1, sello_tenue=True)
    nuevo, decisiones = hacienda.recodificar_imagenes(pdf, hacienda.DPI_TOPE)
    assert max(p["tinta_perdida"] for p in hacienda.verificar(pdf, nuevo)) <= hacienda.MAX_TINTA_PERDIDA
    assert _sello_conservado(pdf, nuevo) < 235, "el sello debe seguir viéndose"


def test_blanco_y_negro_no_sale_invertido():
    pdf = make_scan_pdf(1)
    nuevo, decisiones = hacienda.recodificar_imagenes(pdf, hacienda.DPI_TOPE)
    assert decisiones[0].codificacion == "bn_g4"
    with fitz.open(stream=nuevo, filetype="pdf") as d:
        pix = d[0].get_pixmap(dpi=50, colorspace=fitz.csGRAY)
        assert np.frombuffer(pix.samples, np.uint8).mean() > 150, "la hoja debe seguir siendo clara"


def test_pagina_que_no_cabe_ni_comprimida_se_rechaza():
    pdf = make_scan_pdf(1)
    with pytest.raises(ValueError, match="sin quitarle contenido"):
        hacienda.preparar(pdf, "x.pdf", limite=5_000)


def test_api_hacienda_entrega_partes_y_receta(client):
    pdf = make_scan_pdf(8)
    r = client.post("/api/hacienda", files=[("file", ("CBF-2026-9_CAR.pdf", io.BytesIO(pdf), "application/pdf"))])
    assert r.status_code == 200
    data = r.json()
    assert data["num_pages"] == 8
    assert all(p["size_mb"] * 1024 * 1024 <= hacienda.LIMITE_BYTES for p in data["partes"])
    assert data["receta_nombre"] == "CBF-2026-9_CAR_receta.txt"
    assert "No se quitó nada" in data["receta_texto"]


def test_api_hacienda_rechaza_no_pdf(client):
    r = client.post("/api/hacienda", files=[("file", ("x.pdf", io.BytesIO(b"hola"), "application/pdf"))])
    assert r.status_code == 400
