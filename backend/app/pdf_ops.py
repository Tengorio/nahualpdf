"""
Lógica de manipulación de PDF para miniPDF v2.

Port de `utilities_minipdf.py` + las funciones de división aprobadas en la
versión Streamlit, SIN dependencia de Streamlit: aquí no hay `st.*`. Las
funciones son puras (bytes -> bytes / estructuras), para poder llamarse desde
FastAPI, pruebas o cualquier otro frontend.
"""
from __future__ import annotations

import io
import os
import re
import tempfile
from io import BytesIO

import img2pdf
from pdf2image import convert_from_path
from pypdf import PdfReader, PdfWriter
from pypdf.generic import NameObject, NumberObject


# --------------------------------------------------------------------------- #
# Utilidades básicas
# --------------------------------------------------------------------------- #
def get_file_size_mb(file_bytes: bytes) -> float:
    """Tamaño en MB."""
    return len(file_bytes) / (1024 * 1024)


def count_pages(pdf_bytes: bytes) -> int:
    return len(PdfReader(BytesIO(pdf_bytes)).pages)


def parse_page_range(range_str: str, max_pages: int) -> list[int]:
    """
    "1-3,5,7-9" -> [1,2,3,5,7,8,9], recortado a [1, max_pages].
    Lanza ValueError si el texto no es un rango válido.
    """
    pages: list[int] = []
    for part in range_str.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            start_s, end_s = part.split("-", 1)
            start, end = int(start_s.strip()), int(end_s.strip())
            pages.extend(range(max(1, start), min(end, max_pages) + 1))
        else:
            page = int(part)
            if 1 <= page <= max_pages:
                pages.append(page)
    return sorted(set(pages))


def extract_pages(pdf_bytes: bytes, page_range: str) -> bytes:
    """Extrae un rango ("1-3,5") como un PDF nuevo. Lanza ValueError si el rango es inválido."""
    reader = PdfReader(BytesIO(pdf_bytes))
    writer = PdfWriter()
    for page_num in parse_page_range(page_range, len(reader.pages)):
        writer.add_page(reader.pages[page_num - 1])
    out = BytesIO()
    writer.write(out)
    return out.getvalue()


def merge_pdfs(pdf_bytes_list: list[bytes]) -> bytes:
    writer = PdfWriter()
    for pdf_bytes in pdf_bytes_list:
        for page in PdfReader(BytesIO(pdf_bytes)).pages:
            writer.add_page(page)
    out = BytesIO()
    writer.write(out)
    return out.getvalue()


def detect_text_content(pdf_bytes: bytes) -> tuple[bool, float]:
    """(tiene_texto_significativo, proporción_de_páginas_con_texto)."""
    reader = PdfReader(BytesIO(pdf_bytes))
    total = len(reader.pages)
    with_text = 0
    for page in reader.pages:
        try:
            if len((page.extract_text() or "").strip()) > 10:
                with_text += 1
        except Exception:
            pass
    ratio = with_text / total if total else 0.0
    return ratio > 0.5, ratio


# --------------------------------------------------------------------------- #
# Compresión
# --------------------------------------------------------------------------- #
def pdf_to_compressed_pdf(pdf_bytes: bytes, dpi: int = 100, quality: int = 70) -> bytes:
    """Comprime rasterizando cada página a JPEG y reconstruyendo el PDF."""
    tmp_in = None
    tmp_imgs: list[str] = []
    try:
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
            f.write(pdf_bytes)
            tmp_in = f.name
        images = convert_from_path(tmp_in, dpi=dpi)
        for img in images:
            tf = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False)
            img.save(tf.name, "JPEG", quality=quality)
            tmp_imgs.append(tf.name)
        return img2pdf.convert(tmp_imgs)
    finally:
        for p in tmp_imgs:
            try:
                os.remove(p)
            except OSError:
                pass
        if tmp_in:
            try:
                os.remove(tmp_in)
            except OSError:
                pass


