# QM spec

Read all of this before you change QM. It says what QM promises, not how it works. The north stars come first, then the subsystems from most central to least.

## North stars

1. **Unhobble the model.** Models are smarter than we let them be, and effective intelligence grows with the capabilities you give them. Give the agent a real computer, real credentials and real reach, then let it decide. Your budget should be the limit, never the tool. Don't build guardrails the next model won't need.
2. **Capability first, authority explicit.** The agent acts as its human, with the same access that person has on their laptop. Capability never replaces authentication, scope isolation, grants or audit. What the agent can safely know is bounded by how good the permissions are.
3. **Brain out of the box.** Sessions, memory and state live in Postgres, and the agent can read them. Sandboxes and models are resources the agent picks, provisions and switches as the work needs. It doesn't live inside them.
4. **Nail the primitives.** Keep the harness thin: run commands on a computer, read and write files, publish apps. Everything else is a patch over a rough edge until a primitive can absorb it. Agent features are full sessions with the whole toolset, not bare model calls.
5. **Simplicity.** Fix the cause, fix every instance, and delete more than you add. Prefer the industry's usual approach to bespoke machinery. Agents are brilliant employees missing the big picture: they overengineer, fix only the corner they can see, and need permission to tear down what exists. Push them to simplify.
6. **Iterate fast.** Merge to production should take minutes. Speed is the best feature, and every bit of overhead we add should be measured and driven down. Code is nearly free, so run QA and experiments in parallel across many boxes. Assume work is always running: nothing waits for a quiet moment.
7. **Agent UX as polished as human UX.** Tools, errors, hints and prompts are the agent's interface, so they get the same care as the web UI. Spend every context token on purpose. Errors are honest and specific, never silently capped, dropped or swapped.
8. **Ground truth.** Read transcripts to keep a feel for real use. If you can't say how the agent should do something, do it by hand first. Claims need receipts.

## 1. Scopes and identity

`identity/identity-service.ts` resolves every Slack and web actor to one principal, keyed by verified work email. `resolution/` turns that principal and the room into a scope and computes what the turn may see: `scope-membership.ts` for who's in the room, `audience-floor.ts` for the least-privileged person present, and `sharing-posture.ts` for Open vs. scoped reads. Grants on artifacts live in `acl/acl-store.ts`. `security/security-posture.ts` sets autonomy per scope (Dangerous, Auto, Strict), and `security-screener.ts` screens untrusted content. Admin reads go through `admin/admin-service.ts` and are audited in `admin/postgres-audit-log.ts`.

## 2. Turns and sessions

The core loop is `core/orchestrator.ts`, which assembles context from `orchestrator/prompt-blocks.ts`, runs the harness and commits results. `runs/worker.ts` claims runs from `runs/postgres-run-store.ts`. The session lease in `sessions/postgres-session-store.ts` makes sure only one writer touches a transcript. Transcripts are `session_entries`, with `session_tape` as the replay record, folded back into context by `harness/tape-fold.ts`. Mid-turn messages arrive through `sessions/session-mailbox.ts`. `orchestrator/compaction.ts` summarizes history when context fills up. `runs/drain.ts` and `reaper.ts` handle deploys and dead workers.

## 3. Harnesses and models

`harness/harness-router.ts` picks among `pi-harness.ts`, `codex-harness.ts`, `claude-harness.ts` and `opencode-harness.ts`. All of them expose the one tool catalog in `harness/agent-tools.ts`, backed by `tools/primitives.ts`. `model/model-catalog.ts` and `gateway-catalog.ts` define which models exist, their effort levels and their prices (`pi-models.ts`). The agent swaps runtimes through `harness/runtime-control.ts`. Goals and grinds are `harness/goal.ts`.

## 4. Sandboxes

`sandbox/sandbox.ts` is the provider contract. Implementations: `e2b-`, `modal-`, `sprites-`, `aws-`, `porter-`, `superserve-`, `agent37-`, `smolmachines-` and `local-sandbox.ts`. `sandbox-resources.ts` is the list of computers. `sandbox-routing.ts` maps each scope to its default. `home-snapshot.ts` tars `$HOME` to S3 so a scope can move providers. Execs share `exec-sandbox-base.ts`, and `orchestrator/sandboxes.ts` turns provider failures into facts the agent can act on.

## 5. Credentials

`credentials/keychain.ts` holds each person's logins. `secret-drop.ts` mints the one-time links that fill it. `connectors/oauth.ts` refreshes connected apps. Brokered calls go through `api/credential-broker.ts` and `git-http-broker.ts`, which add the secret on the server side. Sandbox egress runs through `deploy/egress-proxy`, which checks the per-turn token from `auth/capability-token.ts`. Whatever does get materialized is scoped to one command, and `security/secret-masking.ts` keeps it out of transcripts. Cross-scope use needs an owner-approved grant (`credentials/keychain-approval.ts`, `triggers/keychain-ask.ts`).

## 6. Memory, guidance and skills

Memory is `memory/memory-service.ts` over a per-scope notebook (`notebook.ts`), recalled each turn via `recall-delta.ts`. It's an append-only index, not a datastore or a permission. Guidance is the scope's standing orders, edited through the `guidance` tool. Skills live in `skills/skill-store.ts`, arrive from packs through `skill-sync-engine.ts`, and are copied onto the sandbox only when a command asks (`materialize.ts`).

## 7. Background work

Crons are `cron/scheduler.ts` on pg-boss (`job-queue.ts`), and `cron/authority.ts` decides whose credentials a fire runs with. Loops are `loops/runner.ts`, with sources feeding `ingress.ts`, an item ledger for the Inbox, and `governor.ts` limiting spend. Webhooks enter through `webhooks/webhook-receiver.ts`, and subagents are background runs (`runs/background-controller.ts`). Non-owner edits go through `triggers/edit-notice.ts`. Start with a smart model, then downgrade it or swap in a script once the task is understood.

## 8. Surfaces

`slack/` and `plugins/web-ui` are two views of the same sessions. Slack delivery is `slack/delivery.ts` (ack emoji in `ack-emoji.ts`, approvals in `approval-cards.ts`). Web delivery is `delivery/web-transcript-delivery.ts`. Each should look native. Text arrives first and heavy content loads lazily. Model-only context never reaches the browser.

## 9. Apps and files

`deploy/deploy-service.ts` publishes apps as immutable versions across the `docker-`, `fly-`, `aws-` and `porter-deploy-provider.ts` backends. Every request passes core's viewer check (`deploy/viewer-session.ts`). Apps are private by default and shared like docs, and external access is an admin flag that defaults to off. Files are `files/file-artifact-store.ts` over `durable-byte-store.ts`, and they inherit their scope's permissions.

## 10. Deploy and release

The `cli/` (`qm deploy`, `qm check --live`) runs blue/green releases. Terraform under `deploy/stacks` and `aws/` provisions the infrastructure. Downstream deployments pin a qm release. At deploy time, a turn hands off at a safe point within a short grace window. Merged is not live, so verify against the running release.

## Editing this spec

Write contracts, not mechanisms. No dates, PR numbers or status. Name real modules, and update this file in the same PR that renames or deletes one. Stay near this length.
