do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'user_profiles'
  ) then
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'user_profiles'
        and column_name = 'email'
    ) then
      execute 'alter table public.user_profiles add column if not exists user_email text generated always as (email) stored';
    else
      execute 'alter table public.user_profiles add column if not exists user_email text';
    end if;
  end if;
exception
  when undefined_table then
    null;
end
$$;
