# ZCode 的 Honcho 长期记忆

一个小型、fail-open 的 ZCode 插件：

- `SessionStart` 召回有限的 Honcho 用户上下文；
- `Stop` 将 user/assistant turn 写入本地 outbox，再上传 Honcho；
- 网络失败时保留待发送记录，下次会话重试；
- 记忆服务失败不会阻塞 ZCode。

它不是 Langfuse 观测插件的复制品：默认不上传成功工具调用的输入输出，
也不读取隐藏思维链。

## 配置

在 ZCode 插件设置中填写，或使用同名环境变量：

```text
HONCHO_API_KEY
HONCHO_BASE_URL
HONCHO_WORKSPACE_ID
HONCHO_PEER_ID
HONCHO_ASSISTANT_PEER_ID
HONCHO_ENABLED
HONCHO_INJECT_CONTEXT
HONCHO_CAPTURE_PROMPTS
HONCHO_CAPTURE_RESPONSES
HONCHO_MAX_CONTEXT_CHARS
HONCHO_MAX_CAPTURE_CHARS
HONCHO_DEBUG
```

`HONCHO_BASE_URL` 默认是 `https://api.honcho.dev`，assistant peer 默认是
`zcode`。如果要和 Pi、Codex 或 Claude 共享记忆，workspace 和 peer ID 必须保持
稳定。

API key 只由本地 hook 进程读取，不要提交到 Git 或写入 `hooks/hooks.json`。

## 开发

需要 Node.js 20+：

```bash
npm ci
npm run check
npm run package:plugin
```

## 安装

ZCode 会把一个目录当作**插件市场**，本仓库根目录带有 `marketplace.json`。先构建，然后在
**Settings → Plugins → Add marketplace → Select directory** 选择本仓库目录，从个人市场安装
`honcho-memory`，启用并填写 `userConfig`。

也可以在线安装：在 **Settings → Plugins → Create → Add marketplace** 中填入 GitHub 仓库地址：

- 社区市场仓库：<https://github.com/erlinerd/zcode-plugin-honcho>
- 市场清单：<https://raw.githubusercontent.com/erlinerd/zcode-plugin-honcho/main/marketplace.json>
- 插件清单：<https://raw.githubusercontent.com/erlinerd/zcode-plugin-honcho/main/.zcode-plugin/plugin.json>
- 最新插件 ZIP：<https://github.com/erlinerd/zcode-plugin-honcho/releases/latest/download/plugin.zip>
- 最新 ZIP 校验文件：<https://github.com/erlinerd/zcode-plugin-honcho/releases/latest/download/plugin.zip.sha256>
- Release 页面：<https://github.com/erlinerd/zcode-plugin-honcho/releases/latest>

市场名为 `zcode-honcho-community`，其 `marketplace.json` 用 `source: "."` 指向仓库本身；
带版本的发布产物由打 tag 的 GitHub Actions 工作流生成。

安装后在插件设置里填 `honcho_api_key`、`honcho_workspace_id`、`honcho_peer_id`。
不填则插件按设计保持静默：hook 输出 `{}`，不读也不写任何记忆。

参考：

- [ZCode hooks](https://zcode.z.ai/en/docs/hooks)
- [ZCode memory](https://zcode.z.ai/cn/docs/memory)
- [Honcho MCP](https://honcho.dev/docs/v3/guides/integrations/mcp)
