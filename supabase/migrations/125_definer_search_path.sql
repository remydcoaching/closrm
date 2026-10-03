-- supabase/migrations/125_definer_search_path.sql
-- Fonctions SECURITY DEFINER sans search_path figé (023, 024, 038, 041, 043,
-- 068…) : elles s'exécutent avec les droits de leur propriétaire en résolvant
-- les noms via le search_path de l'appelant (lint Supabase
-- « function_search_path_mutable »). On le fige pour chacune, sans connaître
-- leurs signatures : public (nos tables), extensions (uuid_generate_v4…),
-- pg_temp en dernier.
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) c where c like 'search_path=%')
  loop
    execute format('alter function %s set search_path = public, extensions, pg_temp', r.sig);
  end loop;
end $$;
