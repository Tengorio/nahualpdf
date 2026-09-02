# CLAUDE.md — NahualPDF

Guía de arranque para Claude Code en este repositorio.

## Regla dura: pruebas y previews solo en local

**Nunca publicar mockups, prototipos, previews de UI ni cualquier entregable en
un Artifact online (claude.ai) ni ningún otro host externo, a menos que el
usuario lo pida explícitamente.** Todas las pruebas de desarrollo y las
revisiones visuales se hacen en **local**. Si hay que ver una interfaz, se corre
localmente y se revisa con capturas o con el navegador; un wireframe se entrega
como archivo local, no como URL.

Encaja con la naturaleza del producto: los archivos de los usuarios nunca salen
a internet.

## Qué es este proyecto

**NahualPDF** — herramienta de transformación de expedientes y documentos en
PDF: dividir, unir, comprimir y organizar. Equivalente local de iLovePDF,
corriendo en la red local de Secihti. React + Vite + TypeScript (frontend) y
FastAPI (backend); los archivos se procesan en memoria y no se persisten.

Lo usan varias áreas de Secihti, no solo ministración.

```
nahualpdf/
├─ backend/          FastAPI · toda la lógica de PDF en app/pdf_ops.py
│  └─ tests/         18 pruebas de la API (pytest)
├─ frontend/         React + Vite + TypeScript
│  ├─ src/panels/    una herramienta por panel
│  ├─ src/components/  tablero de páginas, miniaturas, comunes
│  └─ e2e/           14 pruebas de interfaz (Playwright)
├─ deploy/           unidad de systemd + script de instalación
├─ legacy/streamlit/ la versión original en Streamlit (archivada, no se ejecuta)
└─ bitacora/         registro técnico por fecha
```

## Cómo correr

**En producción ya corre solo**, como servicio de usuario de systemd
(`nahualpdf.service`, con `linger` habilitado): queda arriba al cerrar la sesión
SSH y arranca solo al reiniciar el equipo.

```
http://172.16.26.16:8000        ← la dirección que usan los compañeros
```

```bash
bash deploy/instalar.sh              # compila, instala y reinicia (así se publican cambios)
systemctl --user status nahualpdf
tail -f deploy/nahualpdf.log
```

Para desarrollar: `cd frontend && npm run dev` (:5173, con proxy `/api` → :8000)
y, si se toca el backend, `conda activate mini && cd backend && uvicorn
app.main:app --reload --port 8000`. El ambiente de Python es conda `mini`
(3.11); requiere `poppler`/`pdftoppm` en el sistema.

## Pruebas — correrlas siempre antes de dar algo por terminado

```bash
conda activate mini && cd backend && pytest tests/ -q
cd frontend && NAHUALPDF_URL=http://localhost:8000 npx playwright test e2e/nahualpdf.spec.ts
```

Playwright usa el **Chrome instalado en el servidor** (`channel: 'chrome'`), no
descarga navegadores. Los PDF de prueba no se versionan: se regeneran con
`python e2e/fixtures/generar_fixtures.py`. Para revisar apariencia a ojo,
`npx playwright test e2e/capturas.spec.ts` deja capturas en claro y oscuro en
`frontend/e2e/capturas/`.

> **Estado al 2026-09-01: 21 de 21 en verde**, ya con la identidad gráfica nueva
> aplicada. No existe script `npm run test:e2e`: los `package.json` solo traen
> `dev`, `build`, `lint` y `preview`, así que el comando es `npx playwright test`
> dentro de `frontend/`.

## Identidad gráfica — decidida el 2026-09-01, NO revertir

La apariencia de esta app **cambió a propósito** el 2026-09-01. Si algo se ve
distinto a como lo recuerdas, no es un accidente ni una regresión.

**La fuente de verdad es `~/japt/identidad_grafica_interfaces/DESIGN.md`.** Si un
color del CSS y ese archivo no coinciden, manda el archivo y el CSS es el que
está mal. Ahí están los tokens, los componentes, los estados y el porqué de cada
decisión; el material visual está en `IDENTIDAD.html` de esa misma carpeta.

### Qué cambió y por qué

- **El glifo de la marca ya no es la letra `n`**: es Tepeyollotl, «corazón de la
  montaña» —el nahual de Tezcatlipoca, la misma deidad en su otra forma, que es
  justo lo que hace esta app—. Vive en `src/icons.tsx` como `Ic.logo`.
- **El favicon se reemplazó.** El anterior (`public/favicon.svg`) era un logotipo
  morado de plantilla que no era nuestro y salía en la pestaña de todos.

- **Los tokens de color se reemplazaron** en `src/index.css`. El acento dejó de
  ser el teal `#0F766E` que esta app compartía con su hermana: las dos usaban
  literalmente el mismo tema —el encabezado del CSS de Tezcatlipoca hasta decía
  «NahualPDF»— y eran indistinguibles en dos pestañas.
