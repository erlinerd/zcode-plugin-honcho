# 官方 ZCode 市场接入方案调研

日期：2026-09-13（v2，含 PR 通道现状修正） · 状态：结论已定，待执行
问题：`zcode-plugin-honcho`（本仓库，TS + esbuild + @honcho-ai/sdk）如何进入官方插件市场 `zai-org/zcode-plugins`（ZCode 内置插件列表）。

## 结论

**提交形态有同类先例，但接受率当前为 0/8，期望值按"排队待审"管理：走路线 A 提交（成本低、无损失），但官方内置列表的上架时间不可控；实际分发继续依赖 git 个人市场通道（已通）。**

分层看：

- **技术形态已验证**：PR #11（同作者姊妹插件 zcode-plugin-langfuse）证明 TS→裸 .mjs 零构建改造可行，结构可复用。
- **接受未验证**：官方仓库历史上 **9 个社区 PR 全部 open、0 merged、零审阅、CI 不跑**（PR #11 创建 24h+，0 reviews / 0 comments / no checks）；真正进官方目录的实证通道是内部 `ZCode Marketplace Bot` 管线（tianyancha、finance、gitlab、lark-cli 等全部 bot 直推）。
- **外链条目**：validate.py 代码层面封死（证据 1），无先例无例外通道，git 安装只在"个人市场"车道有效。

## 证据表

| # | 事实 | 来源 |
| --- | --- | --- |
| 1 | 官方目录条目 source 必须精确匹配 `./plugins/<name>`，git/url/zip 外链条目直接 `err` | `scripts/validate.py` L167-175（zai-org/zcode-plugins@main） |
| 2 | 现有 19 个条目全部是 `./plugins/<name>`，零外链 | `marketplace.json`（同仓库 main） |
| 3 | `url+zip+sha256` 格式是官方**发布管线输出**：`build_dist.py` 把 `./plugins/<name>` 重写为 CDN zip 条目（`_artifact`、`CDN_BASE_URL`），不是社区提交格式 | `docs/distribution.md`、`scripts/build_dist.py` 头注释 |
| 4 | 官方安装流程 = 下载 → sha256 校验 → 解压 → 原子替换，**无 npm install 步骤** | `docs/distribution.md` "Installation Flow" |
| 5 | plugins/ 下除 video2code 的 **skill 输出模板**（web-replicate/templates/，脚手架非构建设施）外，无任何 package.json/tsconfig/dist；零插件带构建链 | 全量文件树 `git/trees/main?recursive=1`（1857 文件） |
| 6 | CONTRIBUTING 禁止提交 build output、混淆源码；要求双语 README、记录网络/副作用；版本不可变 | `CONTRIBUTING.md`、`docs/PLUGIN_DEVELOPMENT.md` §1.3 |
| 7 | 官方 hook 形态：`{"type":"process","command":"node","args":["${ZCODE_PLUGIN_ROOT}/...mjs"],"timeoutMs":120000}` 裸 .mjs 直跑，无依赖 | `plugins/mimosa/hooks/hooks.json`；`plugins/example-plugin/hooks/session-start.mjs` |
| 8 | **先例（形态）**：PR #11 `feat(zcode-plugin-langfuse)` = 同作者姊妹插件入仓申请，文件 = 纯 JS 模块（hooks/entry.mjs、extract.mjs、state.mjs、tracker.mjs、langfuse.mjs、config.mjs）+ package.json（元数据）+ LICENSE + THIRD_PARTY_NOTICES + 双语 README | `repos/zai-org/zcode-plugins/pulls/11/files` |
| 9 | issues 里唯一"外部包"提案（ru-RU，issue #3）以 issue 形式存在，未进目录；没有任何外链条目 PR | `search/issues?q=repo:zai-org/zcode-plugins` |
| 10 | **9 个社区 PR 全部 open、0 merged、PR #11 零 review/零评论/无 CI check**（创建 24h+，mergeable_state=blocked） | `pulls?state=all`、`pulls/11`（2026-09-13 查询） |
| 11 | main 全部提交来自 `ZCode Marketplace Bot`（内部管线直推：tianyancha、finance、video2code、gitlab、lark-cli…）；`0ca3d01` 连 example-plugin 都移出了 marketplace 索引 | `commits?per_page=15` |

## 路线评估

### A. 官方仓库放零构建纯 JS 版（本仓库 TS+SDK 为上游）— ✅ 推荐，但期望值改为"排队"

- **可行性**：提交形态有同类先例（PR #11，证据 8）；我们 hooks 协议与官方形态一致，仅需去构建化。
- **接受不确定性（关键修正）**：官方仓库**从未合入任何社区 PR**（0/9，证据 10）；上架的实证通道是内部 bot 管线（证据 11）。提交 = 排队等官方开始审社区贡献，时间不可控，可能长期无响应。
- **成本**：把 src/*.ts 移植为 hooks/ 下若干裸 .mjs（fetch 实现 minimal Honcho REST 客户端替代 SDK），结构抄 langfuse PR；约半天。
- **为什么仍然值得提交**：边际成本低、无损失（PR open 不影响个人市场分发）；一旦官方开始处理社区队列即自动获得曝光。
- AGENTS.md 冲突：官方目录的副本不是本仓库代码，不适用本仓库 TS+SDK 标准；本仓库本身不改。

### C. 本仓库整体转零构建 JS（JSDoc）单一实现 — 备选

- 单一实现无漂移，但违反 AGENTS.md 两条（TS strict、官方 SDK），需重写已测代码 + 改标准，约半天到一天。langfuse 先例表明作者本人也选了"双仓"而非此路。

### D. 提 issue 请求外链例外 — 不支持

- 零先例（证据 2、9），validate.py 是维护者写的硬规则，被接受概率极低；仅可作为 A 的补充沟通。

### （已否决）提交 npm 项目指望用户端构建

- 官方安装流程无 npm 步骤（证据 4），zip 内无 dist 则 hook 直接断链；且 build_dist.py 不会跑构建。

## 建议

1. 执行路线 A，但按"排队待审"管理预期：新建 `plugins/zcode-plugin-honcho/`（裸 .mjs 模块 + hooks.json + 双语 README + LICENSE + THIRD_PARTY_NOTICES），根 marketplace.json 注册（category: `developer-tools`），本地跑 `python3 scripts/validate.py && python3 scripts/build_dist.py` 后 fork + PR；PR 正文模板抄 PR #11，并**顺带询问社区贡献的审阅节奏**。
2. 实际分发不以官方上架为前提：git 个人市场通道（已通）继续作为主渠道，v0.2.0 已可安装。
3. 版本对齐 0.2.0；后续发版时两仓同步 bump（官方仓库版本不可变原则，见证据 6）。
4. releasing.md 补一节"官方市场同步流程"，把漂移风险制度化。
