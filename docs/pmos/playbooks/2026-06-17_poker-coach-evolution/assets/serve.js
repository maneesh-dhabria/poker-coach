#!/usr/bin/env node
// serve.js — zero-deps static server for a feature folder. FR-06, FR-44, FR-45, NFR-07.
// Usage: cd <feature-folder> && node assets/serve.js
//        node assets/serve.js [--port N] [--pid-file FILE] [--idle SEC] [--root DIR]
// Notes:
//   * --pid-file writes atomic JSON {pid, port, started_at} after listen().
//   * --port-file is a deprecated alias for --pid-file (kept one release per Decision P2).
//   * --idle (default 300s) — server self-shuts if no request arrives in that window.
//   * Hard-binds 127.0.0.1; any --host other than 127.0.0.1 is rejected (FR-45).

'use strict';

const http = require('http');
const fs   = require('fs');
const path = require('path');
const url  = require('url');
const { jsonInlineEscape } = require('../render.js');

const MAX_SAVE_BYTES = 5 * 1024 * 1024; // 5MB cap on POST /save body
const COMMENTS_RE = /<!-- pmos-comments:start -->[\s\S]*?<script id="pmos-comments" type="application\/json">([\s\S]*?)<\/script>[\s\S]*?<!-- pmos-comments:end -->/;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm':  'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif':  'image/gif',
  '.ico':  'image/x-icon',
  '.md':   'text/plain; charset=utf-8',
  '.txt':  'text/plain; charset=utf-8',
  '.woff': 'font-woff',
  '.woff2':'font-woff2',
};

const DEFAULT_BASE_PORT = 8765;
const PORT_SCAN_LIMIT   = 10;
const DEFAULT_IDLE_SEC  = 300;
const BIND_HOST         = '127.0.0.1'; // FR-45 — hard-bind, refuse anything else.

function parseArgs(argv) {
  const out = {
    root: process.cwd(), port: null,
    pidFile: null, pidFileFromAlias: false,
    idleSec: DEFAULT_IDLE_SEC, host: null,
  };
  // Accept both `--flag value` and `--flag=value`.
  const take = (i, name) => {
    const a = argv[i];
    if (a === name) return [argv[i+1], i+1];
    if (a.startsWith(name + '=')) return [a.slice(name.length + 1), i];
    return [null, i];
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]; let v, ni;
    if (a === '--help' || a === '-h') { out.help = true; continue; }
    [v, ni] = take(i, '--port');      if (v !== null) { out.port    = parseInt(v, 10); i = ni; continue; }
    [v, ni] = take(i, '--pid-file');  if (v !== null) { out.pidFile = v;                i = ni; continue; }
    [v, ni] = take(i, '--port-file'); if (v !== null) { out.pidFile = v; out.pidFileFromAlias = true; i = ni; continue; }
    [v, ni] = take(i, '--idle');      if (v !== null) { out.idleSec = parseFloat(v);    i = ni; continue; }
    [v, ni] = take(i, '--root');      if (v !== null) { out.root    = path.resolve(v);  i = ni; continue; }
    [v, ni] = take(i, '--host');      if (v !== null) { out.host    = v;                i = ni; continue; }
  }
  return out;
}

function safeJoin(root, reqPath) {
  // Decode + strip query/hash before path-join; reject traversal.
  // Boundary check requires path.sep — bare startsWith() lets `/tmp/feat`
  // match `/tmp/feat-evil/...` after `%2E%2E/feat-evil/...` decodes through.
  let decoded;
  try { decoded = decodeURIComponent(reqPath.split('?')[0].split('#')[0]); }
  catch (_) { return null; }
  const joined  = path.normalize(path.join(root, decoded));
  const rootSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (joined !== root && !joined.startsWith(rootSep)) return null;
  return joined;
}

function send(res, code, body, headers = {}) {
  res.writeHead(code, headers);
  res.end(body);
}

