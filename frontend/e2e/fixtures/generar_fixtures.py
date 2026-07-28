"""
Genera los PDF de prueba que consumen los tests de Playwright.

Los PDF no se versionan (ver .gitignore); regenéralos con:
    conda activate mini && python e2e/fixtures/generar_fixtures.py
"""
from __future__ import annotations

import sys
from pathlib import Path

from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

HERE = Path(__file__).parent


def texto(nombre: str, paginas: int, etiqueta: str) -> None:
    c = canvas.Canvas(str(HERE / nombre), pagesize=letter)
    for i in range(1, paginas + 1):
        c.setFont("Helvetica-Bold", 40)
        c.drawString(72, 640, f"{etiqueta} {i}")
        c.setFont("Helvetica", 16)
        c.drawString(72, 590, "Documento de prueba de miniPDF v2.")
        c.showPage()
    c.save()


def pesado(nombre: str, paginas: int) -> None:
    """Sin texto seleccionable y con bastante peso: obliga a comprimir/partir."""
    import random

    rnd = random.Random(11)
    c = canvas.Canvas(str(HERE / nombre), pagesize=letter)
    for _ in range(paginas):
        for _ in range(6000):
            c.setFillColorRGB(rnd.random(), rnd.random(), rnd.random())
            c.rect(rnd.uniform(0, 560), rnd.uniform(0, 720),
                   rnd.uniform(2, 16), rnd.uniform(2, 16), fill=1, stroke=0)
        c.showPage()
    c.save()


if __name__ == "__main__":
    texto("CF-2024-G-101 informe.pdf", 4, "ALFA")
    texto("CF-2024-G-101 anexo.pdf", 3, "BETA")
    pesado("pesado.pdf", 3)
    print("Fixtures generadas en", HERE, file=sys.stderr)
