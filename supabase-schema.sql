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
  id                 uuid primary key default gen_random_uuid(),
  name               text not null unique,
  manager_name       text not null default '',  -- gerente o director responsable
  secretary_name     text not null default '',  -- secretaria administrativa de esa área requirente
  secretary_contact  text not null default '',  -- correo o teléfono de esa secretaria
  created_at         timestamptz not null default now()
);

-- Perfil de cada persona. Se crea automáticamente (ver el trigger más abajo)
-- en el momento en que alguien se registra con su correo. Si el
-- administrador ya había "pre-registrado" ese correo en pending_profiles
-- (tabla de abajo) con su puesto, área, etc., el trigger copia esos datos
-- de una vez; si no, queda vacío hasta que el administrador lo complete
-- desde la pestaña "Áreas y usuarios".
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
comment on table public.profiles is 'Un registro por persona. Se crea al registrarse; ya viene con su puesto si el administrador lo pre-registró en pending_profiles.';

-- "Invitaciones": el administrador registra aquí a alguien por su correo,
-- con su puesto, área y permisos YA asignados, ANTES de que esa persona
-- haya creado su cuenta. No está ligada todavía a ningún usuario real de
-- auth.users (por eso es una tabla aparte de "profiles", que sí exige un
-- usuario real). En cuanto esa persona entra a Procomly y crea su cuenta
-- con ESE MISMO correo, el trigger de más abajo copia estos datos a su
-- perfil real y borra esta fila — todo automático, sin que el
-- administrador tenga que volver a tocar nada.
create table public.pending_profiles (
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
comment on table public.pending_profiles is 'Personas invitadas por el administrador (correo + puesto ya asignado) que todavía no han creado su cuenta.';

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
                                      'area-correccion','juridico','publicacion','publicado',
                                      'adjudicado','desierto','pendiente-pago','cerrado','cancelado')),
  secretaria_id   uuid references public.profiles (id),
  gerente_id      uuid references public.profiles (id),
  coordinador_id  uuid references public.profiles (id),
  analista_id     uuid references public.profiles (id),
  rework_count    int not null default 0,

  -- Campos administrativos adicionales, tomados del Excel de seguimiento de
  -- Compras Menores que este software reemplaza — se llenan a lo largo del
  -- proceso (no todos aplican desde el inicio) y quedan visibles/editables
  -- para quien "tiene la pelota" en la etapa actual, igual que el resto de
  -- los campos de un proceso.
  modalidad                 text not null default '',   -- p. ej. "CONTRATACIÓN MENOR", "LICITACIÓN PÚBLICA NACIONAL"...
  referencia                text not null default '',   -- p. ej. "ETED-DAF-CM-2026-0076"
  no_comunicacion           text not null default '',
  no_solicitud_pedido       text not null default '',
  proceso_pacc              boolean not null default false, -- ¿forma parte del Plan Anual de Compras y Contrataciones?
  monto_presupuestado       numeric,
  monto_adjudicado          numeric,
  empresa_adjudicada        text not null default '',
  no_orden_compra           text not null default '',
  fecha_publicacion         date,
  fecha_adjudicacion        date,
  fecha_orden               date,
  fecha_asignacion_analista date,
  fecha_salida_correccion   date,
  fecha_entrada_corregido   date,
  estatus_legado            text not null default '',   -- estatus textual original, solo para procesos importados del Excel
  analista_legado           text not null default '',   -- nombre del analista tal como aparecía en el Excel, para procesos importados sin cuenta real todavía
  observaciones             text not null default '',

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

-- ¿Puede la persona actual ver este proceso? Secretaría, Gerencia y
-- Jurídico ven todos los procesos (necesitan visión completa del flujo).
-- Coordinador y Analista solo ven los procesos que tienen asignados a
-- ellos mismos (aunque el proceso ya haya avanzado a otra etapa). Área
-- requirente solo ve los procesos de su propia área. El administrador
-- siempre ve todo. Se usa para las políticas de "select" de cases,
-- case_events y attachments, así las tres tablas quedan consistentes.
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
        or (public.has_role('coordinador') and c.coordinador_id = auth.uid())
        or (public.has_role('analista') and c.analista_id = auth.uid())
        or (public.has_role('area') and c.area_id = public.my_area_id())
      )
  );
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
declare
  invite public.pending_profiles;
