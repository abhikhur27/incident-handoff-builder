const storageKey = 'incident_handoff_builder_state_v1';

const fields = {
  title: document.getElementById('incident-title'),
  owner: document.getElementById('incident-owner'),
  severity: document.getElementById('incident-severity'),
  phase: document.getElementById('incident-phase'),
  summary: document.getElementById('incident-summary'),
  impact: document.getElementById('incident-impact'),
  detection: document.getElementById('incident-detection'),
  handoff: document.getElementById('incident-handoff'),
};

const checks = {
  mitigation: document.getElementById('check-mitigation'),
  comms: document.getElementById('check-comms'),
  rollback: document.getElementById('check-rollback'),
  monitoring: document.getElementById('check-monitoring'),
};

const timelineList = document.getElementById('timeline-list');
const actionList = document.getElementById('action-list');
const readinessScoreEl = document.getElementById('readiness-score');
const timelineCountEl = document.getElementById('timeline-count');
const actionCountEl = document.getElementById('action-count');
const postureSummaryEl = document.getElementById('posture-summary');
const actionPostureEl = document.getElementById('action-posture');
const missingListEl = document.getElementById('missing-list');
const executivePreviewEl = document.getElementById('executive-preview');
const markdownPreviewEl = document.getElementById('markdown-preview');
const statusEl = document.getElementById('status');
const importFileEl = document.getElementById('import-file');

const timelineTemplate = document.getElementById('timeline-template');
const actionTemplate = document.getElementById('action-template');

let state = loadState();

function defaultState() {
  return {
    title: '',
    owner: '',
    severity: 'SEV-2',
    phase: 'Investigating',
    summary: '',
    impact: '',
    detection: '',
    handoff: '',
    checks: {
      mitigation: false,
      comms: false,
      rollback: false,
      monitoring: false,
    },
    timeline: [blankTimelineRow()],
    actions: [blankActionRow()],
  };
}

function blankTimelineRow() {
  return { id: crypto.randomUUID(), time: '', owner: '', event: '' };
}

function blankActionRow() {
  return { id: crypto.randomUUID(), owner: '', deadline: '', task: '', status: 'open' };
}

function sampleState() {
  return {
    title: 'Checkout API latency spike',
    owner: 'Backend on-call',
    severity: 'SEV-2',
    phase: 'Monitoring',
    summary: 'P95 latency on checkout requests spiked after a cache eviction burst in one region, causing degraded purchase completion.',
    impact: 'US-East checkout traffic saw 18-25 second response times for about 14 minutes. Some users retried and a subset abandoned carts.',
    detection: 'PagerDuty fired on checkout P95 latency > 8s, then support reported customer complaints within five minutes.',
    handoff: 'Mitigation is live and latency has normalized, but the cache invalidation path still needs a root-cause read before the next deploy window. Start with the canary region traces and verify whether the same burst can recur after a warm restart.',
    checks: {
      mitigation: true,
      comms: true,
      rollback: false,
      monitoring: true,
    },
    timeline: [
      { id: crypto.randomUUID(), time: '14:02 CT', owner: 'API on-call', event: 'Latency alert fired for checkout P95.' },
      { id: crypto.randomUUID(), time: '14:07 CT', owner: 'Support lead', event: 'Customer complaints confirmed from US-East shoppers.' },
      { id: crypto.randomUUID(), time: '14:15 CT', owner: 'Platform lead', event: 'Cache pool recycled and mitigation deployed to 30% of traffic.' },
      { id: crypto.randomUUID(), time: '14:24 CT', owner: 'Backend on-call', event: 'Latency returned to baseline across all regions.' },
    ],
    actions: [
      { id: crypto.randomUUID(), owner: 'Backend on-call', deadline: 'Before 18:00 CT', task: 'Review invalidation burst traces in the first affected region.', status: 'open' },
      { id: crypto.randomUUID(), owner: 'Platform lead', deadline: 'Next deploy window', task: 'Confirm rollback recipe for cache pool config changes.', status: 'blocked' },
    ],
  };
}