function sendJson(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function writeArtifactAtomic(p, c) {
  fs.writeFileSync(p + '.tmp', c);
  fs.renameSync(p + '.tmp', p);
}

function handleSave(root, body, res) {
  // Validate body shape.
  if (!body || typeof body.expected_version !== 'number'
      || !body.payload || typeof body.payload !== 'object'
      || body.payload.schema !== 1
      || typeof body.payload.version !== 'number'
      || !Array.isArray(body.payload.threads)) {
    return sendJson(res, 400, { error: 'schema-validation-failed', details: 'body shape invalid' });
  }

  // Resolve artifact path from query (?artifact=foo.html) or fallback to single *.html.
  const parsed = new URL(body.__url || '/', 'http://x');
  let artifactName = parsed.searchParams.get('artifact');
  if (!artifactName) {
    let candidates;
    try { candidates = fs.readdirSync(root).filter((n) => n.endsWith('.html') && n !== 'index.html'); }
    catch (_) { return sendJson(res, 400, { error: 'schema-validation-failed', details: 'artifact param required' }); }
    if (candidates.length !== 1) {
      return sendJson(res, 400, { error: 'schema-validation-failed', details: 'artifact param required' });
    }
    artifactName = candidates[0];
  }

  const absPath = safeJoin(root, artifactName);
  if (!absPath) return sendJson(res, 400, { error: 'schema-validation-failed', details: 'artifact path invalid' });

  let html;
  try { html = fs.readFileSync(absPath, 'utf8'); }
  catch (_) { return sendJson(res, 500, { error: 'internal' }); }

  const m = html.match(COMMENTS_RE);
  if (!m) return sendJson(res, 500, { error: 'internal' });
  let current;
  try { current = JSON.parse(m[1]); }
  catch (_) { return sendJson(res, 500, { error: 'internal' }); }

  if (current.version !== body.expected_version) {
    return sendJson(res, 409, {
      error: 'version-conflict',
      current_version: current.version,
      current_generated_at: current.generated_at,
    });
  }

  const newPayload = {
    schema: 1,
    version: body.expected_version + 1,
    generated_at: new Date().toISOString(),
    threads: body.payload.threads,
  };
  const newBlock = `<!-- pmos-comments:start -->\n<script id="pmos-comments" type="application/json">\n${jsonInlineEscape(newPayload)}\n</script>\n<!-- pmos-comments:end -->`;
  const newHtml = html.replace(COMMENTS_RE, newBlock);

  try { writeArtifactAtomic(absPath, newHtml); }
  catch (_) { return sendJson(res, 500, { error: 'internal' }); }

  return sendJson(res, 200, { version: newPayload.version, generated_at: newPayload.generated_at });
}

function handler(root) {
  return function (req, res) {
    // Parse URL — req.url may include query string.
    let parsedUrl;
    try { parsedUrl = new URL(req.url || '/', 'http://x'); }
    catch (_) { return send(res, 400, 'Bad Request\n', { 'Content-Type': 'text/plain; charset=utf-8' }); }

    // /save dispatch — handle BEFORE static fall-through.
    if (parsedUrl.pathname === '/save') {
      if (req.method === 'HEAD') {
        res.writeHead(204);
        return res.end();
      }
      if (req.method === 'POST') {
        let received = 0;
        const chunks = [];
        let aborted = false;
        req.on('data', (chunk) => {
          if (aborted) return;
          received += chunk.length;
          if (received > MAX_SAVE_BYTES) {
            aborted = true;
            sendJson(res, 413, { error: 'payload-too-large' });
            try { req.destroy(); } catch (_) {}
            return;
          }
          chunks.push(chunk);
        });
        req.on('end', () => {
          if (aborted) return;
          const raw = Buffer.concat(chunks).toString('utf8');
          let body;
          try { body = JSON.parse(raw); }
          catch (e) { return sendJson(res, 400, { error: 'schema-validation-failed', details: String(e.message || e) }); }
          // Pass req.url through so handleSave can read searchParams.
          body.__url = req.url;
          return handleSave(root, body, res);
        });
        return;
      }
      return send(res, 405, 'Method Not Allowed\n', { 'Content-Type': 'text/plain; charset=utf-8', 'Allow': 'HEAD, POST' });
    }

    let target = safeJoin(root, req.url || '/');
    if (!target) return send(res, 403, 'Forbidden\n', { 'Content-Type': 'text/plain; charset=utf-8' });

    fs.stat(target, (err, st) => {
      if (err) return send(res, 404, 'Not Found\n', { 'Content-Type': 'text/plain; charset=utf-8' });
      if (st.isDirectory()) {
        const idx = path.join(target, 'index.html');
        return fs.stat(idx, (e2) => {
          if (e2) return send(res, 404, 'Not Found\n', { 'Content-Type': 'text/plain; charset=utf-8' });
          stream(idx, res);
        });
      }
      stream(target, res);
    });
  };
}

function stream(file, res) {
  const ext = path.extname(file).toLowerCase();
  const ctype = MIME[ext] || 'text/plain; charset=utf-8';
  res.writeHead(200, { 'Content-Type': ctype, 'Cache-Control': 'no-store' });
  fs.createReadStream(file)
    .on('error', () => { try { res.end(); } catch (_) {} })
    .pipe(res);
}

function listen(server, port) {
  return new Promise((resolve, reject) => {
    const onErr = (err) => { server.removeListener('listening', onOk); reject(err); };
    const onOk  = () => {
      server.removeListener('error', onErr);
      // FR-45: hard-bind assertion — refuse anything but loopback even if
      // future refactors pass a different host through.
      const addr = server.address();
      if (addr && addr.address && addr.address !== BIND_HOST && addr.address !== '::1') {
        return reject(new Error(`serve.js: bound to ${addr.address}, expected ${BIND_HOST} (FR-45)`));
      }
      resolve(addr && typeof addr.port === 'number' ? addr.port : port);
    };
    server.once('error', onErr);
    server.once('listening', onOk);
    server.listen(port, BIND_HOST);
  });
}

function writePidFileAtomic(pidFile, payload) {
  // FR-44 — temp-then-rename atomic write.
  const tmp = pidFile + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2) + '\n');
  fs.renameSync(tmp, pidFile);
}

