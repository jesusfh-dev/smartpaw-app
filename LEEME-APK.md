# SmartPaw: cómo funcionan las actualizaciones

La app del celular carga la página desde GitHub Pages:
https://jesusfh-dev.github.io/smartpaw-app/

## Cambiar algo de la app (lo normal)
1. Edita `index.html` en VS Code.
2. Haz **Commit** y luego **Sync Changes**.
3. En 1-2 minutos GitHub lo publica ("Publicar app web" en la pestaña Actions).
4. Los celulares ven la versión nueva la próxima vez que abran la app.
   No hay que reinstalar nada. (GitHub puede tardar hasta ~10 min en refrescar su caché.)

## Cuándo sí hace falta un APK nuevo
Solo si cambias `capacitor.config.json`, `package.json`, `offline.html` o los workflows
(por ejemplo: nombre de la app, icono, permisos). En ese caso "Compilar APK" se ejecuta solo
y publica la versión en **Releases**.

Enlace fijo para descargar siempre el APK más reciente desde el celular:
https://github.com/jesusfh-dev/smartpaw-app/releases/latest/download/SmartPaw.apk

Como el APK siempre se firma con `smartpaw-debug.keystore`, se instala encima del anterior
sin desinstalar. No borres ese archivo: si se pierde, habría que desinstalar la app en todos
los celulares una vez.

## Sin internet
Si el celular no tiene conexión, la app muestra la pantalla `offline.html` con un botón
"Reintentar" y vuelve sola cuando regresa la conexión.

## Instalar en un celular nuevo
1. Abre el enlace de descarga de arriba en el celular.
2. Abre `SmartPaw.apk` y permite "instalar apps de origen desconocido".
3. Acepta el permiso de ubicación cuando la app lo pida.