function loadState() {
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey));
    if (!raw) return defaultState();
    return normalizeState(raw);
  } catch (error) {
    return defaultState();
  }
}

function normalizeState(raw) {
  const fallback = defaultState();
  return {
    ...fallback,
    ...raw,
    checks: {
      ...fallback.checks,
      ...(raw.checks || {}),
    },
    timeline: Array.isArray(raw.timeline) && raw.timeline.length
      ? raw.timeline.map((row) => ({ id: row.id || crypto.randomUUID(), time: row.time || '', owner: row.owner || '', event: row.event || '' }))
      : [blankTimelineRow()],
    actions: Array.isArray(raw.actions) && raw.actions.length
      ? raw.actions.map((row) => ({
        id: row.id || crypto.randomUUID(),
        owner: row.owner || '',
        deadline: row.deadline || '',
        task: row.task || '',
        status: ['open', 'blocked', 'done'].includes(row.status) ? row.status : 'open',
      }))
      : [blankActionRow()],
  };
}

function persistState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function setStatus(message) {
  statusEl.textContent = message;
}

function bindTopLevelFields() {
  Object.entries(fields).forEach(([key, element]) => {
    element.addEventListener('input', () => {
      state[key] = element.value;
      update();
    });
  });

  Object.entries(checks).forEach(([key, element]) => {
    element.addEventListener('change', () => {
      state.checks[key] = element.checked;
      update();
    });
  });
}

function renderRows(listElement, rows, template, kind) {
  listElement.innerHTML = '';
  rows.forEach((row) => {
    const fragment = template.content.firstElementChild.cloneNode(true);
    fragment.dataset.id = row.id;
    fragment.querySelectorAll('[data-field]').forEach((input) => {
      const field = input.dataset.field;
      input.value = row[field] || '';
      const syncRow = () => {
        const targetCollection = kind === 'timeline' ? state.timeline : state.actions;
        const targetRow = targetCollection.find((entry) => entry.id === row.id);
        if (!targetRow) return;
        targetRow[field] = input.value;
        update();
      };
      input.addEventListener('input', syncRow);
      input.addEventListener('change', syncRow);
    });
    fragment.querySelector('.remove-row').addEventListener('click', () => {
      if (kind === 'timeline') {
        state.timeline = state.timeline.filter((entry) => entry.id !== row.id);
        if (!state.timeline.length) state.timeline = [blankTimelineRow()];
      } else {
        state.actions = state.actions.filter((entry) => entry.id !== row.id);
        if (!state.actions.length) state.actions = [blankActionRow()];
      }
      update();
    });
    listElement.appendChild(fragment);
  });
}

function incidentReadiness() {
  const checksComplete = Object.values(state.checks).filter(Boolean).length;
  const requiredFacts = [
    state.title.trim(),
    state.owner.trim(),
    state.summary.trim(),
    state.impact.trim(),
    state.detection.trim(),
    state.handoff.trim(),
  ].filter(Boolean).length;
  const timelineComplete = state.timeline.filter((row) => row.time.trim() && row.event.trim()).length;
  const actionsComplete = state.actions.filter((row) => row.owner.trim() && row.task.trim() && row.status !== 'done').length;

  const rawScore = (requiredFacts * 10) + (checksComplete * 5) + (timelineComplete * 6) + (actionsComplete * 6);
  return Math.min(100, rawScore);
}

function missingItems() {
  const items = [];
  if (!state.title.trim()) items.push('Incident title is still blank.');
  if (!state.owner.trim()) items.push('Current owner is missing.');
  if (!state.impact.trim()) items.push('Customer impact is not described yet.');
  if (!state.detection.trim()) items.push('Detection signal is missing.');
  if (!state.timeline.some((row) => row.time.trim() && row.event.trim())) items.push('Timeline has no timestamped event yet.');
  if (!state.actions.some((row) => row.owner.trim() && row.task.trim() && row.status !== 'done')) items.push('No open or blocked owned action is ready for the next shift.');
  if (!state.checks.monitoring && state.phase !== 'Resolved') items.push('Monitoring confirmation is still unchecked.');
  if (!state.handoff.trim()) items.push('Next-shift handoff note is missing.');
  return items;
}

