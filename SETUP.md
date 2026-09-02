# Guía de configuración — Procomly (ETED)

Esta guía te lleva, paso a paso, desde cero hasta tener Procomly funcionando
con una base de datos real, segura y en línea. No necesitas saber programar —
solo ir siguiendo los pasos en orden.

En total son tres partes:

1. Crear tu proyecto de Supabase (la base de datos + el sistema de usuarios).
2. Conectar la página web a ese proyecto.
3. Crear tu propio usuario y volverte administradora.

---

## Parte 1 — Crear el proyecto de Supabase

Supabase es el servicio que guarda toda la información (los procesos, los
usuarios, los archivos adjuntos) de forma segura y permanente. Tiene un plan
gratuito que es más que suficiente para Procomly.

1. Entra a **https://supabase.com** y haz clic en **Start your project** (o
   **Sign in** si ya tienes cuenta). Puedes crear la cuenta con tu correo o
   con tu cuenta de GitHub.
2. Una vez dentro, haz clic en **New project**.
3. Completa:
   - **Name**: por ejemplo `eted-licitaciones`.
   - **Database Password**: crea una contraseña fuerte y **guárdala en un
     lugar seguro** (no la necesitarás para el día a día, pero es importante
     conservarla).
   - **Region**: elige la más cercana (por ejemplo, una en Estados Unidos si
     no hay una específica para República Dominicana).
4. Haz clic en **Create new project** y espera 1-2 minutos mientras Supabase
   prepara todo.

### Ejecutar el esquema de la base de datos

Este paso crea todas las tablas (procesos, usuarios, áreas, etc.) y, muy
importante, las **reglas de seguridad** que determinan quién puede ver y
hacer qué — esa es la parte que hace que la aplicación sea "bien segura":
esas reglas viven dentro de la propia base de datos, no solo en la página
web, así que nadie puede saltárselas así tenga conocimientos técnicos.

1. En el menú de la izquierda de tu proyecto, haz clic en el ícono de
   **SQL Editor**.
2. Haz clic en **New query**.
3. Abre el archivo **`supabase-schema.sql`** de este repositorio (con
   cualquier editor de texto, o directamente en GitHub), selecciona todo su
   contenido (Ctrl/Cmd + A) y cópialo (Ctrl/Cmd + C).
4. Pégalo en el SQL Editor de Supabase y haz clic en **Run** (o Ctrl/Cmd +
   Enter).
5. Debe terminar con un mensaje de éxito ("Success. No rows returned"). Si
   ves un error, revisa que hayas copiado el archivo completo desde la
   primera hasta la última línea, y vuelve a intentarlo.

Este mismo script deja creado el "almacén" (bucket) de Supabase Storage
donde se guardarán los archivos adjuntos, llamado `attachments`, ya
configurado como privado. Puedes confirmarlo entrando al ícono de
**Storage** en el menú izquierdo: debe aparecer un bucket llamado
`attachments`.

### Confirmar que el inicio de sesión por correo esté activado

Normalmente ya viene activado por defecto, pero conviene confirmarlo:

1. Ve a **Authentication → Providers** (ícono de candado en el menú
   izquierdo, luego la pestaña "Providers" o "Sign In / Providers").
2. Verifica que **Email** esté habilitado (en verde / "Enabled").
3. Opcional pero recomendado: en **Authentication → URL Configuration**,
   revisa que la "Site URL" corresponda a la dirección donde publicarás
   Procomly (por ejemplo `https://tu-usuario.github.io/PCC-ETED/`) una vez
   la tengas — esto hace que los correos de confirmación y de recuperación
   de contraseña lleven a la página correcta. Puedes dejarlo con el valor
   por defecto por ahora y ajustarlo después.

### Obtener la URL y la clave pública ("anon key")

1. Ve a **Settings → API** (ícono de engranaje, luego "API").
2. Copia el valor de **Project URL** (algo como
   `https://abcdefghijk.supabase.co`).
3. Copia el valor de **anon public** (una clave larga de letras y números,
   bajo "Project API keys").

Esta clave pública es segura de compartir dentro del código de la página —
por diseño, cualquiera puede verla, y aun así no puede hacer nada indebido
porque las reglas de seguridad del Paso 1 son las que de verdad deciden qué
se puede hacer. **Nunca** copies aquí la clave llamada `service_role` — esa
sí es secreta.

---

## Parte 2 — Conectar la página web a tu proyecto

