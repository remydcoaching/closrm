-- ============================================================================
-- MIGRATION 024: Replace ALL RLS policies to use workspace_members
--
-- PREREQUISITE: Migration 023 must be applied (workspace_members table + backfill)
-- USES: user_workspace_ids() function (SECURITY DEFINER, bypasses RLS)
--
-- This migration replaces the old pattern:
--   workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid())
-- With the new pattern:
--   workspace_id IN (SELECT user_workspace_ids())
-- ============================================================================

-- ─── Schema.sql tables ─────────────────────────────────────────────────────

-- workspaces: allow members to see their workspace (not just owner)
DROP POLICY IF EXISTS "Owner access" ON workspaces;
CREATE POLICY "workspace_access" ON workspaces
  FOR ALL USING (id IN (SELECT user_workspace_ids()));

-- users: allow workspace members to see each other
DROP POLICY IF EXISTS "Workspace members" ON users;
CREATE POLICY "users_access" ON users
  FOR ALL USING (workspace_id IN (SELECT user_workspace_ids()));

-- leads
DROP POLICY IF EXISTS "Workspace leads" ON leads;
CREATE POLICY "leads_access" ON leads
  FOR ALL USING (workspace_id IN (SELECT user_workspace_ids()));

-- calls
DROP POLICY IF EXISTS "Workspace calls" ON calls;
CREATE POLICY "calls_access" ON calls
  FOR ALL USING (workspace_id IN (SELECT user_workspace_ids()));

-- follow_ups
DROP POLICY IF EXISTS "Workspace follow_ups" ON follow_ups;
CREATE POLICY "follow_ups_access" ON follow_ups
  FOR ALL USING (workspace_id IN (SELECT user_workspace_ids()));

-- automations (legacy)
DROP POLICY IF EXISTS "Workspace automations" ON automations;
CREATE POLICY "automations_access" ON automations
  FOR ALL USING (workspace_id IN (SELECT user_workspace_ids()));

-- integrations
DROP POLICY IF EXISTS "Workspace integrations" ON integrations;
CREATE POLICY "integrations_access" ON integrations
  FOR ALL USING (workspace_id IN (SELECT user_workspace_ids()));

-- ─── Migration 001: Workflows ──────────────────────────────────────────────

DROP POLICY IF EXISTS "Workspace workflows" ON workflows;
CREATE POLICY "workflows_access" ON workflows
  FOR ALL USING (workspace_id IN (SELECT user_workspace_ids()));

DROP POLICY IF EXISTS "Workspace workflow_steps" ON workflow_steps;
CREATE POLICY "workflow_steps_access" ON workflow_steps
  FOR ALL USING (
    workflow_id IN (
      SELECT id FROM workflows WHERE workspace_id IN (SELECT user_workspace_ids())
    )
  );

DROP POLICY IF EXISTS "Workspace workflow_executions" ON workflow_executions;
CREATE POLICY "workflow_executions_access" ON workflow_executions
  FOR ALL USING (workspace_id IN (SELECT user_workspace_ids()));

DROP POLICY IF EXISTS "Workspace execution_logs" ON workflow_execution_logs;
CREATE POLICY "execution_logs_access" ON workflow_execution_logs
  FOR ALL USING (
    execution_id IN (
      SELECT id FROM workflow_executions WHERE workspace_id IN (SELECT user_workspace_ids())
    )
  );

-- ─── Migration 002: Booking Calendars ──────────────────────────────────────

DROP POLICY IF EXISTS "Workspace slugs" ON workspace_slugs;
CREATE POLICY "slugs_access" ON workspace_slugs
  FOR ALL USING (workspace_id IN (SELECT user_workspace_ids()));

DROP POLICY IF EXISTS "Workspace booking_calendars" ON booking_calendars;
CREATE POLICY "booking_calendars_access" ON booking_calendars
  FOR ALL USING (workspace_id IN (SELECT user_workspace_ids()));

DROP POLICY IF EXISTS "Workspace bookings" ON bookings;
CREATE POLICY "bookings_access" ON bookings
  FOR ALL USING (workspace_id IN (SELECT user_workspace_ids()));

