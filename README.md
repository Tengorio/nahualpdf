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

- [x] Backend: `pdf/info`, `split/auto` (prioriza calidad), `split/manual`,
      `compress`, `merge`, `merge/pages`, `organize`
- [x] **Dividir** — subir → auto/manual → descargar cada parte o todo en .zip
- [x] **Comprimir** — a un tamaño objetivo, preservando texto opcionalmente
- [x] **Unir** — tablero visual de miniaturas: arrastra páginas para reordenar
      (mouse o teclado, vía @dnd-kit), gíralas, quita las que no van, compresión opcional
- [x] **Organizar** — mismo tablero sobre uno o varios documentos: reordenar,
      girar (90° por clic o tecla `R`) y eliminar páginas antes de guardar
- [x] Acciones sobre todo el tablero: incluir/excluir todas, invertir orden,
      girar todas, quitar giros, y tres densidades de miniatura (S/M/L)
- [x] Vistas previas de resultados y de páginas (pdf.js en el navegador, lazy)
- [x] Tema claro/oscuro (claro por defecto, con botón; se recuerda)
- [x] Pruebas automatizadas de API y de interfaz (ver abajo)
- [ ] Descarga por streaming del lado servidor (hoy base64 en JSON; ok para archivos chicos)

## Pruebas

**Backend** — 18 pruebas de la API, con PDFs generados al vuelo:
```bash
conda activate mini
cd backend
pip install -r requirements-dev.txt     # la primera vez
pytest tests/ -q
```

**Interfaz** — 14 pruebas end-to-end en Chrome headless, usando el Chrome ya
instalado en el servidor (no descarga navegadores). Requiere el backend arriba
en `:8000`; Vite lo levanta solo si no está corriendo:
```bash
cd frontend
python e2e/fixtures/generar_fixtures.py   # la primera vez: PDFs de prueba
npx playwright test e2e/minipdf.spec.ts
```

Para revisar la apariencia a ojo, `npx playwright test e2e/capturas.spec.ts`
deja capturas de cada pantalla en claro y oscuro en `frontend/e2e/capturas/`.
