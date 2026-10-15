# DATOS — NahualPDF

Escrito el 2026-10-15 a partir de `backend/app/main.py`, `CLAUDE.md` y `.gitignore`.

## Qué datos maneja

- **Los PDF que suben los usuarios**, que pueden ser expedientes con datos personales. Se procesan **en memoria** y el resultado vuelve al navegador. No hay base de datos ni carpeta de salida: al terminar la petición, nada queda en el servidor.
- **`incidencias/`** (fuera de git): reportes de usuarios con sus archivos de ejemplo, guardados a mano para diagnosticar. Pueden tener datos personales: no salen de la red y se borran cuando ya no hacen falta.
- **`deploy/nahualpdf.log`** (fuera de git): peticiones y errores, con la IP del cliente. No guarda contenido de archivos.

## API (red local, sin contraseña)

| Ruta | Qué hace |
|---|---|
| `GET /api/health` | ¿responde? |
| `POST /api/pdf/info` | páginas, tamaño y miniaturas |
| `POST /api/split/auto`, `/api/split/manual` | dividir |
| `POST /api/compress` | comprimir |
| `POST /api/merge`, `/api/merge/pages`, `/api/organize` | unir y reorganizar |

Las respuestas llevan los PDF en base64 dentro del JSON.

## En git (repo público `Tengorio/nahualpdf`)

Solo código, pruebas y documentación. Los PDF de prueba se generan al vuelo (`frontend/e2e/fixtures/generar_fixtures.py`) y no se versionan.

## Retención

`incidencias/`: borrar cada reporte una vez resuelto. El log no rota (pendiente menor).
