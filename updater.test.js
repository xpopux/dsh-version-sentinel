import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, rm, readdir } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createUpdater, compareVersions, parseVersion, REGISTRY, PACKAGE, METADATA_SOURCES } from './updater.js'

const CURRENT = '1.0.0-alpha.2'
const COMPANION = '@deepseek-ai/dsh-hooks-codex'
function metadata(versions = ['1.0.0', '1.1.0-beta.1'], options = {}) {
  return { name: PACKAGE, versions: Object.fromEntries(versions.map(version => [version, { name: PACKAGE, version, engines: { node: '>=24' }, ...(options.deprecated === version ? { deprecated: 'unsupported' } : {}) }])), time: Object.fromEntries(versions.map(v => [v, '2026-01-01T00:00:00.000Z'])), 'dist-tags': { latest: '1.1.0-beta.1', next: '1.1.0-beta.1', stable: '1.0.0' } }
}
const jsonResponse = value => ({ ok: true, status: 200, text: async () => JSON.stringify(value) })
async function fixture(t, overrides = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dsh-updater-test-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const deployment = path.join(root, 'deploy'), installDir = path.join(deployment, 'node_modules', PACKAGE)
  await mkdir(installDir, { recursive: true })
  await writeFile(path.join(installDir, 'package.json'), JSON.stringify({ name: PACKAGE, version: CURRENT }))
  await writeFile(path.join(deployment, 'package.json'), JSON.stringify({ private: true, dependencies: { [PACKAGE]: CURRENT, [COMPANION]: CURRENT } }))
  let doc = metadata(), calls = [], runs = []
  const fetchImpl = async (url, options) => {
    calls.push({ url, options })
    if (url.endsWith('%2fdsh')) return jsonResponse(doc)
    const pieces = url.slice(REGISTRY.length + 1).split('/')
    return jsonResponse({ name: decodeURIComponent(pieces[0]), version: decodeURIComponent(pieces[1]), engines: { node: '>=24' } })
  }
  const run = async (executable, args, options) => {
    runs.push({ executable, args, options })
    const manifest = JSON.parse(await readFile(path.join(options.cwd, 'package.json'), 'utf8'))
    for (const [name, version] of Object.entries(manifest.dependencies)) {
      const dir = path.join(options.cwd, 'node_modules', name)
      await mkdir(dir, { recursive: true })
      await writeFile(path.join(dir, 'package.json'), JSON.stringify({ name, version }))
    }
    return { code: 0 }
  }
  const updater = createUpdater({ installDir, nodeExecutable: process.execPath, updateRoot: path.join(root, 'updates'), fetchImpl, run, ...overrides })
  t.after(() => updater.dispose())
  return { root, deployment, installDir, updater, calls, runs, fetchImpl, run, setDoc: value => { doc = value } }
}

