# Changelog

## Unreleased

- 插件 id 与市场 id 统一为 `zcode-plugin-honcho`（原插件 id `honcho-memory`、市场 id `zcode-honcho-community`）。对已安装用户是 breaking change：需从市场重装新 id 的插件并重新保存 `userConfig`（选项键随 id 变化）；如需保留 outbox/会话状态，把 `~/.zcode/cli/plugins/data/honcho-memory/` 改名为 `zcode-plugin-honcho/`。

## 0.1.2 - 2026-09-13

- pending flush 加时间预算（SessionStart 2s / Stop 15s）：积压多时不再串行重试超出 hook 超时被 ZCode 击杀、丢失本次 recall；超预算条目留在 outbox 下次重试，剩余数上报到诊断。
- 文档对齐实现：CONTRACTS.md 移除不存在的 `ContextProvider` 端口并记录 flush 预算合同；新增 `CONTEXT.md` 词汇表；spec.md 的 session 映射描述改为实际的哈希方案；测试名修正。

## 0.1.1 - 2026-09-13

- 移除 `.npmrc`（`engine-strict=true`）：ZCode 插件安装器执行 `npm install` 时因引擎检查中止，导致 `prepare` 构建失败、缓存缺 `dist/`，hook 静默断链。
- 版本号升到 0.1.1，确保重装/更新时按新版本重建缓存。

## 0.1.0 - 2026-09-13

- Initial ZCode Honcho memory plugin scaffold.
