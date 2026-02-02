create table if not exists public.system_notifications (
    id uuid primary key default gen_random_uuid(),
    type text not null,
    title text not null,
    description text,
    youtube_url text,
    active boolean not null default true,
    start_date timestamptz,
    end_date timestamptz,
    priority integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint notifications_type_check check (type in ('informative', 'critical', 'maintenance', 'youtube'))
);

create index if not exists idx_notifications_active_dates_priority
    on public.system_notifications (active, start_date, end_date, priority desc, created_at desc);

create table if not exists public.user_system_notification_preferences (
    user_id uuid primary key,
    last_shown_at timestamptz,
    last_seen_date date,
    dismissed_until_date date,
    dismissed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint user_notification_preferences_user_fk foreign key (user_id) references auth.users(id) on delete cascade
);

alter table public.system_notifications enable row level security;
alter table public.user_system_notification_preferences enable row level security;

drop policy if exists system_notifications_select on public.system_notifications;
create policy system_notifications_select on public.system_notifications
    for select to authenticated
    using (
        (auth.jwt() -> 'app_metadata' ->> 'is_super_admin') = 'true'
        or (
            active = true
            and (start_date is null or start_date <= now())
            and (end_date is null or end_date >= now())
        )
    );

drop policy if exists system_notifications_insert on public.system_notifications;
create policy system_notifications_insert on public.system_notifications
    for insert to authenticated
    with check (
        (auth.jwt() -> 'app_metadata' ->> 'is_super_admin') = 'true'
    );

drop policy if exists system_notifications_update on public.system_notifications;
create policy system_notifications_update on public.system_notifications
    for update to authenticated
    using (
        (auth.jwt() -> 'app_metadata' ->> 'is_super_admin') = 'true'
    )
    with check (
        (auth.jwt() -> 'app_metadata' ->> 'is_super_admin') = 'true'
    );

drop policy if exists system_notifications_delete on public.system_notifications;
create policy system_notifications_delete on public.system_notifications
    for delete to authenticated
    using (
        (auth.jwt() -> 'app_metadata' ->> 'is_super_admin') = 'true'
    );

drop policy if exists user_system_notification_preferences_select on public.user_system_notification_preferences;
create policy user_system_notification_preferences_select on public.user_system_notification_preferences
    for select to authenticated
    using (user_id = auth.uid());

drop policy if exists user_system_notification_preferences_insert on public.user_system_notification_preferences;
create policy user_system_notification_preferences_insert on public.user_system_notification_preferences
    for insert to authenticated
    with check (user_id = auth.uid());

drop policy if exists user_system_notification_preferences_update on public.user_system_notification_preferences;
create policy user_system_notification_preferences_update on public.user_system_notification_preferences
    for update to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

drop policy if exists user_system_notification_preferences_delete on public.user_system_notification_preferences;
create policy user_system_notification_preferences_delete on public.user_system_notification_preferences
    for delete to authenticated
    using (user_id = auth.uid());
