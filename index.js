import { createUpdater } from './updater.js';
import { readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';

// DSH_* tool environment variables are NOT guaranteed in the Host process.
// Locate the actually running CLI, never a possibly stale profile dependency.
export function locateInstallation(argv = process.argv, cwd = process.cwd()) {
  const entry = realpathSync(path.resolve(cwd, argv[1] || ''));
  if (path.basename(entry) !== 'bin.js' || path.basename(path.dirname(entry)) !== 'lib') throw new Error('Cannot verify the running DSH CLI entry');
  const root = path.dirname(path.dirname(entry));
  const manifest = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  if (manifest.name !== '@deepseek-ai/dsh' || typeof manifest.version !== 'string') throw new Error('The running entry is not a verified DSH installation');
  return root;
}

export const inject = ['webServer', 'tools'];
const BASE = '/api/local-dsh-update-center';
export function makeHandler(service, getOrigin) {
  return async (req, res, peer) => {
    const reply = (code, body) => {
      res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(JSON.stringify(body));
    };
    if (peer?.principal?.kind !== 'owner') return reply(403, { error: 'Owner access required' });
    const path = new URL(req.url, getOrigin()).pathname;
    try {
      if (req.method === 'GET' && path === BASE) return reply(200, service.snapshot());
      if (req.method !== 'POST') return reply(405, { error: 'Method not allowed' });
      // Explicit same-origin owner UI only. No generic command execution or remote URL input.
      if (req.headers.origin !== getOrigin() || req.headers['x-dsh-update'] !== '1' || !req.headers['content-type']?.startsWith('application/json')) {
        return reply(403, { error: 'Same-origin confirmation required' });
      }
      let body = '';
      for await (const chunk of req) {
        body += chunk.toString('utf8');
        if (body.length > 2048) return reply(413, { error: 'Request too large' });
      }
      const args = JSON.parse(body || '{}');
      if (path === BASE + '/check') return reply(200, await service.check(true));
      if (path === BASE + '/prepare' && args.confirm === true && typeof args.version === 'string') {
        const result = await service.prepare(args.version);
        return reply(200, result);
      }
      return reply(400, { error: 'Invalid action or missing confirmation' });
    } catch (error) { return reply(400, { error: error.message || String(error) }); }
  };
}
export function apply(ctx) {
  const service = createUpdater({ installDir: locateInstallation(), nodeExecutable: process.execPath });
  ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: BASE, auth: 'required', handler: makeHandler(service, () => ctx.webServer.getOrigin()) }));
  ctx.effect(() => ctx.tools.register({
    name: 'dsh_update_check',
    description: 'Read-only DSH release check against the official npm registry, separating stable and prerelease versions. Cannot install or authorize an update; use the owner-only Update center UI to confirm preparation.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    output: { schema: { type: 'object', additionalProperties: true }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
    execute: async () => service.check(true),
  }));
  // Host-side cache coalesces requests from several tabs; no scheduling or background agent is created.
  const check = () => service.check().catch(() => {});
  ctx.effect(() => { void check(); const timer = setInterval(check, 60 * 60 * 1000); timer.unref?.(); return async () => { clearInterval(timer); await service.dispose(); }; });
}
