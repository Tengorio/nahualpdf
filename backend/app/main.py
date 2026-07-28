"""
API de miniPDF v2 (FastAPI).

Expone la lógica de `pdf_ops` como endpoints HTTP para el frontend React.
Corre en local; los archivos se procesan en memoria y no se persisten.
"""
from __future__ import annotations

import base64
import json
import os

from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import pdf_ops

app = FastAPI(title="miniPDF API", version="2.0.0")

# En desarrollo el frontend Vite corre en localhost:5173.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------------------------------- #
# Modelos de respuesta
# --------------------------------------------------------------------------- #
class PdfInfo(BaseModel):
    filename: str
    num_pages: int
    size_mb: float
    has_text: bool
    text_ratio: float
    project_key: str | None


class Part(BaseModel):
    index: int
    filename: str
    range: str
    size_mb: float
    compressed: bool
    oversized: bool
    error: bool = False
    content_b64: str | None = None


class SplitResult(BaseModel):
    parts: list[Part]


class CompressResult(BaseModel):
    filename: str
    original_size_mb: float
    size_mb: float
    compressed: bool
    oversized: bool
    content_b64: str


class MergeResult(BaseModel):
    filename: str
    num_pages: int
    size_mb: float
    compressed: bool
    oversized: bool
    content_b64: str


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
async def _read_pdf(file: UploadFile) -> bytes:
    if file.content_type not in ("application/pdf", "application/octet-stream"):
        # algunos navegadores mandan octet-stream; validamos por magic bytes abajo
        pass
    data = await file.read()
    if not data[:5] == b"%PDF-":
        raise HTTPException(status_code=400, detail="El archivo no es un PDF válido.")
    return data


def _part_filename(original: str, index: int, project_key: str | None) -> str:
    base = project_key or os.path.splitext(original)[0]
    return f"{base}_{index + 1}.pdf"


def _serialize_parts(raw_parts: list[dict], original: str, project_key: str | None) -> list[Part]:
    parts: list[Part] = []
    for i, p in enumerate(raw_parts):
        is_error = p.get("error", False)
        parts.append(
            Part(
                index=i,
                filename=_part_filename(original, i, project_key),
                range=p["range"],
                size_mb=p["size_mb"],
                compressed=p["compressed"],
                oversized=p["oversized"],
                error=is_error,
                content_b64=None if is_error or p["bytes"] is None
                else base64.b64encode(p["bytes"]).decode("ascii"),
            )
        )
    return parts


# --------------------------------------------------------------------------- #
# Endpoints
# --------------------------------------------------------------------------- #
@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "service": "minipdf-api"}


@app.post("/api/pdf/info", response_model=PdfInfo)
async def pdf_info(file: UploadFile = File(...)) -> PdfInfo:
    data = await _read_pdf(file)
    has_text, ratio = pdf_ops.detect_text_content(data)
    return PdfInfo(
        filename=file.filename or "documento.pdf",
        num_pages=pdf_ops.count_pages(data),
        size_mb=round(pdf_ops.get_file_size_mb(data), 3),
        has_text=has_text,
        text_ratio=round(ratio, 3),
        project_key=pdf_ops.extract_project_key(file.filename or ""),
    )


@app.post("/api/split/auto", response_model=SplitResult)
async def split_auto(
    file: UploadFile = File(...),
    max_size_mb: float = Form(1.0),
    dpi: int = Form(150),
    quality: int = Form(80),
    preserve_text: bool = Form(True),
) -> SplitResult:
    data = await _read_pdf(file)
    raw = pdf_ops.split_pdf_auto(
        data, max_size_mb, dpi=dpi, quality=quality, preserve_text=preserve_text
    )
    key = pdf_ops.extract_project_key(file.filename or "")
    return SplitResult(parts=_serialize_parts(raw, file.filename or "documento.pdf", key))


@app.post("/api/split/manual", response_model=SplitResult)
async def split_manual(
    file: UploadFile = File(...),
    ranges: str = Form(...),  # JSON: ["1-10","11-25","26-40"]
    max_size_mb: float = Form(1.0),
    dpi: int = Form(150),
    quality: int = Form(80),
    preserve_text: bool = Form(True),
) -> SplitResult:
    data = await _read_pdf(file)
    try:
        range_list = json.loads(ranges)
        if not isinstance(range_list, list):
            raise ValueError
    except (json.JSONDecodeError, ValueError):
        raise HTTPException(status_code=400, detail="`ranges` debe ser un arreglo JSON de rangos.")

    raw = pdf_ops.split_pdf_manual(
        data, range_list, max_size_mb, dpi=dpi, quality=quality, preserve_text=preserve_text
    )
    key = pdf_ops.extract_project_key(file.filename or "")
    return SplitResult(parts=_serialize_parts(raw, file.filename or "documento.pdf", key))


@app.post("/api/compress", response_model=CompressResult)
async def compress(
    file: UploadFile = File(...),
    max_size_mb: float = Form(1.0),
    dpi: int = Form(150),
    quality: int = Form(80),
    preserve_text: bool = Form(True),
) -> CompressResult:
    data = await _read_pdf(file)
    original = round(pdf_ops.get_file_size_mb(data), 3)
    res = pdf_ops.compress_to_target(
        data, max_size_mb, dpi=dpi, quality=quality, preserve_text=preserve_text
    )
    name = file.filename or "documento.pdf"
    key = pdf_ops.extract_project_key(name)
    base = key or os.path.splitext(name)[0]
    return CompressResult(
        filename=f"{base}_comprimido.pdf",
        original_size_mb=original,
        size_mb=res["size_mb"],
        compressed=res["compressed"],
        oversized=res["oversized"],
        content_b64=base64.b64encode(res["bytes"]).decode("ascii"),
    )


