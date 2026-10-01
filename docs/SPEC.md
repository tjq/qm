# QM spec

Read this before you change QM. It describes the target. Where the code falls short, a **Gap** line says so; closing one means deleting the line.

## North stars

1. **Unhobbling.** Frontier models are usually smarter than we allow them to be. Effective intelligence grows with capabilities exposed.
2. **Free the claw.** Sessions, memory and state live in Postgres, and the agent can read them. Sandboxes and models are resources the agent chooses and switches between as the work demands.
3. **Primitives.** Keep the harness thin: run commands on a computer, read and write files, publish apps. Everything else is a patch over a rough edge until a primitive can absorb it. Agent features are full sessions with the whole toolset, not bare model calls.
4. **Iterate fast.** Merge to production should take minutes. Speed is the best feature, and every bit of overhead we add should be measured and driven down.
5. **Agent UX = human UX.** Tools, errors, hints and prompts are the agent's interface, so they get the same care as the web UI. Spend every context token on purpose.

## Subsystems, most central first

**Turns and sessions.** A turn is a run: a worker claims it from the Postgres run queue, the orchestrator assembles context, runs a harness, and commits the result to the session transcript. One lease per session guarantees one writer. Deploys hand a live turn off at a safe point within a short grace window; they never wait for quiet. **Gap:** transcripts are written to both `session_entries` and `session_tape`, with a read-time heal between them, and `session_leases` duplicates the run lease.

**Harnesses and models.** Pi, Codex, Claude Code and OpenCode are interchangeable harnesses over one tool catalog. The model catalog is the single source for which models exist, their effort levels and prices. A runtime is one value (harness, model, effort, fast), validated once; an unsupported combination is an error, not a silent fallback. **Gap:** the Pi harness regex-matches refusal text to fall back to other models; each harness classifies retryable errors its own way; goal spend is metered twice.

**Scopes and identity.** Every Slack or web actor resolves to one principal by verified work email. A scope is a room plus the people in it; what a turn may read is computed from the least-privileged person present and the room's sharing posture. Admin reads are audited; outside Slack Connect users get no reply.

**Sandboxes.** A computer is a provider resource (E2B, Modal, Sprites, AWS, Docker and others) with a home that can be snapshotted and moved. Status reports what failed; the agent decides what to do, including finishing the work on a different computer. **Gap:** nine providers, two of them on the shared exec base; status still collapses distinct failures into one "wedged" verdict with restart advice.

**Credentials.** Secrets stay server-side. Shared org credentials are used by proxy through the broker and the egress proxy, which check a per-turn capability token. Personal logins live in a per-person keychain filled by one-time drop links, and cross-scope use requires the owner's approval on a card, never chat. **Gap:** six keychain decrypt paths, two delivery routes, eight signed-token formats.

**Memory, guidance and skills.** Memory is an append-only per-scope notebook recalled each turn: an index of pointers, not a datastore and not a permission. Guidance holds a scope's standing orders. Skills are instructions served from core. **Gap:** memory has two configuration axes and production uses one default.

**Background work.** Crons run on pg-boss with one dedupe rule; a fire runs with its owner's access, and edits by others wait for the owner. Loops are crons that work a queue with outputs held for review. **Gap:** two webhook receivers; cron dedupes a fire three ways; Loop ingress has its own retry queue.

**Surfaces.** Slack and the web UI are two views of the same sessions, each native to its host. Text first, heavy content lazily; model-only context never reaches the browser. **Gap:** the web UI server is a hand-rolled HTTP router; Slack has five reply renderers; inbound Slack dedupe is in-memory, so a retry on the other deploy color runs twice.

**Apps and files.** Apps publish as immutable versions behind core's viewer check, private by default and shared like a document; external access is an admin flag, default off. **Gap:** Docker-published apps have no durable data mount.

**Deploy and release.** The CLI runs blue/green releases; Terraform provisions. Downstream deployments pin a qm release, and merged is not live until the running release contains it. **Gap:** the AWS backend is 5,000 lines of shell-outs where the SDK belongs.

## One of each

Extend these; don't add a sibling. Where several exist, converge on the first named.

- Work queue: the runs queue. *Gap:* delivery and file uploads have their own; cron is on pg-boss.
- Lock: the advisory-lock helper plus the run lease. *Gap:* session leases, a leader lease, nested deploy locks.
- Retry, backoff, timeout, failure classification: one helper, one classifier. *Gap:* six retry ladders and a second `withTimeout`.
- Dedupe: the idempotency store. *Gap:* Slack, webhooks and Loop items each keep their own.
- HTTP routing and validation: Fastify with TypeBox. *Gap:* web UI server, portal.
- Signed tokens: jose. *Gap:* seven other formats.
- Runtime choice type, sandbox exec base, scheduler, webhook receiver, SSE writer, Slack reply renderer, model list: one each.

## Pitfalls

Patterns from this repo's history, with the PRs that introduced or removed them.

- **Overengineering.** Admin redesign shipped with an Original/New toggle and duplicate styles; #1311 removed 1,000 lines of it. Procedural memory landed as a pluggable provider router nobody switches (#894).
- **Band-aids.** A per-store recount under a global lock froze chat on every deploy (#1753). A per-command machine lock serialized sessions sharing a computer (#1748). Refusal fallback by regex and a hard-coded model ladder (#1743, still present).
- **Duplication.** Transcripts dual-written to two tables (#1272). A Sprites fix re-implemented on main after landing on a side branch (#1776). A second model picker (#1476). Fifty hand-copied relay fragments that drifted (#488).
- **Hand-rolling.** Raw REST where an SDK existed (#1419); piping through `fly ssh console` (#1407).
- **Non-durability.** Loop checkpoints on sandbox disk (#1694). Multiview layout in localStorage (#452). Docker app data lost on redeploy (#1789, open).
- **Config matrix.** Screening grew three overlapping knobs before #1784 collapsed them. A TTL env var added right after the value was fixed (#1747). Four overlapping runtime defaults (#1619). Each new sandbox backend came with its own knobs (#478, #876, #922). About 485 env vars are read today.
- **God files.** The AWS backend keeps absorbing features (#1296). Four more files are past 3,000 lines.
- **Inconsistent UI.** Three transcript font sizes (#1545). Two stacked pane headers (#513). A parallel design system of ten stacked PRs (#1053).
- **YC over-indexing.** A YC-workflow factory loop ported into public src before it ran (#1008, reverted #1026). YC batch copy in the generic welcome (#1315, still present).
- **Leaks.** Org rollout guidance, identity examples and 92 screenshots in public docs and fixtures (#1504).
- **Flab.** 264k test lines against 201k source. Net-negative diffs are normal.

## Editing this spec

Describe the target, not the mechanism. Name subsystems, not files. Delete a gap when it closes; add a pitfall only with a PR to cite. Stay near this length.
