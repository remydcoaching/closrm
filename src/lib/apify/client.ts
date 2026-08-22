const APIFY_BASE_URL = 'https://api.apify.com/v2'

export interface ApifyLikerItem {
  position: number
  userId: string
  username: string
  fullName: string | null
  profilePicUrl: string | null
  isVerified: boolean
  sourcePost: string
  scrapedAt: string
}

export type ApifyRunStatus = 'READY' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'ABORTED' | 'TIMED-OUT'

function getToken(): string {
  const token = process.env.APIFY_API_TOKEN
  if (!token) throw new Error('APIFY_API_TOKEN is not set')
  return token
}

function getActorId(): string {
  const actorId = process.env.APIFY_ACTOR_ID
  if (!actorId) throw new Error('APIFY_ACTOR_ID is not set')
  return actorId
}

export async function startLikersRun(
  postUrls: string[],
): Promise<{ runId: string; datasetId: string | null }> {
  const response = await fetch(`${APIFY_BASE_URL}/actors/${getActorId()}/runs`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ postUrls }),
  })

  if (!response.ok) {
    throw new Error(`Apify run start failed: ${response.status}`)
  }

  const body = await response.json()
  return {
    runId: body.data.id,
    datasetId: body.data.defaultDatasetId ?? null,
  }
}

export async function getRunStatus(
  runId: string,
): Promise<{ status: ApifyRunStatus; defaultDatasetId: string | null }> {
  const response = await fetch(`${APIFY_BASE_URL}/actors/${getActorId()}/runs/${runId}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  })

  if (!response.ok) {
    throw new Error(`Apify run status fetch failed: ${response.status}`)
  }

  const body = await response.json()
  return {
    status: body.data.status,
    defaultDatasetId: body.data.defaultDatasetId ?? null,
  }
}

export async function getDatasetItems(datasetId: string): Promise<ApifyLikerItem[]> {
  const response = await fetch(`${APIFY_BASE_URL}/datasets/${datasetId}/items`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  })

  if (!response.ok) {
    throw new Error(`Apify dataset fetch failed: ${response.status}`)
  }

  const body = await response.json()
  return body.items
}
