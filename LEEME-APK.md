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

## Rastreo en tiempo real (collar ↔ dueño)

La app usa **MQTT sobre WebSockets seguros** (servidor público `broker.emqx.io`, con
`broker.hivemq.com` de respaldo automático). No hace falta cuenta ni claves.

**Cómo probarlo con dos celulares**
1. Celular del collar: pestaña **Emisor** → elige *Simulado* o *GPS real* → **Iniciar transmisión**.
   Ahí aparece el **código de 6 caracteres** (o usa *Compartir* para mandar un enlace).
2. Celular del dueño: pestaña **Mapa** → **🔗 Vincular** → escribe el código.
3. El dueño ve en vivo: ubicación animada, ruta, velocidad, distancia, batería y latencia.
   Puede **🔔 Sonar collar** y activar **⚡ Modo intensivo** (ubicación cada 1 s en vez de 5 s).

**Estados que ve el dueño**
- *En línea*: llegan datos.
- *Sin señal*: el collar sigue conectado pero no manda datos desde hace 15 s
  (puedes probarlo con el interruptor "Simular pérdida de señal").
- *Fuera de línea*: el collar se apagó, se quedó sin batería o perdió internet de golpe
  (el servidor lo avisa automáticamente con su "Last Will"). Muestra la última conexión.

**Importante**
- El celular del collar debe tener la app **abierta y con la pantalla encendida**: Android pausa
  las apps en segundo plano. La app intenta mantener la pantalla encendida mientras transmite.
- El servidor es público: cualquiera que conozca el código podría ver la ubicación.
  Para un producto real conviene un servidor propio con usuario/contraseña.

**Versión de prueba (staging)**
`staging.html` se publica en https://jesusfh-dev.github.io/smartpaw-app/staging.html y **no** afecta a los
celulares. Prueba ahí los cambios grandes y, cuando funcionen, copia su contenido a `index.html`.

**Pruebas automáticas**: `tests/rastreo.e2e.js` (30 verificaciones con dos navegadores: collar y dueño).
