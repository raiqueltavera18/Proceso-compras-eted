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
   puesto (Secretaría y Gerencia de Compras, Coordinador, Analista,
   Jurídico, o Área requirente con su área correspondiente) y si va a ser
   administradora. Haz clic en **Invitar**.
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
| **Secretaría y Gerencia de Compras** | Solo los que no tienen todavía a nadie de este puesto asignado, o los que tiene asignados a ella misma — ya no ve automáticamente los que ya están en manos de otra persona de este mismo puesto | No | Solo en las etapas "Secretaría y Gerencia de Compras" y "Publicación", y todo el seguimiento posterior a la publicación (adjudicar, declarar desierto, registrar orden de compra, marcar pagado y cerrar) — siempre dentro de los procesos que puede ver (columna anterior) | Sí, en los procesos que ve | Solo lectura |
| **Coordinador** | Solo los procesos que tiene asignados a él/ella | No | En las etapas "Coordinador" y "Coordinador — revisando pliego" (tras recibirlo de vuelta del Analista), en sus procesos asignados | Sí, en sus procesos | Solo lectura |
| **Analista** | Solo los procesos que tiene asignados a él/ella | No | Solo en las etapas "Analista" y "Corrección", en sus procesos asignados — al terminar el pliego lo remite de vuelta a Coordinación (ya no directo a Jurídico) | Sí, en sus procesos | Solo lectura |
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

**Ya tenía mi proyecto creado antes de la bandeja de notificaciones (la campanita 🔔) — ¿cómo lo actualizo?**
Si no ves el ícono de la campanita junto a tu nombre en la parte superior,
corre esto una sola vez en el **SQL Editor** de tu proyecto — es seguro, no
borra ni modifica ningún proceso que ya tengas:

```sql
alter table public.cases
  add column if not exists created_by uuid references public.profiles (id);

create table if not exists public.notifications (
  id            uuid primary key default gen_random_uuid(),
  recipient_id  uuid not null references public.profiles (id) on delete cascade,
  case_id       uuid references public.cases (id) on delete cascade,
  kind          text not null default '',
  title         text not null,
  body          text not null default '',
  read          boolean not null default false,
  created_at    timestamptz not null default now()
);

alter table public.notifications enable row level security;
grant select, insert, update, delete on public.notifications to anon, authenticated;

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
  on public.notifications for select
  to authenticated
  using (recipient_id = auth.uid() or public.is_admin());

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
  on public.notifications for update
  to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

create or replace function public.fanout_case_event_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.cases%rowtype;
  ger record;
  already uuid[] := '{}';
  resumen text;
begin
  select * into c from public.cases where id = new.case_id;
  if not found then return new; end if;

  resumen := trim(coalesce(new.actor_name, '') || ' ' || coalesce(new.action, ''));

  if c.coordinador_id is not null and c.coordinador_id <> new.actor_id then
    insert into public.notifications (recipient_id, case_id, kind, title, body)
    values (c.coordinador_id, c.id, 'proceso', c.title, resumen);
    already := already || c.coordinador_id;
  end if;

  if c.analista_id is not null and c.analista_id <> new.actor_id and not (c.analista_id = any(already)) then
    insert into public.notifications (recipient_id, case_id, kind, title, body)
    values (c.analista_id, c.id, 'proceso', c.title, resumen);
    already := already || c.analista_id;
  end if;

  if c.created_by is not null and c.created_by <> new.actor_id and not (c.created_by = any(already)) then
    insert into public.notifications (recipient_id, case_id, kind, title, body)
    values (c.created_by, c.id, 'proceso', c.title, resumen);
    already := already || c.created_by;
  end if;

  for ger in select id from public.profiles where 'gerente' = any(roles) and active loop
    if ger.id <> new.actor_id and not (ger.id = any(already)) then
      insert into public.notifications (recipient_id, case_id, kind, title, body)
      values (ger.id, c.id, 'proceso', c.title, resumen);
      already := already || ger.id;
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists case_events_notify on public.case_events;
create trigger case_events_notify
  after insert on public.case_events
  for each row execute procedure public.fanout_case_event_notifications();
```

Después de correrlo, sube también los archivos `app.js`, `styles.css` y
`supabase-schema.sql` actualizados a tu repositorio de GitHub (reemplazando
los que ya tenías). La campanita te avisará, de ahora en adelante, cada vez
que se te asigne una acción en un proceso, cuando cambie algo en un proceso
que tú registraste, o (si eres de Secretaría y Gerencia de Compras)
cualquier cambio en cualquier proceso — todavía **solo dentro de la
aplicación**, no por correo.

