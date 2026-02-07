# Visual Delivery Skill — 开发指南

## 项目概述
这是一个 Claude Agent Skill，通过本地 Web 界面将任务结果以富视觉 UI 形式交付（Mermaid 图表、交互表格、仪表盘等）。

## 项目结构
```
.
├── SKILL.md              # Agent 指令文件（技能入口）
├── scripts/              # Node.js 脚本（start.js, stop.js, await-feedback.js）
├── references/           # SKILL.md 的补充参考文档
├── templates/            # 只读模板（首次运行复制到工作目录）
│   ├── server/           # Express + WebSocket 服务端
│   ├── ui/               # React + Vite 前端
│   └── design/           # 设计令牌模板
└── .dev/                 # 开发文档与设计规格
    ├── skill-dev-experience.md  # 技能开发经验总结（持续更新）
    ├── architecture.md
    ├── skill-spec.md
    ├── skill-best-practices.md
    └── ...其他设计文档
```

运行时工作目录：`{CWD}/.visual-delivery/`（不在 skill 目录内）

## 技术栈
- **Server**: Node.js 18+, Express, ws (WebSocket)
- **Frontend**: React 18, Vite, CSS Modules + CSS Variables
- **存储**: JSON 文件（无数据库）
- **脚本**: Node.js（跨平台，不用 bash）

## 开发规范

### SKILL.md 编写
- 主文件不超过 500 行，详细规格放 `references/`
- 参考文件仅一级深度（SKILL.md → references/xxx.md，不再嵌套）
- description 用第三人称，不超过 1024 字符
- 统一术语：delivery（交付）、feedback（反馈）、annotation（标注）、blocking/interactive/passive（模式）

### 脚本
- 三个脚本各司其职，不添加新脚本
- 错误处理：脚本自己解决问题，不甩给 agent
- `already_running` 是成功（exit 0），超时也是正常退出

### 前端
- 运行时在工作目录构建，不预构建
- 所有样式通过 CSS 变量（设计令牌），不硬编码颜色
- WebSocket 单向推送（Server→Browser），数据提交用 REST API

### 数据模型
- Per-Delivery 文件结构：`data/deliveries/{id}/` 下独立文件
- 原子写入 + 文件锁，支持并发

## 经验文档
开发过程中积累的经验和反模式记录在 `.dev/skill-dev-experience.md`，请在开发中持续更新。

## 常用命令
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
