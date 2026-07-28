"""Fixtures compartidas: cliente de la API y PDFs sintéticos de prueba."""
from __future__ import annotations

import io
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client() -> TestClient:
    return TestClient(app)


def make_text_pdf(num_pages: int = 4, text: str = "Documento de prueba") -> bytes:
    """PDF con texto seleccionable en cada página."""
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    for i in range(1, num_pages + 1):
        c.setFont("Helvetica", 24)
        c.drawString(72, 700, f"{text} — pagina {i}")
        c.drawString(72, 650, "Contenido suficiente para que se detecte texto.")
        c.showPage()
    c.save()
    return buf.getvalue()


def make_heavy_pdf(num_pages: int = 4) -> bytes:
    """
    PDF pesado y SIN texto seleccionable: cada página es un mosaico de
    rectángulos de colores. Sirve para ejercitar la compresión real.
    """
    import random

    rnd = random.Random(7)
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    for _ in range(num_pages):
        for _ in range(4000):
            c.setFillColorRGB(rnd.random(), rnd.random(), rnd.random())
            x, y = rnd.uniform(0, 560), rnd.uniform(0, 720)
            c.rect(x, y, rnd.uniform(2, 14), rnd.uniform(2, 14), fill=1, stroke=0)
        c.showPage()
    c.save()
    return buf.getvalue()


@pytest.fixture(scope="session")
def text_pdf() -> bytes:
    return make_text_pdf(6)


@pytest.fixture(scope="session")
def heavy_pdf() -> bytes:
    return make_heavy_pdf(4)


def upload(pdf: bytes, name: str = "documento.pdf") -> tuple[str, tuple[str, io.BytesIO, str]]:
    return ("file", (name, io.BytesIO(pdf), "application/pdf"))


def uploads(pdfs: list[bytes], names: list[str]) -> list[tuple]:
    return [("files", (n, io.BytesIO(p), "application/pdf")) for p, n in zip(pdfs, names)]
