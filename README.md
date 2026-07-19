# Incident Handoff Builder

Static browser tool for turning raw outage notes into a concise incident handoff brief.

## Why this exists

During an incident, useful context gets scattered across chat, dashboards, and half-written notes. The next person on shift usually does not need every message. They need one readable handoff that says:

- what failed
- who is currently driving
- what customers felt
- what already happened
- what still needs to happen next

This tool structures those pieces and exports a Markdown brief or portable JSON snapshot.

## Features

- Plain-language incident facts section for title, severity, owner, summary, impact, detection, and handoff note
- Readiness checklist for mitigation, comms, rollback, and monitoring posture
- Timestamped timeline rows with owner attribution
- Owned next-action rows with deadline hints plus `open`, `blocked`, and `done` status tracking
- Live completeness scoring and missing-context callouts
- Markdown preview with copy/export flow
- Executive update preview for quick Slack/email incident status copy
- Action posture summary so the next shift can see blocked vs open follow-up at a glance
- JSON export/import for passing a draft between machines
- Browser-local persistence so the working brief survives refreshes

## Run locally

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Portfolio Positioning

- Project type: Static browser workflow tool
- Strongest use: incident response, shift handoff, and operational note cleanup
- Stack truth: HTML, CSS, JavaScript

## Demo Path

1. Load the sample incident.
2. Add one timeline event and one next action.
3. Show the missing-context list shrink.
4. Copy or export the generated Markdown brief.