-- ─── Migration 004: Booking Locations ──────────────────────────────────────

DROP POLICY IF EXISTS "Workspace booking_locations" ON booking_locations;
CREATE POLICY "booking_locations_access" ON booking_locations
  FOR ALL USING (workspace_id IN (SELECT user_workspace_ids()));

-- ─── Migration 005: Planning Templates ─────────────────────────────────────

DROP POLICY IF EXISTS "Workspace planning_templates" ON planning_templates;
CREATE POLICY "planning_templates_access" ON planning_templates
  FOR ALL USING (workspace_id IN (SELECT user_workspace_ids()));

-- ─── Migration 006: Email Module ───────────────────────────────────────────

DROP POLICY IF EXISTS "email_domains_workspace" ON email_domains;
CREATE POLICY "email_domains_access" ON email_domains
  FOR ALL USING (workspace_id IN (SELECT user_workspace_ids()));

DROP POLICY IF EXISTS "email_templates_workspace" ON email_templates;
CREATE POLICY "email_templates_access" ON email_templates
  FOR ALL USING (workspace_id IN (SELECT user_workspace_ids()));

DROP POLICY IF EXISTS "email_broadcasts_workspace" ON email_broadcasts;
CREATE POLICY "email_broadcasts_access" ON email_broadcasts
  FOR ALL USING (workspace_id IN (SELECT user_workspace_ids()));

DROP POLICY IF EXISTS "email_sends_workspace" ON email_sends;
CREATE POLICY "email_sends_access" ON email_sends
  FOR ALL USING (workspace_id IN (SELECT user_workspace_ids()));

DROP POLICY IF EXISTS "email_sequence_enrollments_workspace" ON email_sequence_enrollments;
CREATE POLICY "email_sequence_enrollments_access" ON email_sequence_enrollments
  FOR ALL USING (workspace_id IN (SELECT user_workspace_ids()));

-- ─── Migration 008: Funnels ────────────────────────────────────────────────

DROP POLICY IF EXISTS "funnels_workspace" ON funnels;
CREATE POLICY "funnels_access" ON funnels
  FOR ALL USING (workspace_id IN (SELECT user_workspace_ids()));

DROP POLICY IF EXISTS "funnel_pages_workspace" ON funnel_pages;
CREATE POLICY "funnel_pages_access" ON funnel_pages
  FOR ALL USING (workspace_id IN (SELECT user_workspace_ids()));

DROP POLICY IF EXISTS "funnel_events_workspace" ON funnel_events;
CREATE POLICY "funnel_events_access" ON funnel_events
  FOR ALL USING (workspace_id IN (SELECT user_workspace_ids()));

-- ─── Migration 009: Instagram Module ───────────────────────────────────────

DROP POLICY IF EXISTS "ig_accounts_workspace" ON ig_accounts;
CREATE POLICY "ig_accounts_access" ON ig_accounts
  FOR ALL USING (workspace_id IN (SELECT user_workspace_ids()));

DROP POLICY IF EXISTS "ig_content_pillars_workspace" ON ig_content_pillars;
CREATE POLICY "ig_content_pillars_access" ON ig_content_pillars
  FOR ALL USING (workspace_id IN (SELECT user_workspace_ids()));

DROP POLICY IF EXISTS "ig_stories_workspace" ON ig_stories;
CREATE POLICY "ig_stories_access" ON ig_stories
  FOR ALL USING (workspace_id IN (SELECT user_workspace_ids()));

DROP POLICY IF EXISTS "story_sequences_workspace" ON story_sequences;
CREATE POLICY "story_sequences_access" ON story_sequences
  FOR ALL USING (workspace_id IN (SELECT user_workspace_ids()));

DROP POLICY IF EXISTS "story_sequence_items_workspace" ON story_sequence_items;
CREATE POLICY "story_sequence_items_access" ON story_sequence_items
  FOR ALL USING (
    sequence_id IN (
      SELECT id FROM story_sequences WHERE workspace_id IN (SELECT user_workspace_ids())
    )
  );

