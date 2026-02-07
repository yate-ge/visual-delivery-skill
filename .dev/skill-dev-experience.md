# Agent Skill 开发经验总结

> 基于 Visual Delivery Skill 项目的实践经验，持续更新。

---

## 一、Skill 架构设计原则

### 1.1 Template → Instance 模式（核心）
- **Skill 目录**（`templates/`）保持只读，存放源模板
- **工作目录**（`{CWD}/.visual-delivery/`）存放运行时文件和用户自定义内容
- 首次运行时复制模板，后续运行复用已有文件
- 好处：skill 可分享、用户自定义不被覆盖、升级不丢数据

### 1.2 三层分离
| 层 | 职责 | 技术 |
|---|---|---|
| **Skill 层** | SKILL.md 指令 + 脚本 | 只做确定性操作 |
| **Server 层** | HTTP API + WebSocket + 文件 I/O | Express + ws |
| **Frontend 层** | 用户界面 | React + Vite |

### 1.3 Per-Delivery 数据模型（非单体文件）
```
data/deliveries/{id}/
├── delivery.json      # 完整记录
├── annotations.json   # 用户标注
├── feedback.json      # 用户反馈
└── session.json       # 阻塞模式专用
```
- 每个 delivery 独立目录，独立文件锁
- 好处：减少锁竞争、按需读取、并行写入、干净删除

### 1.4 JSON 文件存储（无数据库）
- Agent 可直接读写文件，无需 ORM
- 原子写入：先写临时文件，再 rename
- 文件锁：`fs.writeFileSync(lockPath, pid, { flag: 'wx' })` 实现原子 check-and-create
- 过期锁检测：检查 PID 是否存活，死锁自动清理

---

## 二、SKILL.md 编写规范

### 2.1 核心原则：简洁 + 渐进式披露
- 主文件 **不超过 500 行**，只包含 agent 不知道的信息
- 详细规格放在 `references/`（仅一级深度，不嵌套）
- 每段文字都要问："这值得占用 token 吗？"
- 超过 100 行的参考文件必须有目录

### 2.2 激活规则模式（Two-Phase Activation）
**解决问题**：没有激活状态的 skill 会被 agent 忽略

**实现方式**：
- `description` 前置描述中明确声明激活规则
- 未初始化：`server.pid` 不存在 → 休眠，等用户显式命令
- 已初始化：`server.pid` 存在 → 始终激活，所有结果走可视化交付
- 每次交互 Step 1：健康检查，服务挂了就自动重启

### 2.3 统一术语（非协商性）
| 术语 | 含义 | 不要用 |
|---|---|---|
| delivery | 任务结果发布 | result, output, report |
| feedback | 用户结构化回复 | response, input, answer |
| annotation | 用户对内容的评论 | comment, note, remark |
| blocking | 等待反馈模式 | waiting, polling |
| interactive | 异步反馈 | async, non-blocking |
| passive | 仅展示模式 | static, read-only |
| session | 阻塞等待上下文 | request, ticket |

### 2.4 指令覆盖范围
- **写指令**的场景：agent 自由度高的操作（模式选择、内容格式）
- **不写指令**的场景：低自由度操作给精确命令（脚本启动命令）
- **必须写的**：用户通知——每一步都要告诉用户正在做什么

### 2.5 描述（description）写法
- 注入到系统提示，必须用**第三人称**
- 正确："Delivers task results visually..."
- 错误："Use when you need to..." / "I can deliver..."
- 不超过 1024 字符，说明 WHAT 和 WHEN

---

## 三、脚本开发规范

### 3.1 三个脚本，各司其职
| 脚本 | 职责 |
|---|---|
| `start.js` | 初始化 + 启动服务（模板复制、依赖安装、构建、环境检测） |
| `stop.js` | 进程清理（服务器 + 隧道） |
| `await-feedback.js` | 阻塞轮询（单进程运行） |

### 3.2 Node.js（非 bash）
- 跨平台兼容（Windows/macOS/Linux）
- 原生 `fs.cpSync()`, `process.kill()` 跨平台工作
- 依赖最小化：仅 express, ws

### 3.3 错误处理哲学：脚本解决问题，不甩给 agent
- 所有错误包含具体指引（"安装 X: brew install X"）
- `already running` = 成功（exit 0），不是错误
- cloudflared 缺失 = 信息提示，不是错误（继续本地运行）
- 超时 = 正常退出（exit 0），delivery 保持开放