1. Abre el archivo **`config.js`** de este repositorio.
2. Reemplaza los dos valores de ejemplo:

   ```js
   window.ETED_CONFIG = {
     SUPABASE_URL: "PEGA_AQUI_LA_URL_DE_TU_PROYECTO",
     SUPABASE_ANON_KEY: "PEGA_AQUI_TU_ANON_KEY"
   };
   ```

   por los que copiaste en el paso anterior, por ejemplo:

   ```js
   window.ETED_CONFIG = {
     SUPABASE_URL: "https://abcdefghijk.supabase.co",
     SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9....."
   };
   ```

3. Guarda el archivo.

Si vas a publicar el sitio en GitHub Pages, sigue las instrucciones del
**`README.md`** de este repositorio para subir todos los archivos (incluido
este `config.js` ya editado) y activar GitHub Pages. Recuerda: los archivos
deben quedar en la **raíz** del repositorio, no dentro de una subcarpeta.

---

## Parte 3 — Crear tu usuario y volverte administradora

Por seguridad, esta aplicación no trae ningún usuario ni contraseña de
fábrica — cada persona crea su propia cuenta, y luego una administradora le
asigna su puesto. Tú serás la primera administradora.

1. Abre la página ya publicada (o `index.html` en tu computadora mientras
   pruebas).
2. Haz clic en la pestaña **"Crear cuenta"**, escribe tu correo y una
   contraseña, y confirma.
3. Según cómo haya quedado configurada la confirmación por correo en tu
   proyecto, es posible que te pida revisar tu bandeja de entrada y hacer
   clic en un enlace antes de poder entrar. Si no llega el correo revisa la
   carpeta de spam.
4. Una vez que puedas iniciar sesión, ya existe tu cuenta — pero todavía sin
   ningún puesto asignado. Para convertirte en administradora, vuelve al
   **SQL Editor** de Supabase (Parte 1) y corre esta instrucción,
   reemplazando el correo por el que usaste:

   ```sql
   update public.profiles
   set is_admin = true
   where email = 'tu-correo@ejemplo.com';
   ```

5. Haz clic en **Run**. Ese "update" afecta solo a esa fila y es seguro de
   ejecutar.
6. Vuelve a la aplicación y actualiza la página (o haz clic en
   "Actualizar"). Ahora deberías ver la pestaña **"Áreas y usuarios"**,
   señal de que ya tienes permisos de administradora.

### Agregar al resto del equipo

A partir de aquí, todo se hace desde la propia aplicación, sin volver a
tocar Supabase:

1. Cada persona del equipo entra a la página y crea su propia cuenta desde
   "Crear cuenta" (con su correo real).
2. Tú, como administradora, entras a **"Áreas y usuarios"**. Ahí verás a
   cada persona que se haya registrado, marcada como "Sin puesto asignado —
   pendiente".
3. Haz clic en **"Perfil" → "Editar perfil"** de esa persona y asígnale su
   puesto (Secretaría, Gerencia, Coordinador, Analista, Jurídico, o Área
   requirente con su área correspondiente), su nombre completo y los demás
   datos. Guarda los cambios.
4. Esa persona ya puede usar Procomly con su propia cuenta y solo verá
   habilitadas las acciones que le correspondan a su puesto.

---

## Preguntas frecuentes

**¿Qué pasa si alguien intenta hacer algo que no le corresponde?**
La aplicación se lo impide visualmente (el botón aparece bloqueado), y aunque
alguien intentara forzarlo por otros medios, la base de datos misma rechaza
la acción — las reglas de seguridad (Row Level Security) y una validación
adicional de "qué pasos son válidos" viven en Supabase, no solo en la
página web.

**¿Dónde se guardan los archivos adjuntos?**
En Supabase Storage, en el bucket privado `attachments`. Nadie puede acceder
a ellos directamente por internet — solo se pueden ver dentro de la
aplicación, con enlaces temporales que expiran a los pocos minutos.

**¿Cuánto cuesta esto?**
El plan gratuito de Supabase incluye base de datos, autenticación y
almacenamiento con límites generosos, más que suficientes para el uso normal
de Procomly dentro de la gerencia. Si en el futuro el uso crece mucho,
Supabase avisa antes de necesitar pasar a un plan pago.

**Perdí mi contraseña de administradora, ¿qué hago?**
Usa el enlace "¿Olvidaste tu contraseña?" en la pantalla de inicio de
sesión — te llegará un correo para restablecerla, igual que en cualquier
otra aplicación.

**¿Puedo tener más de una administradora?**
Sí — repite el `update` de la Parte 3 con el correo de cada persona que
quieras que tenga permisos de administradora.
