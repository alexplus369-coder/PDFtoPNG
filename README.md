# 📄 PDF a Imagen (100% Client-Side)

Conversor de PDF a PNG/JPEG que funciona completamente en el navegador.  
**Sin servidor, sin subidas, sin dependencias del sistema.** Ideal para GitHub Pages.

## ✨ Características

- 🔒 **100% privado** — tus archivos nunca salen de tu dispositivo
- 🖼️ **PNG o JPEG** con calidad ajustable
- 📐 **Múltiples resoluciones** (1× a 4×)
- 📥 **Descarga individual** o en **ZIP**
- 📱 **Responsive** — funciona en móvil y escritorio
- 🚀 **GitHub Pages ready** — solo archivos estáticos

## 🚀 Uso en GitHub Pages

1. Crea un nuevo repositorio en GitHub
2. Sube estos archivos (mantén la estructura de carpetas)
3. Ve a **Settings → Pages → Source** y selecciona la rama `main` y carpeta `/ (root)`
4. Espera 1 minuto y accede a la URL que te proporciona GitHub

## 🛠️ Uso local

Simplemente abre `index.html` en tu navegador.  
No necesitas instalar nada ni levantar un servidor.

&gt; **Nota:** Por políticas de CORS, algunos navegadores pueden requerir un servidor local para que el worker de PDF.js cargue correctamente. Si es tu caso:
&gt; ```bash
&gt; npx serve .
&gt; ```

## 📦 Librerías usadas (CDN)

- [PDF.js](https://mozilla.github.io/pdf.js/) — renderizado de PDF
- [JSZip](https://stuk.github.io/jszip/) — generación de archivos ZIP
- [FileSaver.js](https://github.com/eligrey/FileSaver.js/) — descarga de archivos

## ⚠️ Limitaciones del navegador

- PDFs con **muchas páginas** (&gt;100) o **muy pesados** pueden consumir mucha RAM
- La calidad máxima depende de la memoria disponible del dispositivo
- No soporta PDFs protegidos con contraseña

## 📄 Licencia

MIT