# DSH Version Sentinel / DSH 版本哨兵

**DSH Version Sentinel** is a community plugin that tells you when a newer version of DeepSeek Harness Web is available. It checks npm at startup and falls back to the mainland China npm mirror (npmmirror) if the official registry is unreachable. When it finds an update, a green arrow appears at the bottom of the sidebar. Click it to browse versions and tell stable releases apart from prereleases. Checks run quietly and never install updates or restart DSH.

**[Download v1.0 (.tgz)](https://github.com/xpopux/dsh-version-sentinel/releases/download/v1.0/dsh-version-sentinel-1.0.0.tgz)** · [Release notes](https://github.com/xpopux/dsh-version-sentinel/releases/tag/v1.0)

This community release (`1.0.0`) was tested with the npm installation of **DSH Web `0.2.3-alpha.2` on Windows**. It is not an official DeepSeek updater.

## Installation

In the DSH Web profile, use **Plugins → Add plugin** and select the repository or release package. For a verified local checkout, run `dsh plugin --profile web add <absolute-path-to-plugin>`.

If replacing an earlier local development copy, disable that copy first; do not run both under the same profile. Refresh the page after installation and restart DSH only if its plugin manager asks you to.

## Usage

Open **Version sentinel / 版本哨兵** at the sidebar foot (↑ in the collapsed rail).

- Checks the official npm registry on activation and hourly while DSH is running. If it cannot load the official catalog, it reads the mainland China npmmirror catalog. Mirror data can lag and is for detection only; preparing an update still requires official npm verification. It is not a Windows scheduled task.
- Stable and prerelease releases have distinct text and theme-aware colors. Alpha, Beta and RC are prereleases; the npm `latest` tag is displayed literally, never treated as proof of stability.
- Shows running version, last check, channel filters, published versions and errors. Deprecated, current and older versions cannot be selected for upgrade.
- Preparation requires an explicit owner-only confirmation, then uses a separate directory. It does not replace the running installation, change the profile or boot scripts, stop processes, or restart DSH.
- **Preparation is not activation.** npm lifecycle scripts are disabled. Native dependencies may still need manual setup. Read the generated instructions, review compatibility and back up the profile before manually switching the existing launcher and restarting during a safe window.
- Agent tool `dsh_update_check` only checks versions. The install confirmation is user-only.
- The sidebar entry becomes a large green arrow only when the check finds a newer version. Click it to see the versions; when there is no update or a check fails, the entry stays neutral and no notification pops up.

## Compatibility / 兼容性

Verified originally on the Windows npm installation of DSH Web `0.2.3-alpha.2`. The Host requires the npm DSH CLI entry (`lib/bin.js`). Desktop, source checkouts, and other DSH versions have not been validated. Download preparation requires an npm CLI alongside the active Node executable and a standalone installation whose same-version DSH companion packages can be verified. Unsupported layouts fail without changing the running installation. Network access is limited to the selected npm release sources for detection; npm may also fetch dependencies when you explicitly prepare a version.

本版验证环境为 Windows 下通过 npm 安装的 DSH Web `0.2.3-alpha.2`。Desktop、源码启动及其他版本未验证。下载准备只支持能校验同版本配套包的独立 npm 部署，不满足条件会报错，不会改动正在运行的版本。检查失败会保留旧列表并显示错误，不会误报“已经最新”。

安装插件本身不会升级或重启 DSH，也不会执行任何依赖安装脚本。移除/停用插件可关闭检查和 UI；已准备的独立目录不会自动删除。
