# 📄 PDF Tools (100% Client-Side)

## Corrección OCR — septiembre 2026

Esta revisión sustituye las reglas anteriores de filtrado y ajuste OCR:

- Prioriza las líneas y párrafos nativos de Tesseract; conserva palabras de baja confianza dentro de una línea fiable, sin mutilar frases ni descartar siglas por falta de vocales. La reconstrucción antigua queda como respaldo para salidas sin bloques.
- Descarta líneas completas con confianza media ponderada inferior a 55; el reconocimiento sigue pudiendo cometer errores.
- Estima el tamaño inicial a partir de la altura de los glifos (factor 1.05).
- Cubre el rectángulo original completo y ajusta conjuntamente traducción y texto bilingüe. Si no caben con un mínimo de 5 puntos o 65 % del cuerpo inicial, genera el PDF reformateado mediante el mecanismo de respaldo.
- Los reintentos parten del texto digital, evitando reutilizar OCR de otro idioma o modo.
- Validación: sintaxis JavaScript y pruebas de frases completas, columnas separadas, siglas, confianza y coordenadas. Pendiente prueba integral en navegador con los servicios externos.

El ZIP incluye la estructura correcta: `index.html`, `js/app.js`, `css/style.css` y `api/translate.js`.



Conversor de PDF a PNG/JPEG que funciona completamente en el navegador.  
**Sin servidor, sin subidas, sin dependencias del sistema.** Ideal para GitHub Pages.

## ✨ Características

- 🔒 **100% privado** — tus archivos nunca salen de tu dispositivo
- 🖼️ **PNG o JPEG** con calidad ajustable
- 📐 **Múltiples resoluciones** (1× a 4×)
- 📥 **Descarga individual** o en **ZIP**
- 🌐 **Traductor de PDF** — 21 idiomas, salida en Word/PDF/TXT y modo bilingüe
- 📱 **Responsive** — funciona en móvil y escritorio
- 🚀 **GitHub Pages ready** — solo archivos estáticos

## 🌐 Traductor de PDF

Herramienta incluida que extrae el texto del PDF, lo traduce y genera un documento nuevo:

- **21 idiomas** de origen y destino, con **autodetección** de idioma
- **Formatos de salida**: Word (.docx), PDF reformateado, **PDF con diseño original** y TXT
- **Modo bilingüe**: incluye el texto original encima de la traducción
- **PDF de salida con todos los alfabetos** (latino, cirílico, chino, japonés, coreano, árabe…)
- **Caché y deduplicación**: los encabezados/pies repetidos se traducen una sola vez
- **Traducción por lotes**: varios párrafos por petición (hasta 8× menos peticiones), con validación estricta que garantiza que nunca se mezcle o pierda texto
- **Cadena de 4 servicios gratuitos con failover**: Google → Google alternativo → Lingva → MyMemory (opcionalmente un 5.º: tu propio proxy en Vercel, ver `api/translate.js`)
- **Pausa adaptativa anti-bloqueo**: ante un 429/cuota la pausa se duplica hasta 8 s y decae al normalizar el servicio
- **Caché persistente**: las traducciones se guardan en tu navegador; si algo se interrumpe, al reintentar **continúa donde se quedó** (no re-paga lo ya traducido)
- **Botón "Detener y guardar"**: corta la traducción cuando quieras y genera un documento parcial limpio, con aviso de la página exacta donde se cortó
- **Corte parcial automático**: si el servicio dejara de responder a mitad de documento, el PDF/Word/TXT se corta limpio en la última página 100% traducida (nunca a mitad de frase)
- **Estadísticas en vivo**: páginas, palabras y tiempo estimado al subir el PDF; contador de secciones + tiempo restante durante la traducción
- **🆕 PDF con diseño original**: traduce el PDF «sobre el original» conservando imágenes, tablas, colores y maquetación (ver más abajo)
- **🆕 OCR integrado (Tesseract.js)**: los PDFs **escaneados** o con zonas sin texto se leen con OCR dentro de tu navegador y se traducen igual (ver más abajo)

### 🆕 Modo «PDF diseño» (maqueta original)

El formato **PDF diseño** reabre el PDF original y sustituye **solo el texto**: tapa cada párrafo con el color de fondo real (muestreado de la propia página) y escribe la traducción en la misma posición, reajustando el cuerpo para que quepa.

