# QM spec

Read this whole before changing QM. It covers what QM promises, not how. Subsystems run from most central to least, and each has a wall of shame: real mistakes we don't repeat.

## North stars

- **Multiplayer first.** Every person and every room gets a real agent. Sharing is explicit and never accidental.
- **Never quiet.** Assume there is always work running. Nothing waits for idle: not deploys, not migrations, not maintenance.
- **Durable by default.** If anyone reads it back later, it lives in Postgres. RAM is only a cache.
- **Simpler every change.** Fix the cause, fix every instance, and leave less code than you found. No band-aids.
- **Honest failure.** Errors are loud and specific. Nothing is silently capped, dropped, swapped or retried forever.
- **Open and swappable.** Harnesses, models, sandboxes and deploy targets are plugins. No vendor gets to be load-bearing.

## 1. Scopes and identity

A scope is a person (DM), a channel, a group or a project. Each one has its own memory, files, keychain view, crons, apps and computer. A turn runs as a real human and only sees what that human and that scope are entitled to. Admins can see across scopes, and every admin read is audited.

Shame:
- Compaction summaries carried private content into a shared channel. A summary counts as data, so it gets the same boundary as the content it came from.
- Setup consent written into memory prose was treated as authorization. Memory is not a grant.

## 2. Turns and sessions

A session is one ordered transcript. A turn claims it, runs, and commits what it did as it goes. Stop works like a kernel interrupt: it ends the turn and every descendant right away. A new message either steers the running turn or queues behind it. It never silently kills it.

Shame:
- A boot-time recount held a global lock and froze chat writes during a deploy promotion, so the deploy rolled back.
- Stop waited on a subagent that never received the cancel.
- A new user message pre-empted an in-flight turn and the work vanished without a word.

## 3. Harnesses and models

A runtime is one unit: harness, model, effort and fast mode. Every harness drives the same core tools and transcript. An invalid combination is an error, never a quiet fallback. The effort menu shows only what the provider actually offers, under the provider's own names.

Shame:
- Harnesses silently dropped or swapped the selected effort level.
- A gateway response cache replayed one malformed tool call to every retry, and the run was recorded as a success 24 times.
- A regex refusal detector with an alternate-model ladder. We deleted it.

## 4. Sandboxes

Every scope has a durable computer. Providers are interchangeable. A dead machine is a fact to report, not a verdict, and the agent should finish the work on another box. Commands on one machine never serialize behind a whole-machine lock.

Shame:
- Distinct provider failures were collapsed into "wedged, restart it," and the agent promised retries it never scheduled.
- Whole execs queued behind a five-minute machine lock.
- A failed snapshot retried on every turn, forever.

## 5. Credentials

Secrets stay out of the sandbox wherever possible. Brokered calls get the secret stamped on server-side. Anything that must be materialized exists only for the turn and only for the command that asked for it. Cross-scope use needs an owner-approved grant. New credentials arrive through a secret-drop link, never through chat.

Shame:
- Env-delivered org credentials skipped the grant check the broker enforced.
- A token sat in a git remote URL and ended up in a transcript.
- The agent walked a user through the admin console instead of minting a drop link.

## 6. Memory, guidance and skills

Memory is an append-only index of durable facts. It is not a datastore and not authorization. Guidance holds standing instructions. Skills are scope-owned procedures, shared by grant and promoted to the org by an admin.

Shame:
- Superseded instructions stayed in memory and quietly conflicted with new ones.

## 7. Background work: crons, Loops and webhooks

Scheduled work runs with its owner's authority and posts where it was created. A shared job cannot be retargeted or rewritten by a non-owner without the owner's live approval. Every fire is recorded durably, and a fire that cannot do its job says so.

Shame:
- Loop intake ran with its tools stripped, so it always found nothing, and fired 50 times in six hours.
- Two concurrent fires each invented their own lock file and sent the same report twice.
- A hardcoded 100-task quota got in people's way. Limits must never block real work.

## 8. Surfaces: Slack and web

Slack and web are two views of the same sessions and identity. Slack should look like Slack and web like the web UI. Text renders first and large things load lazily. The browser never receives model-only context. An ack means "I am working on this."

Shame:
- A byte-size page cap hid earlier turns with no way to scroll back.
- Memory and environment blocks were shipped to the browser.
- The agent said "attached" without attaching, and guessed URLs.

## 9. Apps and files

Apps are private by default and shared the way docs are. Truly external access is off unless an admin turns it on. Files carry the permissions of the scope that made them.

Shame:
- Public app links were on by default.

## 10. Deploy and release

Blue/green with health checks. In-flight turns hand off to new workers at a safe point within a short grace window, and nobody waits for a drain. Downstream deployments pin a qm release. Merged is not live: verify against the running release.

Shame:
- A deploy waited for turns to drain, which never happens.
- A schema bug in a unified tool definition took down every sandbox silently for an hour.

## Editing this spec

Contracts, not mechanisms. No dates, PR numbers or status. Stay under 1,000 words. When a mistake costs real time, add one line to its wall of shame in the fixing PR.
