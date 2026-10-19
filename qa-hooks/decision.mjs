#!/usr/bin/env node
// QA instrument, written by scripts/qa/fixtures.mjs. Not a product hook.
//
// Records every tool call it is handed, and refuses the one that mentions qa-denied.txt.
// The refusal is exit 2 plus a reason on stderr — the block every client
// this engine emits for honours.

import { appendFileSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const LOG = fileURLToPath(new URL('../qa-observations.jsonl', import.meta.url))
const DENIED = "qa-denied.txt"
const ALLOWED = "qa-allowed.txt"

let raw = ''
try {
  raw = readFileSync(0, 'utf8')
} catch (error) {
  // No stdin is a real client shape (some events pass nothing), so the call is still recorded —
  // with the read failure named, so an empty payload and an unreadable one never look alike.
  raw = JSON.stringify({ qaStdinError: String(error && error.message ? error.message : error) })
}

let payload = {}
try {
  payload = JSON.parse(raw)
} catch {
  // An unparseable payload is still a call the hook saw. The raw text is scanned as-is below.
  payload = {}
}

const tool =
  typeof payload.tool_name === 'string' ? payload.tool_name
  : typeof payload.toolName === 'string' ? payload.toolName
  : typeof payload.tool === 'string' ? payload.tool
  : ''
const mentionsDenied = raw.includes(DENIED)
const mentionsAllowed = raw.includes(ALLOWED)
const decision = mentionsDenied ? 'denied' : mentionsAllowed ? 'allowed' : 'unmatched'

appendFileSync(
  LOG,
  JSON.stringify({
    at: new Date().toISOString(),
    tool,
    decision,
    mentionsDenied,
    mentionsAllowed,
    payloadBytes: raw.length,
  }) + '\n',
)

if (decision === 'denied') {
  process.stderr.write(
    JSON.stringify({
      hook: 'qa-decision',
      blocked: true,
      permissionDecision: 'deny',
      permissionDecisionReason: 'QA instrument: ' + DENIED + ' is refused by this repository\'s hook.',
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: 'QA instrument: ' + DENIED + ' is refused by this repository\'s hook.',
      },
    }) + '\n',
  )
  process.exitCode = 2
}