async function start({ root, port, pidFile, pidFileFromAlias, idleSec, host }) {
  // FR-45 — if caller explicitly passed --host, it must be loopback.
  if (host && host !== BIND_HOST && host !== 'localhost') {
    throw new Error(`--host=${host} refused; serve.js hard-binds ${BIND_HOST} only (FR-45)`);
  }
  if (pidFileFromAlias) {
    // Decision P2 — one-release deprecation grace for --port-file.
    process.stderr.write('serve.js: --port-file is deprecated, use --pid-file (alias retained for one release)\n');
  }

  const resolvedRoot = path.resolve(root);
  const server = http.createServer(handler(resolvedRoot));

  // --port=0 lets the OS choose a free port (used by tests); otherwise scan.
  let bound = null;
  if (Number.isFinite(port) && port === 0) {
    bound = await listen(server, 0);
  } else {
    const startPort = Number.isFinite(port) ? port : DEFAULT_BASE_PORT;
    for (let i = 0; i < PORT_SCAN_LIMIT; i++) {
      const p = startPort + i;
      try { bound = await listen(server, p); break; }
      catch (e) {
        if (e.code !== 'EADDRINUSE') throw e;
        // try next port
      }
    }
    if (!bound) throw new Error(`No free port in range ${startPort}..${startPort + PORT_SCAN_LIMIT - 1}`);
  }

  // Orphan .tmp scan — log to stderr, no auto-delete. (T2 / FR — surface leftover
  // atomic-write tmpfiles from a previous crashed run so the operator can inspect.)
  try {
    for (const name of fs.readdirSync(resolvedRoot)) {
      if (name.endsWith('.html.tmp')) {
        process.stderr.write(`orphan .tmp from previous run: ${name} — inspect and delete manually\n`);
      }
    }
  } catch (_) { /* root unreadable: skip */ }

  // Idle timeout — server self-closes if no request arrives within idleSec.
  // Default 300s; --idle=<sec> overrides; 0/negative disables.
  let idleTimer = null;
  const idleMs = Number.isFinite(idleSec) ? Math.max(0, idleSec * 1000) : DEFAULT_IDLE_SEC * 1000;
  const cleanup = () => {
    if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
    if (pidFile) { try { fs.unlinkSync(pidFile); } catch (_) {} }
  };
  const armIdle = () => {
    if (!idleMs) return;
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      try { server.close(); } catch (_) {}
      cleanup();
      process.exit(0);
    }, idleMs);
    if (typeof idleTimer.unref === 'function') idleTimer.unref();
  };
  server.on('request', armIdle);
  armIdle();

  // PID file (FR-44) — write JSON only after listen succeeded.
  if (pidFile) {
    writePidFileAtomic(pidFile, {
      pid: process.pid,
      port: bound,
      started_at: new Date().toISOString(),
    });
  }

  // Signal + exit cleanup.
  const onSignal = (sig) => {
    cleanup();
    try { server.close(); } catch (_) {}
    // Exit so test wrappers can observe the process end.
    process.exit(sig === 'SIGINT' ? 130 : 0);
  };
  process.once('SIGTERM', () => onSignal('SIGTERM'));
  process.once('SIGINT',  () => onSignal('SIGINT'));
  process.on('exit', cleanup);

  const u = `http://${BIND_HOST}:${bound}/index.html`;
  process.stdout.write(`Serving ${path.resolve(root)}\n`);
  process.stdout.write(`Open ${u}\n`);
  return server;
}

if (require.main === module) {
  const args = parseArgs(process.argv);
  if (args.help) {
    process.stdout.write('Usage: node serve.js [--port N] [--pid-file FILE] [--idle SEC] [--root DIR]\n');
    process.stdout.write('       --port-file FILE (deprecated alias for --pid-file)\n');
    process.exit(0);
  }
  start(args).catch((e) => { process.stderr.write(`serve.js: ${e.message}\n`); process.exit(1); });
}

module.exports = { start, MIME };
