-- In-app account deletion.
--
-- Mandatory for App Store review since 2022 for any app that creates
-- accounts, and a guaranteed rejection without it.
--
-- Deleting a row from auth.users needs privileges the `authenticated` role
-- does not have, so this is SECURITY DEFINER and runs as its owner
-- (`postgres`, because migrations run as that role). Every user-data table
-- references auth.users with ON DELETE CASCADE, so this one statement takes
-- the visits, stays, trips, trip_plans and sync_state with it.

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
-- Empty search_path is required on a definer function: without it, a caller
-- who can create objects could shadow an unqualified name and have this run
-- their code with postgres privileges. Every relation below is therefore
-- schema-qualified.
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  -- A definer function bypasses RLS, so the ownership check has to be in the
  -- body rather than left to a policy. `caller` is the only id this can ever
  -- delete, and an unauthenticated call deletes nothing at all.
  if caller is null then
    raise exception 'delete_own_account requires an authenticated session';
  end if;

  delete from auth.users where id = caller;
end;
$$;

-- Narrow execution to exactly the role that should have it. `public` includes
-- `anon`, and an anonymous caller reaching this would get the exception above
-- rather than a deletion — but not granting it at all is the better answer.
revoke all on function public.delete_own_account() from public;
revoke all on function public.delete_own_account() from anon;
grant execute on function public.delete_own_account() to authenticated;
