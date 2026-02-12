[English](./README.md) | [中文](./README.zh-CN.md)

# Visual Delivery Skill

一个 [Claude Code](https://docs.anthropic.com/en/docs/claude-code) 技能，让 Agent 将任务结果以富交互网页的形式交付，并直接在页面上收集结构化反馈。

## 它做了什么

安装后，Agent 会为每个任务生成**完整的 HTML 页面**（仪表盘、图表、交互表格、代码审查、方案对比……），通过本地 Web 界面展示。用户在浏览器中直接查看结果、标注文本、点击操作按钮或输入自由文本来提供反馈——反馈会自动回传给 Agent 处理。

### 核心特性

- **生成式 UI** — Agent 为每次交付生成完整的 HTML+CSS+JS 页面，没有预定义模板，每次交付都是独特的。
- **结构化反馈** — 文本标注（选中任意文字即可评论）、逐项操作按钮、自由文本输入。反馈自动回流给 Agent。
- **设计令牌系统** — 通过 CSS 变量（`--vds-*`）自定义颜色、字体、间距。可在设置页面编辑，也可以让 Agent 帮你调整。
- **多语言支持** — 内置英文语言包。其他任何语言由 Agent 在启动时自动生成。
- **实时更新** — WebSocket 从服务端推送到浏览器，交付内容和反馈即时呈现。
- **本地优先** — 运行在 `localhost:3847`。可选通过 [cloudflared](https://github.com/cloudflare/cloudflared) 隧道提供远程访问。

## 环境要求

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI
- Node.js 18+
- （可选）[cloudflared](https://github.com/cloudflare/cloudflared)，用于远程访问

## 安装

将技能目录复制到项目的 Claude Code skills 文件夹中：

```
your-project/
└── .claude/
    └── skills/
        └── visual-delivery-skill/   ← 本仓库
            ├── SKILL.md
            ├── scripts/
            ├── templates/
            └── references/
```

就这样。Claude Code 会自动发现 `.claude/skills/` 下的技能。

## 使用方法

启动对话并触发技能：

```
你: 启动视觉交付
```

Agent 会依次：

1. **启动服务** — 在端口 3847 启动 Express + Vite 本地服务
2. **显示访问地址** — `http://localhost:3847`
3. **询问远程访问** — 仅本地使用，还是启动 cloudflared 隧道

启动后，Agent 会自动判断哪些任务结果适合以可视化页面交付。

### 触发模式

控制 Agent 何时使用视觉交付（可在设置页面配置）：

| 模式 | 行为 |
|------|------|
| **智能**（默认） | Agent 根据上下文决定——复杂结果用可视化，简单回答用纯文本 |
| **自动** | 所有结果都以可视化页面交付 |
| **手动** | 仅在你明确要求时才使用视觉交付 |

### 反馈工作流

1. Agent 交付一个包含逐项反馈按钮的可视化页面
2. 你查看并提供反馈：
   - **文本标注** — 选中任意文字添加评论
   - **操作按钮** — 针对每项内容的上下文选项（如「接受修复」「延后处理」「不修复」）
   - **自由文本** — 每项内容的「其他...」输入框 + 全局补充评论
3. 在侧边栏中提交反馈
4. Agent 处理反馈、更新交付页面、标记已处理项

## 架构

```
visual-delivery-skill/
├── SKILL.md                  # Agent 指令文件（技能入口）
├── CLAUDE.md                 # 开发指南
├── scripts/
│   ├── start.js              # 启动服务 + 构建前端
│   └── stop.js               # 优雅停止
├── references/               # SKILL.md 的补充参考文档
│   ├── api.md                # REST API 参考
│   ├── generative-ui-guide.md
│   ├── feedback-schema.md
│   └── design-system.md
└── templates/                # 首次启动时复制到运行时目录
    ├── server/               # Express + WebSocket 后端
    │   ├── index.js
    │   ├── routes/api.js
    │   └── lib/              # store, ws, ids, time
    ├── ui/                   # React + Vite 前端
    │   └── src/
    │       ├── pages/        # Dashboard, DeliveryPage, Settings
    │       ├── components/   # GeneratedContentFrame, FeedbackSidebar, ...
    │       ├── hooks/        # useWebSocket, useDeliveries, useDesignTokens
    │       └── lib/          # bridge.js, api.js, i18n.js, theme.js
    ├── locales/              # 内置语言包
    └── design/               # 默认设计令牌
```

### 运行时

首次启动时，`scripts/start.js` 将 `templates/` 复制到 `{项目}/.visual-delivery/`，安装依赖、构建前端、启动服务。该运行时目录已被 gitignore，会按需重新生成。

### 生成式 UI 工作原理

1. Agent 分析任务结果，设计页面布局
2. 生成完整的 `<!DOCTYPE html>` 页面（内联 CSS/JS）
3. 通过 `POST /api/deliveries` 发布到服务端
4. 前端在沙箱 iframe 中渲染页面
5. **桥接脚本**被注入 iframe，实现：
   - 文本选中 → 标注反馈
   - `data-vd-feedback-*` 按钮点击 → 结构化反馈
   - iframe 高度自动同步
   - 设计令牌作为 CSS 变量注入

支持的 CDN 库包括 Tailwind CSS、Chart.js、Mermaid、D3.js、Highlight.js 等。

## 配置

### 设计令牌

通过设置页面或 API 自定义视觉外观：

```bash
# 读取当前令牌
curl http://localhost:3847/api/design-tokens

# 通过设置页面修改，或直接告诉 Agent：
# "把主色调改成紫色"
```

令牌包括颜色（主色、背景、表面、文本、边框）、字体（字族、字号）和间距。

### 平台品牌

通过设置页面或 `PUT /api/settings` 自定义平台名称、Logo、标语和视觉风格。

## API 概览

| 端点 | 说明 |
|------|------|
| `GET /health` | 健康检查 |
| `GET /api/deliveries` | 列出所有交付 |
| `POST /api/deliveries` | 创建新交付 |
| `GET /api/deliveries/:id` | 获取交付详情 |
| `PUT /api/deliveries/:id/content` | 更新交付内容 |
| `GET /api/deliveries/:id/feedback` | 获取反馈（轻量） |
| `POST /api/deliveries/:id/feedback/resolve` | 标记反馈已处理 |
| `GET /api/settings` | 读取设置 |
| `PUT /api/settings` | 更新设置 |
| `GET /api/design-tokens` | 读取设计令牌 |
| `GET /api/locale` | 读取 UI 语言包 |
| `PUT /api/locale` | 更新 UI 语言包 |

完整 API 文档：[references/api.md](references/api.md)

## 开发

所有源代码在 `templates/` 目录中。运行时目录（`.visual-delivery/`）是生成产物，不要直接编辑。

```bash
# 启动服务（中文）
node scripts/start.js --data-dir /path/to/.visual-delivery --lang zh

# 启动服务（英文）
node scripts/start.js --data-dir /path/to/.visual-delivery --lang en

# 停止服务
node scripts/stop.js --data-dir /path/to/.visual-delivery

# 健康检查
curl -s http://localhost:3847/health
```

修改 `templates/` 下的文件后，需要重启服务以同步到运行时目录。

## 许可证

本项目基于 [MIT 许可证](./LICENSE) 开源。

你可以自由地在个人和商业项目中使用、修改和分发本软件。详见 [LICENSE](./LICENSE) 文件。
