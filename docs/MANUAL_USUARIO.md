# Manual de usuario — NahualPDF

NahualPDF divide, une, comprime y reorganiza PDF, como iLovePDF, pero dentro de la red de SECIHTI: los archivos no salen a internet y no se guardan en el servidor. Escrito el 2026-10-15.

**Dirección:** `http://172.16.26.16:8000`

## Reorganizar o unir (la pestaña que abre por omisión)

1. Suelta uno o varios PDF. Aparecen todas sus páginas como miniaturas en un tablero.
2. Arrastra las páginas para cambiar el orden (con el ratón o el teclado). Gira una página con un clic o la tecla `R`, y quita las que no van.
3. Para todo el tablero a la vez: incluir o excluir todas, invertir el orden, girar todas, quitar giros y cambiar el tamaño de las miniaturas (S, M, L).
4. **Para imprimir a doble cara**, marca la casilla: cada documento con número impar de páginas recibe una hoja en blanco al final, para que dos documentos no queden en la misma hoja de papel.
5. Si quieres, comprime el resultado. Descarga.

## Preparar para Hacienda (un botón)

1. Suelta uno o varios PDF (por ejemplo, todos los CAR de una vez). Empiezan solos, uno tras otro.
2. Cada documento sale en archivos de **menos de 1 MB**. Si cabe en uno, sale con su mismo nombre; si no, en partes
   `_parte1de2`, `_parte2de2`… en orden de páginas, en las menos partes posibles.
3. **No se quita nada:** el texto, los logos, los sellos y las firmas se quedan. Solo las imágenes pasan a gris o a
   blanco y negro.
4. Descarga cada parte o todo en un `.zip`. «Ver receta» explica qué se le hizo a cada documento.
5. Si salen más de 5 partes, aparece un aviso: ese documento no se puede bajar más sin quitarle contenido.

Para subir a Hacienda conviene esta pestaña antes que los modos Hacienda de Dividir o Comprimir.

## Dividir

- **Dividir para Hacienda (1 MB):** corta solo, en partes de hasta 1 MB, cuidando la calidad.
- **Dividir manualmente**, con un solo criterio:
  1. tamaño por parte (1, 2 o 5 MB, o libre);
  2. número de partes iguales;
  3. rangos de páginas (agrega las partes que necesites).

Descarga cada parte o todas en un `.zip`.

## Comprimir

- **Comprimir para Hacienda (1 MB):** deja el archivo en 1 MB y conserva el texto seleccionable cuando se puede.
- **Comprimir manualmente**, con un solo criterio:
  1. tamaño objetivo (1, 2 o 5 MB, o libre);
  2. calidad (baja 200 DPI, media 150 DPI, alta 100 DPI);
  3. texto: conservarlo seleccionable o convertir todo a imagen.

## Consejos

- Antes de descargar puedes ver la vista previa de cada resultado.
- El tema claro u oscuro se cambia con el botón de arriba y se recuerda.
- Con archivos muy grandes (escaneos de muchas páginas) la carga puede tardar o cortarse si estás en otra subred. Si ves «error de red», intenta con el archivo partido o avisa.

## Si algo sale mal

Avisa a Javier Paredes con el archivo (si se puede compartir), qué pestaña usabas y el mensaje que salió.
