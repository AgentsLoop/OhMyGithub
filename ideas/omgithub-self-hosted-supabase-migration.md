# Migrate OmGithub from Firebase to self-hosted Supabase on a2

Status: proposal only. Do not change production until the Firebase export is complete and verified.

## Goal

Run Supabase on a2 with Docker Compose. Keep OmGithub catalog data, ratings,
comments, and play history on a2. Do not use Supabase Cloud or external backup
storage.

Keep GitHub sign-in, public URLs, Actions builds, upload callbacks, and game
files unchanged.

## Deploy Supabase

1. Create `/home/ubuntu/projects/omgithub-supabase` on a2.
2. Use the official Supabase Docker Compose deployment. Pin the upstream release
   and every image digest. Verify ARM64 support before installation.
3. Create dedicated Docker volumes for PostgreSQL, Supabase Storage, and backup
   data. Do not bind PostgreSQL, Kong, Studio, or Storage ports to the public
   network.
4. Put Supabase and OmGithub on a private Docker network. Connect the Node
   server through a PostgreSQL connection pool.
5. Reach Studio only through an SSH tunnel. Store generated secrets in KeePass
   and materialize them only in the a2 deployment environment.
6. Record pinned versions, ports, volume names, image digests, and health checks
   in the deployment documentation.

## Replace Firebase access

1. Add versioned SQL migrations for `projects`, social totals, ratings,
   comments, and play records.
2. Preserve Firestore document IDs, timestamps, status, catalog metadata, and
   JSON fields. Use JSONB for flexible project metadata.
3. Add indexes for project ID, slug, source key, public path, publication time,
   comment project ID, and social identity keys.
4. Replace Firestore calls with parameterized PostgreSQL queries. Keep the
   existing server API responses and local JSON storage for development.
5. Preserve partial project updates, catalog ordering, rating seeds, moderation
   state, canonical social identities, and the rolling 24-hour play-count rule.
6. Use transactions and row locks for ratings, comments, and plays. Do not lose
   concurrent writes or count one visitor twice in a 24-hour period.
7. Update catalog import and star-backfill commands to use the PostgreSQL
   adapter. Fail production startup when the database configuration is missing
   or invalid.

## Export and import data

1. Export every Firebase document from `omgithub_projects`, `project_social`,
   `project_ratings`, `project_comments`, and `project_plays` to a2.
2. Use pagination and resumable checkpoints. Do not use the catalog's
   200-record display limit.
3. Save immutable export files, collection counts, and checksums under
   `/home/ubuntu/backups/omgithub-supabase/firebase-export`.
4. Import with ID-based upserts. Preserve timestamps and source IDs.
5. Verify each collection count and canonical record checksum after import.
6. Stop the migration when Firebase quota errors prevent a complete export.
   Keep Firebase authoritative until a later full export succeeds.

## Cut over and roll back

1. Schedule a short maintenance window.
2. Block new writes and wait for active publication jobs and upload callbacks.
3. Take the final Firebase export and import it into Supabase.
4. Compare final counts, checksums, catalog routes, and social summaries.
5. Deploy OmGithub with Supabase only after all checks pass.
6. Keep Firebase credentials, exports, the a1 migration backup, and the stopped
   Firebase-capable image for seven days.
7. If Supabase fails before accepting writes, restart the Firebase version.
8. If Supabase has accepted writes, freeze writes, export complete Supabase data
   back to Firebase, verify it, then restore the Firebase version.
9. Do not delete Firebase data automatically.

## Backups

1. Store backups under `/home/ubuntu/backups/omgithub-supabase` on a2.
2. Run PostgreSQL logical backups every hour. Keep 48 hourly backups, 14 daily
   backups, and 4 weekly backups.
3. Back up database roles, Supabase configuration, Docker Compose files, and
   game files every day. Create a full pre-change backup before each deployment
   or database migration.
4. Write each backup to a temporary path, verify it, then rename it into place.
   Never remove the last verified backup.
5. Run a weekly restore into an isolated PostgreSQL database on a2. Check schema,
   record counts, checksums, and representative OmGithub queries.
6. Accept the single-host limit: a2 disk loss loses all local copies. Target at
   most one hour of data loss and a one-hour database restore. Measure restore
   time in the weekly test.

## Monitoring and updates

1. Use systemd timers for backups and monitoring.
2. Check every minute: OmGithub health, Supabase container health, PostgreSQL
   connectivity, restart counts, disk use, free memory, and newest backup age.
3. Save monitoring results locally. Mark a failure after three consecutive failed
   checks. Flag disk use above 80 percent and a database backup older than two
   hours.
4. Check upstream Supabase releases each month. Record candidate releases and
   review release notes before updates.
5. Update only during a maintenance window. Pin new images, take a verified
   backup, test the updated stack against a restored database, then reopen
   writes.
6. Retain the prior Compose configuration and images. Roll back application-only
   failures to the prior image. Restore the matching database backup when a
   database update cannot be reversed safely.

## Verify before delivery

1. Test catalog lookups, partial project updates, exports, imports, and metadata
   preservation.
2. Test concurrent ratings, comments, deletion, moderation, play
   deduplication, and transaction rollback.
3. Test backup creation, failed backup detection, restore, container restart,
   and rollback.
4. Verify the public catalog, existing game subdomains, GitHub sign-in, and one
   complete Actions publication with its upload callback.
5. Run `npm test`, `npm run build`, and `git diff --check`.
6. Commit and push the code, scripts, migrations, and documentation with the
   migration reason, validation results, and current task ID.