**Ya tenía mi proyecto creado antes de poder desactivar cuentas — ¿cómo lo actualizo?**
Si en el Directorio de usuarios ("Áreas y usuarios") no ves el botón
"Desactivar" junto a cada persona, corre esto una sola vez en el **SQL
Editor** de tu proyecto — es seguro, no borra ni modifica ningún proceso ni
ninguna cuenta que ya tengas:

```sql
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid() and active), false);
$$;

create or replace function public.has_role(check_role text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select check_role = any(roles) from public.profiles where id = auth.uid() and active),
    false
  );
$$;
```

Después de correrlo, sube también el archivo `app.js` actualizado a tu
repositorio de GitHub. Desde ese momento, cuando le des a "Desactivar" a
alguien desde el Directorio de usuarios, esa persona pierde de inmediato
todo acceso a Procomly (no ve ni puede hacer nada, aunque conserve su
puesto guardado) — a diferencia de borrar su cuenta desde el panel de
Supabase, esto no toca su historial en los procesos ni su acceso de inicio
de sesión, y puedes reactivarla en cualquier momento con el mismo botón.

**Ya tenía mi proyecto creado antes del puesto "Observador (solo lectura)" — ¿cómo lo actualizo?**
Si al editar el perfil de alguien no ves la opción "Observador (solo
lectura)" entre los puestos, corre esto una sola vez en el **SQL Editor**
de tu proyecto — es seguro, no borra ni modifica ningún proceso ni ninguna
cuenta que ya tengas:

```sql
create or replace function public.can_view_case(target_case_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.cases c
    where c.id = target_case_id
      and (
        public.is_admin()
        or public.has_role('secretaria')
        or public.has_role('gerente')
        or public.has_role('juridico')
        or public.has_role('observador')
        or (public.has_role('coordinador') and c.coordinador_id = auth.uid())
        or (public.has_role('analista') and c.analista_id = auth.uid())
        or (public.has_role('area') and c.area_id = public.my_area_id())
      )
  );
$$;
```

Después de correrlo, sube también el archivo `app.js` actualizado a tu
repositorio de GitHub. El puesto "Observador" es para dar acceso de
demostración o revisión sin riesgo: quien lo tenga ve absolutamente todo
(todos los procesos en cualquier etapa y área, el directorio, Áreas y
usuarios), pero no puede crear, editar, avanzar ni borrar nada — todos los
botones de acción le quedan bloqueados, y la base de datos rechaza
cualquier intento de todas formas aunque alguien intentara saltarse la
pantalla.

**Un proceso cambia de etapa pero no queda ningún registro de por qué (el motivo de una devolución desaparece) — ¿cómo lo arreglo?**
Esto es un error real de seguridad en versiones anteriores del esquema, no
un problema de tus datos: cuando alguien devolvía un proceso (o hacía
cualquier otra transición hacia una etapa que ya no era la suya), a veces
la base de datos guardaba el cambio de etapa pero rechazaba en silencio el
evento que explica qué pasó y por qué — el proceso sí se movía, pero sin
dejar ningún rastro del motivo. Corre esto una sola vez en el **SQL
Editor** de tu proyecto — es seguro, no borra ni modifica ningún proceso
ni ninguna cuenta que ya tengas:

```sql
create or replace function public.can_log_case_event(target_case_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
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

drop policy if exists "case_events_insert_if_can_act_on_case" on public.case_events;

create policy "case_events_insert_if_can_act_on_case"
  on public.case_events for insert
  to authenticated
  with check (
    actor_id = auth.uid()
    and public.can_log_case_event(case_id)
  );
```

Después de correrlo, sube también `app.js` y `styles.css` actualizados a
tu repositorio — ese motivo ahora aparece en un recuadro visible arriba de
los botones de acción de cada proceso, en vez de solo dentro de
"Historial". Los procesos que ya perdieron su motivo (como los que hayas
probado antes de este arreglo) no lo recuperan retroactivamente — no
quedó guardado en ningún lado —, pero de aquí en adelante ya no volverá a
pasar.

