# DECISIONES — NahualPDF

La más reciente arriba. Reconstruido el 2026-10-15 desde `CLAUDE.md`, `README.md` y `bitacora/`.

| ID | Fecha | Decisión | Por qué |
|---|---|---|---|
| D-08 | 2026-09-01 | Identidad gráfica propia (Tepeyollotl, acento distinto al de Tezcatlipoca, esquina de «hoja doblada» en `.card`), tokens de `~/japt/identidad_grafica_interfaces/DESIGN.md`. **No revertir** | Las dos apps eran indistinguibles en dos pestañas; la esquina distingue sin depender del color |
| D-07 | 2026-09-01 | Tema claro por omisión, sin `prefers-color-scheme`; foco visible obligatorio; tres tokens ajustados por contraste WCAG | El bloque automático hacía parpadear la app; se usa con teclado |
| D-06 | 2026-09-01 | Los iconos del navegador llevan versión (`?v=2`) | El navegador cachea el favicon y su ausencia |
| D-05 | 2026-08-18 | Tres herramientas: «Reorganizar o unir» (por omisión), «Dividir» y «Comprimir»; las dos últimas con modo Hacienda (1 MB fijo) y modo manual de un solo criterio | «Unir» y «Organizar» por separado causaban fricción |
| D-04 | 2026-08-18 | Los errores de red se traducen a mensajes accionables y CORS acepta cualquier origen de la red local | El usuario veía `Failed to fetch` en inglés al cortarse una carga entre subredes |
| D-03 | 2026-08-03 | «Unir para imprimir»: hoja en blanco al final de cada documento impar | Que al imprimir a doble cara no queden dos documentos en una hoja |
| D-02 | 2026-07-28 | Se renombra miniPDF a NahualPDF y queda como aplicación independiente de `~/japt/ministracion` | Otras áreas la pedían justamente por independiente |
| D-01 | 2026-07-27 | Reescritura en React + FastAPI; la lógica de PDF en `app/pdf_ops.py`, sin Streamlit; servicio de usuario de systemd en el puerto 8000 | Servirla a varias áreas sin mantener sesiones abiertas |
| D-00 | 2025 | Los archivos se procesan en memoria y no se guardan; nada sale a internet | Son expedientes con datos personales |

## Por decidir

- Descarga por *streaming* para archivos grandes.
