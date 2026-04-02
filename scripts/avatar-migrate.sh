#!/bin/bash
# ============================================
# Avatar Migration — Complete Workflow
# ============================================
#
# Phase 1: BACKUP (run locally, BEFORE adding Volume)
#
#   DATABASE_URL="postgresql://..." \
#   BACKEND_URL="https://backend-production-db434.up.railway.app" \
#   node scripts/avatar-backup.mjs
#
# Phase 2: DEPLOY + RESTORE
#
#   1. Railwayダッシュボードで backendサービスに Volume 追加
#      Mount Path: /data
#
#   2. avatar-backup/ をgitに一時コミット:
#      git add avatar-backup/
#      git add apps/backend/Dockerfile
#      git commit -m "tmp: avatar migration files"
#      git push
#
#   3. Railwayが自動デプロイ → 起動時にリストアが実行される
#
#   4. ログでリストア完了を確認
#
# Phase 3: CLEANUP
#
#   git rm -r avatar-backup/
#   # Dockerfileからリストア行を削除
#   git commit -m "cleanup: remove avatar migration files"
#   git push
#
echo "This file is a reference only. Do not execute directly."
echo "Read the comments above for step-by-step instructions."
