# Changelog

## Unreleased

- 发行架构对齐 zcode-plugin-langfuse 终版设计：`dist/` 定型为「市场壳 + 官方模板插件布局」——`dist/marketplace.json`（source `./plugins/<name>`）+ `dist/plugins/zcode-plugin-honcho/`（`.zcode-plugin/` 与 `.claude-plugin/` 双 manifest、`hooks/hooks.json`、直达 bundle `hooks/entry.mjs`（无 dist 段、无 sourcemap）、双语 README、LICENSE、THIRD_PARTY_NOTICES）。根 `marketplace.json` 的 entry 改指 `./dist/plugins/<name>` 并补 `description_i18n`/`category`/`tags`/`strict`。
- 新增根级 `.claude-plugin/plugin.json`（与 `.zcode-plugin/plugin.json` 深度相等，Claude 兼容）；`hooks/hooks.json` 入口改为 `${ZCODE_PLUGIN_ROOT}/hooks/entry.mjs`。
- 新增 `scripts/build-layout.mjs`（`validatePluginRoot`：壳 source、manifest 对齐、双 manifest 深度相等、hook 事件集与入口参数、8 个必需文件、构建来源标记、无符号链接、文件/字节上限）；`scripts/build.mjs` 组装 dist 后自校验。
- `scripts/validate.mjs` 重写：校验根 manifest 与 `.claude-plugin` 深度相等、根 marketplace source 必须为 `./dist/plugins/<name>`；`--artifact` 校验 dist bundle 构建标记。
- `scripts/package-plugin.mjs` 删除：ZIP 只由 release workflow 从 `dist/` 打包（资产名 `zcode-plugin-honcho-v<version>.zip` + sha256）；`package:plugin` = build + validate + validate:artifact。
- `scripts/sync-official.mjs` 替换为 `scripts/sync-catalog.mjs`（`npm run sync:catalog`）：镜像 `dist/plugins/<name>` 八件套入 fork、用壳 manifest 逐字构造目录条目（含 `description_i18n`）、`--repo` 必填、`--push` 显式、以 git 跟踪集判定幂等、`add --force` 防 fork gitignore 吞 bundle。
- 新增 `.github/workflows/catalog-sync.yml`：打 tag 自动同步官方目录 fork（`CATALOG_SYNC_PAT` + bot 身份 + push 校验）；ci.yml 去掉旧 artifacts checksum 步骤。
- 文档更新：`docs/releasing.md` 改为「dist 市场树 + ZIP 发布 + catalog 同步」流程；README 安装说明改为「发行 ZIP 解压即市场」，并明确新 clone 不可直接作市场。

## 0.2.0 - 2026-09-13

- 插件 id 与市场 id 统一为 `zcode-plugin-honcho`（原插件 id `honcho-memory`、市场 id `zcode-honcho-community`）。对已安装用户是 breaking change，升级步骤：
  1. 在 **Settings → Plugins** 删除旧市场 `zcode-honcho-community`，用仓库地址重新添加市场（新市场名 `zcode-plugin-honcho`）并安装插件；
  2. 在插件设置重新保存 `userConfig`——选项键随 id 变化，不重存则插件静默停用（fail-open）；
  3. 如需保留 outbox/会话状态，把 `~/.zcode/cli/plugins/data/` 下的旧目录改名为 `zcode-plugin-honcho@zcode-plugin-honcho/`（ZCode 实际布局是 `<插件id>@<市场id>`；仅 ZCode 未托管、走代码 fallback 的场景才叫 `honcho-memory/`）。

- 开发依赖升级：typescript 7.0、vitest 5、esbuild 0.28、@types/node 26（dev-only，构建产物不受影响）；CI actions 升至 v7，release 日志不再出现 node20 强升警告。

## 0.1.2 - 2026-09-13

- pending flush 加时间预算（SessionStart 2s / Stop 15s）：积压多时不再串行重试超出 hook 超时被 ZCode 击杀、丢失本次 recall；超预算条目留在 outbox 下次重试，剩余数上报到诊断。
- 文档对齐实现：CONTRACTS.md 移除不存在的 `ContextProvider` 端口并记录 flush 预算合同；新增 `CONTEXT.md` 词汇表；spec.md 的 session 映射描述改为实际的哈希方案；测试名修正。

## 0.1.1 - 2026-09-13

- 移除 `.npmrc`（`engine-strict=true`）：ZCode 插件安装器执行 `npm install` 时因引擎检查中止，导致 `prepare` 构建失败、缓存缺 `dist/`，hook 静默断链。
- 版本号升到 0.1.1，确保重装/更新时按新版本重建缓存。

## 0.1.0 - 2026-09-13

- Initial ZCode Honcho memory plugin scaffold.