function postureSummary() {
  const missing = missingItems();
  if (missing.length >= 5) {
    return 'Fragile handoff. Too many core facts are still missing for the next responder to resume cleanly.';
  }
  if (state.phase === 'Resolved' && missing.length <= 2) {
    return 'Resolved and handoff-ready. The brief has enough context for wrap-up and postmortem follow-through.';
  }
  if (state.checks.mitigation && state.checks.monitoring) {
    return 'Mitigation is in place, but the handoff should still call out unresolved follow-up risk.';
  }
  return 'Active investigation. The next responder will need a clear first step and current theory.';
}

function buildMarkdown() {
  const timelineRows = state.timeline
    .filter((row) => row.time.trim() || row.event.trim() || row.owner.trim())
    .map((row) => `- ${row.time || 'Time TBD'} | ${row.owner || 'Owner TBD'} | ${row.event || 'Event TBD'}`);
  const actionRows = state.actions
    .filter((row) => row.owner.trim() || row.task.trim() || row.deadline.trim())
    .map((row) => `- ${formatActionStatus(row.status)} | ${row.owner || 'Owner TBD'} | ${row.deadline || 'Deadline TBD'} | ${row.task || 'Action TBD'}`);

  return [
    `# ${state.title || 'Untitled incident'}`,
    '',
    `- Severity: ${state.severity}`,
    `- Status: ${state.phase}`,
    `- Current owner: ${state.owner || 'Unassigned'}`,
    `- Shift posture: ${postureSummary()}`,
    '',
    '## What Happened',
    '',
    state.summary || 'Summary still missing.',
    '',
    '## Customer Impact',
    '',
    state.impact || 'Impact not documented yet.',
    '',
    '## Detection',
    '',
    state.detection || 'Detection signal not documented yet.',
    '',
    '## Readiness Checklist',
    '',
    `- Mitigation shipped: ${state.checks.mitigation ? 'yes' : 'no'}`,
    `- Customer comms sent: ${state.checks.comms ? 'yes' : 'no'}`,
    `- Rollback path tested: ${state.checks.rollback ? 'yes' : 'no'}`,
    `- Monitoring confirms the trend: ${state.checks.monitoring ? 'yes' : 'no'}`,
    '',
    '## Timeline',
    '',
    ...(timelineRows.length ? timelineRows : ['- No timeline events captured yet.']),
    '',
    '## Next Actions',
    '',
    ...(actionRows.length ? actionRows : ['- No owned follow-up actions captured yet.']),
    '',
    '## Next-Shift Handoff Note',
    '',
    state.handoff || 'Handoff note still missing.',
    '',
  ].join('\n');
}

function firstOwnedAction() {
  return state.actions.find((row) => row.status === 'blocked' && row.owner.trim() && row.task.trim())
    || state.actions.find((row) => row.status === 'open' && row.owner.trim() && row.task.trim())
    || state.actions.find((row) => row.owner.trim() && row.task.trim());
}

function formatActionStatus(status) {
  if (status === 'blocked') return 'Blocked';
  if (status === 'done') return 'Done';
  return 'Open';
}

function buildActionPosture() {
  const blocked = state.actions.filter((row) => row.status === 'blocked' && (row.owner.trim() || row.task.trim())).length;
  const open = state.actions.filter((row) => row.status === 'open' && (row.owner.trim() || row.task.trim())).length;
  const done = state.actions.filter((row) => row.status === 'done' && (row.owner.trim() || row.task.trim())).length;

  if (!blocked && !open && !done) {
    return 'No action rows are populated yet.';
  }
  if (blocked) {
    return `${blocked} blocked, ${open} open, ${done} done. The next shift should start with the blocked work first.`;
  }
  if (open) {
    return `${open} open, ${done} done, no blocked actions. The handoff is actionable but still needs follow-through.`;
  }
  return `${done} done, no open follow-up. This incident is close to wrap-up if the narrative is complete.`;
}