- **El semáforo (`--good`/`--warn`/`--crit`) es idéntico en las dos apps** y no
  se toca: un error debe verse igual en ambas. Lo único que las distingue es el
  acento de marca.
- **Tres tokens cambiaron por accesibilidad, no por gusto**, y no hay que
  «devolverlos» a como se veían: `--warn` claro daba 4.37:1 sobre su propio
  lavado, `--ink-3` daba 3.1:1 y se usa para subtítulos (que son texto), y el
  nuevo `--line-strong` existe porque los bordes de `input` y `.btn-ghost` daban
  1.5:1 contra el mínimo de 3:1 de WCAG 1.4.11.
- **Se eliminó el bloque `@media (prefers-color-scheme: dark)`.** Era una de tres
  copias del tema en el mismo archivo, y hacía que la app parpadeara en oscuro
  antes de que React estampara `data-theme` en cualquier equipo con el sistema en
  oscuro. El predeterminado es **claro**, a propósito. Hoy el tema se define en
  dos selectores: `:root` y `:root[data-theme="dark"]`.
- **El foco visible es obligatorio** (`:focus-visible` global en `index.css`).
  La app se usa con teclado; no eliminar el outline.

### El icono de la pestaña lleva versión

`index.html` declara tres iconos (`favicon.ico`, `favicon.svg`,
`apple-touch-icon.png`) **con `?v=2`**, y `public/` tiene además `favicon-32.png`
e `icon-512.png`. El sufijo no es decorativo: el navegador cachea el favicon con
mucha agresividad —y cachea también la ausencia— así que sin él un icono nuevo
no se ve aunque el archivo ya esté en el servidor. **Si cambias el icono, sube la
versión** en los tres `<link>`.

### Lo que parece un descuido y no lo es

`.card` lleva `border-top-left-radius: var(--radius-fold)` — la esquina superior
izquierda más redondeada que las otras tres. Es **la hoja doblada**, el rasgo de
marca de NahualPDF.

Ese renglón es lo que permite distinguir las dos apps **sin depender del
color** — sobrevive al gris, a la impresión y al daltonismo. Está comentado en el
CSS. No quitarlo.

## Convenciones

- Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`.
- Registrar el trabajo técnico en `bitacora/AAAA-MM-DD.md`, con el formato de
  las entradas existentes (contexto, qué se hizo, caveats).
- Documentar en el mismo ciclo lo que cambie el README o el despliegue.
- Avisar explícitamente si un cambio toca el servicio, dependencias grandes o
  scripts operativos.
- No pushear sin que el usuario lo pida.

## Preferencias del usuario (Javier / Tengorio)

- **No le gusta el prefijo `!`** para correr comandos en la sesión: prefiere
  ejecutarlos él en otra terminal. Darle el comando listo para copiar.
- No hay credenciales de GitHub ni `gh` en este servidor: los `git push` los
  corre él.
- `sudo` pide contraseña — cualquier cosa que lo requiera (abrir un puerto en
  ufw, por ejemplo) la ejecuta él.

## Historia (por qué el nombre cambió)

Nació como **miniPDF**, app de Streamlit para ministración (de ahí el "mini").
Javier iba a darla por obsoleta e incrustarla en la plataforma de ministración,
pero en una reunión con los equipos de datos y automatización de otras áreas
resultó ser de los módulos más pedidos — y lo que valoraban era justo que fuera
independiente. Se reescribió en React + FastAPI (2026-07-27) y se renombró a
NahualPDF (2026-07-28): *nahual*, el que cambia de forma.

La versión Streamlit está archivada en `legacy/streamlit/` y su historia
completa vive en este repo desde el primer commit de 2025.

## Relación con los repos vecinos

- **`~/japt/tezcatlipoca/`** (:8001) — lectura de documentos y extracción por
  plantillas. Misma arquitectura e identidad visual; heredó de aquí `theme.ts`,
  `index.css` y el patrón de paneles.
- **`~/japt/yaca/`** (:8002) — separa el PDF engrapado de las CLC y nombra cada
  pedazo con su proyecto. Nació el 2026-08-10 del mismo modo (era miniCLC) y
  también heredó de aquí el tema, `components/common.tsx` y el criterio de la
  capa pura de `app/pdf_ops.py`. Vale la pena mantener la familia.

## Relación con el repo de ministración

Este proyecto es **independiente** de `~/japt/ministracion/`. Las reglas de ese
repo (no tocar MySQL ni SFTP, flujo de ramas con revisión de Antonio) **no
aplican aquí**. Existe todavía `pages/miniPDF.py` dentro de esa plataforma: es
la versión integrada de la herramienta vieja, y decidir si se retira o se deja
apuntando a NahualPDF es una conversación pendiente con el usuario.
