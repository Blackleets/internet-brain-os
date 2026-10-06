# Efesto al encender el PC

Objetivo: iniciar sesión en Windows, abrir [Efesto](https://efesto-five.vercel.app/) y recuperar la conexión sin volver a copiar tokens. El Kernel funciona en tu PC y la extensión conserva su credencial privada.

## Preparación única

1. Descarga la versión que incluye estos cambios y descomprímela en una carpeta que vayas a conservar. Cierra la versión anterior antes de cambiar de carpeta.
2. Haz doble clic en **Setup Efesto Daily.cmd**. Instala o repara Efesto, inicia el Kernel y activa el inicio automático para tu cuenta de Windows. No necesita que escribas comandos.
3. Si aún no tienes la extensión: abre `chrome://extensions`, activa **Modo de desarrollador**, pulsa **Cargar descomprimida** y selecciona `apps/extension/dist` dentro de esa carpeta. Si ya estaba instalada, recarga la extensión actualizada.
4. Abre la extensión de Efesto y empareja una sola vez con el código que muestra el lanzador. Si ha caducado, abre **Efesto Launcher.cmd** para obtener otro. No compartas el token privado.
5. En la extensión, marca **Reconectar automáticamente la web de Efesto**. Abre o recarga [Efesto](https://efesto-five.vercel.app/). La web comprobará la conexión real antes de mostrar el Kernel listo.

Después de esto, Windows inicia el Kernel en segundo plano al entrar en tu cuenta. La web vuelve a conectarse mediante la extensión autorizada. Abrir la web no crea ni ejecuta una misión por sí solo.

## Comprobación visible

Reinicia Windows, entra en la misma cuenta y abre Efesto en el mismo perfil del navegador. Comprueba que aparece **Kernel listo** sin pegar un token. Crea un Goal cuando quieras probar una misión; su ejecución sigue sujeta a las confirmaciones y capacidades del Kernel. Esta comprobación en tu PC sigue pendiente: las pruebas automatizadas del repositorio no la sustituyen.

## Si no conecta

- Comprueba que la extensión actualizada está habilitada y que tiene marcada la reconexión. En Ajustes puedes pulsar **Conectar con extensión** para reintentar.
- Si Windows acaba de arrancar, espera unos segundos y recarga la web. La recuperación inicial hace un número limitado de intentos.
- Abre **Efesto Launcher.cmd** para ver el diagnóstico del Kernel. El arranque automático no instala paquetes ni repara un puerto ocupado a escondidas.
- Si rotaste la credencial o cambiaste de instalación, vuelve a emparejar la extensión. No publiques tokens ni archivos privados de Efesto.
- Conserva la carpeta instalada. Antes de moverla, desactiva su inicio automático y actívalo desde la nueva ubicación.

## Desactivar

**Disable Efesto Auto Start.cmd** quita únicamente el inicio automático de esta instalación. No borra datos ni detiene el Kernel que ya está funcionando. **Enable Efesto Auto Start.cmd** permite activarlo de nuevo después de instalar.

Desmarca la reconexión en la extensión, o pulsa **Desconectar** en los Ajustes de la web cuando estés conectado mediante la extensión. Esto revoca la autorización de reconexión de la web y cancela sus peticiones activas. La extensión conserva su emparejamiento para sus propias funciones.

## Alcance

Diseñado para Windows y un navegador Chromium con la extensión instalada. El PC debe estar encendido y despierto. No permite conectar el móvil al Kernel del PC. El inicio ocurre al iniciar sesión, no antes de entrar en Windows. La web de producción debe haber desplegado también estos cambios; una vista previa de otra URL no recibe acceso automático.
