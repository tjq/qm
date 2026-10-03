# QM spec

Read this before you change QM. It describes the target.

## North stars

1. **Unhobbling.** Frontier models are usually smarter than we allow them to be. Effective intelligence grows with capabilities exposed.
2. **Free the claw.** Sessions, memory and state live in Postgres, and the agent can read them. Sandboxes and models are resources the agent chooses and switches between as the work demands.
3. **Primitives.** Keep the harness thin: run commands on a computer, read and write files, publish apps. Primitives are orthogonal, each doing one thing with no overlap, and higher-level functionality is composed from them rather than built beside them. Everything else is a patch over a rough edge until a primitive can absorb it. Agent features are full sessions with the whole toolset, not bare model calls.
4. **Iterate fast.** Merge to production should take minutes. Speed is the best feature, and every bit of overhead we add should be measured and driven down.
5. **Agent UX = human UX.** Tools, errors, hints and prompts are the agent's interface, so they get the same care as the web UI. Spend every context token on purpose.

## Subsystems, most central first

**Turns and sessions.** A turn is a run: a worker claims it from the Postgres run queue, the orchestrator assembles context, runs a harness, and commits the result to the session tape. One lease per session guarantees one writer. Deploys hand a live turn off at a safe point within a short grace window; they never wait for quiet.

**Harnesses and models.** Pi, Codex, Claude Code and OpenCode are interchangeable harnesses over one tool catalog. The model catalog is the single source for which models exist, their effort levels and prices. A runtime is one value (harness, model, effort, fast), validated once; an unsupported combination is an error, not a silent fallback.

**Scopes and identity.** Every Slack or web actor resolves to one principal by verified work email. A scope is a room plus the people in it; what a turn may read is computed from the least-privileged person present and the room's sharing posture. Admin reads are audited; outside Slack Connect users get no reply.

**Sandboxes.** A computer is a provider resource (E2B, Modal, Sprites, AWS, Docker and others) with a home that can be snapshotted and moved. Status reports what failed; the agent decides what to do, including finishing the work on a different computer.

**Credentials.** Secrets stay server-side. Shared org credentials are used by proxy through the broker and the egress proxy, which check a per-turn capability token. Personal logins live in a per-person keychain filled by one-time drop links, and cross-scope use requires the owner's approval on a card, never chat.

**Memory, guidance and skills.** Memory is an append-only per-scope notebook recalled each turn: an index of pointers, not a datastore and not a permission. Guidance holds a scope's standing orders. Skills are instructions served from core.

**Background work.** Crons run on pg-boss with one dedupe rule; a fire runs with its owner's access, and edits by others wait for the owner. Loops are crons that work a queue with outputs held for review.

**Surfaces.** Slack and the web UI are two views of the same sessions, each native to its host. Text first, heavy content lazily; model-only context never reaches the browser.

**Apps and files.** Apps publish as immutable versions behind core's viewer check, private by default and shared like a document; external access is an admin flag, default off.

**Deploy and release.** The CLI runs blue/green releases; Terraform provisions. Downstream deployments pin a qm release, and merged is not live until the running release contains it.

**Error preservation.** Never discard error information. Preserve the original failure, its cause chain and any subsequent cleanup failures in access-controlled diagnostics, with enough context to trace the failed operation. A concise user-facing message must not replace the underlying evidence. Redact credentials and sensitive payloads; redaction is not a reason to erase the failure.

## One of each

Extend these; don't add a sibling. Where several exist, converge on the first named.

- Work queue: the runs queue.
- Lock: the advisory-lock helper plus the run lease.
- Retry, backoff, timeout, failure classification: one helper, one classifier.
- Dedupe: the idempotency store.
- HTTP routing and validation: Fastify with TypeBox.
- Signed tokens: jose.
- Runtime choice type, sandbox exec base, scheduler, webhook receiver, SSE writer, Slack reply renderer, model list: one each.

## Wall of shame

Patterns from this repo's history, with the PRs that introduced or removed them. Status is as of main 6996960f.

### Discarded error evidence (1 example)

