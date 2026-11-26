import { readFileSync, realpathSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, writeFile, realpath } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'

export const REGISTRY = 'https://registry.npmjs.org'
export const PACKAGE = '@deepseek-ai/dsh'
const PACKUMENT = `${REGISTRY}/@deepseek-ai%2fdsh`
export const METADATA_SOURCES = Object.freeze([
  Object.freeze({ label: 'npm 官方源', url: PACKUMENT, fallback: false, notice: '版本检测使用 npm 官方元数据；准备更新仍需重新校验官方版本与同版配套包。' }),
  Object.freeze({ label: 'npmmirror 国内备用源', url: 'https://registry.npmmirror.com/@deepseek-ai%2fdsh', fallback: true, notice: '官方源暂不可用，国内备用元数据可能滞后，仅供版本检测；下载准备必须重新通过 npm 官方源验证，不从镜像安装。' }),
])
const REQUEST_TIMEOUT_MS = 9000
const DEPENDENCIES = [PACKAGE, '@deepseek-ai/dsh-hooks-codex', '@deepseek-ai/dsh-browser-use', '@deepseek-ai/dsh-experimental-browser-use-playwright-mcp', '@deepseek-ai/dsh-computer-use', '@deepseek-ai/dsh-experimental-computer-use-cua-driver-native', '@deepseek-ai/dsh-mcp-client', '@deepseek-ai/dsh-tools']
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/
export function parseVersion(value) {
  if (typeof value !== 'string' || value.length > 160) return null
  const m = SEMVER.exec(value)
  if (!m) return null
  const pre = m[4]?.split('.') ?? []
  if (pre.some(x => /^\d+$/.test(x) && x.length > 1 && x.startsWith('0'))) return null
  return { core: m.slice(1, 4).map(BigInt), pre }
}
export function compareVersions(a, b) {
  const x = parseVersion(a), y = parseVersion(b)
  if (!x || !y) throw new Error('Invalid SemVer')
  for (let i = 0; i < 3; i++) if (x.core[i] !== y.core[i]) return x.core[i] > y.core[i] ? 1 : -1
  if (!x.pre.length || !y.pre.length) return x.pre.length === y.pre.length ? 0 : x.pre.length ? -1 : 1
  for (let i = 0; i < Math.max(x.pre.length, y.pre.length); i++) {
    const p = x.pre[i], q = y.pre[i]
    if (p === undefined || q === undefined) return p === q ? 0 : p === undefined ? -1 : 1
    if (p === q) continue
    const pn = /^\d+$/.test(p), qn = /^\d+$/.test(q)
    if (pn && qn) return BigInt(p) > BigInt(q) ? 1 : -1
    if (pn !== qn) return pn ? -1 : 1
    return p > q ? 1 : -1
  }
  return 0
}
const inside = (child, parent) => { const rel = path.relative(parent, child); return rel === '' || (!rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel)) }
const messageOf = e => String(e?.message || e).slice(0, 1000)
function canonicalFuture(p) {
  let ancestor = path.resolve(p), suffix = []
  for (;;) {
    try { return path.join(realpathSync(ancestor), ...suffix.reverse()) } catch (e) {
      if (e.code !== 'ENOENT') throw e
      const parent = path.dirname(ancestor)
      if (parent === ancestor) throw e
      suffix.push(path.basename(ancestor)); ancestor = parent
    }
  }
}
async function runProcess(executable, args, options) {
  return await new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd: options.cwd, env: options.env, signal: options.signal, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = '', stderr = '', timedOut = false
    const timer = setTimeout(() => { timedOut = true; child.kill() }, options.timeoutMs)
    child.stdout.on('data', b => { stdout = (stdout + b).slice(-16000) })
    child.stderr.on('data', b => { stderr = (stderr + b).slice(-16000) })
    child.on('error', e => { clearTimeout(timer); reject(e) })
    child.on('close', code => { clearTimeout(timer); resolve({ code, stdout, stderr, timedOut }) })
  })
}

