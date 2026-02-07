# Runtime Dynamic Component 功能开发需求文档

## 1. 背景与问题

当前 Visual Delivery 的渲染模式是“预置组件 + 运行时数据填充”，组件类型固定为 `data_view`、`markdown`、`metric_grid`、`decision_form`。  
这导致两个核心问题：

1. 展示形式不能真正按任务需求动态变化（例如创新点总结更适合思维导图/结构图，而不是纯表格+文本）。
2. 反馈与执行闭环弱：用户虽然可提交反馈，但页面缺少“Agent执行过程与结果回写”的可视化状态。

目标是将技能从“固定模板渲染”升级为“需求驱动的运行时组件体系”，并支持组件持久化复用。

## 2. 目标与非目标

### 2.1 目标

1. 支持根据任务语义选择更合适的组件表达形式（图、表、卡、流程、决策等）。
2. 支持运行时定义组件（受控 DSL），无需每次前端手写新 React 组件。
3. 支持组件持久化注册、版本化管理、跨任务复用。
4. 补齐反馈执行闭环：用户反馈 -> Agent执行 -> 页面状态更新可见。
5. 保持现有任务交付与对齐流程兼容，不破坏已有交付数据。

### 2.2 非目标

1. 不支持执行任意用户 JavaScript（安全风险高）。
2. 不在首期引入复杂插件市场或远程组件下载机制。
3. 不在首期追求完全通用低代码平台能力。

## 3. 关键用户故事

1. 作为用户，我提出“总结核心创新点”时，页面应自动用更直观的图形结构展示（如思维导图）。
2. 作为用户，我希望在每条审查项上直接选择“确认 / 拒绝 / 需要修改”，并填写具体要求。
3. 作为用户，我提交反馈后，能看到 Agent 是否已处理、做了什么改动、处理结果是什么。
4. 作为 Agent，我希望根据任务目标组合组件，而不是被固定组件集限制表达。
5. 作为 Agent/系统维护者，我希望把好用的组件模板保存为可复用资产，下次直接引用。

## 4. 功能范围

## 4.1 Phase 1（短期，优先落地）

1. 新增可视化组件类型：`mermaid`（用于流程图/思维导图/架构图）。
2. 新增审查交互组件：`review_table`（逐项决策 + 备注）。
3. 新增交付执行状态区：`execution_timeline`（展示处理进度与结果摘要）。

## 4.2 Phase 2（中期）

1. 引入运行时动态组件 `runtime_widget`（基于受控 DSL 渲染）。
2. 引入组件注册表（`component_registry.json`）支持持久化复用。
3. 支持“交付引用组件版本”与“内联组件定义”并存。

## 4.3 Phase 3（长期）

1. 组件能力标注（capabilities）与自动推荐。
2. 组件模板治理（废弃、升级提醒、兼容策略）。
3. 组件质量评估指标（使用率、反馈质量、完成率）。

## 5. 概念模型与数据结构

### 5.1 组件来源模型

组件分为三类：

1. `builtin`：系统内置组件（向后兼容）。
2. `registry`：注册表组件（持久化、可复用）。
3. `inline_runtime`：一次性交付内联组件（可选持久化）。

### 5.2 交付组件定义（建议）

```json
{
  "id": "comp-innovation-map",
  "type": "mermaid",
  "source": "builtin",
  "title": "核心创新点思维导图",
  "props": {
    "diagram": "mindmap\n  root((核心创新))\n    ..."
  }
}
```

```json
{
  "id": "comp-review-table",
  "type": "review_table",
  "source": "builtin",
  "title": "问题逐条确认",
  "props": {
    "rows": [
      { "item_id": "A1", "title": "...", "severity": "critical" }
    ],
    "decision_options": ["confirm", "reject", "change_request"]
  }
}
```

```json
{
  "id": "comp-runtime-01",
  "type": "runtime_widget",
  "source": "inline_runtime",
  "title": "定制组件",
  "schema": {
    "layout": "...",
    "fields": "...",
    "actions": "..."
  }
}
```

### 5.3 组件注册表（建议）

路径：`{DATA_DIR}/data/component_registry.json`

