#!/usr/bin/env node
/* eslint-disable */
// stamity — continue hook (Cursor).
//
// On stop, keeps an unattended run going on a Cursor agent machine: while a
// run in progress on this branch reads `Mode: unattended` and its last
// checkpoint line leaves units, it answers a followup_message naming the count
// and the record. Anything else, or a read it cannot finish, answers nothing.
// A stop whose status is aborted or error ends there. Never blocks; the hooks
// file caps the follow-ups at the row's loop_limit.
//
// Generated file — regenerate it rather than editing; local edits are overwritten.
// Trust posture: exec form, repo-committed, no dynamic evaluation, no network reach.
// Reads outside repo state: the stop payload's status on stdin and the
// CURSOR_AGENT_SOCKET and STAMITY_REPO_ROOT variables. Reads the run records
// and .git/HEAD; writes nothing.

import { closeSync, lstatSync, openSync, readFileSync, readSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const STATE_SEGMENTS = [".stamity"];
const RUNS_SEGMENTS = [".stamity","runs"];
const RECORD_FILE = "record.md";
const RUN_ID = new RegExp("^[0-9]{4}-[0-9]{2}-[0-9]{2}_[a-z0-9-]+$", "");
const STATUS = new RegExp("^status:\\s*(.*)$", "i");
const MODE = new RegExp("^mode:\\s*(attended|unattended)\\b", "i");
const BRANCH = new RegExp("^branch:\\s*(\\S+)", "i");
const IN_PROGRESS = new RegExp("\\bin progress\\b", "i");
const CHECKPOINT = new RegExp("^\\s*- +\\S+ +checkpoint: *\\S+ +units +done=\\S* +remaining=(\\S*)", "");
const CAPACITY_STOP = new RegExp("^\\s*- +\\S+ +capacity: .*(?:\\u2192|->) *BLOCKED_DEPENDENCY\\b", "");
const HEAD_LINES = 15;
const HEAD_READ_BYTES = 65536;
const RECORD_MAX_BYTES = 1048576;
const RUN_FOLDERS_MAX = 2000;
const FOLLOW_UP = "Continue the run: <m> units remain; the record is <path>.";
const FAULT_NOTE = "stamity cursor continue: <read> could not be read (<cause>), so the run is not continued.";

const HERE = dirname(fileURLToPath(import.meta.url));
const ANCHOR_SEGMENTS = ["hooks","generated",".stamity"];

/**
 * The repository root this script was emitted into, or "" when the script is not
 * sitting where emission puts one. Shape-checked rather than assumed: four levels
 * up from any directory is some directory, and only the emitted layout's own
 * parent segments make it a repository root.
 */
function derivedRoot() {
  let dir = dirname(HERE);
  for (const segment of ANCHOR_SEGMENTS) {
    if (basename(dir) !== segment) return "";
    dir = dirname(dir);
  }
  return dir;
}

function repoRoot() {
  const cwd = resolve(process.cwd());
  const derived = derivedRoot();
  if (derived !== "") return derived;
  const declared = process.env.STAMITY_REPO_ROOT;
  if (typeof declared !== "string" || declared === "") return cwd;
  const candidate = resolve(cwd, declared);
  const prefix = candidate.endsWith(sep) ? candidate : candidate + sep;
  if (candidate !== cwd && !cwd.startsWith(prefix)) return cwd;
  try {
    if (!statSync(join(candidate, STATE_SEGMENTS[0])).isDirectory()) return cwd;
  } catch {
    return cwd;
  }
  return candidate;
}

/** A record's status, mode and branch from its first HEAD_LINES lines; null when absent or not a regular file. */
function recordHead(path) {
  let stats;
  try {
    stats = lstatSync(path);
  } catch (error) {
    if (error && error.code === "ENOENT") return null;
    throw error;
  }
  if (!stats.isFile()) return null;
  const fd = openSync(path, "r");
  let text = "";
  try {
    const buffer = Buffer.alloc(Math.min(HEAD_READ_BYTES, stats.size));
    text = buffer.toString("utf8", 0, readSync(fd, buffer, 0, buffer.length, 0));
  } finally {
    closeSync(fd);
  }
  let status = null;
  let mode = null;
  let branch = null;
  for (const line of text.replace(/^\uFEFF/, "").split(/\r?\n/).slice(0, HEAD_LINES)) {
    status ??= STATUS.exec(line)?.[1] ?? null;
    mode ??= MODE.exec(line)?.[1].toLowerCase() ?? null;
    branch ??= BRANCH.exec(line)?.[1] ?? null;
  }
  return { inProgress: status !== null && IN_PROGRESS.test(status), mode, branch };
}

/** The heads of every run folder's record, each with its repo-relative path; no records folder holds none, more than RUN_FOLDERS_MAX throws. */
function recordHeads(root) {
  const runsDir = join(root, ...RUNS_SEGMENTS);
  let entries = [];
  try {
    if (lstatSync(runsDir).isDirectory()) entries = readdirSync(runsDir, { withFileTypes: true });
  } catch (error) {
    if (!error || (error.code !== "ENOENT" && error.code !== "ENOTDIR")) throw error;
  }
  // Every run folder's head, so no pile of folders named after an open record's pushes it out of the read.
  const names = entries
    .filter((entry) => entry.isDirectory() && RUN_ID.test(entry.name))
    .map((entry) => entry.name)
    .sort()
    .reverse();
  if (names.length > RUN_FOLDERS_MAX) {
    throw Object.assign(new Error("run folders"), { code: "RUN_FOLDERS_OVER_" + RUN_FOLDERS_MAX, path: runsDir });
  }
  const heads = [];
  for (const name of names) {
    const head = recordHead(join(runsDir, name, RECORD_FILE));
    if (head !== null) heads.push({ ...head, run: name, path: [...RUNS_SEGMENTS, name, RECORD_FILE].join("/") });
  }
  return heads;
}

/** The branch .git/HEAD names; null when none is named. Throws on a read failing past absence. */
function cardCurrentBranch(rootDir) {
  const read = (path) => {
    let stats;
    try {
      stats = lstatSync(path);
    } catch (error) {
      if (error && (error.code === "ENOENT" || error.code === "ENOTDIR")) return null;
      throw error;
    }
    return stats.isFile() && stats.size <= 4096 ? readFileSync(path, "utf8").trim() : null;
  };
  const dotGit = join(rootDir, ".git");
  let gitDir = dotGit;
  let stats;
  try {
    stats = lstatSync(dotGit);
  } catch (error) {
    if (error && (error.code === "ENOENT" || error.code === "ENOTDIR")) return null;
    throw error;
  }
  if (!stats.isDirectory()) {
    const pointer = /^gitdir:[ \t]*(.+)$/.exec((read(dotGit) ?? "").split(/\r?\n/)[0]);
    if (pointer === null) return null;
    const target = pointer[1].trim();
    gitDir = isAbsolute(target) ? target : resolve(rootDir, target);
  }
  const branch = /^ref: refs\/heads\/(.+)$/.exec(read(join(gitDir, "HEAD")) ?? "")?.[1] ?? null;
  return branch === ".invalid" ? null : branch;
}

/**
 * The units a record's last checkpoint line leaves, above 0; null when none is left, its count is not digits, no line
 * is there, or the newest capacity stop has at most one checkpoint line after it (its own: the run waits for a reset).
 */
function unitsLeft(path) {
  const stats = lstatSync(path);
  if (!stats.isFile()) return null;
  if (stats.size > RECORD_MAX_BYTES) throw Object.assign(new Error("record"), { code: "RECORD_TOO_LARGE", path });
  const fd = openSync(path, "r");
  let text = "";
  try {
    const buffer = Buffer.alloc(stats.size);
    text = buffer.toString("utf8", 0, readSync(fd, buffer, 0, buffer.length, 0));
  } finally {
    closeSync(fd);
  }
  let left = null;
  let sinceStop = null;
  for (const line of text.split(/\r?\n/)) {
    if (CAPACITY_STOP.test(line)) sinceStop = 0;
    const count = CHECKPOINT.exec(line)?.[1];
    if (count === undefined) continue;
    left = count;
    if (sinceStop !== null) sinceStop += 1;
  }
  if (sinceStop !== null && sinceStop <= 1) return null;
  return left !== null && /^[0-9]{1,9}$/.test(left) && Number(left) > 0 ? Number(left) : null;
}

/** The follow-up this stop earns, or null when the agent stops. */
function followUp() {
  // A Cursor agent machine only: a local session on a branch carrying such a record is never steered.
  if (["", "false", "0"].includes(process.env.CURSOR_AGENT_SOCKET ?? "")) return null;
  // A completed stop only, or one whose payload names no status: an aborted or failed one is not continued.
  const raw = readFileSync(0, "utf8");
  const status = raw.trim() === "" ? undefined : JSON.parse(raw)?.status;
  if (status !== undefined && status !== "completed") return null;
  const root = repoRoot();
  const branch = cardCurrentBranch(root);
  if (branch === null) return null;
  // No order among records: a run id carries only the date, so two runs of one day would rank by slug.
  for (const head of recordHeads(root)) {
    if (!head.inProgress || head.mode !== "unattended" || head.branch !== branch) continue;
    const left = unitsLeft(join(root, ...RUNS_SEGMENTS, head.run, RECORD_FILE));
    // Digits and the folder-built path only: no text read from the record reaches the agent's next prompt.
    if (left !== null) return FOLLOW_UP.replace("<m>", () => String(left)).replace("<path>", () => head.path);
  }
  return null;
}

let message = null;
try {
  message = followUp();
} catch (error) {
  // Never a gate: a read this hook could not finish stops the run here, and one line says which read failed.
  const syntax = error instanceof SyntaxError;
  const read = syntax ? "the hook payload" : error && typeof error.path === "string" ? error.path : "an input";
  const cause = syntax ? "not JSON" : error && error.code ? String(error.code) : (error && error.name) || "a fault";
  const note = FAULT_NOTE.replace("<read>", () => read).replace("<cause>", () => cause);
  process.stderr.write(note.replace(/[\u0000-\u001f\u007f]/g, "?") + "\n");
}
if (message !== null) process.stdout.write(JSON.stringify({ followup_message: message }) + "\n");