**Se unificaron los puestos "Secretaría Administrativa" y "Gerente de Compras" — ¿cómo actualizo mi proyecto?**
Secretaría Administrativa actuaba siempre bajo las directrices de Gerencia
de Compras, así que ambos puestos/etapas se unificaron en uno solo:
"Secretaría y Gerencia de Compras" (por dentro sigue siendo el puesto
`gerente` de siempre). Quien lo tenga recibe la solicitud recién creada,
la revisa/archiva, confirma si es Compra menor o Licitación, y asigna
coordinador — con la misma libertad que ya tenía Gerencia de devolver el
proceso al área requirente si hace falta corregir algo. Igual que
Coordinador y Analista, en "Procesos pendientes de mi acción" solo ve los
procesos sin asignar o asignados a ella misma, nunca los de otra persona
del mismo puesto.

Corre esto una sola vez en el **SQL Editor** de tu proyecto — es seguro,
no borra ningún proceso ni ninguna cuenta que ya tengas; solo actualiza a
quién le corresponde actuar y migra lo que siga en la etapa vieja:

```sql
-- 1) Ya no se puede "devolver" un proceso a la etapa "secretaria" (se
--    unificó con "gerente"); se deja como ORIGEN válido nada más, por si
--    algún proceso viejo sigue ahí, para que pueda seguir avanzando.
create or replace function public.enforce_case_transition()
returns trigger
language plpgsql
as $$
declare
  allowed text[];
begin
  if public.is_admin() then
    return new;
  end if;

  if old.stage = new.stage then
    return new;
  end if;

  allowed := case old.stage
    when 'secretaria'      then array['gerente','cancelado']
    when 'gerente'         then array['coordinador','area-correccion','cancelado']
    when 'coordinador'     then array['analista','gerente','area-correccion','cancelado']
    when 'analista'        then array['juridico','gerente','coordinador','area-correccion','cancelado']
    when 'correccion'      then array['juridico','area-correccion','cancelado']
    when 'area-correccion' then array['analista','cancelado']
    when 'juridico'        then array['publicacion','gerente','coordinador','analista','area-correccion','cancelado']
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

-- 2) Los procesos nuevos entran directo a "gerente" (ya no existe una
--    etapa "secretaria" intermedia).
alter table public.cases alter column stage set default 'gerente';

-- 3) Migra los datos existentes: cualquier perfil con el puesto
--    "secretaria" pasa a tener "gerente" (sin duplicarlo si ya tenía
--    ambos), y cualquier proceso que siguiera en la etapa "secretaria"
--    pasa a "gerente" (conservando a quién lo tenía asignado), dejando un
--    registro en su historial explicando por qué cambió.
do $$
declare
  migrated_case_ids uuid[];
begin
  update public.profiles
  set roles = (
    select array_agg(distinct r order by r)
    from unnest(array_replace(roles, 'secretaria', 'gerente')) as r
  )
  where 'secretaria' = any(roles);

  select array_agg(id) into migrated_case_ids
  from public.cases
  where stage = 'secretaria';

  update public.cases
  set gerente_id = coalesce(gerente_id, secretaria_id),
      stage = 'gerente',
      updated_at = now()
  where stage = 'secretaria';

  if migrated_case_ids is not null then
    insert into public.case_events (case_id, stage_held, actor_id, actor_name, role_label, action, note, duration_ms)
    select c_id, 'gerente', null, 'Sistema', 'Migración automática',
           'pasó automáticamente de "Secretaría Administrativa" a "Secretaría y Gerencia de Compras"',
           'Los puestos "Secretaría Administrativa" y "Gerente de Compras" se unificaron en uno solo.',
           0
    from unnest(migrated_case_ids) as c_id;
  end if;
end $$;
```

Después de correrlo, sube también `app.js` y `styles.css` actualizados a
tu repositorio de GitHub. Si tenías a alguien con el puesto "Secretaría
Administrativa" únicamente, ahora la verás en el directorio con el puesto
"Secretaría y Gerencia de Compras" — no hace falta que vuelvas a asignarle
nada a mano.

**¿Cómo agrego el chat de prueba a un proyecto que ya tenía creado?**
Si actualizaste el código pero en "Chat" te sale "permission denied" o la
pestaña ni aparece, es porque tu proyecto de Supabase todavía no tiene las
tablas y funciones nuevas. Corre esto una sola vez en el **SQL Editor** de
tu proyecto — es seguro, no borra ni modifica ningún proceso que ya tengas:

```sql
create table if not exists public.app_settings (
  key         text primary key,
  value       boolean not null default false,
  updated_at  timestamptz not null default now()
);
comment on table public.app_settings is 'Interruptores generales de la aplicación, editables solo por la administradora.';

insert into public.app_settings (key, value) values ('testing_features_enabled', true)
  on conflict (key) do nothing;

create table if not exists public.chat_messages (
  id           uuid primary key default gen_random_uuid(),
  author_id    uuid references public.profiles (id),
  author_name  text not null default '',
  body         text not null,
  created_at   timestamptz not null default now()
);

alter table public.app_settings enable row level security;
alter table public.chat_messages enable row level security;

grant select, insert, update, delete on public.app_settings to anon, authenticated;
grant select, insert, update, delete on public.chat_messages to anon, authenticated;

create or replace function public.testing_features_enabled()
returns boolean language sql security definer set search_path = public stable as $$
  select coalesce((select value from public.app_settings where key = 'testing_features_enabled'), false);
$$;

create or replace function public.can_write_chat()
returns boolean language sql security definer set search_path = public stable as $$
  select coalesce((
    select p.is_admin or exists (select 1 from unnest(p.roles) r where r <> 'observador')
    from public.profiles p
    where p.id = auth.uid() and p.active
  ), false);
$$;

create or replace function public.recent_activity_feed(p_limit int default 150)
returns table (
  case_id uuid, case_number bigint, case_title text, ts timestamptz,
  actor_name text, role_label text, action text, note text
)
language sql security definer set search_path = public stable as $$
  select e.case_id, c.case_number, c.title, e.ts, e.actor_name, e.role_label, e.action, e.note
  from public.case_events e
  join public.cases c on c.id = e.case_id
  where public.testing_features_enabled() or public.is_admin()
  order by e.ts desc
  limit greatest(1, least(coalesce(p_limit, 150), 500));
$$;

grant execute on function public.recent_activity_feed(int) to authenticated;

drop policy if exists "app_settings_select_authenticated" on public.app_settings;
create policy "app_settings_select_authenticated" on public.app_settings for select to authenticated using (true);

drop policy if exists "app_settings_write_admin_only" on public.app_settings;
create policy "app_settings_write_admin_only" on public.app_settings for all
  to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "chat_messages_select_while_enabled" on public.chat_messages;
create policy "chat_messages_select_while_enabled" on public.chat_messages for select
  to authenticated using (public.testing_features_enabled() or public.is_admin());

drop policy if exists "chat_messages_insert_while_enabled" on public.chat_messages;
create policy "chat_messages_insert_while_enabled" on public.chat_messages for insert
  to authenticated with check (
    author_id = auth.uid()
    and public.can_write_chat()
    and public.testing_features_enabled()
  );

drop policy if exists "chat_messages_delete_admin_only" on public.chat_messages;
create policy "chat_messages_delete_admin_only" on public.chat_messages for delete
  to authenticated using (public.is_admin());
```

Después de correrlo, sube también `app.js`, `styles.css` y
`supabase-schema.sql` actualizados a tu repositorio de GitHub. La pestaña
"Chat" aparecerá activada por defecto para todo el que tenga un puesto
asignado (menos Observador); puedes apagarla en cualquier momento desde
"Áreas y usuarios" → "🧪 Modo de prueba", como se explica en el `README.md`.

**Ya tenía mi proyecto creado antes del nuevo paso "Coordinador — revisando pliego", la visibilidad acotada de Secretaría y Gerencia de Compras, y las menciones (@) del chat — ¿cómo lo actualizo?**
Este cambio trae tres cosas juntas: (1) después de que el Analista elabora el
pliego, el proceso vuelve siempre a Coordinación, que decide si va a
Consultoría Jurídica (Licitación) o directo a Publicación (Compra menor);
(2) Secretaría y Gerencia de Compras deja de ver automáticamente TODOS los
procesos — solo ve los que no tienen todavía a nadie de ese puesto
asignado, o los que tiene asignados a sí misma; (3) en el chat ahora se
puede etiquetar a alguien con `@` y le llega una notificación real. Corre
esto una sola vez en el **SQL Editor** de tu proyecto — es seguro, no borra
ningún proceso ni ninguna cuenta que ya tengas:

```sql
-- 1) Nueva etapa "coordinador-revision" en la lista de valores permitidos.
alter table public.cases drop constraint if exists cases_stage_check;
alter table public.cases add constraint cases_stage_check
  check (stage in ('secretaria','gerente','coordinador','analista','correccion',
                    'area-correccion','coordinador-revision','juridico','publicacion',
                    'publicado','adjudicado','desierto','pendiente-pago','cerrado','cancelado'));

-- 2) El pliego del Analista ya no va directo a Jurídico: pasa por
--    "coordinador-revision", que decide el destino según el tipo de
--    proceso (menor -> Publicación directo; licitación -> Jurídico).
create or replace function public.enforce_case_transition()
returns trigger
language plpgsql
as $$
declare
  allowed text[];
begin
  if public.is_admin() then
    return new;
  end if;

  if old.stage = new.stage then
    return new;
  end if;

  allowed := case old.stage
    when 'secretaria'      then array['gerente','cancelado']
    when 'gerente'         then array['coordinador','area-correccion','cancelado']
    when 'coordinador'     then array['analista','gerente','area-correccion','cancelado']
    when 'analista'        then array['coordinador-revision','gerente','coordinador','area-correccion','cancelado']
    when 'correccion'      then array['coordinador-revision','area-correccion','cancelado']
    when 'coordinador-revision' then
      case new.tipo
        when 'menor'      then array['publicacion','gerente','cancelado']
        when 'licitacion' then array['juridico','gerente','cancelado']
        else array[]::text[]
      end
    when 'area-correccion' then array['analista','cancelado']
    when 'juridico'        then array['publicacion','gerente','coordinador','analista','area-correccion','cancelado']
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

-- 3) Quién puede modificar el proceso en la nueva etapa, y las etapas ya
--    existentes que Gerencia administra después de publicar quedan
--    acotadas al mismo alcance que puede VER (ver el punto 4).
drop policy if exists "cases_update_stage_owner" on public.cases;
create policy "cases_update_stage_owner"
  on public.cases for update
  to authenticated
  using (
    public.is_admin()
    or (stage = 'secretaria' and public.has_role('secretaria') and (secretaria_id is null or secretaria_id = auth.uid()))
    or (stage = 'gerente' and public.has_role('gerente') and (gerente_id is null or gerente_id = auth.uid()))
    or (stage = 'publicacion' and public.has_role('gerente') and (gerente_id is null or gerente_id = auth.uid()))
    or (stage = 'coordinador' and coordinador_id = auth.uid())
    or (stage = 'coordinador-revision' and coordinador_id = auth.uid())
    or (stage in ('analista','correccion') and analista_id = auth.uid())
    or (stage = 'area-correccion' and public.has_role('area') and area_id = public.my_area_id())
    or (stage = 'juridico' and public.has_role('juridico'))
    or (stage in ('publicado','adjudicado','pendiente-pago') and public.has_role('gerente') and (gerente_id is null or gerente_id = auth.uid()))
  )
  with check (true);

-- 4) Secretaría y Gerencia de Compras ya NO ve/edita automáticamente todos
--    los procesos: solo los que no tienen todavía a nadie de ese puesto
--    asignado, o los que tiene asignados a sí misma. Jurídico y el
--    administrador siguen viendo todos, igual que antes.
create or replace function public.can_view_case(target_case_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.cases c
    where c.id = target_case_id
      and (
        public.is_admin()
        or (public.has_role('secretaria') and (c.secretaria_id is null or c.secretaria_id = auth.uid()))
        or (public.has_role('gerente') and (c.gerente_id is null or c.gerente_id = auth.uid()))
        or public.has_role('juridico')
        or public.has_role('observador')
        or (public.has_role('coordinador') and c.coordinador_id = auth.uid())
        or (public.has_role('analista') and c.analista_id = auth.uid())
        or (public.has_role('area') and c.area_id = public.my_area_id())
      )
  );
$$;

create or replace function public.can_log_case_event(target_case_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.cases c
    where c.id = target_case_id
      and (
        public.is_admin()
        or (public.has_role('secretaria') and (c.secretaria_id is null or c.secretaria_id = auth.uid()))
        or (public.has_role('gerente') and (c.gerente_id is null or c.gerente_id = auth.uid()))
        or public.has_role('juridico')
        or (public.has_role('coordinador') and c.coordinador_id = auth.uid())
        or (public.has_role('analista') and c.analista_id = auth.uid())
        or (public.has_role('area') and c.area_id = public.my_area_id())
      )
  );
$$;

-- 5) "Editar solicitud" (descripción, tipo, área, solicitante) para
--    Gerencia queda acotado igual: solo en los procesos que puede ver.
create or replace function public.edit_case_basic_fields(
  p_case_id uuid, p_title text, p_tipo text, p_area_id uuid, p_solicitante text
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
    or (public.has_role('gerente') and (c.gerente_id is null or c.gerente_id = auth.uid()))
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

-- 6) Las notificaciones automáticas a Gerencia (cada vez que se registra
--    un evento en un proceso) quedan igual de acotadas: ya no avisan a un
--    gerente al que el proceso ya no le aparece en pantalla.
create or replace function public.fanout_case_event_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.cases%rowtype;
  ger record;
  already uuid[] := '{}';
  resumen text;
begin
  select * into c from public.cases where id = new.case_id;
  if not found then return new; end if;

  resumen := trim(coalesce(new.actor_name, '') || ' ' || coalesce(new.action, ''));

  if c.coordinador_id is not null and c.coordinador_id <> new.actor_id then
    insert into public.notifications (recipient_id, case_id, kind, title, body)
    values (c.coordinador_id, c.id, 'proceso', c.title, resumen);
    already := already || c.coordinador_id;
  end if;

  if c.analista_id is not null and c.analista_id <> new.actor_id and not (c.analista_id = any(already)) then
    insert into public.notifications (recipient_id, case_id, kind, title, body)
    values (c.analista_id, c.id, 'proceso', c.title, resumen);
    already := already || c.analista_id;
  end if;

  if c.created_by is not null and c.created_by <> new.actor_id and not (c.created_by = any(already)) then
    insert into public.notifications (recipient_id, case_id, kind, title, body)
    values (c.created_by, c.id, 'proceso', c.title, resumen);
    already := already || c.created_by;
  end if;

  for ger in
    select id from public.profiles
    where 'gerente' = any(roles) and active
      and (c.gerente_id is null or c.gerente_id = id)
  loop
    if ger.id <> new.actor_id and not (ger.id = any(already)) then
      insert into public.notifications (recipient_id, case_id, kind, title, body)
      values (ger.id, c.id, 'proceso', c.title, resumen);
      already := already || ger.id;
    end if;
  end loop;

  return new;
end;
$$;

-- 7) Etiquetar (@) en el chat: nueva columna + notificación a la campanita.
alter table public.chat_messages add column if not exists mentioned_ids uuid[] not null default '{}';

create or replace function public.fanout_chat_mention_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
  ids uuid[];
begin
  ids := coalesce((select array_agg(distinct x) from unnest(new.mentioned_ids) x), '{}');

  foreach uid in array ids loop
    if uid is not null and uid <> new.author_id then
      insert into public.notifications (recipient_id, case_id, kind, title, body)
      values (uid, null, 'chat_mention', coalesce(nullif(new.author_name, ''), 'Alguien'), new.body);
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists chat_messages_notify_mentions on public.chat_messages;
create trigger chat_messages_notify_mentions
  after insert on public.chat_messages
  for each row execute procedure public.fanout_chat_mention_notifications();
```

