/**
 * Authenticated screenshot + smoke capture for the demo personas.
 *
 * Signs each persona in with a single-use Clerk sign-in token (minted from
 * CLERK_SECRET_KEY in apps/web/.env.local — the key and token are never printed),
 * then loads every listed route in one headless Chrome over CDP and writes a
 * full-page PNG to docs/demo/screenshots/app/ plus a text dump to the OS temp dir.
 * Any route that renders an error boundary, a 404 or the sign-in page is reported.
 *
 * Usage (dev server running):
 *   bun run capture:demo                       # all personas, default route set
 *   BASE=https://unisphere-hazel.vercel.app bun run capture:demo   # against a deployment
 *
 * Requires Google Chrome on this machine (CHROME_BIN overrides the path).
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "../../..");
const ENV_PATH = resolve(HERE, "../.env.local");
const SHOTS = resolve(REPO, "docs/demo/screenshots/app");
const TMP = process.env.TMPDIR || process.env.TEMP || "/tmp";
const DOMDIR = resolve(TMP, "unisphere-capture/dom");
const PROFILE_ROOT = resolve(TMP, "unisphere-capture/profiles");

const CHROME = process.env.CHROME_BIN || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = (process.env.BASE || "http://localhost:3000").replace(/\/$/, "");
const PORT = Number(process.env.CDP_PORT || 9555);

const PERSONAS = [
  {
    persona: "student",
    email: "student@shu.edu.pk",
    pages: [
      "/dashboard",
      "/timetable",
      "/exams",
      "/planning",
      "/attendance",
      "/marks",
      "/clashes",
      "/messages",
      "/forms",
      "/submissions",
      "/complaints",
      "/notifications",
      "/fyp",
      "/resources/my",
      "/resources/request",
      "/internships",
      "/mentorship",
      "/chat",
      "/profile",
    ],
  },
  {
    persona: "coordinator",
    email: "coordinator@shu.edu.pk",
    pages: [
      "/dashboard",
      "/coordinator/clashes",
      "/coordinator/timetable",
      "/coordinator/exams",
      "/coordinator/approvals",
      "/coordinator/faculty",
      "/coordinator/students",
      "/coordinator/complaints",
      "/messages",
      "/admin/broadcast",
      "/profile",
    ],
  },
  {
    persona: "faculty",
    email: "faculty@shu.edu.pk",
    pages: [
      "/dashboard",
      "/faculty/attendance",
      "/faculty/marks",
      "/faculty/students",
      "/faculty/fyp",
      "/messages",
      "/faculty/reviews",
      "/faculty/courses",
      "/faculty/complaints",
      "/reviews",
    ],
  },
  {
    persona: "fyphead",
    email: "fyphead@shu.edu.pk",
    pages: [
      "/dashboard",
      "/fyphead",
      "/admin/fyp",
      "/admin/requests",
      "/admin/allocations",
      "/admin/labs",
      "/admin/inventory",
      "/admin/reports",
      "/admin/audit",
      "/messages",
      "/profile",
    ],
  },
  {
    persona: "mentor",
    email: "mentor@shu.edu.pk",
    pages: ["/dashboard", "/mentor", "/mentorship", "/messages", "/profile"],
  },
  {
    persona: "admin",
    email: "admin@shu.edu.pk",
    pages: [
      "/dashboard",
      "/admin/users",
      "/admin/forms",
      "/admin/audit",
      "/admin/reports",
      "/coordinator/clashes",
      "/coordinator/timetable",
      "/coordinator/exams",
      "/messages",
      "/profile",
    ],
  },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function readEnv() {
  const out = {};
  if (!existsSync(ENV_PATH)) return out;
  for (const line of readFileSync(ENV_PATH, "utf8").split(/\r?\n/)) {
    if (!line.includes("=") || line.trim().startsWith("#")) continue;
    const i = line.indexOf("=");
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

async function mintTicket(email, secret) {
  const headers = { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" };
  let userId = null;
  for (let page = 0; page < 5 && !userId; page++) {
    const res = await fetch(`https://api.clerk.com/v1/users?limit=100&offset=${page * 100}`, { headers });
    if (!res.ok) throw new Error(`clerk users list HTTP ${res.status}`);
    const users = await res.json();
    if (!Array.isArray(users) || users.length === 0) break;
    const hit = users.find((u) => (u.email_addresses || []).some((e) => e.email_address === email));
    if (hit) userId = hit.id;
    if (users.length < 100) break;
  }
  if (!userId) throw new Error(`no Clerk user for ${email}`);
  const mint = await fetch("https://api.clerk.com/v1/sign_in_tokens", {
    method: "POST",
    headers,
    body: JSON.stringify({ user_id: userId, expires_in_seconds: 300 }),
  });
  const token = await mint.json();
  if (!mint.ok || !token.token) throw new Error(`mint failed HTTP ${mint.status}`);
  return token.token;
}

// ---------- CDP client ----------
function cdpClient(ws) {
  let msgId = 0;
  const pending = new Map();
  const events = new Map();
  ws.onmessage = (m) => {
    const data = JSON.parse(m.data);
    if (data.id && pending.has(data.id)) {
      const { resolve: res, reject: rej } = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) rej(new Error(data.error.message));
      else res(data.result);
    } else if (data.method && events.has(data.method)) {
      const list = events.get(data.method);
      events.set(data.method, []);
      for (const fn of list) fn();
    }
  };
  return {
    send(method, params = {}) {
      const id = ++msgId;
      return new Promise((res, rej) => {
        pending.set(id, { resolve: res, reject: rej });
        ws.send(JSON.stringify({ id, method, params }));
      });
    },
    waitEvent(name, timeoutMs = 20000) {
      return new Promise((res) => {
        const t = setTimeout(() => res(null), timeoutMs);
        const list = events.get(name) || [];
        list.push(() => {
          clearTimeout(t);
          res(true);
        });
        events.set(name, list);
      });
    },
  };
}

async function capturePersona(persona, email, pages, secret) {
  const profile = resolve(PROFILE_ROOT, persona);
  mkdirSync(profile, { recursive: true });

  const chrome = spawn(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-first-run",
      "--no-default-browser-check",
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${profile}`,
      "--window-size=1440,1400",
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  let version = null;
  for (let i = 0; i < 60 && !version; i++) {
    try {
      version = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
    } catch {
      await sleep(250);
    }
  }
  if (!version) throw new Error("chrome never exposed the CDP port");

  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = () => rej(new Error("cdp ws failed"));
  });
  const cdp = cdpClient(ws);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");

  const goto = async (url, settle = 1800) => {
    const loaded = cdp.waitEvent("Page.loadEventFired");
    await cdp.send("Page.navigate", { url });
    await loaded;
    await sleep(settle);
  };
  const bodyText = async () =>
    (await cdp.send("Runtime.evaluate", { expression: "document.body.innerText", returnByValue: true })).result?.value ||
    "";
  const shot = async (file) => {
    const r = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
    writeFileSync(file, Buffer.from(r.data, "base64"));
  };

  const authed = (t) => /overview/i.test(t) && !/sign in to unisphere/i.test(t);

  await goto(`${BASE}/dashboard`, 2500);
  let body = await bodyText();
  if (!authed(body)) {
    const ticket = await mintTicket(email, secret);
    console.log(`  sign-in needed → minting token for ${email}`);
    await goto(`${BASE}/sign-in?__clerk_ticket=${ticket}`, 6000);
    await goto(`${BASE}/dashboard`, 2500);
    body = await bodyText();
    if (!authed(body)) throw new Error(`sign-in failed for ${email}`);
  }

  let ok = 0;
  let bad = 0;
  for (const page of pages) {
    const name = `${persona}-${page.replace(/^\//, "").replaceAll("/", "-")}`;
    try {
      await goto(BASE + page);
      body = await bodyText();
      writeFileSync(resolve(DOMDIR, `${name}.txt`), body);
      const err = body.match(
        /Application error|Unhandled Runtime Error|Internal Server Error|This page could not be found/,
      );
      const lost = /sign in to unisphere/i.test(body);
      if (!err && !lost) await shot(resolve(SHOTS, `${name}.png`));
      const status = err ? `ERROR(${err[0]})` : lost ? "AUTH_LOST" : "OK";
      if (status === "OK") ok++;
      else bad++;
      console.log(`  ${status.padEnd(8)} ${name}`);
    } catch (e) {
      bad++;
      console.log(`  THREW    ${name} ${String(e).slice(0, 100)}`);
    }
  }
  chrome.kill();
  await sleep(400);
  return { ok, bad };
}

async function main() {
  mkdirSync(SHOTS, { recursive: true });
  mkdirSync(DOMDIR, { recursive: true });
  const env = readEnv();
  const secret = env.CLERK_SECRET_KEY;
  if (!secret) {
    console.error(`CLERK_SECRET_KEY missing in ${ENV_PATH}`);
    process.exit(2);
  }
  if (!existsSync(CHROME)) {
    console.error(`Chrome not found at ${CHROME} — set CHROME_BIN`);
    process.exit(3);
  }

  const only = process.env.PERSONAS ? process.env.PERSONAS.split(",").map((s) => s.trim()) : null;
  const list = only ? PERSONAS.filter((p) => only.includes(p.persona)) : PERSONAS;

  let ok = 0;
  let bad = 0;
  for (const p of list) {
    console.log(`\n== ${p.persona} (${p.email})`);
    const r = await capturePersona(p.persona, p.email, p.pages, secret);
    ok += r.ok;
    bad += r.bad;
  }
  console.log(`\nCaptured ${ok} pages, ${bad} problems → ${SHOTS}`);
  console.log(`Text dumps: ${DOMDIR}`);
  process.exit(bad > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("fatal:", e);
  process.exit(9);
});
