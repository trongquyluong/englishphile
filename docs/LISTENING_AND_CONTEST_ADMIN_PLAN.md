# Listening Upload & Contest Admin Builder — Planning Notes

Internal planning document only. Nothing in this file is implemented yet, and
none of it should ship without its own dedicated task.

## Listening content

- Listening needs **both** question data and an audio file. A listening
  problem without playable audio must not be published to learners.
- Audio must **not** live in the database. Store metadata + an audio URL/path
  only (suggested fields: `audioUrl`, `durationSeconds`, `mimeType`,
  `sourceLabel`). Files belong in object storage or `public/` during beta.
- Admin will later need upload support for listening audio:
  - upload → validate type/size → store → attach URL to the problem/question,
  - preview playback inside admin before publish,
  - keep the existing import/QA/publish lifecycle (`NEEDS_REVIEW` default).
- The existing diagnostic behavior stays: Listening is excluded from
  auto-scoring until published listening content exists.

## Contest Admin Builder (later phase)

The builder will need, at minimum:

- create contest (title, description, visibility, schedule, duration),
- configure sections (order, skill/type grouping),
- set scores per question/section,
- input questions/answers (reuse the problem bank; `PUBLISHED` problems only,
  server-validated),
- upload files — especially audio for Listening sections,
- preview, then publish.

Existing rules that must keep holding when this is built:

- contest problems default to `PUBLISHED` and are server-validated,
- leaderboards never expose user email,
- scoring stays deterministic and explainable.

## Explicitly out of scope for the current patch

- No listening upload UI or API.
- No Contest Admin Builder screens or routes.
- No schema migration for audio metadata.
