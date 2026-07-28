# miniPDF v2

Herramientas de PDF para expedientes de Secihti — equivalente local de iLovePDF,
corriendo en la red local (los archivos **nunca salen a internet**). Migración de
la versión Streamlit a **React (frontend) + FastAPI (backend)** para una UX más
versátil (drag & drop, miniaturas, estados sin recargar, descarga en .zip).

## Estructura

```
minipdf-v2/
├─ backend/     FastAPI · lógica de PDF en app/pdf_ops.py (sin Streamlit)
└─ frontend/    React + Vite + TypeScript
```

La lógica de manipulación de PDF (`backend/app/pdf_ops.py`) es un port sin
Streamlit de `utilities_minipdf.py` + las funciones de división aprobadas.

## Correr en local (dos terminales)

**Backend** (conda `mini`, requiere `poppler`/`pdftoppm` en el sistema):
```bash
conda activate mini
cd backend
pip install -r requirements.txt        # la primera vez
uvicorn app.main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install                            # la primera vez
npm run dev                            # http://localhost:5173
```

Vite redirige `/api` → `localhost:8000`, así que basta abrir
**http://localhost:5173**. Docs del API: http://localhost:8000/docs

## Estado

- [x] Backend: `pdf/info`, `split/auto` (prioriza calidad), `split/manual`, `compress`, `merge`
- [x] **Dividir** — subir → auto/manual → descargar cada parte o todo en .zip
- [x] **Comprimir** — a un tamaño objetivo, preservando texto opcionalmente
- [x] **Unir** — tablero visual de miniaturas: arrastra páginas para reordenar
      (mouse o teclado, vía @dnd-kit), quita las que no van, compresión opcional
- [x] Vistas previas de resultados y de páginas (pdf.js en el navegador, lazy)
- [x] Tema claro/oscuro (claro por defecto, con botón)
- [ ] **Organizar** — rotar páginas y guardar un solo archivo reorganizado (pendiente;
      el tablero de Unir ya cubre reordenar/eliminar entre varios archivos)
- [ ] Descarga por streaming del lado servidor (hoy base64 en JSON; ok para archivos chicos)
