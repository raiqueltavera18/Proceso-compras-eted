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

### Agregar al resto del equipo (invitar por correo)

A partir de aquí, todo se hace desde la propia aplicación, sin volver a
tocar Supabase. La forma recomendada es que tú invites primero — así cada
persona entra ya con su puesto y permisos asignados, y solo tiene que poner
su contraseña:

1. Entra a **"Áreas y usuarios" → "Invitar persona"**.
2. Escribe el correo real de la persona, su nombre (opcional), marca su
   puesto (Secretaría, Gerencia, Coordinador, Analista, Jurídico, o Área
   requirente con su área correspondiente) y si va a ser administradora.
   Haz clic en **Invitar**.
3. Avísale tú misma a esa persona — por correo, WhatsApp, como prefieras —
   que entre a Procomly y cree su cuenta ("Crear cuenta") usando **ese mismo
   correo**. En cuanto lo haga, automáticamente queda con el puesto y los
   permisos que ya le asignaste, sin que tengas que volver a tocar nada.
4. Mientras esa persona no haya creado su cuenta, la verás listada bajo
   "Personas invitadas — todavía no han creado su cuenta", con botones para
   **Editar** (corregir el puesto o los datos que le asignaste) o
   **Cancelar invitación**.

También puede pasar que alguien cree su cuenta por su cuenta, sin que la
hayas invitado antes (por ejemplo, si le compartes el enlace del sitio sin
más). En ese caso aparecerá en el **Directorio de usuarios** marcada como
"Sin puesto asignado — pendiente", y le asignas su puesto igual que antes,
con **"Perfil" → "Editar perfil"**.

---

## Tabla de permisos por puesto

Esto es lo que cada puesto puede y no puede hacer dentro de Procomly. Estas
reglas no son solo visuales: están aplicadas dentro de la propia base de
datos (Row Level Security), así que aunque alguien intentara forzarlas por
otro medio, quedan bloqueadas igual. Una persona puede tener más de un
puesto a la vez (por ejemplo, ser Analista y también de Consultoría
Jurídica) — en ese caso puede hacer todo lo que cualquiera de sus puestos le
permita.

| Puesto | Qué procesos ve | Puede crear una solicitud nueva | Puede actuar (avanzar / devolver) | Adjuntar archivos | Áreas y usuarios |
|---|---|---|---|---|---|
| **Administrador** | Todos, sin excepción | Sí, para cualquier área | Sí, en cualquier etapa (queda registrado a su propio nombre) | Sí, en cualquier proceso | Crear/editar áreas, invitar personas, asignar cualquier puesto (incluido administrador) |
| **Secretaría Administrativa** | Todos | No | Solo cuando el proceso está en la etapa "Secretaría" | Sí, en los procesos que ve | Solo puede ver el directorio (lectura) |
| **Gerencia de Compras** | Todos | No | Solo en las etapas "Gerencia", "Publicación", y todo el seguimiento posterior a la publicación (adjudicar, declarar desierto, registrar orden de compra, marcar pagado y cerrar) | Sí, en los procesos que ve | Solo lectura |
| **Coordinador** | Solo los procesos que tiene asignados a él/ella | No | Solo en la etapa "Coordinador", en sus procesos asignados | Sí, en sus procesos | Solo lectura |
| **Analista** | Solo los procesos que tiene asignados a él/ella | No | Solo en las etapas "Analista" y "Corrección", en sus procesos asignados | Sí, en sus procesos | Solo lectura |
| **Consultoría Jurídica** | Todos | No | Solo en la etapa "Jurídico" | Sí, en los procesos que ve | Solo lectura |
| **Área requirente** | Solo los procesos de su propia área | Sí, únicamente para su propia área | Solo en la etapa "Área — corrigiendo", en procesos de su área | Sí, en los procesos de su área | Solo lectura |

Notas:

- "Puede actuar" incluye siempre la opción de **devolver** el proceso a una
  etapa anterior con un motivo, cuando le corresponde actuar en la etapa
  actual — no es una acción aparte.
- La **bitácora de notificaciones** (registro de qué se "notificó" y
  cuándo) y las **invitaciones** solo las puede ver y usar el administrador.
