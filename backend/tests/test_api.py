"""
Pruebas de la API de miniPDF v2.

Ejercitan los cuatro módulos (info, dividir, comprimir, unir, organizar) contra
PDFs generados al vuelo, sin depender de archivos del expediente real.
"""
from __future__ import annotations

import base64
import io

from pypdf import PdfReader

from conftest import make_text_pdf, upload, uploads


def pdf_of(b64: str) -> PdfReader:
    return PdfReader(io.BytesIO(base64.b64decode(b64)))


# --------------------------------------------------------------------------- #
# Salud e información
# --------------------------------------------------------------------------- #
def test_health(client):
    assert client.get("/api/health").json()["status"] == "ok"


def test_info_reporta_paginas_y_texto(client, text_pdf):
    r = client.post("/api/pdf/info", files=[upload(text_pdf, "CF-2023-G-123 informe.pdf")])
    assert r.status_code == 200
    data = r.json()
    assert data["num_pages"] == 6
    assert data["has_text"] is True
    assert data["project_key"] == "CF-2023-G-123"


def test_info_rechaza_no_pdf(client):
    files = [("file", ("virus.pdf", io.BytesIO(b"no soy un pdf"), "application/pdf"))]
    assert client.post("/api/pdf/info", files=files).status_code == 400


# --------------------------------------------------------------------------- #
# Dividir
# --------------------------------------------------------------------------- #
def test_split_auto_no_pierde_paginas(client, heavy_pdf):
    r = client.post(
        "/api/split/auto",
        files=[upload(heavy_pdf)],
        data={"max_size_mb": 0.3},
    )
    assert r.status_code == 200
    parts = r.json()["parts"]
    assert len(parts) > 1, "un PDF pesado debe partirse en varias piezas"
    total = sum(len(pdf_of(p["content_b64"]).pages) for p in parts)
    assert total == 4, "la suma de páginas de las partes debe ser el original"
    # Prioriza calidad: al poder partir, no debería comprimir todas las piezas.
    assert any(not p["compressed"] for p in parts)


def test_split_manual_respeta_rangos(client, text_pdf):
    r = client.post(
        "/api/split/manual",
        files=[upload(text_pdf)],
        data={"ranges": '["1-2", "3-4", "5-6"]', "max_size_mb": 5},
    )
    parts = r.json()["parts"]
    assert [p["range"] for p in parts] == ["1-2", "3-4", "5-6"]
    assert all(len(pdf_of(p["content_b64"]).pages) == 2 for p in parts)
    assert all(not p["compressed"] for p in parts), "si ya caben, no se tocan"


def test_split_manual_marca_rango_invalido(client, text_pdf):
    r = client.post(
        "/api/split/manual",
        files=[upload(text_pdf)],
        data={"ranges": '["1-2", "999-1000", "abc"]', "max_size_mb": 5},
    )
    parts = r.json()["parts"]
    assert parts[0]["error"] is False
    assert parts[1]["error"] is True, "rango fuera del documento debe marcarse"
    assert parts[2]["error"] is True, "rango no numérico debe marcarse"


def test_split_manual_ranges_mal_formado(client, text_pdf):
    r = client.post(
        "/api/split/manual",
        files=[upload(text_pdf)],
        data={"ranges": "no-es-json", "max_size_mb": 1},
    )
    assert r.status_code == 400


# --------------------------------------------------------------------------- #
# Comprimir
# --------------------------------------------------------------------------- #
def test_compress_reduce_el_tamano(client, heavy_pdf):
    r = client.post("/api/compress", files=[upload(heavy_pdf)], data={"max_size_mb": 0.5})
    data = r.json()
    assert data["size_mb"] < data["original_size_mb"]
    assert len(pdf_of(data["content_b64"]).pages) == 4, "comprimir no cambia el paginado"


def test_compress_no_toca_lo_que_ya_cabe(client, text_pdf):
    r = client.post("/api/compress", files=[upload(text_pdf)], data={"max_size_mb": 10})
    data = r.json()
    assert data["compressed"] is False
    assert data["oversized"] is False


