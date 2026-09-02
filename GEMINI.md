# GEMINI.md — NahualPDF (Antigravity AI Assistant Guide)

Guía de referencia, arquitectura, reglas de desarrollo y contexto para **Antigravity (Gemini)** en el repositorio **NahualPDF**.

---

## 📌 Reglas de Usuario (Globales)

1. **Carpetas Ad-Hoc**: Siempre organizar el trabajo en carpetas *ad hoc* para mantener la estructura limpia y modular.
2. **Checkpoints en Procesos Masivos**: Implementar siempre buenas prácticas con **checkpoints** (guardado parcial, resumen de avance, recuperación ante fallos) cuando se realicen procesamientos masivos o muy tardados.

---

## 🛑 Regla Dura: Pruebas y Previews Solo en Local

**Nunca publicar mockups, prototipos, previews de UI ni cualquier entregable en un Artifact online ni ningún otro host externo, a menos que el usuario lo pida explícitamente.** 
Todas las pruebas de desarrollo y revisiones visuales se ejecutan en **local**: se corre la aplicación y se valida localmente (con capturas de Playwright o en el navegador). Los documentos de los usuarios **nunca salen a internet** y se procesan en memoria sin persistir en disco.

---

## 💡 Descripción del Proyecto

**NahualPDF** es una herramienta web para la transformación, manipulación y organización de expedientes y documentos en PDF (dividir, unir, comprimir, rotar, eliminar páginas y ensamblado para impresión a doble cara). Es el equivalente local y privado de herramientas como iLovePDF, desplegado en la red local de Secihti.

- **Backend**: FastAPI (Python 3.11 en ambiente Conda `mini`), PyMuPDF (`fitz`), `pikepdf`, `pdf2image` / `poppler` (`pdftoppm`). Toda la lógica de transformación reside en `app/pdf_ops.py`.
- **Frontend**: React 18 + Vite + TypeScript (sin dependencias pesadas de UI, CSS puro con tokens en `index.css`).
- **Despliegue**: Servicio de usuario en systemd (`nahualpdf.service` en puerto `:8000`).

### Estructura General del Repositorio

```
nahualpdf/
├─ backend/          FastAPI · lógica de manipulación PDF en app/pdf_ops.py
│  ├─ app/           Módulos del backend (main.py, pdf_ops.py)
│  └─ tests/         Pruebas automatizadas de la API (pytest)
├─ frontend/         React + Vite + TypeScript
│  ├─ src/panels/    Un panel por herramienta: Reorganizar o unir, Dividir, Comprimir
│  ├─ src/components/ Tablero de páginas, miniaturas, componentes comunes
│  ├─ e2e/           Pruebas de interfaz y regresión visual con Playwright
│  └─ e2e/fixtures/  Generador de PDFs sintéticos para pruebas
├─ deploy/           Unidad de systemd (nahualpdf.service) + script instalar.sh
├─ legacy/streamlit/ Versión histórica original en Streamlit (archivada, no se ejecuta)
└─ bitacora/         Registro técnico diario (YYYY-MM-DD.md)
```

---

## ⚡ Comandos Principales de Desarrollo

### Entorno y Ejecución

- **Ambiente Python**: Conda `mini` (Python 3.11). Requiere `poppler-utils` (`pdftoppm`) en el sistema.
- **Backend (Puerto 8000)**:
  ```bash
  conda activate mini && cd backend && uvicorn app.main:app --reload --port 8000
  ```
- **Frontend (Desarrollo :5173 con proxy `/api` hacia :8000)**:
  ```bash
  cd frontend && npm run dev
  ```
- **Producción / Despliegue Local**:
  ```bash
  bash deploy/instalar.sh
  systemctl --user status nahualpdf
  tail -f deploy/nahualpdf.log
  ```
  *URL de acceso en red local:* `http://172.16.26.16:8000`

---

## 🧪 Pruebas Automatizadas (Ejecutar siempre antes de dar por terminada una tarea)

> **Ojo con los paneles**: «Unir» y «Organizar» se unificaron en **`Reorganizar o
> unir`** el 2026-08-18. Los archivos `UnirPanel.tsx` y `OrganizarPanel.tsx`
> quedaron como alias de una línea que nadie importaba, y **se borraron el
> 2026-09-01**. El panel real es `ReorganizarPanel.tsx`.

> **Estado al 2026-09-01: 21/21 en verde.** No existe script `npm run test:e2e`
> —los `package.json` solo traen `dev`, `build`, `lint` y `preview`—, así que el
> comando es `npx playwright test` dentro de `frontend/`.


1. **Backend (pytest)**:
   ```bash
   conda activate mini && cd backend && pytest tests/ -q
   ```
2. **Frontend E2E (Playwright)**:
   ```bash
   cd frontend && NAHUALPDF_URL=http://localhost:8000 npx playwright test e2e/nahualpdf.spec.ts
   ```
3. **Regeneración de Fixtures de Prueba**:
   ```bash
   python frontend/e2e/fixtures/generar_fixtures.py
   ```