function buildExecutiveUpdate() {
  const nextAction = firstOwnedAction();
  const nextStep = nextAction
    ? `${nextAction.owner} owns ${nextAction.task}${nextAction.deadline.trim() ? ` (${nextAction.deadline.trim()})` : ''}.`
    : 'No owned next step is captured yet.';

  return [
    `${state.severity} | ${state.title.trim() || 'Untitled incident'} | ${state.phase}`,
    `Owner: ${state.owner.trim() || 'Unassigned'}`,
    `Impact: ${state.impact.trim() || 'Customer impact still being qualified.'}`,
    `Posture: ${postureSummary()}`,
    `Next: ${nextStep}`,
  ].join('\n');
}

function exportTextFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function copyMarkdown() {
  try {
    await navigator.clipboard.writeText(buildMarkdown());
    setStatus('Copied the current markdown handoff brief.');
  } catch (error) {
    setStatus('Clipboard copy failed in this browser.');
  }
}

async function copyExecutiveUpdate() {
  try {
    await navigator.clipboard.writeText(buildExecutiveUpdate());
    setStatus('Copied the executive update.');
  } catch (error) {
    setStatus('Clipboard copy failed in this browser.');
  }
}

function syncForm() {
  Object.entries(fields).forEach(([key, element]) => {
    element.value = state[key] || '';
  });
  Object.entries(checks).forEach(([key, element]) => {
    element.checked = Boolean(state.checks[key]);
  });
}

function update() {
  persistState();
  syncForm();
  renderRows(timelineList, state.timeline, timelineTemplate, 'timeline');
  renderRows(actionList, state.actions, actionTemplate, 'action');

  const missing = missingItems();
  readinessScoreEl.textContent = `${incidentReadiness()}%`;
  timelineCountEl.textContent = String(state.timeline.filter((row) => row.time.trim() || row.event.trim()).length);
  actionCountEl.textContent = String(state.actions.filter((row) => row.status !== 'done' && (row.owner.trim() || row.task.trim())).length);
  postureSummaryEl.textContent = postureSummary();
  actionPostureEl.textContent = buildActionPosture();

  missingListEl.innerHTML = '';
  (missing.length ? missing : ['No obvious gaps. This brief is ready to hand off.']).forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    missingListEl.appendChild(li);
  });

  executivePreviewEl.textContent = buildExecutiveUpdate();
  markdownPreviewEl.textContent = buildMarkdown();
}

document.getElementById('load-sample').addEventListener('click', () => {
  state = sampleState();
  update();
  setStatus('Loaded a realistic sample incident.');
});

document.getElementById('copy-markdown').addEventListener('click', copyMarkdown);
document.getElementById('copy-exec-update').addEventListener('click', copyExecutiveUpdate);

document.getElementById('export-markdown').addEventListener('click', () => {
  exportTextFile('incident-handoff.md', buildMarkdown(), 'text/markdown');
  setStatus('Exported the markdown handoff brief.');
});

document.getElementById('export-json').addEventListener('click', () => {
  exportTextFile('incident-handoff.json', JSON.stringify(state, null, 2), 'application/json');
  setStatus('Exported the working incident JSON.');
});

document.getElementById('import-json').addEventListener('click', () => {
  importFileEl.click();
});

importFileEl.addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    state = normalizeState(parsed);
    update();
    setStatus('Imported incident JSON.');
  } catch (error) {
    setStatus('Could not import that JSON file.');
  } finally {
    event.target.value = '';
  }
});

document.getElementById('add-timeline').addEventListener('click', () => {
  state.timeline.push(blankTimelineRow());
  update();
});

document.getElementById('add-action').addEventListener('click', () => {
  state.actions.push(blankActionRow());
  update();
});

bindTopLevelFields();
update();
