# Procomly — ETED

**Procomly** (Proceso de Compras y Licitaciones Automatizado)

Herramienta interna para dar seguimiento a cada solicitud de compra o
licitación de la Gerencia de Compras de ETED (Empresa de Transmisión
Eléctrica Dominicana), desde que la registra el área requirente hasta que se
publica, pasando por Secretaría Administrativa, Gerencia de Compras,
Coordinación, Análisis y Consultoría Jurídica.

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

Cada solicitud de compra pasa, en orden, por: **Secretaría Administrativa →
Gerencia de Compras → Coordinación → Análisis → (Consultoría Jurídica) →
Publicación → Adjudicación → Orden de compra → Pago → Cierre**. En cualquier
etapa previa a la publicación, quien la tiene a cargo puede **devolverla** a
una etapa anterior con un motivo, si detecta algo que corregir — el proceso
queda marcado como "en corrección" hasta que se vuelve a completar
correctamente. Todo el historial (quién hizo qué y cuándo) queda registrado
de forma permanente.

Una vez publicado, Gerencia de Compras da seguimiento a lo que antes se
llevaba a mano en el Excel de Compras Menores: registra la empresa
adjudicada y el monto, o declara el proceso **desierto** si no hubo ofertas
válidas; luego registra el número de orden de compra y, cuando se paga,
**cierra** el proceso. Cada tarjeta de proceso además tiene una sección
plegable de "Datos administrativos" (modalidad, referencia, números de
comunicación y de solicitud de pedido, monto presupuestado, si es parte del
PACC, y observaciones) — los mismos datos que antes solo vivían en el
Excel compartido, ahora dentro de Procomly. En "Panorama de tiempos" se
puede descargar un CSV con un renglón por proceso y todas estas columnas,
listo para reemplazar el reporte manual.

Cada tarjeta de proceso también tiene una sección plegable de "Editar
solicitud" para corregir los datos básicos que se llenaron al registrarla
(descripción, tipo de proceso, área requirente, solicitado por) si se
detecta un error después de creada — en cualquier etapa, incluso si el
proceso ya está cerrado. Solo puede usarla el Coordinador o el Analista
mientras tengan el proceso asignado, el Gerente de Compras en cualquier
proceso, o la administradora; cada corrección queda registrada en el
historial del proceso.

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
solo ven los procesos que tienen asignados a ellos mismos, y un Área
requirente solo ve los procesos de su propia área — el resto de los puestos
(Secretaría, Gerencia, Jurídico, Administrador) ven todos los procesos,
porque necesitan seguimiento del flujo completo. La tabla de permisos
completa está en `SETUP.md`.

## Bandeja de notificaciones

En la parte superior, junto a tu nombre, hay una campanita 🔔 con un contador
de avisos sin leer. Te avisa automáticamente cada vez que: se te asigna una
acción dentro de un proceso, cambia algo en un proceso que tú registraste, o
—si eres Coordinador o Gerente de Compras— cambia algo en un proceso que
tienes asignado (Coordinación) o en cualquier proceso (Gerencia). Al hacer
clic en un aviso, te marca ese aviso como leído y te lleva directo a la
tarjeta del proceso correspondiente. Por ahora esta bandeja vive únicamente
dentro de la aplicación — ver la sección de abajo sobre correos.

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

## ¿Preguntas?

Revisa primero `SETUP.md` — cubre la creación del proyecto, la conexión y
las preguntas frecuentes más comunes (seguridad, archivos adjuntos, costos,
contraseñas olvidadas).
