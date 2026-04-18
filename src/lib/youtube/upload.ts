/**
 * Upload a video to YouTube via the resumable upload endpoint.
 * Docs: https://developers.google.com/youtube/v3/docs/videos/insert
 */

export interface YtUploadMetadata {
  title: string
  description?: string
  tags?: string[]
  categoryId?: string
  privacyStatus: 'public' | 'unlisted' | 'private'
  publishAt?: string
}

export interface YtUploadResult {
  id: string
  title: string
  url: string
}

export async function uploadYoutubeVideo(
  accessToken: string,
  mediaUrl: string,
  metadata: YtUploadMetadata,
): Promise<YtUploadResult> {
  const mediaRes = await fetch(mediaUrl)
  if (!mediaRes.ok) throw new Error(`Media download failed: ${mediaRes.status}`)
  const contentType = mediaRes.headers.get('content-type') ?? 'video/*'
  const arrayBuffer = await mediaRes.arrayBuffer()
  const videoBytes = new Uint8Array(arrayBuffer)

  const snippet: Record<string, unknown> = {
    title: metadata.title,
    description: metadata.description ?? '',
    tags: metadata.tags,
    categoryId: metadata.categoryId ?? '22',
  }
  const status: Record<string, unknown> = {
    privacyStatus: metadata.privacyStatus,
    selfDeclaredMadeForKids: false,
  }
  if (metadata.publishAt && metadata.privacyStatus === 'private') {
    status.publishAt = metadata.publishAt
  }

  const initRes = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': contentType,
        'X-Upload-Content-Length': String(videoBytes.byteLength),
      },
      body: JSON.stringify({ snippet, status }),
    },
  )

  if (!initRes.ok) {
    const text = await initRes.text()
    throw new Error(`YouTube init upload ${initRes.status}: ${text}`)
  }
  const uploadUrl = initRes.headers.get('location')
  if (!uploadUrl) throw new Error('YouTube init upload: missing Location header')

  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(videoBytes.byteLength),
    },
    body: videoBytes,
  })

  if (!uploadRes.ok) {
    const text = await uploadRes.text()
    throw new Error(`YouTube PUT upload ${uploadRes.status}: ${text}`)
  }

  const video = (await uploadRes.json()) as {
    id: string
    snippet?: { title?: string }
  }
  return {
    id: video.id,
    title: video.snippet?.title ?? metadata.title,
    url: `https://www.youtube.com/watch?v=${video.id}`,
  }
}
