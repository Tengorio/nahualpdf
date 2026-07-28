# NahualPDF

**Herramienta de transformación de expedientes y documentos en PDF.** Dividir,
unir, comprimir y organizar — equivalente local de iLovePDF, corriendo en la red
local de Secihti: los archivos **nunca salen a internet**.

El nombre viene del *nahual*, el que cambia de forma; que es justo lo que hace
con los documentos.

## Historia

Nació como **miniPDF** (el "mini" venía de *ministración*), una app de Streamlit
para partir y unir expedientes antes de subirlos a las plataformas de Hacienda.
Al resultar útil para otras áreas más allá de ministración, se reescribió como
aplicación propia en **React + FastAPI** y se renombró a NahualPDF. La historia
del Streamlit original vive en este mismo repositorio.

## Estructura

```
nahualpdf/
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

## Servicio permanente (así lo usan los compañeros)

En el servidor corre como servicio de usuario de systemd: queda arriba al
cerrar la sesión SSH y **se levanta solo al reiniciar el equipo**. Un solo
proceso sirve la API y el frontend compilado, así que no hace falta mantener
Vite corriendo.

```
http://172.16.26.16:8000        ← la dirección para compartir
```

Instalar o reinstalar (no necesita sudo; `linger` ya está habilitado para el
usuario, que es lo que permite correr sin sesión abierta):

```bash
bash deploy/instalar.sh
```

Ese script compila el frontend, instala `deploy/nahualpdf.service` en
`~/.config/systemd/user/`, lo habilita y lo reinicia. **Es también la forma de
publicar cambios**: vuelve a correrlo después de tocar el código.

```bash
systemctl --user status nahualpdf      # cómo va
systemctl --user restart nahualpdf     # reiniciar
systemctl --user stop nahualpdf        # bajarlo
tail -f deploy/nahualpdf.log           # registro
```

El servicio tiene `Restart=always`, así que si el proceso muere se levanta solo
a los 5 segundos. Para desarrollo sigue disponible `npm run dev` en :5173, que
convive con el servicio sin chocar de puerto.

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
npx playwright test e2e/nahualpdf.spec.ts
```

Para probar contra el servicio instalado en lugar del servidor de desarrollo
(es decir, sobre el build que realmente usan los compañeros):

```bash
NAHUALPDF_URL=http://localhost:8000 npx playwright test e2e/nahualpdf.spec.ts
```

Para revisar la apariencia a ojo, `npx playwright test e2e/capturas.spec.ts`
deja capturas de cada pantalla en claro y oscuro en `frontend/e2e/capturas/`.
