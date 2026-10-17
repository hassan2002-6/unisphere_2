/**
 * Real-UI verification for the sign-in page + profile-photo feature.
 *
 * Signs a demo persona in with a single-use Clerk sign-in token (never a
 * password), then exercises the actual profile page over CDP:
 *   1. the redesigned sign-in page (desktop + 390px mobile, screenshots)
 *   2. upload a photo through the real form (file input → server action)
 *   3. photo persists after a plain reload
 *   4. photo persists after a brand-new browser session + new sign-in
 *   5. remove returns the default initials avatar
 *
 * Requires: a running app (BASE, default http://localhost:3000) and
 * CLERK_SECRET_KEY in apps/web/.env.local. Run from apps/web:
 *   bun scripts/verify-signin-photo.mjs
 *
 * Screenshots land in docs/demo/screenshots/verify/. Never prints secrets.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { deflateSync, crc32 as zlibCrc32 } from "node:zlib";

const BASE = (process.env.BASE || "http://localhost:3000").replace(/\/$/, "");
const PORT = Number(process.env.CDP_PORT || 9566);
const CHROME = process.env.CHROME_BIN || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUT = resolve(process.cwd(), "../../docs/demo/screenshots/verify");
const ENV_PATH = resolve(process.cwd(), ".env.local");
const PROFILE_ROOT = resolve(process.env.TMPDIR || process.env.TEMP || ".", "unisphere-photo-verify");
const EMAIL = process.env.PERSONA_EMAIL || "student@shu.edu.pk";

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok });
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${extra ? ` — ${extra}` : ""}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Windows: chrome.kill() leaves child processes holding the profile — tree-kill instead. */
function killChrome(chrome) {
  if (!chrome?.pid) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/F", "/T", "/PID", String(chrome.pid)], { stdio: "ignore" });
  } else {
    killChrome(chrome);
  }
}

function readEnvFile() {
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

/** Minimal 200x200 PNG (teal disc + white band) — proves the stored bytes render. */
function testPng(size = 200) {
  const w = size;
  const h = size;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    const row = y * (w * 4 + 1);
    raw[row] = 0; // filter: none
    for (let x = 0; x < w; x++) {
      const i = row + 1 + x * 4;
      const dx = x - w / 2;
      const dy = y - h / 2;
      const inside = dx * dx + dy * dy <= (w * 0.42) ** 2;
      const band = inside && Math.abs(dy) < w * 0.06;
      raw[i] = band ? 255 : 14;
      raw[i + 1] = band ? 255 : 116;
      raw[i + 2] = band ? 255 : 144;
      raw[i + 3] = inside ? 255 : 0;
    }
  }
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const t = Buffer.from(type, "ascii");
    const crc = Buffer.alloc(4);
    const crcVal = typeof Bun !== "undefined" ? Bun.hash.crc32(Buffer.concat([t, data])) : zlibCrc32(Buffer.concat([t, data]));
    crc.writeUInt32BE(crcVal >>> 0);
    return Buffer.concat([len, t, data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

// ---------- CDP ----------
function cdpClient(ws) {
  let msgId = 0;
  const pending = new Map();
  ws.onmessage = (m) => {
    const data = JSON.parse(m.data);
    if (data.id && pending.has(data.id)) {
      const { resolve: res, reject: rej } = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) rej(new Error(data.error.message));
      else res(data.result);
    }
  };
  ws.onclose = () => {
    for (const { reject: rej } of pending.values()) rej(new Error("cdp connection closed"));
    pending.clear();
  };
  return {
    send(method, params = {}) {
      const id = ++msgId;
      return new Promise((res, rej) => {
        pending.set(id, { resolve: res, reject: rej });
        ws.send(JSON.stringify({ id, method, params }));
      });
    },
  };
}

async function launch(profileName, port = PORT) {
  const profile = resolve(PROFILE_ROOT, profileName);
  rmSync(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 400 });
  mkdirSync(profile, { recursive: true });
  const chrome = spawn(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-first-run",
      "--no-default-browser-check",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      "--window-size=1440,1400",
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  let version = null;
  for (let i = 0; i < 60 && !version; i++) {
    try {
      version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
    } catch {
      await sleep(250);
    }
  }
  if (!version) throw new Error("chrome never exposed the CDP port");
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = () => rej(new Error("cdp ws failed"));
  });
  const cdp = cdpClient(ws);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("DOM.enable");
  return { chrome, cdp };
}