```json
{
  "components": [
    {
      "component_key": "review_table",
      "version": "1.0.0",
      "renderer_type": "schema_v1",
      "title": "逐项审查表",
      "schema": {},
      "capabilities": ["row_decision", "feedback_emit"],
      "tags": ["patent", "review"],
      "created_at": "2026-02-07T00:00:00.000Z",
      "updated_at": "2026-02-07T00:00:00.000Z",
      "status": "active"
    }
  ]
}
```

### 5.4 执行状态事件（建议）

路径：`{DATA_DIR}/data/deliveries/{id}/execution-events.json`

```json
[
  {
    "id": "e_001",
    "feedback_id": "f_001",
    "stage": "in_progress",
    "message": "正在修改 content.md 中 A1 条目",
    "created_at": "2026-02-07T08:10:00.000Z"
  },
  {
    "id": "e_002",
    "feedback_id": "f_001",
    "stage": "completed",
    "message": "已完成 ASIC 术语修正",
    "created_at": "2026-02-07T08:12:00.000Z"
  }
]
```

## 6. API 需求（新增/扩展）

### 6.1 组件注册表 API

1. `GET /api/components`
2. `POST /api/components`
3. `GET /api/components/:component_key`
4. `POST /api/components/:component_key/versions`

### 6.2 执行状态 API

1. `GET /api/deliveries/:id/execution-events`
2. `POST /api/deliveries/:id/execution-events`

### 6.3 反馈结构扩展（建议）

现有 `interactive` payload 扩展为可判定结构：

```json
{
  "action": "review_decision",
  "item_id": "A1",
  "decision": "confirm",
  "notes": "术语修正同意"
}
```

`decision` 枚举：`confirm | reject | change_request`

## 7. 前端渲染需求

### 7.1 RuntimeRenderer 扩展

1. 新增 `mermaid` 渲染路由。
2. 新增 `review_table` 渲染路由。
3. 新增 `execution_timeline` 渲染路由。
4. 预留 `runtime_widget` 解释器入口。

### 7.2 交互行为要求

1. `review_table` 每行必须有决策选择与备注输入。
2. 提交时落入统一 feedback draft/commit 流程。
3. 提交后可在页面中查看“处理中/已完成/失败”状态。

### 7.3 兼容性要求

1. 旧类型继续可渲染。
2. 遇到未知类型时展示“降级卡片 + 原始配置摘要”，不崩溃。

## 8. 安全与治理

1. 禁止执行任意 JS；仅允许受控 schema 解释执行。
2. 对运行时 schema 做严格校验（字段白名单、深度限制、大小限制）。
3. 对 Mermaid 文本做长度与关键字限制，防止渲染阻塞。
4. 所有新增数据文件沿用原子写与文件锁策略。

## 9. 迁移与发布策略

1. 保持现有 `ui_spec` 兼容；新字段可选。
2. 首次启动时若无 `component_registry.json` 自动创建空结构。
3. 旧交付无执行事件文件时默认显示“暂无执行记录”。
4. 新功能以 feature flag 渐进发布：
   - `enable_mermaid_component`
   - `enable_review_table`
   - `enable_runtime_widget`
   - `enable_component_registry`

## 10. 验收标准

1. 创新点总结任务可输出并正确渲染 `mermaid` 思维导图。
2. 审查任务中每条问题可直接提交 `confirm/reject/change_request`。
3. Agent 处理反馈后，页面能看到执行事件更新，不仅是 resolved 计数变化。
4. 同一组件模板可被后续不同交付复用，且版本可追踪。
5. 所有新增能力不影响现有交付页正常打开与反馈提交流程。

## 11. 风险与缓解

1. 风险：动态组件设计过于复杂导致不可控。  
   缓解：先做 `mermaid + review_table + execution_timeline` 三个高价值组件，再推进 DSL。

2. 风险：安全边界不足（动态执行）。  
   缓解：不执行任意代码，仅做受控 schema 渲染。

3. 风险：文档与实现再次分叉。  
   缓解：新增能力必须同步更新 `SKILL.md`、`references/api.md`、`.dev/api-spec.md`。

## 12. 讨论待定项

1. `runtime_widget` 的 DSL 边界：只支持布局+字段，还是允许条件逻辑？
2. 组件注册表版本策略：语义化版本（semver）还是时间戳版本？
3. 执行状态是否需要“失败重试”语义与错误详情标准化？
4. 是否允许将“用户修订后内容 diff”直接回写在交付页中展示？