/** Core upgrades are staged only. This never changes the live install, profile, launcher or process. */
export function createUpdater({ installDir, nodeExecutable = process.execPath, updateRoot = path.join(os.homedir(), '.dsh-update-staging'), fetchImpl = globalThis.fetch, run = runProcess } = {}) {
  if (!path.isAbsolute(installDir || '') || !path.isAbsolute(nodeExecutable)) throw new Error('Absolute installation and Node paths are required')
  const anchor = realpathSync(installDir)
  const manifest = JSON.parse(readFileSync(path.join(anchor, 'package.json'), 'utf8'))
  if (manifest.name !== PACKAGE || !parseVersion(manifest.version)) throw new Error('Not a verified DSH installation')
  const current = manifest.version
  const state = { current, checkedAt: null, lastAttemptAt: null, source: null, error: null, releases: [], latestStable: null, latestPrerelease: null, hasStableUpdate: false, hasPrereleaseUpdate: false, job: { status: 'idle' } }
  // Detection candidates (including mirror metadata) never authorize installation.
  let checkPromise, preparing = false, candidates = new Map(), preparation, disposed = false
  const lifetime = new AbortController()
  const snapshot = () => structuredClone(state)
  async function requestJson(url) {
    const response = await fetchImpl(url, { signal: AbortSignal.any([AbortSignal.timeout(REQUEST_TIMEOUT_MS), lifetime.signal]), redirect: 'error', headers: { accept: 'application/json' } })
    if (!response.ok) throw new Error(`npm registry HTTP ${response.status}`)
    const text = await response.text()
    if (text.length > 16 * 1024 * 1024) throw new Error('npm metadata exceeds the safety limit')
    return JSON.parse(text)
  }
  function readCatalog(doc) {
    if (!doc || doc.name !== PACKAGE || !doc.versions || typeof doc.versions !== 'object' || Array.isArray(doc.versions)) throw new Error('Invalid npm package metadata')
    const tags = doc['dist-tags'] && typeof doc['dist-tags'] === 'object' ? Object.entries(doc['dist-tags']) : []
    const releases = [], allowed = new Map()
    for (const [version, m] of Object.entries(doc.versions)) {
      const parsed = parseVersion(version)
      if (!parsed || !m || m.version !== version || m.name !== PACKAGE || m.private === true) continue
      const publishedAt = doc.time?.[version]
      if (typeof publishedAt !== 'string' || !Number.isFinite(Date.parse(publishedAt))) continue
      // Package availability is a detection hint, not official installation authority.
      const release = { version, newer: compareVersions(version, current) > 0, packageAvailable: !m.deprecated, channel: parsed.pre.length ? 'prerelease' : 'stable', publishedAt, tags: tags.filter(([, v]) => v === version).map(([tag]) => tag).sort(), ...(m.deprecated ? { deprecated: String(m.deprecated).slice(0, 500) } : {}) }
      releases.push(release)
      if (!m.deprecated) allowed.set(version, m)
    }
    releases.sort((a, b) => compareVersions(b.version, a.version) || b.version.localeCompare(a.version))
    return { releases, allowed }
  }
  async function fetchCatalog(officialOnly = false) {
    const failures = []
    for (const source of officialOnly ? METADATA_SOURCES.slice(0, 1) : METADATA_SOURCES) {
      lifetime.signal.throwIfAborted()
      try { return { ...readCatalog(await requestJson(source.url)), source: { ...source } } } catch (e) {
        failures.push(`${source.label}：${messageOf(e)}`)
      }
    }
    throw new Error(failures.join('；'))
  }
  async function check(force = false) {
    if (checkPromise) return checkPromise
    if (!force && state.checkedAt && !state.error && Date.now() - Date.parse(state.checkedAt) < 15 * 60 * 1000) return snapshot()
    state.lastAttemptAt = new Date().toISOString()
    checkPromise = (async () => {
      try {
        const { releases, allowed, source } = await fetchCatalog()
        const available = releases.filter(r => !r.deprecated)
        state.releases = releases; state.source = source
        state.latestStable = available.find(r => r.channel === 'stable')?.version ?? null
        state.latestPrerelease = available.find(r => r.channel === 'prerelease')?.version ?? null
        state.hasStableUpdate = !!state.latestStable && compareVersions(state.latestStable, current) > 0
        state.hasPrereleaseUpdate = !!state.latestPrerelease && compareVersions(state.latestPrerelease, current) > 0
        state.checkedAt = new Date().toISOString(); state.error = null; candidates = allowed
      } catch (e) {
        state.error = `检查失败：${messageOf(e)}`
        state.hasStableUpdate = false; state.hasPrereleaseUpdate = false
        state.releases = state.releases.map(r => ({ ...r, newer: false, packageAvailable: false }))
        candidates = new Map() // A stale list is display-only, never installation authority.
      }
      return snapshot()
    })()
    try { return await checkPromise } finally { checkPromise = undefined }
  }
  async function prepare(version) {
    if (disposed) throw new Error('更新器已卸载')
    if (preparing) throw new Error('已有更新准备任务正在运行，请等待完成')
    if (!parseVersion(version) || compareVersions(version, current) <= 0) throw new Error('只允许选择高于当前版本的完整已发布版本')
    if (state.error || !candidates.has(version) || !state.releases.some(r => r.version === version && r.newer && r.packageAvailable === true)) throw new Error('请先成功检查；该版本不在已发布且未弃用的允许列表中（准备仍需官方复验）')
    preparing = true
    state.job = { status: 'preparing', version, message: '正在重新验证官方版本与配套包；不会切换当前运行版本。' }
    preparation = executePreparation(version).catch(() => {})
    return snapshot()
  }
  async function executePreparation(version) {
    let stage, lockHandle
    try {
      // Never fall back to a mirror for preparation, even after a mirror check succeeds.
      const official = await fetchCatalog(true)
      if (!official.allowed.has(version)) throw new Error('该版本不在本次官方已发布且未弃用的允许列表中')
      const selected = official.allowed.get(version)
      const installationRoot = canonicalFuture(path.resolve(anchor, '../../..'))
      const root = canonicalFuture(updateRoot)
      const protectedRoots = [installationRoot, process.env.DSH_HOME || path.join(os.homedir(), '.dsh'), process.env.DSH_PROFILE_DIR].filter(Boolean).map(canonicalFuture)
      if (protectedRoots.some(p => inside(root, p) || inside(p, root))) throw new Error('更新目录与当前安装或 DSH 用户数据目录重叠，已拒绝写入')
      if (realpathSync(nodeExecutable) !== realpathSync(process.execPath)) throw new Error('更新必须使用当前进程的已验证 Node 可执行文件')
      const npmCli = path.join(path.dirname(realpathSync(nodeExecutable)), 'node_modules/npm/bin/npm-cli.js')
      realpathSync(npmCli)
      const semver = createRequire(npmCli)('semver')
      if (selected.engines?.node && !semver.satisfies(process.versions.node, selected.engines.node)) throw new Error(`目标需要 Node ${selected.engines.node}；当前为 ${process.versions.node}`)
      // Preserve this deployment's explicit same-release companion package set.
      const deployment = JSON.parse(await readFile(path.join(installationRoot, 'package.json'), 'utf8'))
      const names = Object.keys(deployment.dependencies || {})
      if (!names.includes(PACKAGE) || names.some(n => !DEPENDENCIES.includes(n)) || names.some(n => deployment.dependencies[n] !== current)) throw new Error('部署依赖不符合已验证的同版包集合，需人工复核')
      for (const name of names.filter(n => n !== PACKAGE)) {
        const m = await requestJson(`${REGISTRY}/${encodeURIComponent(name)}/${encodeURIComponent(version)}`)
        if (m.name !== name || m.version !== version || m.deprecated || m.private === true) throw new Error(`配套包 ${name}@${version} 未发布、已弃用或元数据无效`)
        if (m.engines?.node && !semver.satisfies(process.versions.node, m.engines.node)) throw new Error(`配套包 ${name} 不支持当前 Node`)
      }
      lifetime.signal.throwIfAborted()
      await mkdir(root, { recursive: true })
      // Directory lock also excludes a second updater instance. Never steal stale locks.
      const lock = path.join(root, '.prepare-lock')
      await mkdir(lock)
      lockHandle = lock
      stage = await mkdtemp(path.join(root, `${version}-`))
      state.job = { status: 'preparing', id: path.basename(stage), version, path: stage, message: '正在隔离目录安装；不修改当前运行版本，不执行安装脚本。' }
      const dependencies = Object.fromEntries(names.map(n => [n, version]))
      await writeFile(path.join(stage, 'package.json'), JSON.stringify({ name: 'dsh-staged-update', private: true, dependencies }, null, 2) + '\n', { flag: 'wx' })
      await writeFile(path.join(stage, '.npmrc'), '', { flag: 'wx' })
      await writeFile(path.join(stage, 'global.npmrc'), '', { flag: 'wx' })
      const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^npm_config_/i.test(k) && !['NODE_OPTIONS', 'NODE_PATH', 'ELECTRON_RUN_AS_NODE'].includes(k.toUpperCase())))
      const args = [npmCli, 'install', '--ignore-scripts', '--engine-strict', '--no-audit', '--no-fund', '--save-exact', `--registry=${REGISTRY}`, `--cache=${path.join(stage, '.npm-cache')}`, `--userconfig=${path.join(stage, '.npmrc')}`, `--globalconfig=${path.join(stage, 'global.npmrc')}`]
      const result = await run(process.execPath, args, { cwd: stage, env, timeoutMs: 15 * 60 * 1000, shell: false, signal: lifetime.signal })
      if (result?.timedOut || (result?.code ?? result?.exitCode) !== 0) throw new Error(result?.timedOut ? 'npm 安装超时，准备未完成' : `npm 安装失败（退出码 ${result?.code ?? result?.exitCode ?? 'unknown'}），未切换当前版本`)
      for (const name of names) {
        const packagePath = path.join(stage, 'node_modules', name)
        const actualPath = await realpath(packagePath)
        if (!inside(actualPath, stage)) throw new Error('安装包路径越过隔离目录')
        const installed = JSON.parse(await readFile(path.join(actualPath, 'package.json'), 'utf8'))
        if (installed.name !== name || installed.version !== version) throw new Error(`安装清单校验失败：${name}`)
      }
      const instructions = `# DSH ${version} 更新准备结果\n\n状态：pending-manual（仅下载和清单验证完成，尚未启用）。\n\n当前进程仍运行 ${current}。新文件位于：${stage}\nNode：${process.execPath}\n\n安装使用 --ignore-scripts，未执行依赖安装脚本；原生模块等可能尚不能运行，不能视为已通过启动验收。请由维护人员审查目标版本 docs/upgrade-guide、插件 engines.dsh 和安装脚本后，在独立 DSH_HOME 演练。不要直接对生产 profile 启动此目录。\n\n请按实际部署方式确认启动入口、Node 版本和启动参数。启用前备份配置和会话数据、确认任务空闲、按目标版本迁移指南操作，在维护窗口重启并核验实际运行版本。保留当前安装和启动配置以便回滚。\n\n本次操作未修改运行安装、用户 profile、启动器或计划任务，未停止或重启任何进程。失败时保留隔离目录以便排查。\n`
      await writeFile(path.join(stage, 'UPDATE-INSTRUCTIONS.md'), instructions, { flag: 'wx' })
      state.job = { ...state.job, status: 'pending-manual', message: '新版文件已隔离准备并校验清单。安装脚本被禁用，尚需人工审查、演练与计划重启；当前版本未改变。' }
      return snapshot()
    } catch (e) {
      state.job = { status: 'failed', version, ...(stage ? { path: stage, id: path.basename(stage) } : {}), message: messageOf(e) }
      throw e
    } finally {
      if (lockHandle) {
        // Only remove the exact empty lock directory acquired by this invocation.
        const { rmdir } = await import('node:fs/promises')
        await rmdir(lockHandle).catch(() => {})
      }
      preparing = false
    }
  }
  return { snapshot, check, prepare, waitForIdle: async () => { await preparation; return snapshot() }, dispose: async () => { disposed = true; lifetime.abort(); await preparation } }
}
