import { S3Client } from '@aws-sdk/client-s3'

const accountId = process.env.R2_ACCOUNT_ID
const accessKeyId = process.env.R2_ACCESS_KEY_ID
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
const endpoint = process.env.R2_ENDPOINT

let cachedClient: S3Client | null = null

export function getR2Client(): S3Client {
  if (cachedClient) return cachedClient
  if (!accountId || !accessKeyId || !secretAccessKey || !endpoint) {
    throw new Error(
      'R2 not configured: missing R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_ENDPOINT in env',
    )
  }
  cachedClient = new S3Client({
    region: 'auto',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: false,
  })
  return cachedClient
}

export function getR2Bucket(): string {
  const bucket = process.env.R2_BUCKET
  if (!bucket) throw new Error('R2_BUCKET not set in env')
  return bucket
}

export function isR2Configured(): boolean {
  return !!(accountId && accessKeyId && secretAccessKey && endpoint && process.env.R2_BUCKET)
}
