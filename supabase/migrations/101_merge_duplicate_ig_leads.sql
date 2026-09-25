-- supabase/migrations/101_merge_duplicate_ig_leads.sql
-- One-off cleanup for a real production bug found via SQL audit on
-- 2026-09-20/24: persistDiscoveryResult / processLikersDataset only matched
-- existing leads by instagram_user_id, never by instagram_handle. A lead
-- created before any Hiker/Apify run (handle set, instagram_user_id NULL)
-- was therefore invisible to that lookup, and a later discovery/scrape run
-- that observed the same person created a duplicate lead instead of
-- reusing the existing one. 17 duplicated (workspace_id, instagram_handle)
-- pairs were found in production. The application-level fix (fallback
-- lookup by handle) is in src/lib/hiker/persist.ts and
-- src/lib/apify/process-likers.ts — this migration only cleans up the
-- duplicates that bug already created; it does not change any behavior.
--
-- Merge strategy per duplicated handle: keep the OLDEST lead row (it is the
-- one that existed first, most likely already has calls/follow-ups/notes
-- attached to it) and re-point every dependent row from the newer
-- duplicate(s) onto it, then delete the now-orphaned duplicate leads.
-- Nothing here touches leads with a unique handle or no handle at all.

do $$
declare
  dup record;
  keeper_id uuid;
  loser_id uuid;
begin
  for dup in
    select workspace_id, instagram_handle
    from leads
    where instagram_handle is not null and instagram_handle <> ''
    group by workspace_id, instagram_handle
    having count(*) > 1
  loop
    -- Oldest row for this (workspace_id, instagram_handle) pair is the keeper.
    select id into keeper_id
    from leads
    where workspace_id = dup.workspace_id and instagram_handle = dup.instagram_handle
    order by created_at asc
    limit 1;

    for loser_id in
      select id from leads
      where workspace_id = dup.workspace_id
        and instagram_handle = dup.instagram_handle
        and id <> keeper_id
    loop
      -- Re-point dependent rows onto the keeper. instagram_interactions has
      -- its own dedup unique index keyed on (workspace_id, lead_id, ...) —
      -- a plain UPDATE could collide with a row that already exists under
      -- the keeper for the same interaction; skip those (ON CONFLICT DO
      -- NOTHING equivalent) rather than fail the whole migration, and
      -- delete the now-redundant loser-side row afterwards.
      update instagram_interactions ii
      set lead_id = keeper_id
      where ii.lead_id = loser_id
        and not exists (
          select 1 from instagram_interactions ii2
          where ii2.lead_id = keeper_id
            and ii2.interaction_type = ii.interaction_type
            and coalesce(ii2.source_post_id, '') = coalesce(ii.source_post_id, '')
            and coalesce(ii2.instagram_user_id, ii2.instagram_username) = coalesce(ii.instagram_user_id, ii.instagram_username)
        );
      delete from instagram_interactions where lead_id = loser_id;

      update calls set lead_id = keeper_id where lead_id = loser_id;
      update follow_ups set lead_id = keeper_id where lead_id = loser_id;
      update deals set lead_id = keeper_id where lead_id = loser_id;
      update lead_status_history set lead_id = keeper_id where lead_id = loser_id;
      update ig_conversations set lead_id = keeper_id where lead_id = loser_id;

      -- Backfill instagram_user_id onto the keeper if the duplicate had one
      -- and the keeper didn't (the keeper predates Hiker/Apify in most cases).
      update leads k
      set instagram_user_id = l.instagram_user_id
      from leads l
      where k.id = keeper_id and l.id = loser_id
        and k.instagram_user_id is null and l.instagram_user_id is not null;

      delete from leads where id = loser_id;
    end loop;
  end loop;
end $$;
