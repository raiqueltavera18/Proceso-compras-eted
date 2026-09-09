# Procomly — ETED

**Procomly** (Proceso de Compras y Licitaciones Automatizado)

Herramienta interna para dar seguimiento a cada solicitud de compra o
licitación de la Gerencia de Compras de ETED (Empresa de Transmisión
Eléctrica Dominicana), desde que la registra el área requirente hasta que se
publica, pasando por Secretaría y Gerencia de Compras, Coordinación, Análisis
y Consultoría Jurídica.

## Cómo está construida

Es un sitio **estático** (funciona en GitHub Pages, sin necesidad de un
servidor propio) conectado a un backend real de **[Supabase](https://supabase.com)**:

- **Base de datos real** (PostgreSQL) — los procesos, usuarios, áreas e
  historial se guardan de forma permanente y compartida, no en el navegador
  de cada persona.
- **Autenticación real** — cada persona crea su propia cuenta con su correo
  y contraseña; no hay PINs simulados ni credenciales de mentira.
- **Seguridad aplicada en la propia base de datos** (Row Level Security +
  una validación de "qué pasos del proceso son válidos") — así que las
  reglas de quién puede hacer qué no dependen únicamente de la página web:
  aunque alguien intentara saltárselas por otro medio, la base de datos las
  hace cumplir igual.
- **Archivos adjuntos reales** guardados en Supabase Storage, en un almacén
  privado, accesibles solo mediante enlaces temporales dentro de la
  aplicación.

Todo el mundo que use Procomly ve los mismos datos, actualizados, sin
importar desde qué computadora entre.

## Antes de publicarla: crea tu proyecto de Supabase

Este repositorio es solo la parte visual — necesita conectarse a un proyecto
de Supabase (gratuito) para funcionar. **Sigue primero la guía
[`SETUP.md`](./SETUP.md)**, que te lleva paso a paso desde crear la cuenta
de Supabase hasta convertirte en la primera administradora de Procomly.
No hace falta saber programar.

En resumen, `SETUP.md` cubre:

1. Crear el proyecto en Supabase y ejecutar `supabase-schema.sql` (crea las
   tablas y todas las reglas de seguridad).
2. Pegar la URL y la clave pública de tu proyecto en `config.js`.
3. Crear tu cuenta dentro de la aplicación y volverte administradora.

## Publicar en GitHub Pages

Una vez editado `config.js` con los datos de tu proyecto de Supabase (Parte
2 de `SETUP.md`):

1. Crea un repositorio en GitHub (puede ser privado) y sube **todos** los
   archivos de esta carpeta a la **raíz** del repositorio — no dentro de una
   subcarpeta. Si arrastras archivos desde tu computadora a la página de
   GitHub, arrástralos uno por uno o selecciónalos todos juntos, pero nunca
   arrastres la carpeta contenedora completa (eso los deja anidados un nivel
   más abajo y la página no cargará bien).
2. En el repositorio, ve a **Settings → Pages**.
3. En "Build and deployment", selecciona **Deploy from a branch**, elige la
   rama `main` y la carpeta `/ (root)`.
4. Guarda. GitHub te dará una URL parecida a
   `https://tu-usuario.github.io/nombre-del-repo/` — en uno o dos minutos ya
   estará publicada.
5. Comparte esa URL con tu equipo. Cada persona deberá crear su propia
   cuenta (ver `SETUP.md`, sección "Agregar al resto del equipo").

No hace falta ningún paso de build, `npm install`, ni configuración
adicional — GitHub Pages sirve los archivos directamente.

## Estructura del repositorio

```
index.html            La página (estructura HTML + carga de los demás archivos)
styles.css             Todo el diseño visual (inspirado en Odoo)
app.js                  Toda la lógica de la aplicación
config.js               Conexión a tu proyecto de Supabase (URL + clave pública) — lo editas tú
supabase-schema.sql      Script que crea las tablas y las reglas de seguridad en Supabase
SETUP.md                 Guía paso a paso de configuración inicial
README.md                Este archivo
.gitignore                Ignora archivos comunes de sistema operativo/editor
```

## Cómo funciona el flujo de un proceso

Cada solicitud de compra pasa, en orden, por: **Secretaría y Gerencia de
Compras → Coordinación → Análisis → Coordinación (revisión del pliego) →
[Consultoría Jurídica, solo Licitación] → Publicación → Adjudicación → Orden
de compra → Pago → Cierre**. En cualquier etapa previa a la publicación,
quien la tiene a cargo puede **devolverla** a una etapa anterior con un
motivo, si detecta algo que corregir — el proceso queda marcado como "en
corrección" hasta que se vuelve a completar correctamente. Todo el
historial (quién hizo qué y cuándo) queda registrado de forma permanente.

> **Nota sobre el pliego y la revisión de Coordinación:** después de que el
> Analista elabora y carga el pliego, el proceso **vuelve siempre a
> Coordinación** — nunca va directo a Consultoría Jurídica. Desde ahí,
> Coordinación decide el destino según el **tipo de proceso**: si es
> **Licitación**, lo remite a Consultoría Jurídica (igual que antes); si es
> **Compra menor**, lo aprueba y lo envía **directo a Publicación**, sin
> pasar por Jurídico. Esto reemplaza el paso anterior en el que el Analista
> enviaba el pliego directo a Jurídico en ambos casos.

> **Nota:** "Secretaría y Gerencia de Compras" es un solo puesto/etapa —
> antes existían por separado "Secretaría Administrativa" y "Gerente de
> Compras", pero se unificaron porque Secretaría siempre actuaba bajo las
> directrices de Gerencia de todas formas. Quien tenga este puesto recibe la
> solicitud recién creada, la revisa/archiva y asigna coordinador — con la
> misma libertad que ya tenía Gerencia de devolver el proceso al área
> requirente si hace falta corregir algo. Si tu proyecto de Supabase venía
> de antes de esta unificación, ver `SETUP.md` para la migración.

Una vez publicado, Gerencia de Compras da seguimiento a lo que antes se
llevaba a mano en el Excel de Compras Menores: registra la empresa
adjudicada y el monto, o declara el proceso **desierto** si no hubo ofertas
válidas; luego registra el número de orden de compra y, cuando se paga,
**cierra** el proceso. Cada tarjeta de proceso además tiene una sección
plegable de "Datos administrativos" (modalidad, referencia, números de
comunicación y de solicitud de pedido, monto presupuestado, si es parte del
PACC, y observaciones) — los mismos datos que antes solo vivían en el
Excel compartido, ahora dentro de Procomly. En "Dashboard" (pestaña
"Tiempos") se puede descargar un CSV con un renglón por proceso y todas
estas columnas, listo para reemplazar el reporte manual.

Cada tarjeta de proceso también tiene una sección plegable de "Editar
solicitud" para corregir los datos básicos que se llenaron al registrarla
(descripción, tipo de proceso, área requirente, solicitado por) si se
detecta un error después de creada — en cualquier etapa, incluso si el
proceso ya está cerrado. Solo puede usarla el Coordinador o el Analista
mientras tengan el proceso asignado, Secretaría y Gerencia de Compras en
cualquier proceso, o la administradora; cada corrección queda registrada en
el historial del proceso.

Cualquier persona puede crear su propia cuenta desde la pantalla de
inicio, pero queda sin ningún puesto asignado hasta que la administradora
se lo asigne desde "Áreas y usuarios" — antes de eso no ve ni puede hacer
nada. Desde ahí, la administradora también puede **desactivar** la cuenta
de alguien en cualquier momento: la persona pierde de inmediato todo
acceso a Procomly, pero conserva su historial en los procesos y puede
reactivarse cuando haga falta — pensado para cuando alguien deja el
puesto o se registró por error, sin tener que borrar su cuenta ni su
rastro.

Existe además un puesto especial, **Observador (solo lectura)**, para dar
acceso de demostración o revisión sin ningún riesgo: quien lo tenga ve
absolutamente todo (todos los procesos en cualquier etapa y área, el
directorio, Áreas y usuarios), pero no puede crear, editar, avanzar ni
borrar nada — la base de datos rechaza cualquier intento de escritura,
aunque alguien intentara saltarse la pantalla. Es útil para compartir una
sola cuenta de demostración entre varias personas que solo necesitan
revisar el sistema (ver `SETUP.md`, sección "Cuenta de demostración
compartida").

Quién puede actuar en cada etapa depende del **puesto** que la
administradora le haya asignado a cada persona (ver `SETUP.md`) — no de
quién dice ser dentro de la página. Una administradora puede, si hace falta,
forzar una acción en nombre de otra persona, pero esa acción queda siempre
registrada con el nombre real de la administradora, nunca suplantando a
otra persona.

Además, cada puesto solo ve lo que le corresponde: Coordinación y Análisis
solo ven los procesos que tienen asignados a ellos mismos, un Área
requirente solo ve los procesos de su propia área, y **Secretaría y
Gerencia de Compras solo ve los procesos que no tienen todavía a nadie de
ese puesto asignado, o los que tiene asignados a sí misma** — ya no ve
automáticamente los que ya están en manos de otra persona de Secretaría y
Gerencia de Compras. Jurídico y el Administrador siguen viendo todos los
procesos, porque necesitan seguimiento del flujo completo. Esta misma regla
aplica en todas partes (Procesos en curso, Dashboard, notificaciones): si un
proceso ya no le aparece a alguien de Secretaría y Gerencia de Compras, no
puede editarlo ni cuenta en sus estadísticas del Dashboard, aunque conozca
el número del proceso. La tabla de permisos completa está en `SETUP.md`.

## Dashboard

La pestaña "Dashboard" (antes "Panorama de tiempos") reúne en gráficos todo
el panorama de la Gerencia de Compras, organizado en pestañas internas para
no tener que hacer mucho scroll:

- **Resumen**: total de procesos registrados en el año en curso, total
  histórico, y un gráfico de procesos registrados por mes.
- **Puesto y estatus**: un gráfico con el tiempo promedio que llevan ahora
  mismo los procesos activos según quién los tiene (Secretaría y Gerencia de
  Compras, Coordinación, Análisis, Consultoría Jurídica, o el área requirente
  cuando un proceso está devuelto para corrección), y debajo la lista completa de
  esos procesos — cuánto tiempo lleva cada uno ahí y la última acción
  registrada en su historial, tal cual quedó anotada. Los que llevan más de
  3 días se resaltan en rojo. Haz clic en cualquiera para ir directo a ese
  proceso en "Procesos en curso".
- **Por coordinación**: total de procesos de Licitaciones vs. Compras
  menores (histórico), y ese mismo desglose mes a mes.
- **Áreas**: las 10 áreas requirentes con más procesos registrados, y debajo
  el detalle de **todas** las áreas (no solo las 10 primeras): cuántos
  procesos tiene cada una, su tiempo promedio hasta publicar, y — al hacer
  clic para desplegarla — la lista de sus procesos activos con más tiempo
  en curso.
- **Presupuesto**: los 10 procesos con mayor monto presupuestado y su área.
- **Tiempos**: los gráficos originales de tiempo promedio por etapa y por
  área, la tabla de procesos por área requirente, y los botones para
  descargar los CSV de procesos e historial.

En todos los gráficos organizados por mes, el mes en curso queda resaltado
con un borde de color para ubicarlo de un vistazo.

## Bandeja de notificaciones

En la parte superior, junto a tu nombre, hay una campanita 🔔 con un contador
de avisos sin leer. Te avisa automáticamente cada vez que: se te asigna una
acción dentro de un proceso, cambia algo en un proceso que tú registraste,
—si eres Coordinador o de Secretaría y Gerencia de Compras— cambia algo en
un proceso que tienes asignado (Coordinación) o en un proceso que todavía
puedes ver (Secretaría y Gerencia de Compras — ver más arriba), o alguien te
**etiqueta con @ en el Chat** (ver más abajo). Al hacer clic en un aviso, te
marca ese aviso como leído y te lleva directo a la tarjeta del proceso
correspondiente (o, si es una mención de chat, directo al chat). Por ahora
esta bandeja vive únicamente dentro de la aplicación — ver la sección de
abajo sobre correos.

## Notificaciones por correo — registradas, sin enviar todavía

Cada vez que un proceso cambia de etapa o se devuelve, la aplicación
registra una notificación (a quién iba dirigida, asunto y cuerpo) en la
tabla `notifications_log` de Supabase y muestra un aviso en pantalla, pero
**todavía no envía ningún correo real**. Se dejó así intencionalmente para
no enviar correos hasta que el equipo de TI de ETED conecte una cuenta real
de Microsoft 365/Outlook.

Para activar el envío real hace falta un pequeño servicio adicional (por
ejemplo, una Supabase Edge Function) que lea `notifications_log` y llame a
la Microsoft Graph API con credenciales guardadas de forma segura del lado
del servidor — nunca directamente en esta página, ya que es pública. Es un
paso natural para dar una vez el resto de Procomly esté en uso.

## Chat — solo durante la etapa de prueba

Mientras Procomly esté en período de prueba, el ícono 💬 de la barra
superior (justo al lado de la campanita 🔔) abre un menú desplegable con dos
cosas pensadas para ese momento y **no para quedarse para siempre**. Ya no
es una pestaña del menú lateral — así queda a mano desde cualquier pantalla
de la aplicación, igual que las notificaciones:

- **Chat general**: una sola sala compartida donde cualquiera con un puesto
  asignado (menos Observador, que es de solo lectura) puede escribir y leer
  mensajes, para comentar dudas o avisos del día a día mientras el equipo se
  acostumbra a la aplicación. No es un chat por proceso — es uno solo, para
  todos. Se puede **etiquetar a una persona** escribiendo `@` seguido de su
  nombre — aparece una lista para elegirla, y al enviarse el mensaje le
  llega una notificación real a su campanita 🔔 (además de quedar resaltada
  su mención dentro del mensaje).
- **Todos los procesos**: una lista de lo último que se ha hecho en
  cualquier proceso del sistema (quién, qué acción, en qué proceso), no
  solo los que a cada persona le tocan normalmente. Es distinta de
  "Actividad reciente" en Inicio — esa sigue mostrando, como siempre, solo
  lo que le corresponde ver a cada quien; "Todos los procesos" es
  deliberadamente más amplia, y solo mientras dure la prueba.

Los mensajes y el historial de "Todos los procesos" **no afectan en nada**
a "Procesos en curso" ni al resto de la aplicación — cada Coordinador,
Analista, etc. sigue viendo únicamente lo suyo en todas las demás
pantallas, exactamente igual que antes. El chat se actualiza con el mismo
mecanismo que el resto de Procomly (cada 60 segundos o al pulsar
"Actualizar"), no en tiempo real — salvo mientras estés escribiendo un
mensaje, para no perderte lo que llevas escrito.

Como es algo pensado solo para la prueba, la administradora tiene un
interruptor para apagarlo con un clic en **Áreas y usuarios → 🧪 Modo de
prueba**, sin tocar código ni Supabase. Al apagarlo, el ícono 💬 desaparece
de la barra para todos los demás (los mensajes no se borran, solo se
ocultan); la administradora sigue viendo el ícono para poder revisar el
historial o volver a activarlo cuando quiera. También puede borrar mensajes
puntuales del chat en cualquier momento (por ejemplo, si alguien escribe
algo por error), desde el mismo chat.

## ¿Preguntas?

Revisa primero `SETUP.md` — cubre la creación del proyecto, la conexión y
las preguntas frecuentes más comunes (seguridad, archivos adjuntos, costos,
contraseñas olvidadas).
