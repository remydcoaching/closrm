-- supabase/migrations/117_backfill_lead_instagram_pictures.sql
-- Leads had no Instagram picture (0 / 1143 in prod on 2026-09-27) although
-- ClosRM already stores one for many of them: in the story viewer lists
-- (story_viewers, matched_lead_id) and in Instagram DM conversations
-- (ig_conversations.participant_avatar_url). Fills only empty columns;
-- nothing is overwritten. New story viewer collections keep them fresh
-- (persistStoryViews → planLeadEnrichment).

-- 1. From story viewer lists: most recent sighting per lead.
with latest as (
  select distinct on (sv.workspace_id, sv.matched_lead_id)
    sv.workspace_id, sv.matched_lead_id as lead_id, sv.instagram_user_id, sv.profile_pic_url
  from story_viewers sv
  where sv.matched_lead_id is not null and sv.profile_pic_url is not null
  order by sv.workspace_id, sv.matched_lead_id, sv.first_seen_at desc
)
update leads l
set instagram_profile_pic_url = coalesce(l.instagram_profile_pic_url, latest.profile_pic_url),
    instagram_user_id = coalesce(l.instagram_user_id, latest.instagram_user_id)
from latest
where l.id = latest.lead_id
  and l.workspace_id = latest.workspace_id
  and (l.instagram_profile_pic_url is null or l.instagram_user_id is null);

-- 2. From DM conversations.
with conv as (
  select distinct on (c.workspace_id, c.lead_id) c.workspace_id, c.lead_id, c.participant_avatar_url
  from ig_conversations c
  where c.lead_id is not null and c.participant_avatar_url like 'https://%'
  order by c.workspace_id, c.lead_id, c.last_message_at desc nulls last
)
update leads l
set instagram_profile_pic_url = conv.participant_avatar_url
from conv
where l.id = conv.lead_id
  and l.workspace_id = conv.workspace_id
  and l.instagram_profile_pic_url is null;
