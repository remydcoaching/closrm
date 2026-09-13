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

export interface ApifyCredentials {
  apiToken: string
  actorId: string
}

export async function startLikersRun(
  postUrls: string[],
  credentials: ApifyCredentials,
): Promise<{ runId: string; datasetId: string | null }> {
  const response = await fetch(`${APIFY_BASE_URL}/actors/${credentials.actorId}/runs`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${credentials.apiToken}`,
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
  credentials: ApifyCredentials,
): Promise<{ status: ApifyRunStatus; defaultDatasetId: string | null }> {
  const response = await fetch(`${APIFY_BASE_URL}/actors/${credentials.actorId}/runs/${runId}`, {
    headers: { Authorization: `Bearer ${credentials.apiToken}` },
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

export async function getDatasetItems(
  datasetId: string,
  credentials: ApifyCredentials,
): Promise<ApifyLikerItem[]> {
  const response = await fetch(`${APIFY_BASE_URL}/datasets/${datasetId}/items`, {
    headers: { Authorization: `Bearer ${credentials.apiToken}` },
  })

  if (!response.ok) {
    throw new Error(`Apify dataset fetch failed: ${response.status}`)
  }

  const body = await response.json()
  return body.items
}
