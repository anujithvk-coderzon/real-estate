-- User slugs were built as "<name>-<email local part>-<timestamp>", which
-- published every seller's email address in their public profile URL.
-- This rewrites every slug to "<name>-<6 random hex>", matching lib/slug.ts
-- userSlug(). Irreversible: the old slugs are the defect.

UPDATE "users"
SET "slug" =
  COALESCE(
    NULLIF(
      trim(both '-' from regexp_replace(lower("name"), '[^a-z0-9]+', '-', 'g')),
      ''
    ),
    'member'
  )
  || '-' || substr(md5("id"::text || clock_timestamp()::text), 1, 6);