begin
  select * into invite
  from public.pending_profiles
  where lower(email) = lower(new.email)
  limit 1;

  if found then
    insert into public.profiles
      (id, email, full_name, employee_id, position_title, department, area_id, roles, coord_tipos, is_admin)
    values
      (new.id, new.email, invite.full_name, invite.employee_id, invite.position_title, invite.department,
       invite.area_id, invite.roles, invite.coord_tipos, invite.is_admin);
    delete from public.pending_profiles where lower(email) = lower(new.email);
  else
    insert into public.profiles (id, email) values (new.id, new.email);
  end if;

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
    when 'publicado'       then array['adjudicado','desierto','cancelado']
    when 'adjudicado'      then array['pendiente-pago','cancelado']
    when 'pendiente-pago'  then array['cerrado']
    else array[]::text[]  -- 'desierto', 'cerrado' y 'cancelado' son etapas finales
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
-- 3c. PERMISOS DE TABLA (GRANTS)
-- ============================================================================
-- Row Level Security decide QUÉ FILAS puede ver/editar cada quien, pero
-- antes de eso Postgres exige un permiso base sobre la tabla en sí — sin
-- esto, cualquier consulta falla con "permission denied for table ..." sin
-- importar qué tan bien estén escritas las políticas de abajo. anon es el
-- rol de alguien sin sesión iniciada (de todas formas no verá filas, porque
-- ninguna política de abajo le aplica a "anon"); authenticated es cualquier
-- persona con sesión iniciada.

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

-- ============================================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================================

alter table public.profiles          enable row level security;
alter table public.pending_profiles  enable row level security;
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

-- ---------- pending_profiles ----------
-- Contiene puestos y permisos ya asignados a correos que todavía no han
-- iniciado sesión — solo el administrador puede verlas o tocarlas. Nadie
-- más necesita leer esta tabla (ni siquiera la propia persona invitada:
-- antes de crear su cuenta no tiene sesión, y después de crearla el
-- trigger ya copió sus datos a "profiles" y borró la fila de aquí).
create policy "pending_profiles_admin_only"
  on public.pending_profiles for all
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
-- Secretaría, Gerencia, Jurídico y el administrador ven todos los procesos.
-- Coordinador y Analista solo ven los que tienen asignados a ellos; Área
-- requirente solo ve los de su propia área — ver can_view_case() arriba.
create policy "cases_select_scoped"
  on public.cases for select
  to authenticated
  using (public.can_view_case(id));

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
    -- etapas posteriores a la publicación (adjudicación, orden de compra,
    -- pago, cierre) las administra Gerencia de Compras, igual que el resto
    -- del seguimiento post-publicación en el Excel que este software reemplaza.
    or (stage in ('publicado','adjudicado','pendiente-pago') and public.has_role('gerente'))
  )
  with check (true);  -- el destino válido de cada transición lo controla la aplicación

create policy "cases_delete_admin_only"
  on public.cases for delete
  to authenticated
  using (public.is_admin());

-- ---------- case_events ----------
-- Visible para quien pueda ver el proceso al que pertenece (misma regla que
-- cases, arriba) — y es de solo inserción, una vez escrito un evento nadie
-- lo edita ni lo borra.
create policy "case_events_select_scoped"
  on public.case_events for select
  to authenticated
  using (public.can_view_case(case_id));

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
          or (c.stage in ('publicado','adjudicado','pendiente-pago') and public.has_role('gerente'))
        )
    )
  );

-- ---------- attachments ----------
-- Visibles para quien pueda ver el proceso al que pertenecen (misma regla
-- que cases y case_events, arriba).
create policy "attachments_select_scoped"
  on public.attachments for select
  to authenticated
  using (public.can_view_case(case_id));

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
