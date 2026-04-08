# Lead Messages Restyle — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restyle the LeadMessagesTab to reuse the Messages page components (ConversationThread, MessageInput) and add a Messages tab to the LeadSidePanel.

**Architecture:** Replace custom message rendering in LeadMessagesTab with the shared ConversationThread and MessageInput components. Add a "Messages" tab to LeadSidePanel that shows the same thread inline.

**Tech Stack:** Next.js 14, React, TypeScript, Supabase, existing message components

---

### Task 1: Restyle LeadMessagesTab to use shared components

**Files:**
- Modify: `src/components/leads/LeadMessagesTab.tsx`

**What to do:**
- Remove the custom message rendering (red bubbles, old timestamps)
- Import and use `ConversationThread` from `@/components/messages/ConversationThread`
- Import and use `MessageInput` from `@/components/messages/MessageInput`
- Keep the existing data fetching logic (fetch conversation by lead_id, then messages)
- Add message sending capability (call `/api/instagram/messages/send`)
- Add image sending capability (call `/api/instagram/messages/send-image`)
- Keep the header with avatar + username + "Ouvrir dans Messages" link
- Use inline styles + CSS vars (not hardcoded colors)
- Layout: header at top, scrollable thread in middle, input at bottom

### Task 2: Add Messages tab to LeadSidePanel

**Files:**
- Modify: `src/components/shared/LeadSidePanel.tsx`

**What to do:**
- Add tabs at the top of the side panel: "Infos" (current content) | "Messages" (new)
- When "Messages" tab is selected, show a compact version of the message thread
- Reuse ConversationThread and MessageInput components
- Fetch conversation by lead_id (same as LeadMessagesTab)
- Only show Messages tab if the lead has an instagram_handle
- The tab should be toggleable, default to "Infos"

### Task 3: Fix ContactPanel + commit + deploy

**Files:**
- Already fixed: `src/components/messages/ContactPanel.tsx`

**What to do:**
- Commit the ContactPanel fix (API response format `data.data`)
- Deploy all changes together
