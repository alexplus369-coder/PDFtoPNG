# Proxy de traducción en Vercel (opcional, 100 % gratuito)

Tu PDF Tools funciona perfecto **sin este paso**: la app ya usa una cadena de
4 servicios gratuitos con failover. Este proxy es un extra para quien traduce
**documentos muy grandes a diario**: mueve las peticiones a un servidor
(serverless) con menos restricciones que el navegador.

## Qué gana tu app con el proxy activado

- Un proveedor más al inicio de la cadena (`proxy → Google → Google-alt → Lingva → MyMemory`)
- Lotes de hasta 4 500 caracteres por petición (vs. 1 200 directas)
- Menos probabilidad de límites de rate desde tu IP

## Despliegue en 5 minutos

1. Crea una cuenta gratuita en [vercel.com](https://vercel.com) (con GitHub).
2. Sube esta carpeta a un repositorio (la estructura debe quedar así):
   ```
   mi-proxy/
   └── api/
       └── translate.js
   ```
3. En Vercel: **Add New → Project → Import** ese repositorio → **Deploy**
   (no toques ninguna opción; detecta la función automáticamente).
4. Copia tu URL: `https://tu-proyecto.vercel.app/api/translate`
5. Abre `js/app.js`, busca la línea y pega tu URL:
   ```js
   const TR_PROXY_URL = 'https://tu-proyecto.vercel.app/api/translate';
   ```
6. Sube el cambio a GitHub Pages. Listo: el traductor usará tu proxy primero
   y seguirá con el resto de servicios si el proxy falla.

## Notas

- El proxy solo reenvía texto a Google Translate; no guarda nada.
- Plan Hobby de Vercel: gratuito para uso personal (límites generosos).
- Si algún día quieres quitarlo, deja `TR_PROXY_URL = ''` y todo sigue
  funcionando con la cadena de servicios públicos.
