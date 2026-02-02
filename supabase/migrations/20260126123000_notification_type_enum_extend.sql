do $$
begin
  if exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'notification_type'
      and t.typtype = 'e'
  ) then
    execute $sql$alter type public.notification_type add value if not exists 'informative'$sql$;
    execute $sql$alter type public.notification_type add value if not exists 'critical'$sql$;
    execute $sql$alter type public.notification_type add value if not exists 'maintenance'$sql$;
    execute $sql$alter type public.notification_type add value if not exists 'youtube'$sql$;
  end if;
exception
  when duplicate_object then
    null;
end
$$;
