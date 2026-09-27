// Persists per-content metadata (views, type, thumbnail) from a
// DiscoveryResult into discovery_contents (migration 109) — the data
// discoverInstagramAccount already computes (NormalizedContent.viewCount,
// .thumbnail_url via rawMetadata) but that was previously discarded once
// the scan completed. Powers the Content page's engagement-vs-views chart.
import type { DiscoveryResult } from './discovery'

export interface PersistContentsResult {
  contentsPersisted: number
  errors: string[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function persistDiscoveryContents(supabase: any, workspaceId: string, discoveryRunId: string, result: DiscoveryResult): Promise<PersistContentsResult> {
  const errors: string[] = []
  let contentsPersisted = 0

  for (const content of result.contents) {
    const row = {
      workspace_id: workspaceId,
      discovery_run_id: discoveryRunId,
      content_id: content.id,
      content_type: content.type,
      content_url: content.url,
      // rawMetadata carries Hiker's original item shape — thumbnail_url is
      // present there even though NormalizedContent itself drops it (see
      // normalizer.ts), so it's read from the raw payload here rather than
      // widening NormalizedContent's own shape for one consumer.
      thumbnail_url: (content.rawMetadata as { thumbnail_url?: string })?.thumbnail_url ?? null,
      published_at: content.timestamp,
      view_count: content.viewCount,
      reported_like_count: content.likeCount,
      reported_comment_count: content.commentCount,
    }
    const caption = (content.rawMetadata as { caption_text?: string })?.caption_text?.slice(0, 2000) ?? null
    let { error: insertError } = await supabase.from('discovery_contents').insert({ ...row, caption })
    // Migration 114 (caption) not applied yet: store the rest anyway.
    if (insertError && /caption/.test(insertError.message ?? '')) {
      ;({ error: insertError } = await supabase.from('discovery_contents').insert(row))
    }


    if (insertError) {
      // A unique (discovery_run_id, content_id) collision is expected if
      // this content was already persisted in a re-run of the same request
      // — not a real failure, skip quietly like the interaction dedup does
      // elsewhere in this pipeline.
      if (!/duplicate|unique/i.test(insertError.message ?? '')) {
        errors.push(`Failed to persist discovery content ${content.id}: ${insertError.message}`)
        continue
      }
    }
    contentsPersisted += 1
  }

  return { contentsPersisted, errors }
}