@app.post("/api/merge", response_model=MergeResult)
async def merge(
    files: list[UploadFile] = File(...),
    ranges: str = Form("[]"),  # JSON alineado con files; "" = todas las páginas
    max_size_mb: float = Form(0.0),  # 0 = no comprimir
    dpi: int = Form(150),
    quality: int = Form(80),
    preserve_text: bool = Form(True),
) -> MergeResult:
    if len(files) < 1:
        raise HTTPException(status_code=400, detail="Sube al menos un PDF para unir.")

    try:
        range_list = json.loads(ranges)
        if not isinstance(range_list, list):
            raise ValueError
    except (json.JSONDecodeError, ValueError):
        raise HTTPException(status_code=400, detail="`ranges` debe ser un arreglo JSON.")

    documents: list[tuple[bytes, str]] = []
    names: list[str] = []
    for i, f in enumerate(files):
        data = await _read_pdf(f)
        documents.append((data, range_list[i] if i < len(range_list) else ""))
        names.append(f.filename or f"documento_{i + 1}.pdf")

    limit = max_size_mb if max_size_mb and max_size_mb > 0 else None
    try:
        res = pdf_ops.merge_documents(
            documents, max_size_mb=limit, dpi=dpi, quality=quality, preserve_text=preserve_text
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    key = pdf_ops.find_common_project_key(names)
    base = f"{key}_DC" if key else "documento_unido"
    return MergeResult(
        filename=f"{base}.pdf",
        num_pages=res["num_pages"],
        size_mb=res["size_mb"],
        compressed=res["compressed"],
        oversized=res["oversized"],
        content_b64=base64.b64encode(res["bytes"]).decode("ascii"),
    )


def _parse_sequence(sequence: str) -> list[tuple[int, int, int]]:
    """
    Parsea el JSON del tablero de miniaturas: [[archivo, página], ...] o
    [[archivo, página, rotación], ...]. La rotación es opcional y en grados.
    """
    try:
        raw = json.loads(sequence)
        parsed: list[tuple[int, int, int]] = []
        for entry in raw:
            file_idx, page_no = int(entry[0]), int(entry[1])
            rotation = int(entry[2]) if len(entry) > 2 else 0
            parsed.append((file_idx, page_no, rotation))
        return parsed
    except (json.JSONDecodeError, ValueError, TypeError, IndexError):
        raise HTTPException(
            status_code=400,
            detail="`sequence` debe ser [[archivo, página] o [archivo, página, rotación], ...].",
        )


async def _build_from_pages(
    files: list[UploadFile],
    sequence: str,
    max_size_mb: float,
    dpi: int,
    quality: int,
    preserve_text: bool,
    suffix: str,
    fallback_name: str,
) -> MergeResult:
    """Núcleo compartido por /api/merge/pages y /api/organize."""
    if not files:
        raise HTTPException(status_code=400, detail="Sube al menos un PDF.")

    seq = _parse_sequence(sequence)
    data = [await _read_pdf(f) for f in files]
    names = [f.filename or f"documento_{i + 1}.pdf" for i, f in enumerate(files)]

    limit = max_size_mb if max_size_mb and max_size_mb > 0 else None
    try:
        res = pdf_ops.merge_pages(
            data, seq, max_size_mb=limit, dpi=dpi, quality=quality, preserve_text=preserve_text
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    key = pdf_ops.find_common_project_key(names)
    if key:
        base = f"{key}{suffix}"
    elif len(names) == 1:
        base = f"{os.path.splitext(names[0])[0]}{suffix}"
    else:
        base = fallback_name
    return MergeResult(
        filename=f"{base}.pdf",
        num_pages=res["num_pages"],
        size_mb=res["size_mb"],
        compressed=res["compressed"],
        oversized=res["oversized"],
        content_b64=base64.b64encode(res["bytes"]).decode("ascii"),
    )


@app.post("/api/merge/pages", response_model=MergeResult)
async def merge_pages_endpoint(
    files: list[UploadFile] = File(...),
    sequence: str = Form(...),  # JSON: [[fileIndex, pageNumber, rotation?], ...] en orden
    max_size_mb: float = Form(0.0),  # 0 = no comprimir
    dpi: int = Form(150),
    quality: int = Form(80),
    preserve_text: bool = Form(True),
) -> MergeResult:
    return await _build_from_pages(
        files, sequence, max_size_mb, dpi, quality, preserve_text,
        suffix="_DC", fallback_name="documento_unido",
    )


@app.post("/api/organize", response_model=MergeResult)
async def organize(
    files: list[UploadFile] = File(...),
    sequence: str = Form(...),  # JSON: [[fileIndex, pageNumber, rotation?], ...] en orden
    max_size_mb: float = Form(0.0),  # 0 = no comprimir
    dpi: int = Form(150),
    quality: int = Form(80),
    preserve_text: bool = Form(True),
) -> MergeResult:
    """
    Reordena / gira / elimina páginas y devuelve el documento reconstruido.
    Comparte motor con la unión por páginas; cambia el nombre de salida.
    """
    return await _build_from_pages(
        files, sequence, max_size_mb, dpi, quality, preserve_text,
        suffix="_organizado", fallback_name="documento_organizado",
    )


# --------------------------------------------------------------------------- #
# Frontend compilado
#
# En producción (el servicio systemd) este mismo proceso sirve el build de
# React, así no hay que mantener Vite arriba: todo vive en un puerto.
# Se monta AL FINAL para no tapar las rutas /api. Si no hay build, la API
# funciona igual y el frontend se sirve con `npm run dev` en :5173.
# --------------------------------------------------------------------------- #
DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if DIST.is_dir():
    app.mount("/", StaticFiles(directory=DIST, html=True), name="frontend")