# --------------------------------------------------------------------------- #
# Unir
# --------------------------------------------------------------------------- #
def test_merge_pages_ordena_como_se_pide(client):
    a, b = make_text_pdf(3, "AAA"), make_text_pdf(3, "BBB")
    r = client.post(
        "/api/merge/pages",
        files=uploads([a, b], ["a.pdf", "b.pdf"]),
        data={"sequence": "[[1,3],[0,1],[1,1]]"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["num_pages"] == 3
    texts = [p.extract_text() for p in pdf_of(data["content_b64"]).pages]
    assert "BBB" in texts[0] and "pagina 3" in texts[0]
    assert "AAA" in texts[1] and "pagina 1" in texts[1]
    assert "BBB" in texts[2] and "pagina 1" in texts[2]


def test_merge_nombra_con_clave_de_proyecto(client, text_pdf):
    r = client.post(
        "/api/merge/pages",
        files=uploads([text_pdf, text_pdf], ["CF-2024-I-77 a.pdf", "CF-2024-I-77 b.pdf"]),
        data={"sequence": "[[0,1],[1,1]]"},
    )
    assert r.json()["filename"] == "CF-2024-I-77_DC.pdf"


def test_merge_secuencia_vacia_es_error(client, text_pdf):
    r = client.post(
        "/api/merge/pages",
        files=uploads([text_pdf], ["a.pdf"]),
        data={"sequence": "[]"},
    )
    assert r.status_code == 400


def test_merge_ignora_paginas_fuera_de_rango(client, text_pdf):
    r = client.post(
        "/api/merge/pages",
        files=uploads([text_pdf], ["a.pdf"]),
        data={"sequence": "[[0,1],[0,99],[5,1]]"},
    )
    assert r.json()["num_pages"] == 1


def test_merge_comprime_si_se_pide_limite(client, heavy_pdf):
    r = client.post(
        "/api/merge/pages",
        files=uploads([heavy_pdf], ["pesado.pdf"]),
        data={"sequence": "[[0,1],[0,2],[0,3],[0,4]]", "max_size_mb": 0.4},
    )
    data = r.json()
    assert data["compressed"] is True
    assert data["num_pages"] == 4


# --------------------------------------------------------------------------- #
# Organizar (reordenar + rotar)
# --------------------------------------------------------------------------- #
def test_organize_aplica_rotacion(client, text_pdf):
    r = client.post(
        "/api/organize",
        files=uploads([text_pdf], ["informe.pdf"]),
        data={"sequence": "[[0,1,90],[0,2,180],[0,3,0]]"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["filename"] == "informe_organizado.pdf"
    rotations = [p.get("/Rotate", 0) for p in pdf_of(data["content_b64"]).pages]
    assert rotations == [90, 180, 0]


def test_organize_misma_pagina_con_rotaciones_distintas(client, text_pdf):
    """La rotación de un uso no debe contaminar al siguiente uso de esa página."""
    r = client.post(
        "/api/organize",
        files=uploads([text_pdf], ["informe.pdf"]),
        data={"sequence": "[[0,1,90],[0,1,0],[0,1,270]]"},
    )
    rotations = [p.get("/Rotate", 0) for p in pdf_of(r.json()["content_b64"]).pages]
    assert rotations == [90, 0, 270]


def test_organize_invierte_el_orden(client):
    doc = make_text_pdf(3, "ZZZ")
    r = client.post(
        "/api/organize",
        files=uploads([doc], ["doc.pdf"]),
        data={"sequence": "[[0,3],[0,2],[0,1]]"},
    )
    texts = [p.extract_text().splitlines()[0] for p in pdf_of(r.json()["content_b64"]).pages]
    assert [t.split("—")[1].strip() for t in texts] == ["pagina 3", "pagina 2", "pagina 1"]


def test_organize_sequence_mal_formada(client, text_pdf):
    r = client.post(
        "/api/organize",
        files=uploads([text_pdf], ["a.pdf"]),
        data={"sequence": '[["x","y"]]'},
    )
    assert r.status_code == 400
