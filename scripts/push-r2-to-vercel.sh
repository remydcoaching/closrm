#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."

for VAR in R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_ENDPOINT R2_BUCKET R2_PUBLIC_BASE_URL; do
  VALUE=$(grep "^${VAR}=" .env.local | cut -d= -f2-)
  if [ -n "$VALUE" ]; then
    echo "→ Adding $VAR to Vercel prod..."
    printf "%s" "$VALUE" | vercel env add "$VAR" production --force
  else
    echo "⚠️  $VAR not found in .env.local"
  fi
done

echo ""
echo "✅ Done. Redeploying prod..."
vercel --prod