- **Sandbox startup and cleanup** (2026-10-02): A provider authentication failure was obscured by generic initialization/cleanup errors, then recorded in the tool transcript as “Command execution failed.” The cleanup wrappers did not preserve the original causes, and destruction retries discarded every caught exception. **Rule:** never replace diagnostic evidence with a generic status; preserve both the primary failure and subsequent failures, with secret-safe details and correlation to the operation. *Status:* confirmed on [qm main 5dbebac](https://github.com/yc-software/qm/blob/5dbebac68f671cf456ebd42061ff9578fa4fe138/src/sandbox/sandbox.ts#L17-L40), [destruction path](https://github.com/yc-software/qm/blob/5dbebac68f671cf456ebd42061ff9578fa4fe138/src/core/orchestrator/sandboxes.ts#L162-L173) and [transcript path](https://github.com/yc-software/qm/blob/5dbebac68f671cf456ebd42061ff9578fa4fe138/src/harness/agent-tools.ts#L727-L748); unresolved, no fixing PR yet.

### Overengineering (23 examples)

- **qm-yc#2526** (2026-09-23): Release pipeline grew disposable-candidate qualification, monotonic admission/coalescing, and an audited exact-SHA emergency bypass needing two follow-up race fixes (#2528, #2530). *Status:* unknown.
- **qm-yc#2457** (2026-09-17): Mandatory Cursor Bugbot review gate on queue eligibility and auto-pin admission removed; now advisory. *Status:* wound back in qm-yc#2457.
- **qm#1311** (2026-09-16): Admin redesign (#1276) shipped an Original/New comparison toggle, duplicate original cards/styles and variant URL plumbing; replacement PR removed ~1,006 net lines of scaffolding. *Status:* wound back in qm#1311.
- **qm-yc#2429** (2026-09-16): About a dozen release-pipeline PRs in one day added exact-tree proof reuse, clean-main attestation, audited human delegation, frozen merge-group qualification and capacity proofs. *Status:* unknown.
- **qm-yc#2276** (2026-09-03): The web UI added an importer for iTerm2 .itermcolors and VS Code theme files.
- **qm-yc#2251** (2026-09-02): A daily job copying production-shaped data into staging had never once succeeded (41 GB into a 20 GB disk) and gated nothing, so it was deleted. *Status:* wound back in qm-yc#2251.
- **qm-yc#2236** (2026-09-02): A sandbox layer-image build/publish pipeline pinned an image that no backend ever booted (FLY_BASE_IMAGE read by no code), so it was retired. *Status:* wound back in qm-yc#2236.
- **qm#896** (2026-09-02): An optional core-search backend injection point had no production caller and existed only for tests; removed. *Status:* wound back in qm#896.
- **qm#894** (2026-09-02): Procedural memory ('Memorable') landed as a pluggable provider under a new scope-aware memory router (#700) with MEMORY_PROVIDER_CONFIG routes, alongside a separate MEMORY_STRATEGY switch.
- **qm-yc#2003** (2026-08-16): The Slack surface kept two stacked adapter layers (CoreBridge over SlackCoreClient) from a dead out-of-process plugin boundary, including a network-down error that could no longer happen. *Status:* wound back in qm-yc#2003.
- **qm-yc#1770** (2026-08-01): A /grind directive grammar (20t, 45m, 500k, $3, AND-combined floors) was parsed out of user text to force the agent to keep working. *Status:* wound back in qm-yc#1825.
- **qm-yc#1369** (2026-07-24): One large 'remove hot-path amplification' perf PR changed store reads, polling, streaming, fencing, retention and bundles all at once, and broke production. *Status:* wound back in qm-yc#1596.
- **qm-yc#1493** (2026-07-22): Split Canvas panes got four density tiers (full/compact/card/strip), with small panes swapping the transcript for a glance card or one-line strip. *Status:* wound back in qm-yc#1553.
- **qm-yc#1338** (2026-07-21): An audit-driven cleanup deleted speculative code: an unused followUp signal, a duplicate CLI dev stack, a dead deployment access API, an Admin Tools tab, and dead harness/config knobs. *Status:* wound back in qm-yc#1338.
- **qm-yc#1393** (2026-07-18): The Slack 'working' ack reaction became a Haiku call that goes straight to the Anthropic API around the harness, plus a hardcoded 51-emoji curated slate with its own test.
- **qm-yc#1343** (2026-07-16): Actor-bound service credentials (one org key, per-person path templating in the broker) were built for a single consumer, then reverted three hours later when the consumer needed more. *Status:* wound back in qm-yc#1349.
- **qm-yc#1328** (2026-07-15): A whole device-flow file-bundle refresher subsystem (registry, single-flight refresh, leader sweeper, expiry backfill) existed for exactly one service, AWS SSO, and was deleted. *Status:* wound back in qm-yc#1328.
- **qm-yc#1241** (2026-07-10): A separate LLM classifier engine for grading unfulfilled/perf sessions (prompts, parsers, harness hooks, admin tabs) was replaced by the agent grading links posted to a channel. *Status:* wound back in qm-yc#1241.
- **qm-yc#723** (2026-06-21): A dev-only Slack fan-out relay (one shared Slack app on an always-on Fly relay re-broadcasting events to many dev machines, routed by #name prefixes), stacked on the #719 shared-plugin dispatcher. *Status:* wound back in qm-yc#856.
- **qm-yc#658** (2026-06-18): publish ran every browsable app through the autonomous in-sandbox browser to 'self-verify' it before shipping. *Status:* wound back in qm-yc#841.
- **qm-yc#529** (2026-06-15): A dedicated auth-broker process for device-flow logins was replaced by running logins through the ordinary `background` tool. *Status:* wound back in qm-yc#529.
- **qm-yc#409** (2026-06-11): Pluggable MemoryStrategy seam with three swappable strategies (per-turn, scratch-promote, agent-only), plus a Hermes-style consolidation rewriter (#411, #412, #428).
- **qm-yc#419** (2026-06-11): Offline memory-strategy benchmark: replay fixtures, an LLM judge and a nightly run, built to choose among strategies nobody switches between.

### Band-aid fixes (35 examples)

- **qm#1743** (2026-09-30): Refusal fallback extended by regex-matching Anthropic usage-policy text and 'gateway model is unavailable' to trigger a hard-coded alternate-model ladder (claude-opus-5 / claude-sonnet-5), plus a new admin fallbackRuntime.
- **qm#1748** (2026-09-30): Every non-Modal sandbox took one exclusive sandbox-resource:<id> advisory lock around each command/file op, so sessions sharing a computer queued behind each other; replaced a backend!=='modal' special case with shared locks and a parksOnTeardown profile property. *Status:* wound back in qm#1748.
- **qm#1753** (2026-09-30): Session-counter recount ran on every store init under the global maintenance lock (not a one-time migration), freezing chat writes during blue/green promotion; removed. *Status:* wound back in qm#1753.
- **qm#1432** (2026-09-19): Per-turn reconciliation of a shared skills/ index under a sandbox-wide advisory lock (skill projection) stalled turns 5 minutes; replaced with an explicit skill tool and per-turn skill dirs. *Status:* wound back in qm#1432.
- **qm#1133** (2026-09-12): A factory-specific retry ladder (FACTORY_READ_RETRIES=6) was added around sandbox readProcess polling after one timeout under load. *Status:* wound back (factory code absent on current main).
- **qm-yc#2383** (2026-09-10): When the unified sandbox tool broke command execution, prod was patched by flipping SANDBOX_RESOURCES_ENABLED off rather than fixing the schema. *Status:* wound back in qm-yc#2384.
- **qm#965** (2026-09-07): One legacy \u0000 payload bricked sessions; fixes proposed tolerating poisoned rows and sanitizing every Postgres text write. *Status:* unknown.
- **qm-yc#2321** (2026-09-06): The dual-store parity gate was made to pass with a 15s settle-and-recheck plus new 'benign' classifier classes for timing fields and tool error flags. *Status:* unknown.
- **qm-yc#2280** (2026-09-03): Proposed raising core to 16 GiB and MAX_CLAIMS=2 to ride out a memory leak that was OOM-killing core every 10-19 minutes. *Status:* wound back in qm-yc#2281.
- **qm-yc#2232** (2026-09-02): Pre-deploy RDS snapshot wait raised from the 10-minute AWS waiter to a hand-rolled 45-minute poll after runs crept over the ceiling. *Status:* unknown.
- **qm-yc#2140** (2026-09-01): Core OOM crash-loops were answered by raising V8 heap (#2054) and then doubling the blue task's memory, rather than bounding what the active color loads. *Status:* unknown.
- **qm-yc#2176** (2026-09-01): A 400-entry compaction cap (plus a MAX_CONTEXT_ENTRIES knob set nowhere) fired every ~2.7 turns even though token budgets were far from full. *Status:* wound back in qm-yc#2176.
- **qm-yc#2123** (2026-08-31): Tape read path self-heals ('[tape-heal]', rebuilding from session_entries ~15x/day) instead of the write side being consistent.
- **qm-yc#2117** (2026-08-30): Replay inserted a fabricated assistant message '(continuing after the tool result above)' to satisfy a provider constraint that live tests showed does not exist. *Status:* wound back in qm-yc#2117.
- **qm-yc#2099** (2026-08-28): computerVerdict() collapses a stale health claim plus dead guest into a 'WEDGED — restart' verdict shown to the agent, later found to mislabel provider outages.
- **qm-yc#2026** (2026-08-17): execute prepended a mkdir to any command whose text mentioned $AGENT_OUTBOX to paper over a never-created magic directory. *Status:* wound back in qm-yc#2121.
- **qm-yc#1992** (2026-08-14): Deploy demote/rollback wrapped the opaque `aws ecs wait services-stable` in a 3-attempt retry after it timed out. *Status:* wound back in qm-yc#1995.
- **qm-yc#1975** (2026-08-13): Stuck Arga CI twins handled with a 2-minute bound, retry-once, and global serialization of provisioning; needed a same-day follow-up (#1980) to avoid leaking two runs. *Status:* wound back (twin catalog later split out of CI/CD, qm-yc#2291).
- **qm#394** (2026-08-13): Memory tool silently coerces malformed `remember` calls (content/query/bare string) into facts instead of fixing the tool schema.
- **qm#469** (2026-08-13): Sandbox status collapses any unanswering shell into a 'wedged' verdict with baked-in 'restart the computer' advice.
- **qm-yc#1862** (2026-08-06): Fast-mode rate-limit handled by a second bespoke same-turn recovery path beside the provider-refusal model-swap ladder.
- **qm-yc#1584** (2026-07-23): The harness detects Anthropic content-filter refusals by regex-matching the error wording, then retries the turn on a fallback model.
- **qm-yc#1575** (2026-07-23): Tape coverage gaps were handled with a read-time self-heal instead of fixing every writer that punched holes (background compaction, nudges).
- **qm-yc#1470** (2026-07-21): Post-roll smoke probes retry each failing leg every 5s for up to 120s to paper over old and new ECS task generations serving side by side. *Status:* unknown.
- **qm-yc#1457** (2026-07-21): A band-aid audit of the last 200 merged PRs found ten symptom patches (e.g. an egress DNS-rebind caveat, a duplicate portal-identity codec) and re-fixed nine at their root cause. *Status:* wound back in qm-yc#1457 (PR open/unmerged).
- **qm-yc#1404** (2026-07-20): A band-aid audit rolled back three symptom patches (cron task-field persistence left in the tool description, canonical person identity, ambient provenance) and moved each fix to the layer it had patched around. *Status:* wound back in qm-yc#1404.
- **qm-yc#1336** (2026-07-17): Wedged Fly deploy machines were handled with a restart policy plus force-delete-and-recreate whenever Fly returned 429/412, instead of fixing why the machines wedged. #1042 similarly widened a one-shot retry on 412 after a suspend/resume. *Status:* unknown (DEPLOY_RESTART/ensureConverged no longer in public main; Fly deploy path appears rewritten or removed).
- **qm-yc#892** (2026-06-26): The Conductor-style git diff footer on Slack replies was switched off with `const footer = undefined` one day after shipping, keeping the helper so it could be re-enabled. *Status:* wound back (repoFooterBlocks no longer exists in src/ or plugins/).
- **qm-yc#848** (2026-06-25): Bulk keychain materialization skipped undecryptable rows instead of crashing, to cope with a dev stack whose master key did not match restored prod data. *Status:* unknown.
- **qm-yc#742** (2026-06-22): Deploy provider retried /exec exactly once on Fly's specific '412 machine not running' after autosuspend, one of a string of Fly 408/412 special-case retries (#867, #870, #924, #927, #949). *Status:* wound back (Fly sandbox backend deleted; no fly sandbox in src/sandbox/ and no 408 handling in src/).
- **qm-yc#724** (2026-06-21): Slack reactions.add retries on a fixed ladder of delays to paper over custom-emoji propagation lag.
- **qm-yc#460** (2026-06-12): Raised the browse-agent step budget from 25 to 40 (env-overridable) because a live food order stalled one modal short of checkout. *Status:* wound back (never merged; browse-agent later removed).
- **qm-yc#443** (2026-06-11): Opened a dedicated egress port (33335) so the agentic browser could reach one proxy vendor directly, which bypassed the egress proxy. *Status:* wound back (browse-agent and the port exemption are gone from main).
- **qm-yc#418** (2026-06-11): Patched the text-only turn-reply recovery copy from #372 so it also replays attachments. This is a second delivery path that keeps needing gap fixes.
- **qm-yc#394** (2026-06-10): Enlarged the run worker pool because a trivial turn queued 413s behind long agentic turns, instead of separating short and long work.

### Duplication (34 examples)

- **qm#1776** (2026-09-30): Sprites cold-boot '503 Process not ready' exec re-send implemented on main after the same fix (qm#1489) had already landed only on the long-lived factory side branch.
- **qm#1520** (2026-09-22): Factory required pasted factory-anthropic/-github/-linear/-slack keychain secrets duplicating core's own model auth and connectors (two sources of truth); QM-73..76 resolve from core config/owner connectors instead. *Status:* wound back in qm#1520, qm#1522, qm#1523, qm#1524 (on factory branch).
- **qm#1476** (2026-09-21): Context settings had its own model picker separate from the composer's; switched to reuse the composer model/preset picker. *Status:* wound back in qm#1476 (both plugins/web-ui/src/model-picker.ts and context-model.ts still exist).
- **qm#1427** (2026-09-19): The 'software factory' loop (wrapper, workflows, own Linear/GitHub/Slack/Anthropic credentials, own sizing knobs) was developed as a parallel system on side branch qm-29-port-factory-loop (~QM-29..QM-84 PRs) rather than on native Loops on main. *Status:* unknown (factory/ absent from main; branch still receives merges).
- **qm#1272** (2026-09-16): Session transcripts are kept in both session_entries and session_tape, with SESSION_TAPE_MODE shadow/serve choosing between them.
- **qm#1185** (2026-09-15): Each subscriber held its own LISTEN connection and pg-boss kept its own pool; consolidated to one listener per process and the shared query pool. *Status:* wound back in qm#1185.
- **qm#993** (2026-09-08): Chat search queried both the dedicated search index and legacy entry history for every visible conversation, causing timeouts. *Status:* wound back in qm#993.
- **qm-yc#2331** (2026-09-07): The factory got a converge-vector.sh evaluator, then a second forge-API evaluator (qm-yc#2355) whose check list drifted from the first. *Status:* wound back in qm#1109.
- **qm-yc#2252** (2026-09-02): A 7-minute pre-deploy DB snapshot step came back after #1734 had already deleted it as redundant with continuous backups. *Status:* wound back in qm-yc#2252.
- **qm-yc#2118** (2026-08-30): Renderers were cut over to read the new session tape with a silent fallback to session_entries, leaving two transcript stores both written and read.
- **qm-yc#2079** (2026-08-25): An automated ticket worker opened six separate PRs for the same one-line file-name alignment ticket (QM-4) and two for QM-5. *Status:* wound back (all closed unmerged).
- **qm-yc#2031** (2026-08-19): With full source in both repos, merged public PRs had to be hand-ported into the diverged private fork (and vice versa), often 'adapted' to different internal code. *Status:* wound back in qm-yc thin-layer conversion (~2026-09-08).
- **qm-yc#2019** (2026-08-16): claude, codex and opencode harnesses each carried copy-pasted one-shot/tool-bridge plumbing; opencode's copy drifted and silently ignored the judge model. *Status:* wound back in qm-yc#2019.
- **qm-yc#2018** (2026-08-16): smolmachines and sprites backends duplicated ~150 lines line-for-line (run, file ops, provision, teardown) and had already drifted. *Status:* wound back in qm-yc#2018.
- **qm#488** (2026-08-13): Web-UI /api router had ~50 hand-copied body-parse/relay/path-decode fragments that drifted (some returned 400 instead of 413). *Status:* wound back in qm#488.
- **qm-yc#1983** (2026-08-13): ⌘1–9 implemented as desktop-shell tab switching, then removed from the shell and reimplemented as web-UI session jumping the same day. *Status:* wound back in qm-yc#1986.
- **qm-yc#1735** (2026-07-29): Three different 401 JSON shapes coexisted across the web-ui, portal, admin and core, and two web-ui modules each had a private escapeHtml. *Status:* wound back in qm-yc#1735.
- **qm-yc#1729** (2026-07-29): Core models 'where a conversation happens' five separate times (ScopeId channel/group, Conversation.kind, SessionType, Destination.type, and directory rooms), with a channel/group branch at each call site. *Status:* unknown (unification PRs #1729/#1730 unmerged).
- **qm-yc#1537** (2026-07-23): Both run stores kept two terminal-event systems (a per-run EventEmitter for waitFor and a separate onTerminal listener array), each with its own timeout and cleanup. *Status:* wound back in qm-yc#1537.
- **qm-yc#1499** (2026-07-22): Three hardcoded 'supported models' lists disagreed (picker, web-turn gate, web-ui server allowlist), so choosing a model returned 403. *Status:* wound back in qm-yc#1499 (partial: SELECTABLE_BASE_MODELS still derived beside MODEL_REGISTRY in src/model/pi-models.ts).
- **qm-yc#1441** (2026-07-21): A warm Pi session cache kept a second, stale copy of model context next to the tape, with a negligible hit rate. *Status:* wound back in qm-yc#1441.
- **qm-yc#1298** (2026-07-14): session_tape was added as a second, dual-written transcript store next to session_entries, with a shadow fold and divergence logging, and the migration has stalled after phase 2.
- **qm-yc#1242** (2026-07-10): Two browsers coexisted: the deterministic browse-agent stack (tools, process kind, takeover pages, env family) and the experimental browse-lab skill. The old stack was ripped out. *Status:* wound back in qm-yc#1242.
- **qm-yc#1233** (2026-07-10): Each Slack channel kept a per-container 'ambient observation' session with zero readers alongside the surface cache that actually served the judge and read tools. The dead session was deleted. *Status:* wound back in qm-yc#1233.
- **qm-yc#1101** (2026-07-06): Agent memory could be reached four ways (recall tool, intercepted writes to memory/MEMORY.md, self-API curl recipes, prompt text), and one agent wrote memory to the sandbox where it was silently lost. All four were unified into one typed memory tool. *Status:* wound back in qm-yc#1101.
- **qm-yc#581** (2026-06-16): The same favicon-base-path fix was opened three times (#581, #583, #586), and secret-drop fields[] twice (#669, #671), by parallel agents. *Status:* wound back (duplicates closed or superseded).
- **qm-yc#527** (2026-06-15): Sandbox durability flipped back and forth: app-level backups trimmed (#507), then deleted ('the Fly volume is the durability', #527), then an S3 $HOME snapshot came back for AWS (#812) and now coexists with per-provider native snapshots.
- **qm-yc#496** (2026-06-12): Constant-time compare, shell quoting, hash IDs and signed tokens each had several drifted copies, so a security fix in one would miss the others. *Status:* partially regrown: canonical constantTimeEqual in src/util/crypto.ts, but raw node timingSafeEqual is again called directly in src/api/routes/background-work.ts, src/deploy/viewer-session.ts, src/harness/opencode-harness.ts, src/surfaces/slack-managed.ts.
- **qm-yc#464** (2026-06-12): Cross-cutting helpers (error handling, async/backoff, sweepers, process polling, notebook) were cloned per module and drifting. *Status:* wound back in qm-yc#464, but retry logic has since regrown (see duplicated_systems).
- **qm-yc#476** (2026-06-12): Merged three separate credential subsystems (keychain, OAuth vault, service-credential store) into one store. *Status:* wound back in qm-yc#476.
- **qm-yc#269** (2026-06-09): Removed the legacy plugins/browser HTTP fetcher that coexisted with browse-agent; #453 then removed the second browse login entry point. *Status:* wound back in qm-yc#269 / qm-yc#453.
- **qm-yc#322** (2026-06-09): 'e instanceof Error ? e.message : String(e)' had been rewritten inline more than 30 times, and Fly 404 handling twice; both were replaced by shared helpers. *Status:* wound back in qm-yc#322.
- **qm-yc#176** (2026-06-04): Slack conversation context was built three ways (threadContext, recent-messages block, threadOpener) with up to 3 conversations.replies calls; this PR merged them into one serializer. *Status:* wound back in qm-yc#176.
- **qm-yc#126** (2026-06-03): Deleted the deprecated /web/ chat surface that ran alongside /web-ui/ as a second auth/cookie surface. *Status:* wound back in qm-yc#126.

### Hand-rolling (21 examples)

- **qm#1419** (2026-09-22): Sprites backend used raw REST fetches; moved to Sprites SDK 0.2.3 (WebSocket exec, filesystem APIs, checkpoints); sibling PRs #1420-#1422 aligned Modal/E2B/Smolmachines with provider docs. *Status:* wound back in qm#1419.
- **qm#1407** (2026-09-22): Internal Fly transports piped data through `fly ssh console` (broke on Windows PTY); replaced with Machines exec API stdin. *Status:* wound back in qm#1407.
- **qm-yc#2263** (2026-09-03): Session origin and cron id were re-derived with POSIX regexes over thread_ref on every admin read instead of being stored as columns. *Status:* wound back in qm-yc#2263.
- **qm-yc#2259** (2026-09-02): Hand-rolled regex command redaction in redactCommand had exponential backtracking (24 flags took 0.9s and doubled per flag).
- **qm-yc#2218** (2026-09-01): A non-concurrent materialized view refreshed on every mirrored Slack message (679M row inserts on a 1.5 MB view, errors swallowed) replaced by a plain live GROUP BY. *Status:* wound back in qm-yc#2218.
- **qm-yc#1965** (2026-08-13): Proposed fix for dropped audit writes was a new hand-rolled, in-memory retry buffer (src/util/retry-buffer.ts), which would itself be lost on restart. *Status:* unknown (not merged; retry-buffer absent on main).
- **qm-yc#1601** (2026-07-24): The Split Canvas had its own layout engine (binary pane tree, absolute-positioned panes, custom divider drag). *Status:* wound back in qm-yc#1601.
- **qm-yc#1477** (2026-07-23): A 145-line hand-rolled ustar tar writer/parser (octal headers, checksums, GNU longname, PAX parsing) in fly-tar.ts. *Status:* wound back in qm-yc#1477.
- **qm-yc#1472** (2026-07-22): Six hand-rolled LRU/TTL caches across the slack, portal and web-ui plugins. *Status:* wound back in qm-yc#1472.
- **qm-yc#1479** (2026-07-21): The web-ui server is a hand-rolled node:http router while core uses Fastify.
- **qm-yc#1361** (2026-07-16): The core API's hand-rolled node:http router and dispatcher (161 routes) was swapped for Fastify. *Status:* wound back in qm-yc#1361.
- **qm-yc#1360** (2026-07-16): A ~340-line bespoke egress forward proxy (CONNECT tunneling, hop-by-hop stripping, DNS pinning) was replaced by Envoy plus a thin decision service. *Status:* wound back in qm-yc#1360.
- **qm-yc#1362** (2026-07-16): A home-made base64url(JSON).HMAC token codec used for capability, deploy and OAuth-state tokens was replaced with jose compact JWS. *Status:* wound back in qm-yc#1362.
- **qm-yc#1359** (2026-07-16): Every token count in the system (compaction guard, harness accounting, cost estimate) was a chars/4 guess until a real tokenizer replaced it. *Status:* wound back in qm-yc#1359.
- **qm-yc#1358** (2026-07-16): The cron scheduler used a 1Hz leader-leased full-table scan with home-made leader election until it moved to pg-boss; the queue then double-fired across instances, so #1364 added an atomic slot claim on top.
- **qm-yc#1280** (2026-07-13): The Slack plugin had six hand-written cursor pagination loops that were replaced with the SDK's WebClient.paginate, and #1278 swapped a 43-line char-by-char shell-quote parser for a regex. *Status:* wound back in qm-yc#1280 / qm-yc#1278.
- **qm-yc#1177** (2026-07-08): Custom-emoji upload drove a headless browser through Slack's admin UI (Python engine, stdout marker protocol, login-wall handling) until it was replaced by one authenticated HTTP call. *Status:* wound back in qm-yc#1177.
- **qm-yc#780** (2026-06-23): Custom-emoji upload was a 'virtual' shell command the broker intercepted by regex only when it was the first token on the line. *Status:* wound back in qm-yc#780 (replaced by POST /v1/emoji self-API; still present in src/api/agent-api-catalog.ts).
- **qm-yc#522** (2026-06-15): 36 route handlers each sliced URL params by hand with decodeURIComponent(pathname.slice(...)). *Status:* wound back in qm-yc#522 (compilePath/ctx.params; still present in src/api/routes/route.ts).
- **qm-yc#469** (2026-06-13): browse-agent engine gained a hand-rolled raw-CDP pre-login (Runtime.evaluate typing from a /tmp login JSON) plus custom anti-bot stealth, built for one food-ordering bring-up. *Status:* wound back in qm-yc#782.
- **qm-yc#134** (2026-06-04): Replaced the embedded Pi web UI library chat with a custom chat shell.

### Non-durability (14 examples)

- **qm#1789** (2026-09-30): Docker-published apps have no persistent /data mount, so app data is lost on redeploy.
- **qm#1694** (2026-09-28): Recurring jobs were told to keep checkpoints on sandbox workspace disk, lost when the computer is replaced; now published to durable scoped Files. *Status:* wound back in qm#1694.
- **qm-yc#1969** (2026-08-13): Inbound Slack dedup is a 500-entry in-memory LRU per instance, wiped on every deploy, so a Slack retry hitting the other blue/green color runs the turn twice.
- **qm-yc#1963** (2026-08-13): Idempotency `once()` was check-then-act with a per-instance in-memory in-flight Set, so two instances could both fire the side effect. *Status:* unknown (PR not merged; src/idempotency still holds an in-memory Map).
- **qm#452** (2026-08-13): Multiview layout lived only in localStorage and was lost on a new device or profile. *Status:* wound back in qm#452.
- **qm-yc#1962** (2026-08-13): Unsent-chat attachments were kept in an in-memory per-thread store that survives session switches but not a reload. *Status:* unknown (PR left open; drafts.ts on main has no attachment store).
- **qm#64** (2026-08-04): Cron fire log was stored inside the cron's jsonb row, grew without bound, and every fire rewrote the whole log. *Status:* wound back (src/cron/fire-store.ts; cron-store.ts migrates legacy fireLog out, cron_fires table).
- **qm-yc#1166** (2026-07-09): The only guard against duplicate Slack posts was an in-memory, per-process DeliveryTracker, so old and new tasks both posted during a rolling deploy. *Status:* wound back in qm-yc#1166.
- **qm-yc#1031** (2026-07-01): An admin toggle added in #1023 was read from each core instance's boot-hydrated memory cache, so a flip reached only one of two instances until a redeploy. *Status:* wound back in qm-yc#1031.
- **qm-yc#936** (2026-06-28): A bare Slack 'stop' only worked through in-memory plugin state, so it was lost across a plugin deploy. *Status:* wound back in qm-yc#936 (durable core lookup).
- **qm-yc#568** (2026-06-16): The per-scope memory notebook moved from a file into Postgres, WAL-style, with edit history. *Status:* wound back in qm-yc#568.
- **qm-yc#352** (2026-06-09): Deleted the admin Fleet tab because its counts came from an in-memory per-instance Set that every deploy reset to zero. *Status:* wound back in qm-yc#352.
- **qm-yc#347** (2026-06-09): The cron/webhook/DM delivery outbox was always in memory, so a deploy lost queued messages and multiple instances posted duplicates. *Status:* wound back in qm-yc#347.
- **qm-yc#360** (2026-06-09): ModelGateway admin audit was an unbounded in-memory array; the fix bounded it to a 1,000-record in-memory ring instead of making it durable. *Status:* unknown.

### Config-matrix expansion (26 examples)

- **qm#1784** (2026-09-30): Security screening had three overlapping env knobs (SECURITY_SCREEN_BACKEND, SECURITY_SCREEN_ALL_POSTURES, SECURITY_SCREEN_PROXY_ROLLOUT) plus per-posture inboundScreening; collapsed into one SECURITY_SCREEN=off|observe|enforce. *Status:* wound back in qm#1784.
- **qm#1747** (2026-09-30): New SANDBOX_CAPABILITY_TTL_HOURS env var (48h default, or 0/none for non-expiring bearer tokens) right after #1518 hard-set 48h.
- **qm#1619** (2026-09-25): Separate org runtime defaults for conversations, crons/loops and sub-agents, then per-cron overrides (#1593) and a fallback runtime (#1743): four overlapping runtime settings with precedence rules.
- **qm#1201** (2026-09-15): Security screening gained an off/model/proxy backend plus ALL_POSTURES, four PROXY_* vars and a timeout, layered on HARNESS_SECURITY_POSTURE and the org-level Auto flagger settings from qm#878.
- **qm#1208** (2026-09-15): EAGER_PROVISION was an opt-in flag no deploy template set, so every deployment missed a 66s-to-3s median speedup until it defaulted on. *Status:* partly wound back; flag remains (src/config.ts:1654).
- **qm#1162** (2026-09-14): Gateway deployments had to maintain an environment model allowlist; replaced by discovering models from the gateway's key-scoped list. *Status:* wound back in qm#1162.
- **qm#1044** (2026-09-10): The unified `sandbox` tool shipped behind SANDBOX_RESOURCES_ENABLED alongside the legacy execute/background tools, so two tool surfaces and both flag states must be supported.
- **qm#922** (2026-09-04): Another sandbox backend (agent37) was added, bringing providers to about ten (agent37, aws, e2b, modal, porter, smolmachines, sprites, superserve, local/docker); qm#954 proposed Kubernetes as well.
- **qm#876** (2026-09-02): Porter added as yet another SANDBOX_BACKEND and DEPLOY_PROVIDER (plus a Helm chart), days after Modal (qm-yc#2153) and E2B (qm-yc#2059).
- **qm-yc#2089** (2026-08-27): A new SLACK_ACK_CAP_MS env knob was added to tune a deferred-ack timeout that was being blown under load.
- **qm-yc#2060** (2026-08-20): Per-feature email allowlist env vars (INBOX_USERS, LOOPS_USERS) gate features instead of the existing feature-flag system, and people are added via deploy-config PRs.
- **qm-yc#1998** (2026-08-14): Sandbox IO wedges handled by flipping on an EXECUTE_SCRATCH mode and making prompt copy change depending on which options the deployment has turned off.
- **qm-yc#1994** (2026-08-14): Credential gating shipped behind per-scope feature flags env_cred_grant_gate and command_scoped_credentials (qm-yc#1988), with legacy behavior kept alongside. *Status:* wound back (neither flag is in src/feature-flags.ts FEATURE_NAMES).
- **qm#478** (2026-08-13): Added smolmachines as yet another sandbox backend, then SMOLMACHINES_CPUS/MEMORY_MB/DISK_GB env knobs (qm#507, qm-yc#1807).
- **qm-yc#1787** (2026-08-03): A hardcoded primary/secondary sandbox pair (SANDBOX_SECONDARY_BACKEND) plus CLI 'any' secret-condition machinery (#1788) existed only for the secondary case. *Status:* wound back in qm-yc#1791 (a retired-var warning shim remains in src/config.ts:1291).
- **qm-yc#1433** (2026-07-21): A DEPLOY_ALWAYS_ON=1 env opt-out from Fly scale-to-zero was added to dodge per-machine start rate limits. *Status:* wound back in qm-yc#1675.
- **qm-yc#1319** (2026-07-15): Added Dangerous/Auto/Strict security postures, scoped per org and per room with an org floor, which multiplies screening, approval and capability behavior per scope. #1784 is now adding an observe mode on top.
- **qm-yc#1254** (2026-07-10): A per-scope admin-session-reads flag opened private transcript reads outside DMs as a one-off exception for the grader-queue channel. *Status:* wound back in qm-yc#1329.
- **qm-yc#1096** (2026-07-06): Eager sandbox provisioning shipped behind a default-off EAGER_PROVISION env flag, and the same period added TURN_WALL_CLOCK_SEC under an admin resource (#1425), SANDBOX_BACKEND=local (#1093) and DEV_INTROSPECTION (#1094). EAGER_PROVISION now defaults to true, but the flag is still there.
- **qm-yc#812** (2026-06-29): A new SANDBOX_BACKEND=aws (Lambda MicroVM) was added alongside Fly, the start of a backend list that is now nine values.
- **qm-yc#935** (2026-06-28): Heartbeat rollout grew a stack of knobs: HEARTBEAT_WAKE_ENABLED, HEARTBEAT_DELIVER shadow mode, HEARTBEAT_WAKE_IDS, and a per-org/per-user wake-sandbox flag (#840). *Status:* wound back (no HEARTBEAT_WAKE_* or heartbeat-wake code in current src/config.ts).
- **qm-yc#409** (2026-06-11): MEMORY_STRATEGY env var creates three supported memory modes.
- **qm-yc#305** (2026-06-09): Egress force-through shipped behind a default-OFF FLY_EGRESS_FORCE_THROUGH flag, and #443 added SANDBOX_EXTRA_EGRESS_PORTS to open a hole for one vendor's residential proxy. *Status:* wound back (neither env var exists on main).
- **qm-yc#268** (2026-06-08): PI_SYSTEM_CACHE_SPLIT stays a boolean env flag (default false) even after it was verified and turned on everywhere in production.
- **qm-yc#221** (2026-06-05): Removed SQLite as a redundant middle persistence tier and deleted the ARTIFACT_STORE knob, leaving only Postgres or in-memory. *Status:* wound back in qm-yc#221.
- **qm-yc#58** (2026-06-02): Sandbox backends collapsed to fly-only because local/docker had drifted and their tests were 'green but meaningless'; the backend count has since grown back to about ten.

### God files (5 examples)

- **qm#1296** (2026-09-16): The AWS deploy backend keeps absorbing capacity proofs, ownership handover and candidate logic.
- **qm-yc#1971** (2026-08-13): Proposed file-size ratchet flagged orchestrator.ts at 3,033 lines; it never merged and the file kept growing.
- **qm-yc#1562** (2026-07-23): The 4,460-line orchestrator.ts was split into src/core/orchestrator/*, yet the main file has grown back past its pre-split size.
- **qm-yc#1286** (2026-07-14): primitives.ts carried 27 near-identical control/surface tool methods, collapsed into two helpers, but the big hubs keep growing: orchestrator.ts is 4.5k lines, agent-tools.ts 4.4k and wiring.ts 3k.
- **qm-yc#391** (2026-06-10): Split src/api/server.ts (2,332 lines, one ~1,800-line handle()) and web-ui main.ts (3,189 lines) into route and feature modules. *Status:* wound back in qm-yc#391, but the pattern regrew elsewhere (src/core/orchestrator.ts 4,539 lines, src/harness/agent-tools.ts 4,377, plugins/web-ui/src/chat.ts 3,428, plugins/web-ui/server/index.ts 3,418, src/wiring.ts 3,046).

### Mismatched UI (6 examples)

- **qm#1545** (2026-09-22): Transcript elements each hardcoded their own font-size, so multiview panes showed 15px/14px headers beside 12px text; unified on one --chat-font-size base. *Status:* wound back in qm#1545.
- **qm#1053** (2026-09-11): A parallel 'Beautiful UI' design system (10 stacked PRs) and an admin redesign with an Original/New toggle were built next to the existing web UI styles. *Status:* wound back in qm#1053 (closed with #1054-#1062, #992, #1215).
- **qm#513** (2026-08-13): Multiview panes showed two stacked headers (pane chrome plus the hosted chat's own top bar). *Status:* wound back in qm#513.
- **qm-yc#1823** (2026-08-04): New session top bar collapsed to 0px because the chat grid kept two rows; the transcript painted over it and its buttons stopped working. *Status:* wound back in qm-yc#1823 (and qm#433); header bleed recurred and was fixed in qm-yc#1991.
- **qm-yc#1150** (2026-07-07): Admin dashboard pages each had their own chrome, vocabulary, refresh buttons and scope pickers. The Admin v2 series (#1150–#1179) put them on one shared page shell with dense rows and a single vocabulary, ending with a redundancy sweep. *Status:* wound back in qm-yc#1150/#1179.
- **qm-yc#386** (2026-06-10): The portal landing pages used a different palette, radii and card styles from the Web UI and were restyled to match. *Status:* wound back in qm-yc#386.

### Over-indexing on YC (11 examples)

- **qm#1315** (2026-09-16): Generic web UI welcome ships YC-batch copy (YC Deals, YC investor database, get_yc_application, 'progress through the YC batch').
- **qm#1315** (2026-09-16): The generic web UI onboarding says 'the agent harness we use to run YC' and 'your YC partner in a box', and the welcome ideas cite 'YC Deal' and 'the YC investor database'.
- **qm#1008** (2026-09-09): A 29-file 'software factory' loop (Linear auto-triage, forge ship contract) built for YC's own workflow was ported into public src/loops/factory before it had ever run end to end. *Status:* wound back in qm#1026.
- **qm-yc#2308** (2026-09-05): Core carried a dedicated ycli proxy, vendored bundle, AWS-role broker and credential-execution primitive for YC data. *Status:* wound back in qm-yc#2308.
- **qm-yc#2236** (2026-09-02): The generic sprites backend gained a ycliBundlePath param to push YC's internal CLI at provision. *Status:* wound back (no ycli references in public main src).
- **qm#530** (2026-08-15): Assistant and org names were fixed across prompts, manifests, auth and UI; made deployment-configurable with neutral defaults. *Status:* wound back in qm#530.
- **qm-yc#1859** (2026-08-06): YC team-brain integration grew in core from query_brain to read_brain/write_brain, with a 10-action brain tool proposed (qm-yc#1978). *Status:* wound back (no read_brain/write_brain in src; brain removed later, qm-yc#2302).
- **qm-yc#1303** (2026-07-20): Core had YC hardcodes for ycli (pooled credentials, resident-auth paths, connector list, seed catalog), and #983 removed YC-specific auto-discovery from the command-approval gate. Both moved into a YC deployment layer driven by descriptors. *Status:* wound back in qm-yc#1303 (and qm-yc#983).
- **qm-yc#830** (2026-06-24): The org's own house-style design skill was imported as a seed skill and made the default for every published deployment. *Status:* wound back (skills-seed/ now holds only generic design skills, no org-branded style).
- **qm-yc#664** (2026-06-19): A read-only query_brain tool plus a Fly/Tailscale relay (#663) was wired into core for one specific internal team knowledge server. *Status:* wound back (src/config.ts now warns that the brain env vars are 'retired and ignored — the brain integration was removed', pointing at generic MEMORY_PROVIDER_CONFIG).
- **qm-yc#217** (2026-06-05): The generic orchestrator refreshed the ycli (YC-internal CLI) tool catalog on every Slack turn and had ycli-specific approval gating (#35). *Status:* wound back (no ycli references left in src/ on main).

### Regex (7 examples)

Regex standing in for a parser, a typed error, a stored field or a model call. Main has 1,443 production regex sites in 380 files; cleanup is LAB-166.

- **qm-yc#336** (2026-06-09): Command-policy regexes failed open and missed `rm -fr`/`--recursive` variants, so the approval gate was bypassable. *Status:* patched; the shell scanner is still regex (src/policy/command-policy.ts).
- **qm-yc#773** (2026-06-23): Command-policy regexes scanned heredoc payloads, so trigger words inside data tripped the approval gate. *Status:* patched; a related heredoc bug was found again in the Mythos triage.
- **qm-yc#156** (2026-06-04): A per-line regex env-file parser corrupted multiline secrets. *Status:* wound back in qm-yc#156.
- **qm-yc#2259** (2026-09-02): Ambiguous alternation in redactCommand's regex backtracked exponentially and blocked the event loop. *Status:* wound back in qm-yc#2259.
- **qm-yc#2155** (2026-08-31): Modal's "sandbox gone" regex missed real terminated/detached errors and surfaced hard failures. *Status:* patched; still classifying by message text.
- **qm-yc#2260** (2026-09-03): Cron ids were regex-extracted from provenance JSON on every deliveries row on each read. *Status:* wound back in qm-yc#2260 (stored column).
- **qm-yc#2263** (2026-09-03): Session origin and cron id were re-derived from thread_ref by unindexable per-row regex. *Status:* wound back in qm-yc#2263 (columns added).

### YC info leaking into public qm (3 examples)

- **qm#1504** (2026-09-22): Public docs/test fixtures had org-specific rollout guidance and identity examples plus 92 tracked screenshots (8.1 MB); scrubbed and AGENTS.md now bans committed screenshots. *Status:* wound back in qm#1504 (partially; YC welcome copy remains).
- **qm-yc#1501** (2026-07-22): YC's orange #ff6600, the 'Y' brand mark and the 'Quartermaster' label were hardcoded in the web-ui, admin and portal surfaces. *Status:* wound back in qm-yc#1501.
- **qm-yc#1016** (2026-06-30): The generic agent system prompt hardcoded that the agent's source lives in a specific private org repo. *Status:* wound back (repo string absent from current public src/).

### Duplicated systems (raw, all reviewers)

- **Retry/backoff helpers**: src/util/async.ts (jitteredBackoffMs, retryAfterMs, fetchWithRetry); src/sandbox/sprites-sandbox.ts retrySpritesControl; src/runs/retry-delay.ts retryDelay; src/slack/delivery.ts deliverWithRetry; src/slack/presenters.ts updateWithRetry; src/harness/pi-harness.ts piErrorRetryable vs src/harness/codex-harness.ts codexNonRetryable; qm#1412, qm#1731, qm#1327, qm#1429, qm#1489/#1776. Each provider/harness classifies retryability separately; no shared classification/budget.
- **Work queues**: src/runs/postgres-run-store.ts (SKIP LOCKED); src/delivery/postgres-delivery-store.ts (SKIP LOCKED); src/files/file-upload-store.ts (SKIP LOCKED); src/cron/job-queue.ts (pg-boss). Three hand-built Postgres queues plus pg-boss (LAB-163).
- **Transcript stores**: session_entries; session_tape (src/sessions/postgres-session-store.ts). Tape migration half-done; both written.
- **Locks/leases**: sandbox-resource:<id> advisory locks (qm#1748); skills:projection advisory lock (removed qm#1432); global maintenance lock (qm#1753); session_leases vs run leases; Sprites cross-core provisioning lock (qm#1419). Many ad hoc advisory locks; session_leases overlaps run lease (LAB-164).
- **Runtime selection**: org conversation/cron/subagent/fallback runtimes (qm#1619, qm#1743); per-cron overrides (qm#1593); REFUSAL_FALLBACK_MODEL_IDS in pi-harness.ts; ModelSelector (qm#1609 open). Multiple representations of model+harness+effort (LAB-162).
- **Loop runners**: native Loops (src/loops/); factory loop on qm-29-port-factory-loop branch (qm#1427 and QM-xx PRs). Parallel automation system with its own credentials, scheduling (#1450) and fire deferral (#1455).
- **Model pickers**: plugins/web-ui/src/model-picker.ts; plugins/web-ui/src/context-model.ts; plugins/web-ui/src/model-options.ts. Partly unified by qm#1476.
- **Transcript stores**: session_entries (src/sessions/postgres-session-store.ts); session_tape (same file; SESSION_TAPE_MODE in src/config.ts); qm#1279; qm#1282; qm-yc#2307/#2314/#2321 parity gate. Two authoritative-ish logs plus a parity tool with benign-mismatch whitelists.
- **Work queues**: src/runs/postgres-run-store.ts; src/delivery/postgres-delivery-store.ts; src/files/file-upload-store.ts; pg-boss (cron). Three hand-built FOR UPDATE SKIP LOCKED queues plus pg-boss.
- **Locks/leases**: src/persistence/advisory-lock.ts; src/persistence/leader-lease.ts; advisory locks in src/persistence/pg-pool.ts; session_leases in src/sessions/postgres-session-store.ts; run leases in src/runs/postgres-run-store.ts. qm#1191 (open) had to fix disconnect handling separately for lock clients after qm#1231 guarded pools.
- **Retry/backoff helpers**: src/runs/retry-delay.ts; src/util/async.ts fetchWithRetry; src/slack/delivery.ts deliverWithRetry; src/slack/presenters.ts updateWithRetry; src/sandbox/sprites-sandbox.ts retrySpritesControl; src/deployment/deployment-layer-store.ts retrying; qm#1126 cron backoff (open); qm#1133 factory retries (removed). Each subsystem rolls its own delays and classification.
- **Sandbox command tools**: legacy execute/background tools; unified sandbox tool (qm#1044) behind SANDBOX_RESOURCES_ENABLED. Both surfaces live; flag default off.
- **Security screening configuration**: HARNESS_SECURITY_POSTURE; SECURITY_SCREEN_BACKEND + ALL_POSTURES + PROXY_* (qm#1201); org-level Auto flagger harness/model/rubric (qm#878); provenance-based external-only screening (qm#970). Several overlapping knobs decide whether and how screening runs.
- **Postgres LISTEN connections/pools**: per-subscriber LISTEN connections; pg-boss private pool; DATABASE_POOL_URL transaction pool vs direct pool (qm#1072). Consolidated by qm#1185; pooled vs direct split remains by design.
- **Transcript stores**: session_entries; session_tape (src/harness/tape-projection.ts, tape-fold.ts); qm-yc#2118; qm-yc#2139; qm-yc#2169; qm-yc#2123. Tape reads fall back to/heal from entries; both still written.
- **Work queues**: src/runs/postgres-run-store.ts; src/delivery/postgres-delivery-store.ts; src/files/file-upload-store.ts; pg-boss (cron). Three hand-built FOR UPDATE SKIP LOCKED queues plus pg-boss.
- **Retry/backoff helpers**: src/util/async.ts (jitteredBackoffMs, fetchWithRetry); src/runs/retry-delay.ts (retryDelay); src/sandbox/sprites-sandbox.ts (retrySpritesControl); qm#624; qm#532; qm-yc#2063; qm-yc#2085. Per-subsystem retry ladders rather than one classification/budget.
- **Locks/leases**: src/persistence/advisory-lock.ts; src/persistence/leader-lease.ts; session_leases; run leases; qm-yc#2142 (crawl lease). Several Postgres lock primitives; advisory locks used ad hoc across stores.
- **Recurring work schedulers**: cron (src/cron, cron_fires qm-yc#2182); Loops (qm-yc#1942 with bound child cron, qm-yc#2090 loop ledger). Loops wrap crons with a second ledger/fire path.
- **Home snapshot tar**: src/sandbox/home-snapshot.ts (qm-yc#2153 extraction); qm-yc#2129 / #2162 tar-warning tolerance patched separately in migrate and snapshot paths. Consolidated for e2b/modal/aws; migrate pack path had its own tar tolerance.
- **Sandbox backends**: src/sandbox/{agent37,aws,e2b,local,modal,porter,smolmachines,sprites,superserve}-sandbox.ts. Nine providers plus live migration tooling (qm-yc#2141, #2154).
- **Memory backends**: notebook (default); src/memory/strategy.ts MEMORY_STRATEGY; src/memory/provider-config.ts router (qm#700); src/memory/memorable/ (qm#894). Two independent configuration axes for memory.
- **retry/backoff helpers**: src/util/async.ts fetchWithRetry; src/slack/delivery.ts deliverWithRetry; src/sandbox/sprites-sandbox.ts retrySpritesControl; src/runs/retry-delay.ts retryDelay; cli/src/backends/aws.ts retryLiveProbe; src/harness/pi-harness.ts attemptRefusalFallback; qm-yc#1964/#1965/#1919 (proposed extras). Each subsystem rolls its own retry policy; no shared classification or budget.
- **work queues**: src/runs/postgres-run-store.ts (SKIP LOCKED); src/delivery/postgres-delivery-store.ts (SKIP LOCKED); src/files/file-upload-store.ts (SKIP LOCKED); src/cron/job-queue.ts (pg-boss). Three hand-built Postgres queues plus pg-boss.
- **locks/leases**: src/persistence/advisory-lock.ts; src/persistence/leader-lease.ts; direct advisory locks in acl, audit, cron fire-store, directory, file stores, memory, session store; session_leases vs run leases. Several locking styles for similar exclusion needs.
- **dedup/idempotency**: src/slack/message-gating.ts in-memory LRU deduper; src/idempotency/ (durable + in-memory Map); audit-log idempotency keys (qm-yc#1965); loop-item dedupeKey. Inbound dedup is not built on the durable idempotency store.
- **sandbox backends**: src/sandbox/{agent37,aws,local/docker,e2b,modal,porter,smolmachines,sprites,superserve}-sandbox.ts. About 10 providers, each with its own env config; usage is consolidating on E2B.
- **client UI-state persistence**: localStorage drafts (plugins/web-ui/src/drafts.ts); server web_ui_state DurableMap (qm#452); in-memory attachment store (qm-yc#1962). Three persistence tiers for composer and layout state.
- **Postgres work queues**: src/runs/postgres-run-store.ts (FOR UPDATE SKIP LOCKED); src/delivery/postgres-delivery-store.ts (SKIP LOCKED x2); src/files/file-upload-store.ts (SKIP LOCKED); pg-boss (cron). Three hand-built claim queues plus pg-boss. qm-yc#1628 then added CRON_FIRE_CONCURRENCY as yet another queue tuning knob.
- **Session write locks / leases**: src/sessions/postgres-session-store.ts session_leases; run leases in postgres-run-store; qm-yc#1636/#1638/#1639 (lock-holder logging, defer-not-drop [held], compaction lock split). The session lease is separate from the run lease, and about 134 'session busy' refusals a week spawned more machinery around it.
- **Transcript stores**: session_entries; session_tape (qm-yc#1575, #1781); former Pi warm session cache (deleted in qm-yc#1441). Two coexisting authorities with read-time self-heal between them.
- **Model allowlists**: MODEL_REGISTRY and derived SELECTABLE_BASE_MODELS in src/model/pi-models.ts; formerly DEFAULT_WEBUI_MODEL_IDS and WEB_UI_ALLOWED_MODEL_IDS (qm-yc#1499); qm-yc#1498 picker/gate sync. Drift between lists caused 403s. Mostly consolidated now.
- **Emoji datasets**: src/slack/emoji-map.ts and src/api/routes/admin/slack-installation.ts (emoji-datasource, qm-yc#1469); plugins/web-ui/src/emoji-data.ts (1,931-line checked-in table). Slack moved to the npm dataset, but the web-ui still ships its own checked-in emoji table.
- **HTTP servers / request validation**: src/api/server.ts (Fastify); plugins/web-ui/server/index.ts (node:http); plugins/portal/src/index.ts; zod used in only 5 files (qm-yc#1492 unmerged). Several routers and validation styles.
- **Token/JWT codecs**: src/auth/signed-token.ts (jose); chassis-local kid-JWS codec for portal identity (qm-yc#1457); former hand-rolled Google OIDC verify (moved to jose in qm-yc#1483). The chassis can't import core's jose, so a wire-compatible second codec exists.
- **Conversation location models**: ScopeId channel:/group:; Conversation.kind; SessionType; Destination.type; directory rooms (qm-yc#1729/#1730 unmerged). Five representations of where a conversation happens.
- **Run terminal notifications**: per-run EventEmitter waitFor; onTerminal listener array (both unified in qm-yc#1537). Wound back.
- **locks / leases**: src/persistence/leader-lease.ts (advisory-lock leader lease, qm-yc#1397 replaced leader_leases table); src/persistence/advisory-lock.ts; session_leases table (src/sessions/postgres-session-store.ts); run lease (src/runs/postgres-run-store.ts); delivery claim_expires_at (src/delivery/postgres-delivery-store.ts, qm-yc#1166); cron slot claim (qm-yc#1364) + src/cron/fire-store.ts. At least five separate mutual-exclusion mechanisms. LAB-164 proposes collapsing session_leases into the run lease.
- **work queues**: pg-boss (cron, qm-yc#1358); src/runs/postgres-run-store.ts (SKIP LOCKED); src/delivery/postgres-delivery-store.ts (SKIP LOCKED claim); src/files/file-upload-store.ts (SKIP LOCKED). Three hand-built Postgres queues plus pg-boss. LAB-163 proposes consolidating.
- **cron exactly-once guards**: pg-boss singleton/dedup; cron store atomic slot claim (qm-yc#1364); IdempotencyStore in src/cron/scheduler.ts; src/cron/fire-store.ts. Guards were layered on after each double-fire. LAB-129 proposes collapsing them.
- **transcript / session log stores**: session_entries; session_tape (qm-yc#1298/#1323/#1344); warm in-RAM harness session cache; persisted LLM request bodies. The tape spec itself calls this a triple, and the migration is stuck mid-cutover.
- **retry helpers**: src/runs/retry-delay.ts; src/util/async.ts; src/sandbox/sprites-sandbox.ts (local retry); Slack deliverWithRetry/postWithVerify (src/slack/lib.ts, qm-yc#1267); earlier Fly execRaw 412 retry (qm-yc#1042). Retry and backoff are re-implemented per subsystem, with no shared classification or budget.
- **operator secret stores (historical)**: createEnvVault (VAULT_TOKEN_*); createEnvClientResolver; OAuthVault compat adapter over keychain. Consolidated onto SecretSource (qm-yc#1355) and the keychain ConnectorTokenStore (qm-yc#1314).
- **browser stacks (historical)**: browse-agent deterministic stack; browse-lab skill; headless-browser emoji uploader. Collapsed to one browse skill (qm-yc#1242), and emoji upload moved to HTTP (qm-yc#1177).
- **per-process caches vs durable reads**: DurableMap version-checked cache (src/persistence/durable-map.ts, qm-yc#1395); per-instance boot-hydrated config caches (qm-yc#1031 fixed one); in-memory DeliveryTracker (qm-yc#1166). Caching is handled differently per subsystem, and multi-instance staleness bugs recur.
- **layered config for the same setting**: env var default (e.g. TURN_WALL_CLOCK_SEC); org admin resource (qm-yc#1425); per-scope override (per-scope base model qm-yc#1189, security posture floor qm-yc#1319). Env, org and scope layers repeat for many settings, which multiplies the number of supported states.
- **retry/backoff helpers**: src/util/async.ts (jitteredBackoffMs, fetchWithRetry); src/runs/retry-delay.ts (retryDelay); src/slack/delivery.ts (deliverWithRetry); src/sandbox/sprites-sandbox.ts (retrySpritesControl); src/slack/reactions.ts (REACTION_RETRY_DELAYS_MS ladder); src/api/routes/deployments.ts (inline retry()). #464 set up one shared helper home in src/util/async.ts, but per-module retry ladders came back
- **constant-time compare**: src/util/crypto.ts constantTimeEqual; direct node:crypto timingSafeEqual in background-work.ts, viewer-session.ts, opencode-harness.ts, slack-managed.ts. #496 consolidated these; the drift has regrown
- **sandbox $HOME durability**: src/sandbox/home-snapshot.ts (portable S3 tar); E2B/Modal native snapshots (E2B_NATIVE_SNAPSHOT_INTERVAL_SEC, modal-client.ts); history: Fly volume (#519/#527), app-level backups (#507, deleted). two parallel durability paths per provider
- **sandbox backends**: src/sandbox/{aws,local,docker-exec,sprites,smolmachines,e2b,modal,porter,agent37,superserve}-*.ts. 9 sandbox backends plus 5 deploy providers in src/deploy (aws, docker, fly, porter, shared)
- **inbound dedup/idempotency**: src/idempotency/idempotency-store.ts; src/auth/replay-dedupe.ts; src/loops/item-ledger.ts + loops/sources/*; qm-yc#849 slack channel:ts dedup; qm-yc#839 gmail Pub/Sub dedup; qm-yc#690 cron/webhook create idempotency. each ingress path grew its own dedup key/store
- **memory providers/strategies**: src/memory/provider-router.ts; src/memory/mcp-memory-provider.ts; src/memory/memorable/*; src/memory/strategies/{agent-only,consolidation,per-turn,scratch-promote}.ts; qm-yc#563 (mem0, unmerged); qm-yc#664 (query_brain, removed). MEMORY_STRATEGY x MEMORY_PROVIDER_CONFIG matrix
- **Slack delivery**: src/slack/delivery.ts; src/slack/deliveries.ts; src/delivery/*. two near-homonymous Slack delivery modules (583 and 515 lines) next to a generic delivery store
- **browser backends (history)**: qm-yc#561/#469 browse-agent engine (Browser Use + raw CDP); qm-yc#793 Browserbase live view; qm-yc#838/#868 Kernel. three browser providers inside two weeks; only Kernel remains in current src
- **Store backends (memory + Postgres twin for every store)**: src/admin/{error-log,postgres-error-log,metrics-sink,postgres-metrics-sink,audit...}.ts; src/delivery/{delivery-store,postgres-delivery-store}.ts; src/tasks/{memory-task-store,postgres-task-store}.ts; createMemoryMap used in 28 files; qm-yc#221; qm-yc#347. #221 cut SQLite but kept an in-memory twin for every store; production always uses Postgres, so every store has two implementations and the in-memory one is a silent non-durable mode.
- **Locks/leases**: run leases (qm-yc#4, #340); session leases (qm-yc#177, #190); advisory-lock mutex (qm-yc#159); single-leader Postgres lease for cron/reaper (qm-yc#154); pg-boss for cron. At least four coordination mechanisms.
- **Scheduled/wake triggers**: src/cron; src/triggers; src/monitors (qm-yc#389); src/wake; src/loops; webhooks on the cron trigger engine (qm-yc#83). Several 'wake a conversation later' engines side by side.
- **Which computer runs a command**: src/environments (qm-yc#466); src/reach (execute scope:#channel, qm-yc#410); src/sandbox/sandbox-routing.ts; src/sandbox/sandbox-resources.ts. Overlapping ways to map a scope to a machine.
- **Replay/idempotency dedupe**: source-auth replay dedupe (qm-yc#341, #434); webhook replay dedupe (qm-yc#349); trigger/cron idempotency (qm-yc#354, src/idempotency); run enqueue idempotency (qm-yc#158). Separate dedupe stores per ingress path.
- **Reply delivery**: live Slack streaming path; durable turn-reply recovery outbox (qm-yc#372, #418); src/delivery/run-result-delivery.ts; src/delivery/web-transcript-delivery.ts. A second recovery path that repeats the live path and needed gap fixes.
- **Slack 'working' status indicator**: native assistant.threads.setStatus (qm-yc#77, #131); posted ⚙ Working placeholder (qm-yc#424); qm-yc#150 (unmerged consolidation). Two status pathways for channels vs DMs; the consolidation PR never merged.
- **Transcript/request records**: session entries WAL (qm-yc#301, #307, #271); session_llm_requests snapshots (qm-yc#211); later session_tape. Several stores record overlapping turn content.

## Editing this spec

Describe the target, not the mechanism. Name subsystems, not files. Add to the wall of shame only with a PR to cite. Stay near this length.
