#!/usr/bin/env node
// Dependency audit gate: fails only on high/critical advisories that are not
// listed in .github/audit-allowlist.json. Dependency-free on purpose.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const allowlistPath = process.env.AUDIT_ALLOWLIST || join(here, '..', 'audit-allowlist.json');
const BLOCKING = new Set(['high', 'critical']);

const allowlist = JSON.parse(readFileSync(allowlistPath, 'utf8'));
const accepted = new Map((allowlist.accepted ?? []).map((entry) => [Number(entry.id), entry]));

// yarn v1 exits non-zero when vulnerabilities exist, so ignore the exit code and parse stdout.
const result = spawnSync('yarn', ['audit', '--groups', 'dependencies', '--json'], {
  encoding: 'utf8',
  maxBuffer: 256 * 1024 * 1024,
  shell: process.platform === 'win32',
});
if (result.error) {
  console.error(`Failed to run yarn audit: ${result.error.message}`);
  process.exit(2);
}

const advisories = new Map();
let sawSummary = false;
for (const line of (result.stdout || '').split('\n')) {
  if (!line.trim()) continue;
  let entry;
  try {
    entry = JSON.parse(line);
  } catch {
    continue;
  }
  if (entry.type === 'auditSummary') sawSummary = true;
  if (entry.type === 'auditAdvisory') {
    const adv = entry.data.advisory;
    advisories.set(adv.id, adv);
  }
}

if (!sawSummary) {
  // No summary line means the audit itself failed (network error, registry outage, etc.).
  console.error('yarn audit produced no summary; cannot verify dependencies.');
  console.error((result.stderr || '').trim());
  process.exit(2);
}

const counts = {};
const acceptedHits = [];
const newBlocking = [];
for (const adv of advisories.values()) {
  counts[adv.severity] = (counts[adv.severity] ?? 0) + 1;
  if (!BLOCKING.has(adv.severity)) continue;
  if (accepted.has(adv.id)) acceptedHits.push(adv);
  else newBlocking.push(adv);
}

console.log('Advisories by severity:');
for (const sev of ['critical', 'high', 'moderate', 'low', 'info']) {
  if (counts[sev]) console.log(`  ${sev}: ${counts[sev]}`);
}

if (acceptedHits.length) {
  console.log('\nAccepted high/critical advisories (allowlisted):');
  for (const adv of acceptedHits) {
    const meta = accepted.get(adv.id);
    console.log(`  [${adv.id}] ${adv.module_name} (${adv.severity}): ${adv.title}`);
    console.log(`    reason: ${meta.reason}`);
    console.log(`    tracking: ${meta.issue}`);
    console.log(`::warning title=Accepted advisory ${adv.id}::${adv.module_name}: ${adv.title} (tracked in ${meta.issue})`);
  }
}

if (newBlocking.length) {
  console.log('\nNEW high/critical advisories (not allowlisted):');
  for (const adv of newBlocking) {
    console.log(`  [${adv.id}] ${adv.module_name} (${adv.severity}): ${adv.title}`);
    console.log(`::error title=New ${adv.severity} advisory ${adv.id}::${adv.module_name}: ${adv.title}`);
  }
  console.log('\nFix the dependency, or add the advisory id to .github/audit-allowlist.json with a reason and tracking issue.');
  process.exit(1);
}

console.log('\nNo new high/critical advisories.');
