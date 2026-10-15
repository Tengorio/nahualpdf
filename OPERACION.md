# OPERACIÓN — NahualPDF

Manual para quien opera el servicio en `seguimiento` (carpeta `~/japt/nahualpdf`). Escrito el 2026-10-15 a partir de `deploy/`, `README.md` y `CLAUDE.md`.

## Pieza en marcha

| Pieza | Cómo corre | Dónde mirar |
|---|---|---|
| Servicio `nahualpdf` (FastAPI con el frontend compilado), puerto **8000** | systemd de usuario (`Restart=always`, `MemoryMax=4G`, con *linger*: corre sin sesión abierta y arranca al reiniciar el equipo); uvicorn del ambiente conda `mini` | `systemctl --user status nahualpdf`; `deploy/nahualpdf.log` |
| Dependencia del sistema | `poppler` (`pdftoppm`) para las miniaturas | `pdftoppm -v` |

Puertos vecinos: 8001 Tezcatlipoca, 8002 Yaca.

## Arranque, paro y publicación de cambios

```bash
systemctl --user status nahualpdf
systemctl --user restart nahualpdf      # pide el sí de Javier
systemctl --user stop nahualpdf
bash deploy/instalar.sh                 # compila el frontend, instala la unidad y reinicia: así se publican cambios
curl -s http://127.0.0.1:8000/api/health
```

Documentación interactiva de la API: `http://127.0.0.1:8000/docs`.

## Pruebas (antes de dar algo por terminado)

```bash
cd ~/japt/nahualpdf/backend && /home/cb2/miniconda3/envs/mini/bin/python -m pytest tests/ -q
cd ~/japt/nahualpdf/frontend && python e2e/fixtures/generar_fixtures.py   # la primera vez
NAHUALPDF_URL=http://localhost:8000 npx playwright test e2e/nahualpdf.spec.ts
```

Playwright usa el Chrome instalado en el servidor.

## Registros

- `deploy/nahualpdf.log` (salida y errores; no rota). Ahí se ve si una petición llegó al servidor o se cortó antes.

## Respaldo y restauración

- **Código:** `Tengorio/nahualpdf` (**público**). Restaurar = clonar y correr `deploy/instalar.sh`.
- **Datos:** no hay. Los archivos se procesan en memoria y no se guardan. `incidencias/` (fuera de git) guarda los reportes de usuarios con sus archivos de ejemplo.

## Incidentes conocidos

| Síntoma | Causa | Qué hacer |
|---|---|---|
| «Error de red» o la carga se corta con archivos de varios MB desde otra subred | La petición se corta en la red entre subredes antes de llegar al servidor (caso del 2026-08-17, 10 MB). En el log no aparece el `POST` | Probar desde la misma subred; si se repite, revisar con TI el límite entre subredes |
| Archivos grandes lentos | La respuesta va en base64 dentro del JSON | Partir el archivo; la descarga por *streaming* está pendiente |
| Miniaturas en blanco | Falta `poppler` | Instalarlo pide `sudo` (Javier) |
| El icono de la pestaña no cambia tras actualizarlo | El navegador cachea el favicon | Subir el `?v=` en los tres `<link>` de `index.html` |

## Antes de subir a GitHub

El repo es público: ningún archivo de usuario, incidencia ni dato interno entra a git (`incidencias/` y los PDF de prueba están en `.gitignore`).