- ✅ Conserva **imágenes, tablas, gráficos, colores, cabeceras/pies y numeración** exactamente como el original
- ✅ Detecta **negritas y cursivas** y respeta títulos centrados
- ✅ Detecta **celdas de tabla e índices** y traduce cada celda en su sitio
- ✅ Compatible con el modo bilingüe, la caché y el corte parcial
- ⚠️ Solo idiomas destino con **alfabeto latino** (para CJK/árabe/cirílico usa el PDF reformateado, que sí soporta todos los alfabetos)
- ⚠️ Los PDFs con **páginas rotadas** caen automáticamente al PDF reformateado
- ⚠️ El texto original queda **oculto debajo de la traducción** (sigue siendo localizable con buscar/copiar en algunos lectores)
- ⚠️ En bloques muy ajustados el cuerpo de letra se reduce hasta un 45 % para que la traducción quepa (el español es ~15-20 % más largo que el inglés)

### 🆕 OCR integrado (PDFs escaneados)

Si una página **no tiene capa de texto** (es un escaneo) o tiene **zonas sin detectar**, el traductor puede leerla con **OCR** usando [Tesseract.js](https://tesseract.projectnaptha.com/), que se ejecuta **dentro de tu navegador** (tus documentos no se suben a ningún servidor de OCR).

Opciones en el panel de traducción:

| Opción | Qué hace |
|---|---|
| **Automático** (por defecto) | Aplica OCR solo a las páginas sin texto (menos de ~40 caracteres) |
| **Siempre OCR** | Aplica OCR a **todas** las páginas — recomendado si el PDF tiene **zonas sin detectar o texto corrupto** a medias |
| **Nunca** | Comportamiento clásico: solo texto real del PDF |

- **Idioma del documento (OCR)**: elige el idioma del escaneo (por defecto *Inglés + Español* para documentos mixtos). La primera vez se descarga el modelo del idioma (~10–25 MB) y **queda en caché** del navegador; después es inmediato. **Consejo de precisión**: si el documento está en un solo idioma, elige solo ese (sin mezclar) — el OCR acierta mucho más.
- **Pre-proceso de imagen**: antes de leer, cada página se convierte a gris y se le estira el contraste (percentiles 3 %/97 %) — el papel beige, crema o sepia de los libros ilustrados pasa a blanco puro y la tinta a negro. Esto reduce muchísimo los disparates del tipo «abe Te», «Nee was vided» sobre papel coloreado.
- **Resolución de lectura**: las páginas se renderizan a ~2000 px de ancho (antes 1700) — el texto pequeño de recuadros y notas ya no se confunde («evil»→«evi»).
- **Confianza mínima por palabra**: las palabras leídas con confianza < 68/100 se descartan (el ruido de ilustraciones casi siempre queda por debajo); los rótulos cortos EN MAYÚSCULAS con confianza mediocre también.
- **Filtro anti-ruido**: el OCR de ilustraciones, capturas de pantalla, filigranas y fuentes decorativas suele producir "palabras" absurdas. Antes de traducir, cada línea se analiza (proporción de vocales, símbolos extraños, mezclas implausibles de mayúsculas/números, confianza de cada palabra) y las **palabras-basura se eliminan línea a línea**; si un bloque entero no es texto fiable (por ejemplo, ruido leído sobre una imagen), **se descarta y la zona original queda intacta** — mejor sin traducir que tapando el diseño con una caja de basura.
- **Reconstrucción del layout (4 pasos)**: no se confía en las líneas del OCR (suelen fusionar columnas). Se reconstruye desde las palabras: 1) filas por solape vertical (inmune al temblor de ±px del OCR), 2) corte de cada fila en **huecos horizontales grandes** — así dos recuadros que solo comparten altura NUNCA se convierten en una línea sin sentido, 3) limpieza de palabras-ruido, 4) párrafos por proximidad global (renglón siguiente + solape horizontal > 55 % + cuerpos similares): un título grande jamás se funde con el párrafo que tiene debajo.
- **Cajas finas en PDF diseño**: cada bloque OCR se tapa y reescribe con un fondo **exactamente del tamaño del texto traducido** (calculado tras re-lienar), con el cuerpo real de la fuente (≈ 0.74 × alto del bbox) — adiós a las zonas gigantes que tapaban el flujo-grama o las ilustraciones. El color de la tapa se muestrea del fondo real de cada bloque, no de las ilustraciones vecinas.
- **El texto real nunca se pierde**: el resultado del OCR se **fusiona** con la capa de texto digital de la página — el texto digital se conserva siempre y el OCR solo añade las zonas que faltaban (sin duplicados ni solapes). Por eso «Siempre OCR» es seguro incluso en páginas con texto bueno.
- El OCR es compatible con **todos** los formatos de salida, incluido **PDF diseño** (las páginas escaneadas conservan su apariencia y la traducción se escribe encima).
- El OCR es más lento que la traducción (~7–15 s por página según el dispositivo, la lectura es ahora a mayor resolución); verás el progreso página a página.
- Si una página queda en blanco o con caracteres raros, prueba con otro *Idioma del OCR* o con un escaneo de mayor calidad/resolución.

