# Security Policy

## Scope

This repository is a personal-use MVP for connecting ChatGPT Custom GPT Actions to Google Tasks through a Google Apps Script Web App.

It is designed for a single user workflow and must not be treated as a production-grade company deployment.

## MVP safety constraints

The MVP intentionally allows only:

- reading today's and tomorrow's incomplete tasks
- explicitly creating a task
- explicitly updating a task due date
- returning an audit snapshot

The MVP intentionally does not allow:

- task completion
- task deletion
- bulk deletion
- automatic completion judgment
- automatic overdue task movement
- inferred registration from unclear case names
- date-less task creation

## Authentication model

Apps Script Web App `doPost(e)` is designed here with the assumption that HTTP request headers are not reliably available to the script.

Therefore, this MVP validates a shared secret in the JSON request body.

Required Script Property:

```text
KANROJI_TASKS_SECRET=your-long-random-secret
```

Every request must include:

```json
{
  "secret": "your-long-random-secret"
}
```

Missing or invalid secrets return:

```json
{
  "ok": false,
  "error": "unauthorized"
}
```

## Limitations of body secret authentication

Body secret authentication is simple and usable for personal testing, but it is not strong enough for shared GPTs, team use, or company deployment.

Risks include:

- the secret may be exposed if copied into the wrong place
- the secret is sent in request bodies
- Apps Script is acting as both API endpoint and credential validator
- granular access control is not implemented
- request logging and rate limiting are limited

## Recommendation for broader deployment

For shared GPTs, team use, or company deployment, place an API gateway such as Cloudflare Workers between ChatGPT Actions and Apps Script.

The gateway should handle:

- API key or OAuth validation
- rate limiting
- request logging
- IP or origin restrictions where possible
- request schema validation
- secret rotation
- separation of public credentials from Google Apps Script internals

## Operational safety rules

The assistant must follow these rules when using this bridge:

1. Do not complete tasks automatically.
2. Do not delete tasks.
3. Do not bulk modify tasks.
4. Do not move overdue tasks without explicit user instruction.
5. Do not create date-less tasks.
6. Do not infer a case name or house name when creating a task.
7. Create tasks only when the user clearly states the task content and due date.
8. Use the title format `邸名｜行動`.
9. Treat Google Tasks as an execution layer, not as the single source of truth for all case history.
10. Keep site visits, proposals, and construction starts in Google Calendar rather than automating them through Google Tasks.

## Future phase requirements

Before adding task completion, deletion, or broader automation, require a separate design review.

Task completion should only be added with:

- explicit user instruction
- confirmation step
- operation log
- rollback guidance
- narrow scope

Deletion should remain out of scope unless there is a strong operational reason and a recovery plan.
