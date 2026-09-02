-- ============================================================================
-- Procomly — Proceso de Compras y Licitaciones Automatizado — ETED
-- Esquema de base de datos y seguridad (Row Level Security) para Supabase
-- ============================================================================
-- Cómo usar este archivo: pégalo completo en el Editor SQL de tu proyecto de
-- Supabase (Supabase → SQL Editor → New query) y haz clic en "Run". Se puede
-- ejecutar una sola vez sobre un proyecto nuevo. Ver SETUP.md para el resto
-- de los pasos (crear el proyecto, habilitar autenticación, crear el primer
-- administrador, etc.).
-- ============================================================================

-- Necesario para generar identificadores únicos (uuid) en las tablas.
create extension if not exists "pgcrypto";

-- ============================================================================
-- 1. TABLAS
-- ============================================================================

-- Áreas requirentes (las gerencias/direcciones que piden compras). Va primero
-- porque "profiles" y "cases" la referencian.
create table public.areas (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  manager_name  text not null default '',  -- gerente o director responsable
  created_at    timestamptz not null default now()
);

-- Perfil de cada persona. Un perfil se crea automáticamente (ver el trigger
-- más abajo) cuando alguien se registra con su correo — pero queda "vacío"
-- (sin puestos, sin área) hasta que un administrador lo completa desde la
-- pestaña "Áreas y usuarios" de la aplicación.
create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  email           text not null,
  full_name       text not null default '',
  employee_id     text not null default '',
  position_title  text not null default '',
  department      text not null default '',
  area_id         uuid references public.areas (id) on delete set null,
  roles           text[] not null default '{}',   -- subconjunto de: area, secretaria, gerente, coordinador, analista, juridico
  coord_tipos     text[] not null default '{}',   -- subconjunto de: menor, licitacion (solo aplica si 'coordinador' está en roles)
  is_admin        boolean not null default false,
  active          boolean not null default true,  -- desactivar en vez de borrar la cuenta
  created_at      timestamptz not null default now()
);
comment on table public.profiles is 'Un registro por persona. Se crea vacío al registrarse; el administrador completa puesto(s), área, etc.';