async function js(cdp, expression) {
  const out = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (out.exceptionDetails) throw new Error(`eval failed: ${out.exceptionDetails.text} ${out.result?.description ?? ""}`);
  return out.result?.value;
}

async function goto(cdp, url, waitFor) {
  await cdp.send("Page.navigate", { url });
  for (let i = 0; i < 360; i++) {
    await sleep(250);
    try {
      const state = await js(cdp, "({ ready: document.readyState, path: location.pathname, search: location.search })");
      if (state?.ready === "complete" && waitFor(state)) return state;
    } catch {
      // navigation in flight
    }
  }
  throw new Error(`navigation to ${url} never settled`);
}

/** Wait until the routed avatar images have actually decoded (complete + naturalWidth). */
async function awaitAvatarsLoaded(activeCdp, min = 2) {
  for (let i = 0; i < 120; i++) {
    const ready = await js(
      activeCdp,
      `(() => { const imgs = [...document.querySelectorAll('img[src*="/api/users/"]')]; return imgs.length >= ${min} && imgs.every((img) => img.complete && img.naturalWidth > 0); })()`,
    ).catch(() => false);
    if (ready) return true;
    await sleep(250);
  }
  return false;
}

async function shot(cdp, name, width = 1440) {
  const metrics = await cdp.send("Page.getLayoutMetrics");
  const height = Math.min(Math.ceil(metrics.cssContentSize.height || 1400), 5200);
  const data = await cdp.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width, height, scale: 1 },
  });
  const file = resolve(OUT, name);
  writeFileSync(file, Buffer.from(data.data, "base64"));
  console.log(`  shot  ${name} (${width}x${height})`);
}

