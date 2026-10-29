# Cómo generar el APK de SmartPaw con GitHub

## 1. Subir el proyecto a GitHub (desde VS Code)
1. Abre la carpeta `smartpaw-app` en VS Code.
2. Ve al panel **Control de código fuente** (icono de ramas, o `Ctrl+Shift+G`).
3. Pulsa **"Publicar en GitHub"** (Publish to GitHub) e inicia sesión si te lo pide.
4. Elige **repositorio privado** o público y confirma que se suban todos los archivos
   (incluida la carpeta `.github`).

## 2. Esperar la compilación (unos 5-8 minutos)
1. En la página del repositorio en GitHub, abre la pestaña **Actions**.
2. Verás "Compilar APK" en marcha. Cuando tenga la palomita verde, entra en ella.
3. Abajo, en **Artifacts**, descarga **SmartPaw-APK** (es un .zip con `SmartPaw.apk` dentro).

## 3. Instalar en el celular
1. Pasa `SmartPaw.apk` al celular (cable, Drive, WhatsApp, etc.).
2. Ábrelo y permite "instalar apps de origen desconocido" cuando Android lo pida.
3. Al usar el rastreo, la app pedirá permiso de ubicación: acéptalo.

## Actualizar la app
Cada vez que cambies `index.html` y hagas commit + sync en VS Code, GitHub genera un APK nuevo.
También puedes lanzarlo a mano desde Actions → "Compilar APK" → "Run workflow".

Nota: la app necesita internet para cargar el mapa, las fuentes y las gráficas.