-- Procesos de compra / licitación.
create table public.cases (
  id              uuid primary key default gen_random_uuid(),
  case_number     bigserial,                 -- numeración interna, solo para mostrar "#1001", etc.
  title           text not null,
  tipo            text not null check (tipo in ('menor','licitacion')),
  area_id         uuid not null references public.areas (id),
  solicitante     text not null default '',
  stage           text not null default 'secretaria'
                    check (stage in ('secretaria','gerente','coordinador','analista','correccion',
                                      'area-correccion','juridico','publicacion','publicado','cancelado')),
  secretaria_id   uuid references public.profiles (id),
  gerente_id      uuid references public.profiles (id),
  coordinador_id  uuid references public.profiles (id),
  analista_id     uuid references public.profiles (id),
  rework_count    int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Línea de tiempo / historial de cada proceso (registro de solo lectura una
-- vez creado — nadie puede editar ni borrar un evento pasado).
create table public.case_events (
  id            uuid primary key default gen_random_uuid(),
  case_id       uuid not null references public.cases (id) on delete cascade,
  ts            timestamptz not null default now(),
  stage_held    text not null,
  actor_id      uuid references public.profiles (id),
  actor_name    text not null default '',
  role_label    text not null default '',
  action        text not null,
  note          text not null default '',
  duration_ms   bigint not null default 0
);

-- Archivos adjuntos (los archivos en sí viven en Supabase Storage — ver el
-- bucket "attachments" configurado más abajo; aquí solo la referencia).
create table public.attachments (
  id                uuid primary key default gen_random_uuid(),
  case_id           uuid not null references public.cases (id) on delete cascade,
  storage_path      text not null,
  file_name         text not null,
  file_size         bigint not null default 0,
  mime_type         text not null default '',
  uploaded_by       uuid references public.profiles (id),
  uploaded_by_name  text not null default '',
  created_at        timestamptz not null default now()
);

-- Bitácora de notificaciones (sigue siendo una simulación — no envía correos
-- reales todavía; ver la nota en SETUP.md sobre cómo conectar un envío real
-- más adelante). Queda guardada aquí para que el administrador pueda
-- auditar qué se "notificó" y cuándo.
create table public.notifications_log (
  id            uuid primary key default gen_random_uuid(),
  to_email      text not null,
  to_name       text not null default '',
  subject       text not null,
  body          text not null default '',
  case_id       uuid references public.cases (id) on delete set null,
  created_at    timestamptz not null default now()
);

-- ============================================================================
-- 2. FUNCIONES DE APOYO PARA LAS POLÍTICAS DE SEGURIDAD
-- ============================================================================
-- Se declaran "security definer" para poder consultar la tabla profiles sin
-- disparar de nuevo sus propias políticas de RLS (evita recursión infinita).

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.has_role(check_role text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select check_role = any(roles) from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.my_area_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select area_id from public.profiles where id = auth.uid();
$$;

-- ============================================================================
-- 3. TRIGGER: crear automáticamente un perfil vacío al registrarse
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================================
-- 3b. TRIGGER: impedir saltarse etapas del flujo, incluso para quien tenga
-- permiso de editar el proceso en su etapa actual (defensa adicional a las
-- políticas de RLS de abajo, que solo controlan QUIÉN puede tocar cada
-- etapa — esto controla A QUÉ etapa se puede pasar desde cada una).
-- ============================================================================

create or replace function public.enforce_case_transition()
returns trigger
language plpgsql
as $$
declare
  allowed text[];
begin
  if public.is_admin() then
    return new;  -- el administrador puede corregir manualmente cualquier caso
  end if;

  if old.stage = new.stage then
    return new;  -- no cambia de etapa (p. ej. solo se actualiza rework_count)
  end if;

  allowed := case old.stage
    when 'secretaria'      then array['gerente','cancelado']
    when 'gerente'         then array['coordinador','secretaria','area-correccion','cancelado']
    when 'coordinador'     then array['analista','secretaria','gerente','area-correccion','cancelado']
    when 'analista'        then array['juridico','secretaria','gerente','coordinador','area-correccion','cancelado']
    when 'correccion'      then array['juridico','area-correccion','cancelado']
    when 'area-correccion' then array['analista','cancelado']
    when 'juridico'        then array['publicacion','secretaria','gerente','coordinador','analista','area-correccion','cancelado']
    when 'publicacion'     then array['publicado','cancelado']
    else array[]::text[]  -- 'publicado' y 'cancelado' son etapas finales
  end;

  if not (new.stage = any(allowed)) then
    raise exception 'Transición de etapa no permitida: % -> %', old.stage, new.stage;
  end if;

  return new;
end;
$$;

create trigger case_transition_guard
  before update on public.cases
  for each row execute procedure public.enforce_case_transition();

-- ============================================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================================

alter table public.profiles          enable row level security;
alter table public.areas             enable row level security;
alter table public.cases             enable row level security;
alter table public.case_events       enable row level security;
alter table public.attachments       enable row level security;
alter table public.notifications_log enable row level security;

-- ---------- profiles ----------
-- Cualquier persona que inició sesión puede ver el directorio (nombres,
-- puestos, área) — como una libreta de contactos interna. Nadie puede ver
-- perfiles si no ha iniciado sesión.
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

-- Solo el administrador puede editar cualquier perfil (asignar puestos,
-- área, correo, número de empleado, etc.) — así lo pidió el diseño original:
-- "que se pueda editar todo desde el usuario administrador".
create policy "profiles_update_admin_only"
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Nadie inserta perfiles directamente: se crean solos vía el trigger de
-- arriba cuando alguien se registra. No hace falta política de INSERT.

-- ---------- areas ----------
create policy "areas_select_authenticated"
  on public.areas for select
  to authenticated
  using (true);

create policy "areas_write_admin_only"
  on public.areas for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------- cases ----------
-- Visibles para toda la organización (igual que en la versión anterior: la
-- transparencia entre áreas es intencional). Si más adelante quieres
-- restringir esto por área, cambia esta política.
create policy "cases_select_authenticated"
  on public.cases for select
  to authenticated
  using (true);

-- Puede registrar un proceso nuevo: alguien del área requirente (para su
-- propia área) o el administrador (para cualquier área).
create policy "cases_insert"
  on public.cases for insert
  to authenticated
  with check (
    public.is_admin()
    or (public.has_role('area') and area_id = public.my_area_id())
  );

-- Solo puede modificar un proceso quien "tiene la pelota" en la etapa
-- actual — el mismo control que antes vivía solo en el navegador, ahora
-- reforzado también en el servidor.
create policy "cases_update_stage_owner"
  on public.cases for update
  to authenticated
  using (
    public.is_admin()
    or (stage = 'secretaria' and public.has_role('secretaria') and (secretaria_id is null or secretaria_id = auth.uid()))
    or (stage = 'gerente' and public.has_role('gerente') and (gerente_id is null or gerente_id = auth.uid()))
    or (stage = 'publicacion' and public.has_role('gerente'))
    or (stage = 'coordinador' and coordinador_id = auth.uid())
    or (stage in ('analista','correccion') and analista_id = auth.uid())
    or (stage = 'area-correccion' and public.has_role('area') and area_id = public.my_area_id())
    or (stage = 'juridico' and public.has_role('juridico'))
  )
  with check (true);  -- el destino válido de cada transición lo controla la aplicación

create policy "cases_delete_admin_only"
  on public.cases for delete
  to authenticated
  using (public.is_admin());

-- ---------- case_events ----------
-- El historial es visible para todos (igual que los procesos) y es de solo
-- inserción — una vez escrito un evento, nadie lo edita ni lo borra.
create policy "case_events_select_authenticated"
  on public.case_events for select
  to authenticated
  using (true);

create policy "case_events_insert_if_can_act_on_case"
  on public.case_events for insert
  to authenticated
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
        )
    )
  );