### 3.4 进程管理（跨平台）
- PID 文件模式：启动时写 PID，健康检查时读取
- `process.kill(pid, 0)` 测试进程是否存活
- `process.kill(pid, 'SIGTERM')` 终止（Windows 自动映射到 TerminateProcess）
- 优雅关闭：关 WebSocket → 关 HTTP → 删 PID 文件 → 5s 后强制退出

---

## 四、前端与设计系统

### 4.1 运行时构建（非预构建）
- 前端源码在 `templates/ui/`，初始化时复制到工作目录
- 依赖装在工作目录，不污染 skill 目录
- 运行时 `npm run build` → 用户可自定义后重新构建

### 4.2 设计令牌系统
- 两文件架构：`design-spec.md`（人类读） + `tokens.json`（机器读）
- Token 扁平化：`colors.primary` → `--vds-colors-primary`
- CSS 变量驱动所有样式，无硬编码颜色
- Server 监听 tokens.json → WebSocket 广播 → 前端热重载（无刷新）

### 4.3 富内容渲染
- `html` 类型：自包含 HTML，支持内联 CSS/JS，`<script>` 标签会执行
- `markdown` 类型：支持 GFM + Mermaid 图表（原生支持 ```mermaid 代码块）
- 也可在 HTML 中通过 CDN 加载 Mermaid

### 4.4 WebSocket 策略
- **单向推送**：Server → Browser（新交付、更新、设计变更）
- **数据提交用 REST API**（更清晰的关注点分离）
- 自动重连：指数退避（1s, 2s, 4s, 8s, max 10s）

---

## 五、关键经验教训

### 5.1 做对了的
1. Template → Instance 分离 — 干净、可持久化
2. Per-Delivery 文件结构 — 并发安全、按需读取
3. 文件锁 + 过期检测 — 防数据损坏
4. 设计令牌 + CSS 变量 — 视觉自定义与代码解耦
5. WebSocket 热重载 — 设计改动即时可见
6. 三脚本模式 — 各司其职，错误处理明确
7. JSON 文件存储 — agent 直接读写，无额外依赖
8. 渐进式披露 — SKILL.md 保持简洁，参考文件提供深度

### 5.2 踩过的坑（反模式）
1. **不要用 bash 脚本** — Windows 不兼容，用 Node.js
2. **不要硬编码颜色/间距** — 用 CSS 变量，设计系统必须解耦
3. **不要单文件存所有数据** — 锁竞争、大文件解析慢
4. **不要把错误处理甩给 agent** — 脚本自己解决环境问题
5. **SKILL.md 不要超 500 行** — 用 references 放详细规格
6. **不要写 "如果...怎么办"** — 写 "做什么"，祈使句
7. **超时不是错误** — 正常退出，delivery 保持开放
8. **不要预构建前端** — 运行时构建，允许用户自定义
9. **description 不要用第一/二人称** — 始终第三人称
10. **一定要告诉用户** — 每步操作都通知，UX 是关键

### 5.3 微妙复杂度区域
- **阻塞超时**：不能是错误，需要清晰消息告诉 agent "不要重试"
- **端口冲突**：区分 "我们的服务占用" vs "外部进程占用"
- **并发写入**：per-delivery 文件锁必须严密，竞态条件会丢数据
- **设计令牌验证**：无效 JSON 不能崩服务，保留上次有效值
- **WebSocket 重连**：处理浏览器标签跨服务重启的持久化

---

## 六、i18n 实现模式

- `--lang zh|en` 参数传递：start.js → server → `/api/config` endpoint
- 前端 i18n 模块：`lib/i18n.js`，`t(key)` 函数
- 应用初始化时通过 `fetchConfig()` 加载语言配置
- 中文名：任务交付平台

---

## 七、环境检测与远程访问

- 自动检测远程环境（Codespaces、Gitpod、Replit、SSH、Docker 等）
- 远程访问现为 opt-in（`--remote` 标志），不再自动启用
- cloudflared 缺失时降级为本地访问，不报错

---

## 八、反馈模式（三种）

| 模式 | 数据流 | 适用场景 |
|---|---|---|
| **Passive** | Agent POST → 广播 → 展示 → 结束 | 只展示结果 |
| **Interactive** | Agent POST（含 schema）→ 用户提交 → agent 读 feedback.json | 异步收集反馈 |
| **Blocking** | await-feedback.js POST → 轮询 session → 用户响应 → agent 解除阻塞 | 需要即时决策 |

Feedback schema 类型：confirm、select、form、rating

---

## 九、持续更新日志

> 后续开发中遇到的新经验记录在此。

- *(初始化于 2026-02-07，基于 .dev/ 文档和历史对话)*
