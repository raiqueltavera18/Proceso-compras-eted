# Proceso de Compras automatizado — ETED

Herramienta interna para dar seguimiento a cada solicitud de compra o licitación de la Gerencia de Compras de ETED (Empresa de Transmisión Eléctrica Dominicana), desde que la registra el área requirente hasta que se publica, pasando por Secretaría Administrativa, Gerencia de Compras, Coordinación, Análisis y Consultoría Jurídica.

Es un sitio **100% estático**: un solo archivo HTML (`index.html`) que corre entero en el navegador de quien lo usa. No hay servidor, base de datos ni backend — toda la información (procesos, usuarios, áreas) se guarda en el almacenamiento local (`localStorage`) del navegador de cada persona.

## ⚠️ Qué significa esto en la práctica — léelo antes de usarlo en equipo

Como no hay un servidor compartido, **cada navegador tiene su propia copia de los datos**. Si dos personas abren esta página en dos computadoras distintas, cada una ve y guarda su propia información — los cambios de una no aparecen automáticamente en la otra. Esta versión es ideal para:

- Probar el flujo completo y la interfaz con el equipo antes de invertir en una versión con servidor.
- Que una sola persona (por ejemplo, quien administra Compras) lleve el control desde un único navegador/computadora.
- Una demostración o capacitación.

**No es apta todavía** para que varias personas en distintas oficinas trabajen sobre los mismos procesos en tiempo real — para eso hace falta conectarla a una base de datos compartida (ver la sección "Próximo paso: una versión con servidor" más abajo).

Los "usuarios y contraseñas" de esta versión son un sistema simulado (un PIN de 4 dígitos por persona, guardado con hash en el propio navegador) para poder probar los distintos roles del flujo. **No es un sistema de autenticación de nivel empresarial** — no lo uses para proteger información sensible.

## Publicar en GitHub Pages

1. Crea un repositorio en GitHub (puede ser privado) y sube el contenido de esta carpeta (o simplemente arrastra `index.html`, `README.md` y `.gitignore` a un repo nuevo desde la interfaz web de GitHub).
2. En el repositorio, ve a **Settings → Pages**.
3. En "Build and deployment", selecciona **Deploy from a branch**, elige la rama `main` (o `master`) y la carpeta `/ (root)`.
4. Guarda. GitHub te dará una URL parecida a `https://tu-usuario.github.io/nombre-del-repo/` — en uno o dos minutos ya estará publicada.
5. Comparte esa URL con quien deba usar la bitácora. Recuerda: cada persona que la abra tendrá su propio almacenamiento local (ver advertencia arriba).

No hace falta ningún paso de build, `npm install`, ni configuración adicional — GitHub Pages sirve el archivo `index.html` directamente.

## Estructura del repositorio

```
index.html      La aplicación completa (HTML + CSS + JavaScript en un solo archivo)
README.md       Este archivo
.gitignore      Ignora archivos comunes de sistema operativo/editor
```

## Primer uso

Al abrir la página por primera vez no hay procesos ni usuarios registrados. El primer paso es:

1. Activar el "Modo administrador" (botón arriba a la derecha) — la primera vez te pedirá crear un PIN de administrador.
2. Ir a la pestaña **"Áreas y usuarios"** y registrar ahí a las personas: cada una con su nombre, número de empleado, posición, puesto(s) dentro del flujo (área requirente, Secretaría Administrativa, Gerente de Compras, Coordinador, Analista, Consultoría Jurídica), el área o departamento al que pertenece, su correo y, opcionalmente, una contraseña inicial.
3. Si vas a registrar personas del área requirente, primero crea las áreas (con su gerente o director responsable) en esa misma pestaña.
4. Cada persona, al identificarse por primera vez con su nombre en "Tú eres" (arriba de la página), crea su propio PIN de 4 dígitos para futuras veces.

Desde ese momento, cualquier proceso nuevo se puede registrar desde la pestaña **"Nueva solicitud"**, con sus archivos adjuntos desde el momento de creación, y queda asignado automáticamente a Secretaría Administrativa cuando solo hay una persona con ese puesto registrada.

## Notificaciones por correo — código listo, sin conectar todavía

Cada vez que un proceso pasa de una persona a otra (o se devuelve a una etapa anterior), la aplicación simula el envío de un correo: lo muestra como una notificación emergente en pantalla y lo registra en la consola del navegador (`F12` → pestaña "Console"), pero **no envía ningún correo real todavía**.

Se dejó preparado así intencionalmente (fue una decisión explícita al construir esta versión) para no enviar correos reales hasta que el equipo de TI de ETED conecte una cuenta de Microsoft 365/Outlook real. Todo el código ya llama a una única función central:

```js
function sendEmailNotification(toEmail, subject, body){ ... }
```

(la encuentras buscando `sendEmailNotification` dentro de `index.html`, alrededor de la línea 729). Es el único lugar que hay que modificar para conectar el envío real — el resto de la aplicación (creación de usuarios, asignaciones, devoluciones de proceso, etc.) ya llama a esta función en el momento correcto con el destinatario, asunto y cuerpo del mensaje.

Para conectarla de verdad hay dos caminos típicos con Outlook/Microsoft 365:

- **Microsoft Graph API** (`https://graph.microsoft.com/v1.0/me/sendMail` o el endpoint de una cuenta de servicio) — es lo que Microsoft recomienda actualmente para enviar correo de forma programática. Requiere registrar una aplicación en Azure Active Directory / Entra ID y manejar un token de acceso.
- **SMTP con una "contraseña de aplicación"** — más simple de implementar, pero Microsoft lo está descontinuando progresivamente para muchas cuentas empresariales, así que conviene confirmar con el equipo de TI si sigue disponible para el dominio de ETED.

Cualquiera de las dos opciones necesita credenciales que **no deben quedar escritas directamente en este archivo HTML público** (quedarían visibles para cualquiera que abra la página) — hace falta un pequeño servicio intermedio (backend) que reciba la solicitud de envío desde la página y la reenvíe a Microsoft con las credenciales guardadas de forma segura del lado del servidor. Ese backend es, además, el mismo componente que haría falta para el "próximo paso" descrito abajo (una base de datos compartida), así que conviene resolver ambas cosas juntas.

## Próximo paso: una versión con servidor

Esta versión estática es un buen punto de partida, pero para que **todo el equipo** trabaje sobre los mismos procesos, en tiempo real, desde distintas computadoras, hace falta:

1. Una base de datos compartida (por ejemplo, una API sencilla con una base de datos como PostgreSQL, o un servicio como Supabase/Firebase) donde vivan los procesos, usuarios y áreas en lugar de en `localStorage`.
2. Autenticación real (usuario/contraseña verificados en el servidor, no en el navegador).
3. El envío real de correos descrito arriba.

Esto es una decisión de infraestructura (dónde alojarlo, qué presupuesto y con qué proveedor) que conviene tomar en conjunto con el equipo de TI de ETED cuando el equipo esté listo para dar ese paso.
