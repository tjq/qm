# QM spec

Read all of this before you change QM. It says what QM promises, not how it works. The north stars come first, then the subsystems from most central to least. Each subsystem ends with a wall of shame: real mistakes we won't make again.

## North stars

1. **Unhobble the model.** Models are smarter than we let them be, and effective intelligence grows with the capabilities you give them. Give the agent a real computer, real credentials and real reach, then let it decide. Your budget should be the limit, never the tool. Don't build guardrails the next model won't need.
2. **Capability first, authority explicit.** The agent acts as its human, with the same access that person has on their laptop. Capability never replaces authentication, scope isolation, grants or audit. What the agent can safely know is bounded by how good the permissions are.
3. **Brain out of the box.** Sessions, memory and state live in Postgres, and the agent can read them. Sandboxes and models are resources the agent picks, provisions and switches as the work needs. It doesn't live inside them.
4. **Nail the primitives.** Keep the harness thin: run commands on a computer, read and write files, publish apps. Everything else is a patch over a rough edge until a primitive can absorb it. Agent features are full sessions with the whole toolset, not bare model calls.
5. **Simplicity.** Fix the cause, fix every instance, and delete more than you add. Prefer the industry's usual approach to bespoke machinery. Agents drift toward overengineering and narrow fixes that only see their corner of the system, so push back.
6. **Iterate fast.** Merge to production should take minutes. Speed is the best feature, and every bit of overhead we add should be measured and driven down. Assume work is always running: nothing waits for a quiet moment.
7. **Agent UX as polished as human UX.** Tools, errors, hints and prompts are the agent's interface, so they get the same care as the web UI. Spend every context token on purpose. Errors are honest and specific, never silently capped, dropped or swapped.
8. **Ground truth.** Read transcripts to keep a feel for real use. If you can't say how the agent should do something, do it by hand first. Claims need receipts.

## 1. Scopes and identity

A scope is a person, a channel, a group or a project. Each has its own memory, files, keychain view, crons, apps and computer. A turn runs as one real human and sees only what that human and scope are entitled to. Sharing always takes an explicit grant. Agents don't grasp social context on their own, so the boundaries have to hold it. Admin reads are audited.

Shame: compaction summaries carried private content into a shared channel. Setup consent written into memory was treated as authorization.

## 2. Turns and sessions

A session is one ordered transcript. A turn claims it, commits as it goes, and can hand off to a new worker mid-turn. Stop works like a kernel interrupt and reaches every descendant. A new message steers or queues; it never silently kills the turn.

Shame: a boot-time recount took a global lock and forced a deploy rollback. Stop waited on a subagent that never got the cancel. New messages pre-empted turns, and the work vanished.

## 3. Harnesses and models

A runtime is one unit: harness, model, effort and fast mode. Every harness drives the same core. An invalid combination is an error. Menus show what the provider actually offers, under the provider's own names. The agent can change its own runtime, for example to get around a refusal.

Shame: harnesses silently dropped the chosen effort level. A response cache replayed one malformed tool call and logged 24 successes. A regex refusal ladder, since deleted.

## 4. Sandboxes

Every scope has a default computer, and the agent can reach for others. Providers are interchangeable. A dead box is a fact to report, not a verdict: the agent finishes the job somewhere else. Nothing locks a whole machine.

Shame: distinct failures collapsed into "wedged, restart it," with retries promised and never scheduled. Execs queued behind a five-minute machine lock. A failed snapshot retried on every turn, forever.

## 5. Credentials

Keep secrets out of the sandbox where possible. Brokered calls get the secret added on the server side. Anything materialized lives only for the command that asked for it. Using a credential across scopes needs a grant approved by its owner. New secrets arrive through a secret-drop link, never through chat.

Shame: env-delivered org credentials skipped the broker's grant check. A token in a git remote leaked into a transcript.

## 6. Memory, guidance and skills

Memory is an append-only index of durable facts. It is neither a datastore nor authorization. Guidance holds standing orders. Skills are procedures owned by a scope, shared by grant and promoted to the org by an admin.

Shame: superseded instructions lingered in memory and conflicted with new ones.

## 7. Background work

Crons, Loops, webhooks and grinds (goals with a budget) run with their owner's authority and report where they were created. Start with a smart model, then downgrade it, or replace it with a script once the task is understood. A non-owner's edit waits for the owner's approval. A fire that can't do its job says so.

Shame: Loop intake ran with its tools stripped and fired 50 times in six hours. Two concurrent fires double-sent a report. A 100-task quota blocked real work.

## 8. Surfaces

Slack and web are two views of the same sessions. Each should look native. Text arrives first and heavy content loads lazily. Model-only context never reaches the browser. An ack means "I'm working on this."

Shame: a byte cap hid earlier turns. Memory blocks were shipped to the browser. The agent said "attached" without attaching.

## 9. Apps and files

Apps are private by default and shared like docs. External access stays off until an admin turns it on. Files inherit their scope's permissions.

Shame: public app links were on by default.

## 10. Deploy and release

Blue/green, with handoff at a safe point inside a short grace window. Downstream deployments pin a qm release. Merged is not live, so verify against the running release.

Shame: deploys waited for a drain that never comes. One schema bug silently took down every sandbox for an hour.

## Editing this spec

Write contracts, not mechanisms. No dates, PR numbers or status. Stay near 1,000 words. When a mistake costs real time, add one line to the relevant wall of shame in the PR that fixes it.