def compress_pdf_selective(
    pdf_bytes: bytes, dpi: int = 150, quality: int = 80, preserve_text: bool = True
) -> bytes:
    """
    Comprime selectivamente: solo rasteriza las páginas SIN texto seleccionable,
    dejando intactas las que tienen texto (evita pixelear lo nítido).
    """
    if not preserve_text:
        return pdf_to_compressed_pdf(pdf_bytes, dpi=dpi, quality=quality)

    reader = PdfReader(BytesIO(pdf_bytes))
    total = len(reader.pages)

    pages_without_text: list[int] = []
    for i, page in enumerate(reader.pages):
        try:
            text = page.extract_text() or ""
        except Exception:
            text = ""
        if len(text.strip()) <= 10:
            pages_without_text.append(i)

    if not pages_without_text:
        return pdf_bytes  # todo es texto: nada que rasterizar

    # Rasterizar solo las páginas sin texto
    compressed_pages = []
    tmp_pdf = None
    try:
        writer = PdfWriter()
        for idx in pages_without_text:
            writer.add_page(reader.pages[idx])
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
            writer.write(f)
            tmp_pdf = f.name
        images = convert_from_path(tmp_pdf, dpi=dpi)
        img_bytes = []
        for image in images:
            buf = io.BytesIO()
            image.save(buf, format="JPEG", quality=quality)
            img_bytes.append(buf.getvalue())
        if img_bytes:
            compressed_pages = list(PdfReader(BytesIO(img2pdf.convert(img_bytes))).pages)
    except Exception:
        compressed_pages = [reader.pages[i] for i in pages_without_text]
    finally:
        if tmp_pdf:
            try:
                os.remove(tmp_pdf)
            except OSError:
                pass

    # Reensamblar en orden original
    writer = PdfWriter()
    compressed_iter = iter(compressed_pages)
    for i in range(total):
        if i in pages_without_text:
            try:
                writer.add_page(next(compressed_iter))
            except StopIteration:
                writer.add_page(reader.pages[i])
        else:
            writer.add_page(reader.pages[i])

    out = BytesIO()
    writer.write(out)
    return out.getvalue()


# --------------------------------------------------------------------------- #
# División
# --------------------------------------------------------------------------- #
def even_page_ranges(num_pages: int, num_parts: int) -> list[str]:
    """Reparte num_pages en num_parts rangos contiguos parejos. (40,3)->['1-14','15-28','29-40']."""
    num_parts = max(1, min(num_parts, num_pages))
    base, rem = divmod(num_pages, num_parts)
    ranges, start = [], 1
    for i in range(num_parts):
        count = base + (1 if i < rem else 0)
        end = start + count - 1
        ranges.append(f"{start}-{end}")
        start = end + 1
    return ranges


def _make_part(page_range: str, data: bytes, size: float, compressed: bool, max_size_mb: float) -> dict:
    return {
        "range": page_range,
        "bytes": data,
        "size_mb": round(size, 3),
        "compressed": compressed,
        "oversized": size > max_size_mb,
    }


def split_pdf_auto(
    pdf_bytes: bytes,
    max_size_mb: float,
    dpi: int = 150,
    quality: int = 80,
    preserve_text: bool = True,
    max_depth: int = 8,
) -> list[dict]:
    """
    Divide priorizando CALIDAD: parte por tamaño (bisección recursiva) hasta
    que cada pedazo quepa bajo max_size_mb SIN comprimir. Solo comprime un
    pedazo cuando ya no se puede partir más (una sola página) y aún se pasa.
    """
    total_pages = count_pages(pdf_bytes)
    parts: list[dict] = []

    def process(start: int, end: int, depth: int) -> None:
        page_range = f"{start}-{end}"
        chunk = extract_pages(pdf_bytes, page_range)
        size = get_file_size_mb(chunk)

        if size <= max_size_mb:
            parts.append(_make_part(page_range, chunk, size, False, max_size_mb))
            return

        if (end - start) >= 1 and depth < max_depth:
            mid = (start + end) // 2
            process(start, mid, depth + 1)
            process(mid + 1, end, depth + 1)
            return

        # Página única (o tope de profundidad) que aún se pasa: último recurso.
        compressed = compress_pdf_selective(chunk, dpi=dpi, quality=quality, preserve_text=preserve_text)
        c_size = get_file_size_mb(compressed)
        parts.append(_make_part(page_range, compressed, c_size, True, max_size_mb))

    process(1, total_pages, 0)
    return parts