### Límites y rendimiento

| Aspecto | Valor |
|---|---|
| Peso máximo por PDF | **50 MB** (se avisa al subir) |
| Páginas | Sin límite duro; >100 páginas consumen mucha RAM del navegador |
| PDFs escaneados (sin texto) | **Soportados vía OCR** (~3–10 s/página + descarga del idioma la primera vez) |
| Caracteres por petición | Proxy (con lotes) 4 500 · Google 1 200 · Google-alt 1 000 · Lingva 1 200 · MyMemory 460 |
| Velocidad típica | ~4–6 párrafos/segundo con lotes (1 petición ≈ 5 párrafos) |
| Cuota MyMemory (respaldo) | ~1 000 palabras/día por IP si todos los proveedores Google fallan |
| Documentos muy grandes | Se traducen; si algún servicio se agota, obtienes el parcial + caché para reanudar |

> **Nota:** a diferencia del resto de herramientas (100% locales), la traducción **necesita internet**: el texto se envía a servicios gratuitos de traducción. La caché local de traducciones se guarda solo en tu navegador (localStorage).

### ¿Documentos enormes a diario? (opcional)

El proyecto incluye un **proxy gratuito para Vercel**: el archivo `api/translate.js`, que ya está en la raíz del proyecto. Internamente el proxy encadena **Google gtx → Google dict-chrome-ex → MyMemory** (por si Google limita las IPs de datacenter de Vercel con 429). Para activarlo:

1. La carpeta `api/` debe quedar **en la raíz del repositorio** (al lado de `index.html`). ⚠️ Vercel solo detecta funciones serverless si `api/` está en la raíz: si la anidas dentro de una subcarpeta (p. ej. `opcional-vercel/api/`), el endpoint devolverá **404 NOT_FOUND**.
2. Haz commit y espera el despliegue automático de Vercel (~1 min). Comprueba en el navegador: `https://tu-proyecto.vercel.app/api/translate` debe responder `"Solo POST"` — eso significa que la función está viva (solo acepta peticiones POST; en el navegador normal devuelve ese aviso).
3. Pega tu URL en `TR_PROXY_URL` dentro de `js/app.js` y sube el cambio. Bumpa también `?v=` de `app.js` en `index.html` para refrescar la caché de GitHub Pages.

Con el proxy activo ganas un proveedor extra al inicio de la cadena, con lotes de 4 500 caracteres por petición y menos restricciones desde tu IP. Si algún día quieres quitarlo, deja `TR_PROXY_URL = ''` y la cadena de servicios públicos sigue funcionando igual.

## 🚀 Uso en GitHub Pages

1. Crea un nuevo repositorio en GitHub
2. Sube estos archivos (mantén la estructura de carpetas)
3. Ve a **Settings → Pages → Source** y selecciona la rama `main` y carpeta `/ (root)`
4. Espera 1 minuto y accede a la URL que te proporciona GitHub

## 🛠️ Uso local

Simplemente abre `index.html` en tu navegador.  
No necesitas instalar nada ni levantar un servidor.

> **Nota:** Por políticas de CORS, algunos navegadores pueden requerir un servidor local para que el worker de PDF.js cargue correctamente. Si es tu caso:
> ```bash
> npx serve .
> ```

## 📦 Librerías usadas (CDN)

- [PDF.js](https://mozilla.github.io/pdf.js/) — renderizado y lectura de PDF
- [JSZip](https://stuk.github.io/jszip/) — generación de archivos ZIP
- [FileSaver.js](https://github.com/eligrey/FileSaver.js/) — descarga de archivos
- [jsPDF](https://github.com/parallax/jsPDF) — generación de PDF
- [pdf-lib](https://pdf-lib.js.org/) — manipulación de PDF
- [Mammoth.js](https://mammoth.js.org/) — lectura de .docx
- [docx](https://docx.js.org/) — generación de Word
- [Tesseract.js](https://tesseract.projectnaptha.com/) — OCR en el navegador (se descarga bajo demanda solo si usas el OCR)

## ⚠️ Limitaciones del navegador

- PDFs con **muchas páginas** (>100) o **muy pesados** pueden consumir mucha RAM
- La calidad máxima depende de la memoria disponible del dispositivo
- No soporta PDFs protegidos con contraseña
- La calidad del OCR depende de la nitidez del escaneo; escaneos muy borrosos o con varias idiomas poco comunes pueden dar texto imperfecto

## 📄 Licencia

MIT