- Una persona sin ningún puesto asignado todavía (recién registrada, sin
  invitación previa) no puede hacer nada dentro de Procomly hasta que un
  administrador le asigne su puesto.

---

## Preguntas frecuentes

**¿Qué pasa si alguien intenta hacer algo que no le corresponde?**
La aplicación se lo impide visualmente (el botón aparece bloqueado), y aunque
alguien intentara forzarlo por otros medios, la base de datos misma rechaza
la acción — las reglas de seguridad (Row Level Security) y una validación
adicional de "qué pasos son válidos" viven en Supabase, no solo en la
página web.

**Me sale "permission denied for table..." al iniciar sesión**
Significa que el proyecto se creó con una versión de `supabase-schema.sql`
anterior a la que incluye los permisos base de tabla. Ve al **SQL Editor**
de tu proyecto, corre una vez esto y vuelve a intentar:

```sql
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
```

**Ya tenía mi proyecto creado antes de que existieran las invitaciones — ¿cómo lo actualizo?**
Si creaste tu proyecto antes de esta versión (no tienes todavía "Invitar
persona" en Áreas y usuarios), ve al **SQL Editor** de tu proyecto y corre
esto una sola vez — es seguro, no borra nada de lo que ya tienes:

```sql
alter table public.areas add column if not exists secretary_name text not null default '';
alter table public.areas add column if not exists secretary_contact text not null default '';

create table if not exists public.pending_profiles (
  email           text primary key,
  full_name       text not null default '',
  employee_id     text not null default '',
  position_title  text not null default '',
  department      text not null default '',
  area_id         uuid references public.areas (id) on delete set null,
  roles           text[] not null default '{}',
  coord_tipos     text[] not null default '{}',
  is_admin        boolean not null default false,
  created_at      timestamptz not null default now()
);
alter table public.pending_profiles enable row level security;
drop policy if exists "pending_profiles_admin_only" on public.pending_profiles;
create policy "pending_profiles_admin_only" on public.pending_profiles for all
  to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.pending_profiles to anon, authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare invite public.pending_profiles;
begin
  select * into invite from public.pending_profiles where lower(email) = lower(new.email) limit 1;
  if found then
    insert into public.profiles (id, email, full_name, employee_id, position_title, department, area_id, roles, coord_tipos, is_admin)
    values (new.id, new.email, invite.full_name, invite.employee_id, invite.position_title, invite.department, invite.area_id, invite.roles, invite.coord_tipos, invite.is_admin);
    delete from public.pending_profiles where lower(email) = lower(new.email);
  else
    insert into public.profiles (id, email) values (new.id, new.email);
  end if;
  return new;
end;
$$;

create or replace function public.can_view_case(target_case_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.cases c
    where c.id = target_case_id
      and (
        public.is_admin()
        or public.has_role('secretaria')
        or public.has_role('gerente')
        or public.has_role('juridico')
        or (public.has_role('coordinador') and c.coordinador_id = auth.uid())
        or (public.has_role('analista') and c.analista_id = auth.uid())
        or (public.has_role('area') and c.area_id = public.my_area_id())
      )
  );
$$;

drop policy if exists "cases_select_authenticated" on public.cases;
drop policy if exists "cases_select_scoped" on public.cases;
create policy "cases_select_scoped" on public.cases for select to authenticated using (public.can_view_case(id));

drop policy if exists "case_events_select_authenticated" on public.case_events;
drop policy if exists "case_events_select_scoped" on public.case_events;
create policy "case_events_select_scoped" on public.case_events for select to authenticated using (public.can_view_case(case_id));

drop policy if exists "attachments_select_authenticated" on public.attachments;
drop policy if exists "attachments_select_scoped" on public.attachments;
create policy "attachments_select_scoped" on public.attachments for select to authenticated using (public.can_view_case(case_id));
```

Después de correrlo, sube también los archivos `app.js`, `supabase-schema.sql`
y `SETUP.md` actualizados a tu repositorio de GitHub (reemplazando los que
ya tenías) para que la pantalla de "Invitar persona" aparezca.

**Ya tenía mi proyecto creado antes del seguimiento posterior a la publicación (adjudicación, orden de compra, pago, cierre) — ¿cómo lo actualizo?**
Si tus procesos publicados todavía se quedan "terminados" sin más pasos
(no ves "Registrar adjudicación" en un proceso publicado), corre esto una
sola vez en el **SQL Editor** de tu proyecto — es seguro, no borra ni
modifica ningún proceso que ya tengas:

```sql
alter table public.cases
  add column if not exists modalidad                 text not null default '',
  add column if not exists referencia                 text not null default '',
  add column if not exists no_comunicacion            text not null default '',
  add column if not exists no_solicitud_pedido        text not null default '',
  add column if not exists proceso_pacc               boolean not null default false,
  add column if not exists monto_presupuestado        numeric,
  add column if not exists monto_adjudicado           numeric,
  add column if not exists empresa_adjudicada         text not null default '',
  add column if not exists no_orden_compra             text not null default '',
  add column if not exists fecha_publicacion           date,
  add column if not exists fecha_adjudicacion          date,
  add column if not exists fecha_orden                 date,
  add column if not exists fecha_asignacion_analista    date,
  add column if not exists fecha_salida_correccion      date,
  add column if not exists fecha_entrada_corregido      date,
  add column if not exists estatus_legado               text not null default '',
  add column if not exists analista_legado               text not null default '',
  add column if not exists observaciones                text not null default '';

alter table public.cases drop constraint if exists cases_stage_check;
alter table public.cases add constraint cases_stage_check
  check (stage in ('secretaria','gerente','coordinador','analista','correccion',
                    'area-correccion','juridico','publicacion','publicado',
                    'adjudicado','desierto','pendiente-pago','cerrado','cancelado'));

create or replace function public.enforce_case_transition()
returns trigger language plpgsql as $$
declare allowed text[];
begin
  if public.is_admin() then return new; end if;
  if old.stage = new.stage then return new; end if;
  allowed := case old.stage
    when 'secretaria'      then array['gerente','cancelado']
    when 'gerente'         then array['coordinador','secretaria','area-correccion','cancelado']
    when 'coordinador'     then array['analista','secretaria','gerente','area-correccion','cancelado']
    when 'analista'        then array['juridico','secretaria','gerente','coordinador','area-correccion','cancelado']
    when 'correccion'      then array['juridico','area-correccion','cancelado']
    when 'area-correccion' then array['analista','cancelado']
    when 'juridico'        then array['publicacion','secretaria','gerente','coordinador','analista','area-correccion','cancelado']
    when 'publicacion'     then array['publicado','cancelado']
    when 'publicado'       then array['adjudicado','desierto','cancelado']
    when 'adjudicado'      then array['pendiente-pago','cancelado']
    when 'pendiente-pago'  then array['cerrado']
    else array[]::text[]
  end;
  if not (new.stage = any(allowed)) then
    raise exception 'Transición de etapa no permitida: % -> %', old.stage, new.stage;
  end if;
  return new;
end;
$$;

drop policy if exists "cases_update_stage_owner" on public.cases;
create policy "cases_update_stage_owner" on public.cases for update to authenticated
  using (
    public.is_admin()
    or (stage = 'secretaria' and public.has_role('secretaria') and (secretaria_id is null or secretaria_id = auth.uid()))
    or (stage = 'gerente' and public.has_role('gerente') and (gerente_id is null or gerente_id = auth.uid()))
    or (stage = 'publicacion' and public.has_role('gerente'))
    or (stage = 'coordinador' and coordinador_id = auth.uid())
    or (stage in ('analista','correccion') and analista_id = auth.uid())
    or (stage = 'area-correccion' and public.has_role('area') and area_id = public.my_area_id())
    or (stage = 'juridico' and public.has_role('juridico'))
    or (stage in ('publicado','adjudicado','pendiente-pago') and public.has_role('gerente'))
  ) with check (true);

drop policy if exists "case_events_insert_if_can_act_on_case" on public.case_events;
create policy "case_events_insert_if_can_act_on_case" on public.case_events for insert to authenticated
  with check (
    actor_id = auth.uid()
    and exists (
      select 1 from public.cases c
      where c.id = case_id
        and (
          public.is_admin()
          or (c.stage = 'secretaria' and public.has_role('secretaria'))
          or (c.stage = 'gerente' and public.has_role('gerente') and (c.gerente_id is null or c.gerente_id = auth.uid()))
          or (c.stage = 'publicacion' and public.has_role('gerente'))
          or (c.stage = 'coordinador' and c.coordinador_id = auth.uid())
          or (c.stage in ('analista','correccion') and c.analista_id = auth.uid())
          or (c.stage = 'area-correccion' and public.has_role('area') and c.area_id = public.my_area_id())
          or (c.stage = 'juridico' and public.has_role('juridico'))
          or (c.stage in ('publicado','adjudicado','pendiente-pago') and public.has_role('gerente'))
        )
    )
  );
```

Después de correrlo, sube también los archivos `app.js`, `supabase-schema.sql`
y `SETUP.md` actualizados a tu repositorio de GitHub (reemplazando los que
ya tenías).

**Ya tenía mi proyecto creado antes de poder editar la solicitud (descripción, tipo, área, solicitante) después de creada — ¿cómo lo actualizo?**
Si al abrir un proceso no ves la sección "Editar solicitud", corre esto una
sola vez en el **SQL Editor** de tu proyecto — es seguro, no borra ni
modifica ningún proceso que ya tengas:

```sql
create or replace function public.edit_case_basic_fields(
  p_case_id uuid,
  p_title text,
  p_tipo text,
  p_area_id uuid,
  p_solicitante text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.cases%rowtype;
  me public.profiles%rowtype;
  cambios text := '';
begin
  select * into c from public.cases where id = p_case_id;
  if not found then
    raise exception 'Proceso no encontrado';
  end if;

  if not (
    public.is_admin()
    or public.has_role('gerente')
    or (public.has_role('coordinador') and c.coordinador_id = auth.uid())
    or (public.has_role('analista') and c.analista_id = auth.uid())
  ) then
    raise exception 'No tienes permiso para editar los datos de este proceso';
  end if;

  if p_tipo not in ('menor','licitacion') then
    raise exception 'Tipo de proceso inválido';
  end if;

  select * into me from public.profiles where id = auth.uid();

  if c.title is distinct from p_title then
    cambios := cambios || 'descripción: "' || c.title || '" → "' || p_title || '". ';
  end if;
  if c.tipo is distinct from p_tipo then
    cambios := cambios || 'tipo: "' || c.tipo || '" → "' || p_tipo || '". ';
  end if;
  if c.area_id is distinct from p_area_id then
    cambios := cambios || 'área requirente cambiada. ';
  end if;
  if c.solicitante is distinct from p_solicitante then
    cambios := cambios || 'solicitado por: "' || c.solicitante || '" → "' || p_solicitante || '". ';
  end if;

  update public.cases
  set title = p_title, tipo = p_tipo, area_id = p_area_id, solicitante = p_solicitante
  where id = p_case_id;

  if cambios <> '' then
    insert into public.case_events (case_id, stage_held, actor_id, actor_name, role_label, action, note, duration_ms)
    values (p_case_id, c.stage, auth.uid(), coalesce(nullif(me.full_name, ''), me.email, ''), 'Edición de solicitud', 'editó los datos de la solicitud', cambios, 0);
  end if;
end;
$$;

grant execute on function public.edit_case_basic_fields(uuid, text, text, uuid, text) to authenticated;
```

Después de correrlo, sube también los archivos `app.js` y `supabase-schema.sql`
actualizados a tu repositorio de GitHub (reemplazando los que ya tenías).

**Al confirmar mi correo me manda a una página que no carga ("localhost rechazó la conexión")**
Es normal y no significa que algo falló: tu cuenta ya quedó confirmada en
Supabase, solo que la página a la que te redirige después de confirmar
("Site URL") todavía apunta a una dirección de prueba por defecto. Para
corregirlo: en Supabase ve a **Authentication → URL Configuration** y
cambia la **Site URL** por la dirección real de tu sitio (por ejemplo
`https://tu-usuario.github.io/nombre-del-repo/`). Mientras tanto, puedes
ignorar esa página y simplemente volver a abrir tu sitio e iniciar sesión
normalmente.

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