def split_pdf_manual(
    pdf_bytes: bytes,
    ranges: list[str],
    max_size_mb: float,
    dpi: int = 150,
    quality: int = 80,
    preserve_text: bool = True,
) -> list[dict]:
    """
    Genera un pedazo por cada rango indicado. Deja intactos los que ya caben;
    comprime solo los que rebasen max_size_mb. Marca error en rangos inválidos.
    """
    parts: list[dict] = []
    for page_range in ranges:
        page_range = (page_range or "").strip()
        if not page_range:
            continue
        try:
            chunk = extract_pages(pdf_bytes, page_range)
            # Sintaxis válida pero fuera del documento ("999-1000"): no hay
            # páginas que entregar, así que cuenta como rango inválido.
            if count_pages(chunk) == 0:
                raise ValueError(f"El rango '{page_range}' no selecciona ninguna página.")
        except Exception:
            parts.append({"range": page_range, "bytes": None, "size_mb": 0.0,
                          "compressed": False, "oversized": False, "error": True})
            continue

        size = get_file_size_mb(chunk)
        if size <= max_size_mb:
            parts.append(_make_part(page_range, chunk, size, False, max_size_mb))
            continue

        compressed = compress_pdf_selective(chunk, dpi=dpi, quality=quality, preserve_text=preserve_text)
        c_size = get_file_size_mb(compressed)
        parts.append(_make_part(page_range, compressed, c_size, True, max_size_mb))
    return parts


# --------------------------------------------------------------------------- #
# Nomenclatura de proyecto (claves CF-AAAA-X-NNN)
# --------------------------------------------------------------------------- #
def extract_project_key(filename: str) -> str | None:
    match = re.search(r"CF-\d{4}-[GI]-\d+", filename)
    return match.group(0) if match else None


def find_common_project_key(filenames: list[str]) -> str | None:
    keys = [k for k in (extract_project_key(f) for f in filenames) if k]
    if keys and all(k == keys[0] for k in keys):
        return keys[0]
    return None


# --------------------------------------------------------------------------- #
# Comprimir a un tamaño objetivo
# --------------------------------------------------------------------------- #
def compress_to_target(
    pdf_bytes: bytes,
    max_size_mb: float,
    dpi: int = 150,
    quality: int = 80,
    preserve_text: bool = True,
    max_attempts: int = 12,
) -> dict:
    """
    Reduce un PDF hasta <= max_size_mb bajando dpi/quality de forma iterativa.
    Preserva el texto seleccionable (rasteriza solo páginas sin texto) mientras
    sea posible. Se detiene al cumplir el objetivo o cuando ya no hay avance.
    Devuelve dict con bytes, tamaño, si se comprimió, la bitácora de intentos y
    si quedó por encima del límite.
    """
    original = get_file_size_mb(pdf_bytes)
    if original <= max_size_mb:
        return {"bytes": pdf_bytes, "size_mb": round(original, 3),
                "compressed": False, "oversized": False, "attempts": []}

    cur_dpi, cur_q = dpi, quality
    attempts: list[dict] = []
    best_bytes, best_size = pdf_bytes, original
    prev_size = original

    for i in range(max_attempts):
        out = compress_pdf_selective(pdf_bytes, dpi=cur_dpi, quality=cur_q, preserve_text=preserve_text)
        size = get_file_size_mb(out)
        attempts.append({"attempt": i + 1, "dpi": cur_dpi, "quality": cur_q, "size_mb": round(size, 3)})

        if size < best_size:
            best_bytes, best_size = out, size

        if size <= max_size_mb:
            break
        # Sin avance real (p.ej. PDF todo-texto que no se puede rasterizar): parar.
        if i > 0 and size >= prev_size - 0.001:
            break
        prev_size = size
        cur_dpi = max(40, int(cur_dpi * 0.85))
        cur_q = max(15, int(cur_q * 0.85))

    return {"bytes": best_bytes, "size_mb": round(best_size, 3),
            "compressed": True, "oversized": best_size > max_size_mb, "attempts": attempts}


