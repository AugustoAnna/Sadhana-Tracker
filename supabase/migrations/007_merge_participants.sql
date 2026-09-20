-- Merge an anonymous participant into a permanent (email) account.
--
-- Why: a participant who signs in with their email on a second device before
-- linking it on the phone that holds their history ends up with two auth
-- users. Supabase cannot attach that email to the anonymous user ("already
-- registered"), so instead we move the anonymous participant's rows onto the
-- permanent participant. Called only by the merge-anonymous-account Edge
-- Function (service role) after it has verified the caller controls BOTH
-- sessions — never exposed to anon/authenticated roles.

alter table participants
  add column if not exists merged_into uuid references participants(id);

comment on column participants.merged_into is
  'Set on an anonymous participant whose rows were moved to another participant; this row is then an empty shell kept for the audit trail.';

create or replace function merge_participants(p_from_auth_user uuid, p_to_auth_user uuid)
returns table (moved_practices int, moved_logs int, moved_reminders int, moved_events int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from uuid;
  v_to   uuid;
  v_to_email text;
  c_practices int := 0;
  c_logs      int := 0;
  c_reminders int := 0;
  c_events    int := 0;
begin
  select id into v_from from participants where auth_user_id = p_from_auth_user;
  select id into v_to   from participants where auth_user_id = p_to_auth_user;
  select email into v_to_email from auth.users where id = p_to_auth_user;

  -- Anonymous user that never synced a participant row: nothing to move.
  if v_from is null then
    return query select 0, 0, 0, 0;
    return;
  end if;

  -- Permanent account that has not synced yet (signed in, never onboarded):
  -- simplest correct outcome is to hand the anonymous participant row itself
  -- to the permanent user. Every child row follows automatically.
  if v_to is null then
    update participants
       set auth_user_id = p_to_auth_user,
           email = coalesce(v_to_email, email)
     where id = v_from;
    return query
      select (select count(*)::int from participant_practices where participant_id = v_from),
             (select count(*)::int from practice_completed    where participant_id = v_from),
             (select count(*)::int from reminders             where participant_id = v_from),
             (select count(*)::int from events                where participant_id = v_from);
    return;
  end if;

  if v_from = v_to then
    return query select 0, 0, 0, 0;
    return;
  end if;

  -- Practices: the target may already hold the same practice from a fresh
  -- setup; those would collide on (participant_id, practice_id, instance).
  -- Keep the source copy — the source's logs refer to it.
  delete from participant_practices n
   using participant_practices o
   where n.participant_id = v_to and o.participant_id = v_from
     and n.practice_id = o.practice_id and n.instance = o.instance;
  update participant_practices set participant_id = v_to where participant_id = v_from;
  get diagnostics c_practices = row_count;

  update practice_completed set participant_id = v_to where participant_id = v_from;
  get diagnostics c_logs = row_count;

  -- Reminders: the target's are the defaults from a fresh setup; the source's
  -- are the ones the person actually configured. Only replace when there is
  -- something to replace them with.
  if exists (select 1 from reminders where participant_id = v_from) then
    delete from reminders where participant_id = v_to;
    update reminders set participant_id = v_to where participant_id = v_from;
    get diagnostics c_reminders = row_count;
  end if;

  update events set participant_id = v_to where participant_id = v_from;
  get diagnostics c_events = row_count;

  -- Push subscriptions are per device; the device now belongs to the target
  -- and re-registers on its next open.
  delete from push_subscriptions where participant_id = v_from;

  -- Keep the target's real name; fall back to the source's when the target
  -- only has the placeholder. Carry over device facts the target lacks.
  update participants t
     set name = case when t.name is null or t.name = '' or t.name = 'Anonymous'
                     then coalesce(nullif(s.name, ''), t.name) else t.name end,
         platform = coalesce(t.platform, s.platform),
         installed_standalone = t.installed_standalone or s.installed_standalone,
         notification_permission = coalesce(t.notification_permission, s.notification_permission),
         timezone = coalesce(t.timezone, s.timezone),
         segment = coalesce(t.segment, s.segment)
    from participants s
   where t.id = v_to and s.id = v_from;

  update participants set merged_into = v_to where id = v_from;

  insert into events (participant_id, name, properties, local_date, environment)
  select v_to, 'account_merged',
         jsonb_build_object('from_participant_id', v_from, 'from_auth_user_id', p_from_auth_user,
                            'practices', c_practices, 'logs', c_logs),
         current_date, environment
    from participants where id = v_to;

  return query select c_practices, c_logs, c_reminders, c_events;
end;
$$;

-- Service role only. PostgREST would otherwise expose this as an RPC to any
-- signed-in user, who could pass someone else's auth user id.
revoke all on function merge_participants(uuid, uuid) from public, anon, authenticated;
