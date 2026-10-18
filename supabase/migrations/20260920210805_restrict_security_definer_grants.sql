-- handle_new_user n'est appelée que par le déclencheur, qui s'exécute avec les
-- droits de son propriétaire : personne n'a besoin de l'EXECUTE, et l'exposer
-- via /rest/v1/rpc n'a aucune raison d'être.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- is_space_member doit rester exécutable par `authenticated` : les expressions
-- de politique RLS sont évaluées avec les droits de l'appelant. En revanche
-- rien ne justifie de l'exposer aux visiteurs non connectés.
revoke execute on function public.is_space_member(uuid) from public, anon;
grant execute on function public.is_space_member(uuid) to authenticated;

revoke execute on function public.safe_uuid(text) from public, anon;
grant execute on function public.safe_uuid(text) to authenticated;
