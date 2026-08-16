#!/usr/bin/env node
// SP-025: action-pin verifier for the platform CI kit.
//
// Catches the 2026-08-16 bug class: a `uses: owner/repo@<sha>` pin that does
// not match the upstream tag it claims. Also enforces cross-file consistency
// for the same action (e.g. verify-full.yml embedding the same rust job as
// verify-rust.yml must pin the same SHA).
//
// Usage: node check-action-pins.mjs [files...]
// Exit 0 = clean, 1 = pin violations, 2 = usage/structural error.

import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("usage: node check-action-pins.mjs <workflow.yml...>");
  process.exit(2);
}

const PIN_RE = /uses:\s*([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)@([0-9a-f]{40})(?:\s*#\s*v?([0-9][^\s]*))?/g;

const seen = new Map(); // `${owner/repo}` -> { sha, tag, files: [] }
const violations = [];

function ghJson(path) {
  return execFileSync("gh", ["api", path], { encoding: "utf8" });
}

function curlJson(url) {
  return execFileSync("curl", ["-fsSL", "-H", "Accept: application/vnd.github+json", url], {
    encoding: "utf8",
  });
}

function getJson(apiPath) {
  try {
    return JSON.parse(ghJson(apiPath));
  } catch {
    return JSON.parse(curlJson(`https://api.github.com${apiPath}`));
  }
}

function tagCommitSha(ownerRepo, tag) {
  // Resolve the commit a lightweight/annotated tag points at.
  // Prefer gh (authenticated); fall back to public curl so self-hosted
  // runners without `gh auth` still verify public action pins.
  const ref = tag.startsWith("v") ? tag : `v${tag}`;
  try {
    const obj = getJson(`/repos/${ownerRepo}/git/ref/tags/${ref}`).object;
    if (obj.type === "commit") return obj.sha;
    if (obj.type === "tag") {
      return getJson(`/repos/${ownerRepo}/git/tags/${obj.sha}`).object.sha;
    }
    return null;
  } catch (e) {
    console.error(`  [pin-resolve] ${ownerRepo}@${tag}: ${e.message.split("\n")[0]}`);
    return null;
  }
}

for (const file of files) {
  const text = await readFile(file, "utf8");
  for (const m of text.matchAll(PIN_RE)) {
    const [, action, sha, tag] = m;
    const key = `${action}@${sha}`;
    if (!seen.has(key)) {
      seen.set(key, { action, sha, tag: tag ?? null, files: [file] });
    } else {
      seen.get(key).files.push(file);
    }
    // Cross-file consistency: same action, different SHA.
    for (const [otherKey, rec] of seen) {
      if (otherKey !== key && rec.action === action) {
        violations.push(
          `${action} pinned inconsistently: ${rec.sha} (${rec.files.join(", ")}) vs ${sha} (${file})`
        );
      }
    }
    if (tag) {
      const real = tagCommitSha(action, tag);
      if (!real) {
        violations.push(`${file}: cannot resolve tag ${tag} for ${action} (sha ${sha})`);
      } else if (real !== sha) {
        violations.push(
          `${file}: ${action}@${sha} claims # ${tag} but upstream tag ${tag} = ${real}`
        );
      }
    }
  }
}

if (violations.length > 0) {
  for (const v of [...new Set(violations)]) console.error(`PIN VIOLATION: ${v}`);
  console.error(`check-action-pins: ${new Set(violations).size} violation(s)`);
  process.exit(1);
}
console.log(
  `check-action-pins: OK (${seen.size} unique action pins across ${files.length} file(s))`
);