test('SemVer precedence implements official ordered prerelease example', () => {
  const ordered = ['1.0.0-alpha', '1.0.0-alpha.1', '1.0.0-alpha.beta', '1.0.0-beta', '1.0.0-beta.2', '1.0.0-beta.11', '1.0.0-rc.1', '1.0.0', '1.0.1', '1.1.0', '2.0.0']
  for (let i = 1; i < ordered.length; i++) assert.equal(compareVersions(ordered[i - 1], ordered[i]), -1)
  assert.equal(compareVersions('1.0.0+build.2', '1.0.0+build.1'), 0)
  assert.equal(compareVersions('99999999999999999999.0.0', '2.0.0'), 1)
  assert.ok(parseVersion('1.0.0-x-y.0+build.foo'))
})
test('SemVer rejects ranges, shell fragments, malformed prerelease and leading zeros', () => {
  for (const value of ['latest', '^1.0.0', '1.0', 'v1.0.0', '01.2.3', '1.0.0-01', '1.0.0-', '../1.0.0', '1.0.0;whoami', ' 1.0.0', null, {}, '1.0.0+']) assert.equal(parseVersion(value), null)
})
test('classifies actual SemVer not latest tags, preserves publication dates, sorts and copies snapshots', async t => {
  const { updater } = await fixture(t)
  const s = await updater.check()
  assert.equal(s.latestStable, '1.0.0'); assert.equal(s.latestPrerelease, '1.1.0-beta.1')
  assert.equal(s.hasStableUpdate, true); assert.equal(s.hasPrereleaseUpdate, true)
  assert.deepEqual(s.releases[0].tags, ['latest', 'next']); assert.equal(s.releases[0].channel, 'prerelease')
  assert.equal(s.releases[0].newer, true); assert.equal(s.releases[0].packageAvailable, true)
  assert.equal(s.releases[1].publishedAt, '2026-01-01T00:00:00.000Z')
  assert.deepEqual(s.source, METADATA_SOURCES[0]); assert.ok(s.lastAttemptAt)
  s.releases[0].version = 'broken'; assert.equal(updater.snapshot().releases[0].version, '1.1.0-beta.1')
})
test('all-prerelease registry and latest older than current do not create stable updates', async t => {
  const { updater, setDoc } = await fixture(t)
  setDoc(metadata(['0.9.0-rc.1', CURRENT]))
  const s = await updater.check()
  assert.equal(s.latestStable, null); assert.equal(s.latestPrerelease, CURRENT)
  assert.equal(s.hasStableUpdate, false); assert.equal(s.hasPrereleaseUpdate, false)
  assert.equal(s.releases[0].newer, false)
})
test('deprecated, private, malformed and unpublished entries cannot become allowed candidates', async t => {
  const { updater, setDoc } = await fixture(t)
  const d = metadata(['2.0.0', '3.0.0', '4.0.0', '5.0.0', '6.0.0'], { deprecated: '2.0.0' })
  d.versions['3.0.0'].private = true
  d.versions['4.0.0'].name = 'another-package'
  delete d.time['5.0.0']; d.versions['6.0.0'].version = 'bad'
  setDoc(d)
  const s = await updater.check()
  assert.equal(s.releases.length, 1); assert.equal(s.latestStable, null)
  await assert.rejects(updater.prepare('2.0.0'), /允许列表/)
})
test('checks use official registry, are coalesced, cached and explicitly refreshable', async t => {
  const { updater, calls } = await fixture(t)
  await Promise.all([updater.check(), updater.check()])
  assert.equal(calls.length, 1)
  const cached = updater.snapshot()
  assert.deepEqual(await updater.check(), cached); assert.equal(calls.length, 1)
  await updater.check(true); assert.equal(calls.length, 2)
  assert.equal(calls[0].url, `${REGISTRY}/@deepseek-ai%2fdsh`)
  assert.equal(calls[0].options.redirect, 'error')
})
test('network errors and invalid registry metadata fail closed', async t => {
  for (const fetchImpl of [async () => { throw new Error('offline') }, async () => ({ ok: false, status: 503 }), async () => jsonResponse({ name: 'wrong', versions: {} }), async () => ({ ok: true, text: async () => 'not json' })]) {
    const { updater } = await fixture(t, { fetchImpl })
    const s = await updater.check(true)
    assert.ok(s.error); assert.equal(s.checkedAt, null)
    await assert.rejects(updater.prepare('2.0.0'), /允许列表/)
  }
})
test('a failed recheck keeps prior display list but revokes installation authority', async t => {
  let fail = false
  const { updater } = await fixture(t, { fetchImpl: async () => { if (fail) throw new Error('offline'); return jsonResponse(metadata()) } })
  const success = await updater.check(); fail = true
  const failed = await updater.check(true)
  assert.equal(failed.releases.length, 2)
  assert.equal(failed.checkedAt, success.checkedAt); assert.ok(failed.lastAttemptAt)
  assert.match(failed.error, /npm 官方源.*offline.*npmmirror 国内备用源.*offline/)
  assert.equal(failed.hasStableUpdate, false); assert.equal(failed.hasPrereleaseUpdate, false)
  assert.ok(failed.releases.every(r => !r.newer && r.packageAvailable === false))
  await assert.rejects(updater.prepare('1.0.0'), /允许列表/)
})
test('prepare rejects unknown, older, current, injection and unchecked versions without running npm', async t => {
  const { updater, runs } = await fixture(t)
  await assert.rejects(updater.prepare('1.0.0'), /先成功检查/)
  await updater.check()
  for (const version of [CURRENT, '0.9.0', '2.0.0', '../2.0.0', '1.0.0;calc', 'latest']) await assert.rejects(updater.prepare(version))
  assert.equal(runs.length, 0)
})
test('prepare returns immediately, serializes, stages companion versions and leaves production unchanged', async t => {
  const { updater, installDir, deployment, runs } = await fixture(t)
  const before = await readFile(path.join(deployment, 'package.json'), 'utf8')
  await updater.check()
  const accepted = await updater.prepare('1.0.0')
  assert.equal(accepted.job.status, 'preparing')
  await assert.rejects(updater.prepare('1.1.0-beta.1'), /正在运行/)
  const final = await updater.waitForIdle()
  assert.equal(final.job.status, 'pending-manual', final.job.message)
  assert.equal(final.current, CURRENT)
  assert.equal(await readFile(path.join(deployment, 'package.json'), 'utf8'), before)
  assert.equal(JSON.parse(await readFile(path.join(installDir, 'package.json'), 'utf8')).version, CURRENT)
  const staged = JSON.parse(await readFile(path.join(final.job.path, 'package.json'), 'utf8'))
  assert.deepEqual(staged.dependencies, { [PACKAGE]: '1.0.0', [COMPANION]: '1.0.0' })
  assert.equal(runs.length, 1)
  const call = runs[0]
  assert.equal(call.executable, process.execPath); assert.equal(call.options.shell, false)
  assert.ok(call.args.includes('--ignore-scripts')); assert.ok(call.args.includes('--engine-strict'))
  assert.ok(call.args.includes(`--registry=${REGISTRY}`)); assert.ok(call.options.timeoutMs > 0)
  assert.equal(call.options.env.NODE_OPTIONS, undefined)
  assert.match(await readFile(path.join(final.job.path, 'UPDATE-INSTRUCTIONS.md'), 'utf8'), /pending-manual/)
  assert.deepEqual((await readdir(path.dirname(final.job.path))).filter(x => x === '.prepare-lock'), [])
})
test('installation failures and timeouts report failed, never activation', async t => {
  for (const result of [{ code: 1 }, { code: 0, timedOut: true }]) {
    const { updater } = await fixture(t, { run: async () => result })
    await updater.check(); await updater.prepare('1.0.0')
    const s = await updater.waitForIdle()
    assert.equal(s.job.status, 'failed'); assert.ok(s.job.path); assert.equal(s.current, CURRENT)
    assert.match(s.job.message, /安装失败|超时/)
  }
})
test('successful npm status without correct installed manifests is not success', async t => {
  const { updater } = await fixture(t, { run: async () => ({ code: 0 }) })
  await updater.check(); await updater.prepare('1.0.0')
  assert.equal((await updater.waitForIdle()).job.status, 'failed')
})
test('Node engine incompatibility fails before installation', async t => {
  const { updater, setDoc, runs } = await fixture(t)
  const d = metadata(['1.0.0']); d.versions['1.0.0'].engines.node = '>=999'
  setDoc(d); await updater.check(); await updater.prepare('1.0.0')
  const s = await updater.waitForIdle()
  assert.equal(s.job.status, 'failed'); assert.match(s.job.message, /Node/); assert.equal(runs.length, 0)
})
test('overlapping install directory is refused before staging writes', async t => {
  const f = await fixture(t)
  const unsafe = createUpdater({ installDir: f.installDir, nodeExecutable: process.execPath, updateRoot: path.join(f.deployment, 'updates'), fetchImpl: async () => jsonResponse(metadata()) })
  await unsafe.check(); await unsafe.prepare('1.0.0')
  assert.match((await unsafe.waitForIdle()).job.message, /重叠/)
  assert.deepEqual((await readdir(f.deployment)).sort(), ['node_modules', 'package.json'])
})
test('unknown deployment dependencies are not silently omitted', async t => {
  const f = await fixture(t)
  await writeFile(path.join(f.deployment, 'package.json'), JSON.stringify({ dependencies: { [PACKAGE]: CURRENT, 'unreviewed-package': '1.0.0' } }))
  await f.updater.check(); await f.updater.prepare('1.0.0')
  assert.match((await f.updater.waitForIdle()).job.message, /部署依赖/)
  assert.equal(f.runs.length, 0)
})
test('unpublished companion package prevents npm invocation', async t => {
  const { updater, runs } = await fixture(t, { fetchImpl: async url => url.endsWith('%2fdsh') ? jsonResponse(metadata()) : ({ ok: false, status: 404 }) })
  await updater.check(); await updater.prepare('1.0.0')
  assert.equal((await updater.waitForIdle()).job.status, 'failed'); assert.equal(runs.length, 0)
})
test('candidate withdrawal between selection and preparation fails closed', async t => {
  const f = await fixture(t)
  await f.updater.check()
  f.setDoc(metadata([]))
  await f.updater.prepare('1.0.0')
  assert.equal((await f.updater.waitForIdle()).job.status, 'failed')
  assert.equal(f.runs.length, 0)
})
test('directory lock serializes different updater instances without stealing a live lock', async t => {
  let release, entered
  const gate = new Promise(resolve => { release = resolve })
  const started = new Promise(resolve => { entered = resolve })
  const f = await fixture(t, { run: async () => { entered(); await gate; return { code: 1 } } })
  const second = createUpdater({ installDir: f.installDir, nodeExecutable: process.execPath, updateRoot: path.join(f.root, 'updates'), fetchImpl: f.fetchImpl, run: async () => { throw new Error('must never spawn') } })
  try {
    await f.updater.check(); await f.updater.prepare('1.0.0'); await started
    await second.check(); await second.prepare('1.0.0')
    const blocked = await second.waitForIdle()
    assert.equal(blocked.job.status, 'failed'); assert.match(blocked.job.message, /EEXIST/)
    assert.ok((await readdir(path.join(f.root, 'updates'))).includes('.prepare-lock'))
  } finally { release(); await f.updater.waitForIdle(); await second.dispose() }
})
test('official failures fall back to fixed mirror metadata, classify full list and cache success', async t => {
  for (const official of [async () => { throw new Error('official offline') }, async () => ({ ok: false, status: 503 }), async () => jsonResponse({ name: 'wrong', versions: {} }), async () => ({ ok: true, text: async () => 'not json' })]) {
    const calls = []
    const { updater } = await fixture(t, { fetchImpl: async (url, options) => {
      calls.push({ url, options })
      if (url === METADATA_SOURCES[0].url) return official()
      assert.equal(url, METADATA_SOURCES[1].url)
      return jsonResponse(metadata(['0.9.0', '1.0.0', '1.1.0-beta.1', '1.1.0-rc.1']))
    } })
    const s = await updater.check()
    assert.equal(s.error, null); assert.ok(s.checkedAt); assert.ok(s.lastAttemptAt)
    assert.deepEqual(s.source, METADATA_SOURCES[1]); assert.match(s.source.notice, /可能滞后.*仅供版本检测.*不从镜像安装/)
    assert.equal(s.latestStable, '1.0.0'); assert.equal(s.latestPrerelease, '1.1.0-rc.1')
    assert.equal(s.releases.length, 4); assert.equal(s.hasStableUpdate, true); assert.equal(s.hasPrereleaseUpdate, true)
    assert.equal(s.releases[0].packageAvailable, true)
    assert.deepEqual(await updater.check(), s); assert.equal(calls.length, 2)
    assert.ok(calls.every(c => c.options.redirect === 'error' && c.options.signal instanceof AbortSignal))
    await updater.check(true); assert.equal(calls.length, 4)
  }
})
test('official success with no update does not consult a possibly newer mirror', async t => {
  const calls = []
  const { updater } = await fixture(t, { fetchImpl: async url => { calls.push(url); return jsonResponse(metadata([CURRENT, '0.9.0'])) } })
  const s = await updater.check()
  assert.deepEqual(calls, [METADATA_SOURCES[0].url]); assert.equal(s.source.fallback, false)
  assert.equal(s.hasStableUpdate, false); assert.equal(s.hasPrereleaseUpdate, false)
})
test('all source failures have no update notice or preparation authority, and are retried without cache', async t => {
  const calls = []
  const { updater, runs } = await fixture(t, { fetchImpl: async url => { calls.push(url); return { ok: false, status: 404 } } })
  const s = await updater.check()
  assert.equal(s.checkedAt, null); assert.ok(s.lastAttemptAt); assert.equal(s.source, null)
  assert.ok(s.error); assert.deepEqual(s.releases, [])
  assert.equal(s.hasStableUpdate, false); assert.equal(s.hasPrereleaseUpdate, false)
  await assert.rejects(updater.prepare('1.0.0'), /先成功检查/)
  await updater.check(); assert.equal(calls.length, 4); assert.equal(runs.length, 0)
})
test('mirror detection cannot authorize prepare when official validation fails', async t => {
  const calls = []
  const { updater, root, runs } = await fixture(t, { fetchImpl: async url => {
    calls.push(url)
    return url === METADATA_SOURCES[0].url ? { ok: false, status: 503 } : jsonResponse(metadata())
  } })
  assert.equal((await updater.check()).source.fallback, true)
  await updater.prepare('1.0.0')
  const s = await updater.waitForIdle()
  assert.equal(s.job.status, 'failed'); assert.match(s.job.message, /npm 官方源.*503/)
  assert.deepEqual(calls, [METADATA_SOURCES[0].url, METADATA_SOURCES[1].url, METADATA_SOURCES[0].url])
  assert.equal(runs.length, 0); assert.equal((await readdir(root)).includes('updates'), false)
})
test('mirror-only candidate missing from official catalog cannot prepare', async t => {
  let online = false
  const { updater, runs } = await fixture(t, { fetchImpl: async url => {
    if (url === METADATA_SOURCES[0].url) return online ? jsonResponse(metadata([CURRENT])) : { ok: false, status: 503 }
    return jsonResponse(metadata(['2.0.0']))
  } })
  await updater.check(); online = true
  await updater.prepare('2.0.0')
  const s = await updater.waitForIdle()
  assert.equal(s.job.status, 'failed'); assert.match(s.job.message, /本次官方/); assert.equal(runs.length, 0)
})
test('mirror candidate stages only after fresh official package and same-version companion verification', async t => {
  let online = false
  const calls = []
  const { updater, runs } = await fixture(t, { fetchImpl: async url => {
    calls.push(url)
    if (url === METADATA_SOURCES[0].url && !online) return { ok: false, status: 503 }
    if (url.endsWith('%2fdsh')) return jsonResponse(metadata())
    assert.equal(new URL(url).origin, REGISTRY)
    return jsonResponse({ name: COMPANION, version: '1.0.0', engines: { node: '>=24' } })
  } })
  await updater.check(); online = true
  await updater.prepare('1.0.0')
  const s = await updater.waitForIdle()
  assert.equal(s.job.status, 'pending-manual', s.job.message)
  assert.deepEqual(calls.slice(2), [METADATA_SOURCES[0].url, `${REGISTRY}/${encodeURIComponent(COMPANION)}/1.0.0`])
  assert.equal(runs.length, 1); assert.ok(runs[0].args.includes(`--registry=${REGISTRY}`))
  assert.equal(runs[0].args.some(x => x.includes('npmmirror')), false)
})
test('dispose prevents future installation requests', async t => {
  const { updater } = await fixture(t)
  await updater.check(); await updater.dispose()
  await assert.rejects(updater.prepare('1.0.0'), /卸载/)
})
