# Changelog

## Unreleased

- 新增官方市场分发架构（spec 见 `.scratch/official-marketplace/spec.md`）：`npm run build` 现在直接产出唯一 canonical 官方布局目录 `build/official/plugins/zcode-plugin-honcho/`（esbuild 仅运行一次，ZIP 与官方目录副本均为同一产物的字节拷贝）；bundle 头部带版本来源标记。
- `npm run package:plugin` 改为归档该官方布局目录（ZIP 内新增 README 双语版、LICENSE、元数据 package.json；运行时行为不变）；新增 `validate:official` 与 `dist` 脚本。
- 新增 `npm run sync-official`：把官方布局目录复制入 `zai-org/zcode-plugins` 的本地 fork、upsert 根 marketplace 条目、提交并推送同步分支；支持 `--dry-run`/`--no-push`/`--allow-dirty`/`--dir`/`--branch`，重复运行幂等。
- `docs/releasing.md` 更新：修正「官方目录引用 ZIP-URL」的过期描述（官方 validator 只接受 `./plugins/<name>` 入树条目），改为官方同步流程。

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