Después de correrlo, sube también `app.js`, `styles.css` y
`supabase-schema.sql` actualizados a tu repositorio de GitHub. El chat ahora
vive en el ícono 💬 de la barra superior (junto a la campanita), ya no en
una pestaña del menú lateral — no hace falta ningún paso adicional para
eso, es solo el código nuevo de `app.js`. Ten en cuenta que, en cuanto
apliques esto, cualquier persona de Secretaría y Gerencia de Compras que no
sea administradora verá menos procesos en el Dashboard y en los reportes
(solo los suyos y los sin asignar) — si tu equipo esperaba ver el total de
la empresa ahí, avísales del cambio.

**Cuenta de demostración compartida (un solo correo para varios probadores)**
Para que varias personas revisen Procomly sin tener que invitar a cada una
por separado ni arriesgar los datos reales de ETED:

1. Ve a "Áreas y usuarios" → "Invitar persona", escribe un correo sencillo
   (puede ser uno que ya uses tú misma con un "+", por ejemplo
   `raiqueltaveras18+demo@gmail.com` — a Gmail le da igual lo que pongas
   después del "+", todo llega a tu misma bandeja de entrada, pero para
   Procomly es un correo distinto) y marca únicamente el puesto
   "Observador (solo lectura)". Guarda.
2. Entra a Procomly con ese correo (pestaña "Crear cuenta") y ponle una
   contraseña sencilla — en cuanto la cuenta se cree, queda automáticamente
   con el puesto que le asignaste en el paso 1, sin que tengas que hacer
   nada más.
3. Comparte ese mismo correo y esa misma contraseña con todos los
   probadores. Todos entran con la misma cuenta al mismo tiempo si hace
   falta, ven absolutamente todo el sistema con los datos reales, y no hay
   ningún riesgo de que alguien cree, edite o borre algo por accidente.

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
