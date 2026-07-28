# legacy/ — la versión original en Streamlit

Aquí vive **miniPDF**, la primera encarnación de esta herramienta: una app de
Streamlit de un solo archivo que se usó para partir y unir expedientes de
ministración antes de subirlos a las plataformas de Hacienda.

Se conserva por trazabilidad y como referencia. **No se ejecuta ni se mantiene**:
lo que corre hoy es NahualPDF (`backend/` + `frontend/`), que porta toda esta
lógica sin Streamlit en `backend/app/pdf_ops.py`.

## Contenido

| Archivo | Qué es |
|---|---|
| `streamlit/minipdf.py` | La app completa: UI de Streamlit + lógica de dividir/unir/comprimir |
| `streamlit/utilities_minipdf.py` | Helpers de PDF (rangos, extracción, compresión, claves de proyecto) |
| `streamlit/requirements.txt` | Dependencias de Python de esa versión |
| `streamlit/packages.txt` | Paquetes del sistema (poppler) para el despliegue en Streamlit Cloud |
| `streamlit/.streamlit/` | Configuración del servidor de Streamlit |

## Si alguna vez hace falta correrla

```bash
cd legacy/streamlit
pip install -r requirements.txt
streamlit run minipdf.py
```
