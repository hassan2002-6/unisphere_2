-- KnowledgeDoc full-text search support (plan §6.1 raw-SQL migration).
-- Generated column + GIN index; retrieval uses websearch_to_tsquery
-- against this column with bound parameters (no raw concatenation).

ALTER TABLE "KnowledgeDoc"
  ADD COLUMN IF NOT EXISTS "tsv" tsvector
  GENERATED ALWAYS AS (to_tsvector('english', "title" || ' ' || "content")) STORED;

CREATE INDEX IF NOT EXISTS "knowledgedoc_tsv_idx" ON "KnowledgeDoc" USING GIN ("tsv");
