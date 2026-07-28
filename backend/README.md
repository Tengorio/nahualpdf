# NahualPDF — Backend (FastAPI)

API local que expone la lógica de manipulación de PDF. Los archivos se procesan
en memoria; nada se persiste ni sale a internet.

## Correr en local

```bash
conda activate mini
cd backend
uvicorn app.main:app --reload --port 8000
```

- Docs interactivas: http://localhost:8000/docs
- Salud: http://localhost:8000/api/health

Requiere `poppler` en el sistema (para `pdf2image`): `pdftoppm` debe estar en el PATH.

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| GET  | `/api/health` | Estado del servicio |
| POST | `/api/pdf/info` | Metadatos de un PDF (páginas, tamaño, texto, clave de proyecto) |
| POST | `/api/split/auto` | Divide priorizando calidad (parte por tamaño, comprime al final) |
| POST | `/api/split/manual` | Divide por rangos libres definidos por el usuario |

La lógica pura vive en `app/pdf_ops.py` (port sin Streamlit de `utilities_minipdf.py`).