-- ---------- attachments ----------
create policy "attachments_select_authenticated"
  on public.attachments for select
  to authenticated
  using (true);

create policy "attachments_insert_own"
  on public.attachments for insert
  to authenticated
  with check (uploaded_by = auth.uid());

create policy "attachments_delete_own_or_admin"
  on public.attachments for delete
  to authenticated
  using (uploaded_by = auth.uid() or public.is_admin());

-- ---------- notifications_log ----------
-- Solo el administrador puede revisar la bitácora de notificaciones
-- (auditoría interna).
create policy "notifications_log_admin_only"
  on public.notifications_log for select
  to authenticated
  using (public.is_admin());

create policy "notifications_log_insert_authenticated"
  on public.notifications_log for insert
  to authenticated
  with check (true);

-- ============================================================================
-- 5. ALMACENAMIENTO (Storage) — bucket para los archivos adjuntos
-- ============================================================================
-- Crea el bucket llamado "attachments" desde Supabase → Storage → New bucket
-- (márcalo como privado, NO público) — ver SETUP.md. Luego corre esta parte
-- para darle las mismas reglas de acceso que a la tabla attachments.

insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

create policy "attachments_storage_select_authenticated"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'attachments');

create policy "attachments_storage_insert_authenticated"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'attachments');

create policy "attachments_storage_delete_own_or_admin"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'attachments'
    and (owner = auth.uid() or public.is_admin())
  );

-- ============================================================================
-- Fin del script. Siguiente paso: SETUP.md — crear tu primer usuario
-- administrador y pegar la URL/clave del proyecto en config.js.
-- ============================================================================
