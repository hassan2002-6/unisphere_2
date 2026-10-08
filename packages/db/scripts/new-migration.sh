#!/usr/bin/env bash
# Non-interactive Prisma migration for this repo.
#
# Why: `prisma migrate dev` refuses non-interactive shells, and the live DB has a
# raw-SQL generated `tsv` column on KnowledgeDoc (from the knowledge_fts
# migration) that is intentionally not managed by the schema — the diff is
# filtered so it never touches it.
#
# Usage:  bash scripts/new-migration.sh <migration_name>
set -euo pipefail
cd "$(dirname "$0")/.."

NAME="${1:?usage: new-migration.sh <name>}"
export PATH="$HOME/.bun/bin:$PATH"
set -a; . ../../apps/web/.env.local; set +a

STAMP="$(date +%Y%m%d%H%M%S)"
DIR="prisma/migrations/${STAMP}_${NAME}"
mkdir -p "$DIR"

bunx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script 2>/dev/null \
  | grep -v 'DROP INDEX "knowledgedoc_tsv_idx"' \
  | grep -v 'ALTER COLUMN "tsv" DROP DEFAULT' \
  | grep -v 'DROP COLUMN "tsv"' > "$DIR/migration.sql"

if [ ! -s "$DIR/migration.sql" ]; then
  echo "── no schema drift — removing $DIR"
  rmdir "$DIR"
  exit 0
fi

echo "── generated $DIR/migration.sql ($(wc -l < "$DIR/migration.sql") lines)"
cat "$DIR/migration.sql"
echo "── applying…"
bunx prisma db execute --file "$DIR/migration.sql"
bunx prisma migrate resolve --applied "${STAMP}_${NAME}"
bunx prisma generate
echo "── done: ${STAMP}_${NAME}"