4. **Capturas Visuales (Modo claro y oscuro)**:
   ```bash
   cd frontend && npx playwright test e2e/capturas.spec.ts
   ```
   *(Las capturas se guardan en `frontend/e2e/capturas/` para revisión local).*

---

## 🌐 Relación con Repositorios Hermanos

- **`~/japt/tezcatlipoca/`** (:8001) — Lectura de documentos, OCR y extracción por plantillas. Heredó de aquí `theme.ts`, `index.css` y la estructura de paneles.
- **`~/japt/yaca/`** (:8002) — Separación y nombrado de CLCs por proyecto. Heredó el tema, `components/common.tsx` y la arquitectura pura de `app/pdf_ops.py`.
- **`~/japt/ministracion/`** — Repositorio independiente. Las reglas de base de datos/flujo de ese proyecto **no** aplican aquí.

---

## 🎨 Identidad Gráfica (2026-09-01) — NO Revertir

La apariencia de esta app **cambió a propósito** el 2026-09-01. Si algo se ve
distinto a como lo recuerdas, no es una regresión: es la identidad nueva.

**Fuente de verdad**: `~/japt/identidad_grafica_interfaces/DESIGN.md`. Si un color
del CSS y ese archivo no coinciden, manda el archivo. El material visual (logos,
procedencia, muestras) está en `IDENTIDAD.html` de esa misma carpeta.

1. **Marca**: el glifo dejó de ser una letra en una caja. Ahora es **Tepeyollotl, el corazón de la montaña** — el nahual de Tezcatlipoca, la misma deidad en su otra forma, que es justo lo que hace esta app. Vive en
   `src/icons.tsx` como `Ic.logo`. Las dos apps hermanas comparten **el mismo
   disco**: en Tezcatlipoca humea (el espejo), en NahualPDF late dentro del cerro
   (Tepeyollotl, «corazón de la montaña»).
2. **Acento**: `#845015` en claro, `#C1A381` en oscuro (calibrados contra el matiz del hocico del jaguar, H32). El teal `#0F766E` que ambas apps compartían quedó
   descartado — eran indistinguibles en dos pestañas.
3. **El semáforo (`--good`/`--warn`/`--crit`) es idéntico en las dos apps** y no
   se toca: un error debe verse igual en ambas. Lo único que cambia entre ellas es
   el acento de marca.
4. **Lo que parece un descuido y NO lo es**: `.card` lleva `border-top-left-radius: var(--radius-fold)` — la esquina superior izquierda más redondeada: la hoja doblada. Es lo que distingue esta app
   de su hermana **sin depender del color** —sobrevive al gris, a la impresión y
   al daltonismo—. Está comentado en el CSS. No lo quites.
5. **Tres tokens cambiaron por accesibilidad, medida**: `--warn` claro daba 4.37:1
   sobre su propio lavado; `--ink-3` daba 3.1:1 y se usa para subtítulos, que son
   texto; y el nuevo `--line-strong` existe porque los bordes de `input` y
   `.btn-ghost` daban 1.5:1 contra el mínimo de 3:1 de WCAG 1.4.11. No los
   «devuelvas» a como se veían antes.
6. **El tema se define en DOS selectores**: `:root` y `:root[data-theme="dark"]`.
   Se eliminó el bloque `@media (prefers-color-scheme: dark)`: era una de tres
   copias del mismo tema y hacía parpadear la app en oscuro antes de que React
   estampara `data-theme`. **El predeterminado es claro, a propósito.**
7. **Foco visible obligatorio** (`:focus-visible` global). La app se usa con
   teclado; no elimines el outline.
8. **Los iconos de pestaña llevan `?v=2`** en los tres `<link>` de `index.html`, y
   `public/` tiene `favicon.svg`, `favicon.ico`, `favicon-32.png`,
   `apple-touch-icon.png` e `icon-512.png`. El sufijo no es decorativo: el
   navegador cachea el favicon —y también su ausencia—, así que sin él un icono
   nuevo no se ve. **Si cambias el icono, sube la versión.**

---

## 📝 Convenciones de Trabajo y Preferencias de Usuario

1. **Commits**: Formato semántico claro: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`.
2. **Bitácora**: Registrar el avance técnico en `bitacora/YYYY-MM-DD.md` (contexto, cambios realizados y caveats).
3. **Comandos sin prefijo `!`**: Presentar siempre los comandos listos para copiar y pegar en la terminal.
4. **Git y Sudo**: No realizar `git push` de forma autónoma (lo ejecuta el usuario). Cualquier comando que requiera contraseña con `sudo` lo corre el usuario.
5. **Invariantes Técnicas**:
   - Todo procesamiento de PDF se realiza en memoria; nunca persistir archivos temporales de usuarios en disco salvo que sea estrictamente necesario y efímero.
   - Preservar la consistencia de estilos y temas compartidos con la familia de herramientas (`tezcatlipoca`, `yaca`).
