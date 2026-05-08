import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand, DeleteObjectsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { randomUUID } from 'crypto'
import { getR2Bucket, getR2Client } from './r2-client'

const DEFAULT_PUT_TTL_SECONDS = 60 * 10 // 10 min — assez pour un upload video
const DEFAULT_GET_TTL_SECONDS = 60 * 60 // 1h — review session typique

export type R2Target = 'final' | 'media' | 'rush'

interface BuildPathArgs {
  workspaceId: string
  postId: string
  target: R2Target
  filename: string
}

export function buildR2Path({ workspaceId, postId, target, filename }: BuildPathArgs): string {
  const ext = filename.includes('.') ? filename.split('.').pop()!.toLowerCase().replace(/[^a-z0-9]/g, '') : 'bin'
  const safeExt = ext.length > 0 && ext.length <= 6 ? ext : 'bin'
  return `workspaces/${workspaceId}/posts/${postId}/${target}-${randomUUID()}.${safeExt}`
}

interface SignUploadArgs {
  path: string
  contentType: string
  contentLength?: number
  ttlSeconds?: number
}

export async function signUpload({ path, contentType, contentLength, ttlSeconds }: SignUploadArgs): Promise<string> {
  const client = getR2Client()
  const cmd = new PutObjectCommand({
    Bucket: getR2Bucket(),
    Key: path,
    ContentType: contentType,
    ContentLength: contentLength,
  })
  return getSignedUrl(client, cmd, { expiresIn: ttlSeconds ?? DEFAULT_PUT_TTL_SECONDS })
}

export async function signRead(path: string, ttlSeconds?: number): Promise<string> {
  const client = getR2Client()
  const cmd = new GetObjectCommand({
    Bucket: getR2Bucket(),
    Key: path,
  })
  return getSignedUrl(client, cmd, { expiresIn: ttlSeconds ?? DEFAULT_GET_TTL_SECONDS })
}

export async function deleteObject(path: string): Promise<void> {
  const client = getR2Client()
  await client.send(
    new DeleteObjectCommand({
      Bucket: getR2Bucket(),
      Key: path,
    }),
  )
}

export async function deleteByPrefix(prefix: string): Promise<{ deleted: number }> {
  const client = getR2Client()
  const bucket = getR2Bucket()
  let deleted = 0
  let continuationToken: string | undefined

  do {
    const list = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    )
    const keys = (list.Contents ?? []).map((o) => o.Key).filter((k): k is string => !!k)
    if (keys.length > 0) {
      for (let i = 0; i < keys.length; i += 1000) {
        const batch = keys.slice(i, i + 1000)
        await client.send(
          new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
          }),
        )
        deleted += batch.length
      }
    }
    continuationToken = list.NextContinuationToken
  } while (continuationToken)

  return { deleted }
}

export function pathBelongsToWorkspace(path: string, workspaceId: string): boolean {
  return path.startsWith(`workspaces/${workspaceId}/`)
}

export function extractWorkspaceId(path: string): string | null {
  const m = /^workspaces\/([0-9a-f-]+)\//.exec(path)
  return m?.[1] ?? null
}