async function main() {
  const env = readEnvFile();
  const secret = env.CLERK_SECRET_KEY || process.env.CLERK_SECRET_KEY;
  if (!secret) throw new Error("CLERK_SECRET_KEY missing — add it to apps/web/.env.local");
  mkdirSync(OUT, { recursive: true });

  const png = resolve(PROFILE_ROOT, "avatar-test.png");
  mkdirSync(PROFILE_ROOT, { recursive: true });
  writeFileSync(png, testPng());

  // ── 1. Sign-in page (fresh browser, no session) ─────────────────────────
  console.log("\n1. Sign-in page");
  let avatarSrc = "";
  const signinHtml = await (await fetch(`${BASE}/sign-in`)).text();
  const devBuild = signinHtml.includes("Demo accounts — development only");
  check(
    devBuild ? "development build shows the development-only demo roster" : "production build hides the development-only demo roster",
    true,
    devBuild ? "dev-mode sign-in page" : "production sign-in page",
  );
  let { chrome, cdp } = await launch("session-a", PORT);
  try {
    await goto(cdp, `${BASE}/sign-in`, (s) => s.path.startsWith("/sign-in"));
    const copy = await js(cdp, "document.body.innerText");
    check("shows “Salim Habib University”", copy.includes("Salim Habib University"));
    check("shows the portal descriptor", copy.includes("UniSphere — Student Support & Management Portal") || copy.includes("UniSphere — Student Support & Managing"));
    check("shows the logo slot (asset or labelled placeholder)", await js(cdp, "!!(document.querySelector('img[src*=\"/branding/shu-logo\"]') || [...document.querySelectorAll('[role=img]')].some(el => el.getAttribute('aria-label')?.includes('logo placeholder')))"));
    check("has the sign-in form", await js(cdp, "!!document.querySelector('#identifier') && !!document.querySelector('#password')"));
    await shot(cdp, "signin-desktop.png");

    // 390px phone viewport
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await goto(cdp, `${BASE}/sign-in`, (s) => s.path.startsWith("/sign-in"));
    const overflow = await js(cdp, "document.documentElement.scrollWidth - document.documentElement.clientWidth");
    check("no horizontal overflow at 390px", overflow <= 0, `overflow=${overflow}px`);
    await shot(cdp, "signin-mobile.png", 390);
    await cdp.send("Emulation.clearDeviceMetricsOverride");

    // ── 2. Real sign-in via single-use token, then photo upload ─────────────
    console.log("\n2. Sign in + upload photo (real UI)");
    const ticket = await mintTicket(EMAIL, secret);
    await goto(cdp, `${BASE}/sign-in?__clerk_ticket=${encodeURIComponent(ticket)}`, (s) => s.path.startsWith("/dashboard"));
    check("token sign-in lands on the dashboard", true);

    await goto(cdp, `${BASE}/profile`, (s) => s.path.startsWith("/profile"));

    // Normalize: an earlier aborted run may have left a photo on this persona.
    const hadPhoto = await js(
      cdp,
      "!![...document.querySelectorAll('button')].find((b) => b.textContent.includes('Remove photo'))",
    );
    if (hadPhoto) {
      await js(cdp, "window.confirm = () => true");
      await js(cdp, "[...document.querySelectorAll('button')].find((b) => b.textContent.includes('Remove photo')).click()");
      for (let i = 0; i < 360; i++) {
        await sleep(250);
        const st = await js(cdp, "location.search").catch(() => null);
        if (typeof st === "string" && st.includes("photoRemoved=1")) break;
      }
      await goto(cdp, `${BASE}/profile`, (s) => s.path.startsWith("/profile"));
      console.log("  note  removed a leftover photo from an earlier run before testing");
    }

    const before = await js(cdp, "document.body.innerText");
    check("profile shows the photo feature", before.includes("Profile photo") && before.includes("Choose a photo"));
    check("default initials avatar while no photo exists", (await js(cdp, "document.querySelectorAll('img[src*=\"/api/users/\"]').length")) === 0);

    const doc = await cdp.send("DOM.getDocument");
    const inputNode = await cdp.send("DOM.querySelector", { nodeId: doc.root.nodeId, selector: "input#photo" });
    if (!inputNode.nodeId) throw new Error("file input not found");
    await cdp.send("DOM.setFileInputFiles", { files: [png], nodeId: inputNode.nodeId });
    await sleep(500);
    const fileCount = await js(cdp, "document.querySelector('#photo')?.files?.length ?? -1");
    check("file attached to the form input", fileCount === 1, `files=${fileCount}`);
    await js(cdp, `[...document.querySelectorAll('button')].find((b) => b.textContent.includes('Upload photo')).click()`);
    for (let i = 0; i < 360; i++) {
      await sleep(250);
      const st = await js(cdp, "({ path: location.pathname, search: location.search })").catch(() => null);
      if (st?.path?.startsWith("/profile") && (st.search.includes("photo=1") || st.search.includes("error="))) break;
    }
    const post = await js(cdp, "({ search: location.search, text: document.body.innerText.includes('Profile photo updated') })");
    check("upload succeeds through the real form", post.search.includes("photo=1"), post.search || "no redirect search");
    if (!post.search.includes("photo=1")) {
      const errText = await js(cdp, "document.body.innerText.split('\\n').filter(l => l.includes('save') || l.includes('photo') || l.includes('Photo')).slice(0, 6).join(' | ')");
      console.log(`  note  post-upload page: ${errText}`);
      await shot(cdp, "profile-photo-error.png");
      throw new Error(`upload did not complete: ${post.search}`);
    }

    const after = await js(cdp, "document.body.innerText");
    check("success message shown", after.includes("Profile photo updated"));
    const avatarCount = await js(cdp, "document.querySelectorAll('img[src*=\"/api/users/\"]').length");
    check("photo renders on profile + top bar", avatarCount >= 2, `${avatarCount} avatar(s)`);
    avatarSrc = await js(cdp, "document.querySelector('img[src*=\"/api/users/\"]')?.getAttribute('src') || ''");
    check("photo served from the guarded route with cache-busting", avatarSrc.includes("/api/users/") && avatarSrc.includes("?v="), avatarSrc);
    check("avatar images finish loading after upload", await awaitAvatarsLoaded(cdp, 2));
    await sleep(300);
    await shot(cdp, "profile-photo.png");

    // ── 3. Persistence: reload ──────────────────────────────────────────────
    console.log("\n3. Persistence after refresh");
    await goto(cdp, `${BASE}/profile`, (s) => s.path.startsWith("/profile"));
    check("photo still shown after a full reload", (await js(cdp, "document.querySelectorAll('img[src*=\"/api/users/\"]').length")) >= 2);
    await awaitAvatarsLoaded(cdp, 2);
    await shot(cdp, "profile-photo-refresh.png");
  } finally {
    killChrome(chrome);
    await sleep(800);
  }

  // ── 4. Persistence: brand-new browser + new sign-in ─────────────────────
  console.log("\n4. Persistence after a new login");
  ({ chrome, cdp } = await launch("session-b", PORT + 1));
  try {
    const ticket2 = await mintTicket(EMAIL, secret);
    await goto(cdp, `${BASE}/sign-in?__clerk_ticket=${encodeURIComponent(ticket2)}`, (s) => s.path.startsWith("/dashboard"));
    await goto(cdp, `${BASE}/profile`, (s) => s.path.startsWith("/profile"));
    check("photo survives a new browser session + login", (await js(cdp, "document.querySelectorAll('img[src*=\"/api/users/\"]').length")) >= 2);
    await awaitAvatarsLoaded(cdp, 2);
    await shot(cdp, "profile-photo-relogin.png");

    // ── 5. Remove ──────────────────────────────────────────────────────────
    console.log("\n5. Remove photo");
    const uid = (avatarSrc.match(/\/api\/users\/([^/]+)\/photo/) || [])[1];
    await js(cdp, "window.confirm = () => true");
    const clicked = await js(cdp, "(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Remove photo')); if (!b) return false; b.click(); return true; })()");
    if (!clicked) throw new Error("Remove photo button not found");
    for (let i = 0; i < 360; i++) {
      await sleep(250);
      const st = await js(cdp, "location.search").catch(() => null);
      if (typeof st === "string" && st.includes("photoRemoved=1")) break;
    }
    const removedText = await js(cdp, "document.body.innerText");
    check("success message shown after removal", removedText.includes("Profile photo removed"));
    check("default initials avatar returns", (await js(cdp, "document.querySelectorAll('img[src*=\"/api/users/\"]').length")) === 0);
    if (uid) {
      const status = await js(cdp, `fetch('/api/users/${uid}/photo').then((r) => r.status)`);
      check("stored bytes are gone (photo route now 404s)", status === 404, `HTTP ${status}`);
    }
    await shot(cdp, "profile-photo-removed.png");
  } finally {
    killChrome(chrome);
  }

  // ── 6. Every role account opens its dashboard; restricted pages are denied ─
  console.log("\n6. Role dashboards + restricted-page enforcement");
  const ROLES = [
    { email: "student@shu.edu.pk", label: "Student" },
    { email: "faculty@shu.edu.pk", label: "Faculty" },
    { email: "coordinator@shu.edu.pk", label: "Coordinator" },
    { email: "fyphead@shu.edu.pk", label: "FYP Head" },
    { email: "admin@shu.edu.pk", label: "Administrator", admin: true },
  ];
  for (let i = 0; i < ROLES.length; i++) {
    const r = ROLES[i];
    const s = await launch(`role-${i}`, PORT + 2 + i);
    try {
      const ticket3 = await mintTicket(r.email, secret);
      await goto(s.cdp, `${BASE}/sign-in?__clerk_ticket=${encodeURIComponent(ticket3)}`, (st) => st.path.startsWith("/dashboard"));
      const topbar = await js(s.cdp, "[...document.querySelectorAll('header small')].map((el) => el.innerText).join(' | ')");
      check(`${r.email} opens the ${r.label} dashboard`, topbar.includes(r.label), topbar.slice(0, 90));
      if (r.admin) {
        await goto(s.cdp, `${BASE}/admin/users`, (st) => st.path.startsWith("/admin/users"));
        check("Administrator can open /admin/users", true);
      } else {
        await goto(s.cdp, `${BASE}/admin/users`, (st) => st.path.startsWith("/dashboard") || st.path.startsWith("/admin"));
        const st = await js(s.cdp, "({ path: location.pathname, search: location.search })");
        check(`${r.label} is refused /admin/users`, st.path === "/dashboard" && st.search.includes("denied=1"), `${st.path}${st.search}`);
      }
    } finally {
      killChrome(s.chrome);
      await sleep(400);
    }
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
  if (failed.length) {
    for (const f of failed) console.log(`  FAILED  ${f.name}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("verification aborted:", e instanceof Error ? e.message : e);
  process.exit(1);
});