# --------------------------------------------------------------------------- #
# Unir (combinar) varios PDF, con selección de páginas por archivo
# --------------------------------------------------------------------------- #
def merge_documents(
    documents: list[tuple[bytes, str]],
    max_size_mb: float | None = None,
    dpi: int = 150,
    quality: int = 80,
    preserve_text: bool = True,
) -> dict:
    """
    Une varios documentos en uno. `documents` es una lista de (pdf_bytes, rango);
    rango vacío = todas las páginas. Si max_size_mb se indica, comprime el
    resultado a ese objetivo. Lanza ValueError si algún rango no deja páginas.
    """
    extracted: list[bytes] = []
    for pdf_bytes, page_range in documents:
        page_range = (page_range or "").strip()
        if not page_range:
            extracted.append(pdf_bytes)
            continue
        chunk = extract_pages(pdf_bytes, page_range)
        if count_pages(chunk) == 0:
            raise ValueError(f"El rango '{page_range}' no selecciona ninguna página.")
        extracted.append(chunk)

    combined = merge_pdfs(extracted)
    num_pages = count_pages(combined)
    size = get_file_size_mb(combined)
    compressed = False
    oversized = False
    attempts: list[dict] = []

    if max_size_mb is not None and size > max_size_mb:
        res = compress_to_target(combined, max_size_mb, dpi=dpi, quality=quality, preserve_text=preserve_text)
        combined, size, compressed, oversized, attempts = (
            res["bytes"], res["size_mb"], True, res["oversized"], res["attempts"],
        )

    return {"bytes": combined, "size_mb": round(size, 3), "num_pages": num_pages,
            "compressed": compressed, "oversized": oversized, "attempts": attempts}


def merge_pages(
    files: list[bytes],
    sequence: list[tuple[int, int] | tuple[int, int, int]],
    max_size_mb: float | None = None,
    dpi: int = 150,
    quality: int = 80,
    preserve_text: bool = True,
) -> dict:
    """
    Arma un PDF a partir de una secuencia ORDENADA de páginas. Cada elemento de
    `sequence` es (índice_de_archivo, número_de_página_1based) o, si se quiere
    girar esa página, (índice_de_archivo, página, rotación en grados). Permite
    tomar páginas sueltas de varios archivos en cualquier orden — es lo que
    alimenta el tablero visual de miniaturas. Ignora referencias fuera de rango.
    """
    readers = [PdfReader(BytesIO(b)) for b in files]
    # Rotación de origen de cada página, guardada antes de tocar nada: una misma
    # página puede aparecer varias veces con giros distintos, y `/Rotate` se
    # escribe en el objeto compartido del reader. Trabajando siempre desde el
    # valor original, el segundo uso no hereda el giro del primero.
    base_rotations = {
        (i, p): int(page.get("/Rotate", 0) or 0)
        for i, reader in enumerate(readers)
        for p, page in enumerate(reader.pages, start=1)
    }

    writer = PdfWriter()
    for entry in sequence:
        file_idx, page_no = entry[0], entry[1]
        rotation = entry[2] if len(entry) > 2 else 0
        if 0 <= file_idx < len(readers):
            reader = readers[file_idx]
            if 1 <= page_no <= len(reader.pages):
                page = reader.pages[page_no - 1]
                page[NameObject("/Rotate")] = NumberObject(
                    (base_rotations[(file_idx, page_no)] + rotation) % 360
                )
                writer.add_page(page)

    num_pages = len(writer.pages)
    if num_pages == 0:
        raise ValueError("No se seleccionó ninguna página.")

    out = BytesIO()
    writer.write(out)
    combined = out.getvalue()
    size = get_file_size_mb(combined)
    compressed = False
    oversized = False

    if max_size_mb is not None and size > max_size_mb:
        res = compress_to_target(combined, max_size_mb, dpi=dpi, quality=quality, preserve_text=preserve_text)
        combined, size, compressed, oversized = res["bytes"], res["size_mb"], True, res["oversized"]

    return {"bytes": combined, "size_mb": round(size, 3), "num_pages": num_pages,
            "compressed": compressed, "oversized": oversized}
