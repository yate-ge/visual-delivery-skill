[English](./README.md) | [中文](./README.zh-CN.md)

# Visual Delivery Skill

一个 Agent 技能，将任务结果以可视化交互网页呈现，并支持用户直接在页面上反馈。适用于 [Claude Code](https://docs.anthropic.com/en/docs/claude-code)、[Codex](https://github.com/openai/codex)、[OpenClaw](https://github.com/anthropics/open-claw) 及其他支持 Skill 协议的 Agent 框架。

## 它做了什么

Agent 不再将结果以纯文本形式堆在对话里，而是**生成一个网页**来呈现任务结果——仪表盘、对比表格、代码审查、数据可视化，或是任何让结果易于查看和决策的布局。

你在浏览器中打开页面，直观地查看结果，然后**直接在页面上反馈**：标注文本、点击操作按钮、或输入评论。Agent 读取你的反馈后继续工作——修复你标记的代码、修改你评论的段落、或沿着你选择的方向深入。

这在"Agent 做事"和"人类审查"之间形成了闭环，让协作比在对话中来回沟通更高效、更精准。

### 核心特性

- **生成式 UI** — 每个交付页面都是根据任务独特生成的。没有固定模板，Agent 从零开始设计布局、内容和交互。
- **结构化反馈** — 标注任意文本、点击逐项操作按钮（如「接受修复」「延后处理」）、或输入自由文本。反馈自动回传给 Agent。
- **设计令牌** — 可自定义颜色、字体和间距。通过设置页面编辑，或直接让 Agent 帮你调整。
- **多语言支持** — 内置英文语言包。其他任何语言由 Agent 在启动时自动生成。
- **实时更新** — 通过 WebSocket 推送，交付内容和反馈即时呈现。
- **本地优先** — 运行在 `localhost:3847`。可选通过 [cloudflared](https://github.com/cloudflare/cloudflared) 隧道提供远程访问。

## 安装

将本仓库克隆或复制到 Agent 框架的 skills 目录下：

```bash
# Claude Code
cp -r visual-delivery-skill your-project/.claude/skills/

# Codex
cp -r visual-delivery-skill your-project/.codex/skills/
```

Agent 会自动发现并加载该技能。

## 使用方法

启动对话并触发技能：

```
你: 启动视觉交付
```

Agent 会依次：

1. **启动服务** — 在端口 3847 启动本地服务
2. **显示访问地址** — `http://localhost:3847`
3. **询问远程访问** — 仅本地使用，还是启动隧道供外部访问

启动后，适合可视化呈现的任务结果会自动以交互网页形式交付。

### 触发模式

控制 Agent 何时使用视觉交付（可在设置页面配置）：

| 模式 | 行为 |
|------|------|
| **智能**（默认） | Agent 根据上下文决定——复杂结果用可视化，简单回答用纯文本 |
| **自动** | 所有结果都以可视化页面交付 |
| **手动** | 仅在你明确要求时才使用视觉交付 |

### 反馈工作流

1. Agent 交付一个包含逐项反馈选项的可视化页面
2. 你查看并提供反馈：
   - **文本标注** — 选中任意文字添加评论
   - **操作按钮** — 针对每项内容的上下文选项（如「接受修复」「延后处理」「不修复」）
   - **自由文本** — 每项内容的「其他...」输入框 + 全局补充评论
3. 在侧边栏中提交反馈
4. Agent 处理反馈、更新页面、继续工作

## 架构

```
visual-delivery-skill/
├── SKILL.md                  # Agent 指令文件（技能入口）
├── scripts/
│   ├── start.js              # 启动服务 + 构建前端
│   └── stop.js               # 优雅停止
├── references/               # SKILL.md 的补充参考文档
│   ├── api.md
│   ├── generative-ui-guide.md
│   ├── feedback-schema.md
│   └── design-system.md
└── templates/                # 首次启动时复制到运行时目录
    ├── server/               # Express + WebSocket 后端
    ├── ui/                   # React + Vite 前端
    ├── locales/              # 内置语言包
    └── design/               # 默认设计令牌
```

### 运行时

首次启动时，`start.js` 将 `templates/` 复制到项目的 `.visual-delivery/` 目录，安装依赖、构建前端、启动服务。该运行时目录已被 gitignore，会按需重新生成。

### 工作原理

1. Agent 分析任务结果，设计页面布局
2. 生成一个自包含的网页（内联样式和脚本）
3. 将页面发布到本地服务
4. 前端在沙箱 iframe 中渲染页面
5. 桥接脚本实现页面与反馈侧边栏之间的通信

Agent 可使用 Tailwind CSS、Chart.js、Mermaid、D3.js、Highlight.js 等 CDN 库构建丰富的可视化效果。

## 配置

### 设计令牌

通过设置页面自定义视觉外观，或直接告诉 Agent：

> "把主色调改成紫色"

令牌涵盖颜色（主色、背景、表面、文本、边框）、字体（字族、字号）和间距。

### 平台品牌

通过设置页面自定义平台名称、Logo、标语和视觉风格。

## 许可证

本项目基于 [MIT 许可证](./LICENSE) 开源。