DROP POLICY IF EXISTS "ig_reels_workspace" ON ig_reels;
CREATE POLICY "ig_reels_access" ON ig_reels
  FOR ALL USING (workspace_id IN (SELECT user_workspace_ids()));

DROP POLICY IF EXISTS "ig_drafts_workspace" ON ig_drafts;
CREATE POLICY "ig_drafts_access" ON ig_drafts
  FOR ALL USING (workspace_id IN (SELECT user_workspace_ids()));

DROP POLICY IF EXISTS "ig_hashtag_groups_workspace" ON ig_hashtag_groups;
CREATE POLICY "ig_hashtag_groups_access" ON ig_hashtag_groups
  FOR ALL USING (workspace_id IN (SELECT user_workspace_ids()));

DROP POLICY IF EXISTS "ig_caption_templates_workspace" ON ig_caption_templates;
CREATE POLICY "ig_caption_templates_access" ON ig_caption_templates
  FOR ALL USING (workspace_id IN (SELECT user_workspace_ids()));

DROP POLICY IF EXISTS "ig_snapshots_workspace" ON ig_snapshots;
CREATE POLICY "ig_snapshots_access" ON ig_snapshots
  FOR ALL USING (workspace_id IN (SELECT user_workspace_ids()));

DROP POLICY IF EXISTS "ig_goals_workspace" ON ig_goals;
CREATE POLICY "ig_goals_access" ON ig_goals
  FOR ALL USING (workspace_id IN (SELECT user_workspace_ids()));

DROP POLICY IF EXISTS "ig_conversations_workspace" ON ig_conversations;
CREATE POLICY "ig_conversations_access" ON ig_conversations
  FOR ALL USING (workspace_id IN (SELECT user_workspace_ids()));

DROP POLICY IF EXISTS "ig_messages_workspace" ON ig_messages;
CREATE POLICY "ig_messages_access" ON ig_messages
  FOR ALL USING (workspace_id IN (SELECT user_workspace_ids()));

-- ─── Migration 012: Instagram Comments ─────────────────────────────────────

DROP POLICY IF EXISTS "workspace_isolation" ON ig_comments;
CREATE POLICY "ig_comments_access" ON ig_comments
  FOR ALL USING (workspace_id IN (SELECT user_workspace_ids()));

-- ─── Migration 018: AI Assistant ───────────────────────────────────────────

DROP POLICY IF EXISTS "Workspace brief" ON ai_coach_briefs;
CREATE POLICY "ai_briefs_access" ON ai_coach_briefs
  FOR ALL USING (workspace_id IN (SELECT user_workspace_ids()));

DROP POLICY IF EXISTS "Workspace outcomes" ON ai_conversation_outcomes;
CREATE POLICY "ai_outcomes_access" ON ai_conversation_outcomes
  FOR ALL USING (workspace_id IN (SELECT user_workspace_ids()));

-- ─── Migration 021: Booking Reminders ──────────────────────────────────────

DROP POLICY IF EXISTS "Users can manage their workspace booking_reminders" ON booking_reminders;
CREATE POLICY "booking_reminders_access" ON booking_reminders
  FOR ALL USING (workspace_id IN (SELECT user_workspace_ids()));

-- ─── Storage: Workspace Logos ──────────────────────────────────────────────

DROP POLICY IF EXISTS "workspace_logos_owner_insert" ON storage.objects;
CREATE POLICY "workspace_logos_member_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'workspace-logos' AND
    (storage.foldername(name))[1]::uuid IN (SELECT user_workspace_ids())
  );

DROP POLICY IF EXISTS "workspace_logos_owner_update" ON storage.objects;
CREATE POLICY "workspace_logos_member_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'workspace-logos' AND
    (storage.foldername(name))[1]::uuid IN (SELECT user_workspace_ids())
  );

DROP POLICY IF EXISTS "workspace_logos_owner_delete" ON storage.objects;
CREATE POLICY "workspace_logos_member_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'workspace-logos' AND
    (storage.foldername(name))[1]::uuid IN (SELECT user_workspace_ids())
  );
