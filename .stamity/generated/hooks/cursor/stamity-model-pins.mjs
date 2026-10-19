#!/usr/bin/env node
/* eslint-disable */
// stamity — model-fill hook for sub-agent calls.
//
// Wired on preToolUse for Task. When a call spawns one of this setup's agents
// and names no model, it answers with the call's input plus the model the
// class-to-model map below gives that agent's class, which only an operator's
// pin puts there; every other call is allowed unchanged. It always allows, as
// valid JSON, and never blocks.
//
// Generated file — regenerate it rather than editing; local edits are overwritten.
// Trust posture: exec form, repo-committed, no dynamic evaluation, no network
// reach, and output determined by repo state alone.

import { readFileSync } from "node:fs";

const NAMESPACE = "stamity-";
const TOOL = "Task";
const MAP = {
  "classes": {
    "frontier": {
      "fallbacks": []
    },
    "advanced": {
      "fallbacks": []
    },
    "standard": {
      "fallbacks": []
    },
    "economy": {
      "fallbacks": []
    }
  },
  "roles": {
    "stamity-creator": "standard",
    "stamity-design-quality": "advanced",
    "stamity-fixer": "standard",
    "stamity-implementer": "advanced",
    "stamity-performance": "standard",
    "stamity-researcher": "standard",
    "stamity-reviewer": "advanced",
    "stamity-security": "advanced",
    "stamity-spec-author": "advanced",
    "stamity-test-runner": "economy"
  }
};

function reasonOf(err) {
  if (err === null || err === undefined) return "unknown error";
  const message = typeof err === "object" && typeof err.message === "string" ? err.message : String(err);
  const code = typeof err === "object" && typeof err.code === "string" ? err.code + ": " : "";
  return code + message;
}

function readPayload() {
  let raw = "";
  try {
    raw = readFileSync(0, "utf8");
  } catch (err) {
    return { payload: {}, problem: "stdin was unreadable (" + reasonOf(err) + ")" };
  }
  if (raw.trim() === "") return { payload: {}, problem: "stdin carried no payload" };
  try {
    const parsed = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { payload: {}, problem: "payload was not a JSON object" };
    }
    return { payload: parsed, problem: null };
  } catch (err) {
    return { payload: {}, problem: "payload was not valid JSON (" + reasonOf(err) + ")" };
  }
}

function notice(hook, event) {
  process.stderr.write(JSON.stringify({ hook, ...event }) + "\n");
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// The class's model for a Task call that names none, or null to leave the call as it is.
function modelFor(payload) {
  if (payload.tool_name !== TOOL) return null;
  const input = payload.tool_input;
  if (!isObject(input) || (input.model !== undefined && input.model !== null)) return null;
  const agentId = input.subagent_type;
  if (typeof agentId !== "string" || !agentId.startsWith(NAMESPACE) || !Object.hasOwn(MAP.roles, agentId)) return null;
  const modelClass = MAP.roles[agentId];
  const entry = Object.hasOwn(MAP.classes, modelClass) ? MAP.classes[modelClass] : undefined;
  return isObject(entry) && typeof entry.model === "string" ? entry.model : null;
}

let answer = { permission: "allow" };
try {
  const { payload, problem } = readPayload();
  if (problem !== null) {
    notice("stamity-cursor-model-pins", { reasonCode: "TASK_PAYLOAD_UNUSABLE", detail: problem, at: new Date().toISOString() });
  } else {
    const model = modelFor(payload);
    if (model !== null) answer = { permission: "allow", updated_input: { ...payload.tool_input, model } };
  }
} catch (err) {
  notice("stamity-cursor-model-pins", { reasonCode: "MODEL_FILL_FAILED", detail: reasonOf(err), at: new Date().toISOString() });
}
process.stdout.write(JSON.stringify(answer));
