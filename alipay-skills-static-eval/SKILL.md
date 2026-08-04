---
name: alipay-skills-static-eval
description: 静态评测小程序 agent skills 的质量。
disable-model-invocation: true
---

# 静态评测

通过并行子代理（sub-agent）评测小程序 agent skills 的质量。
主 agent 负责发现 skills、生成独立子任务并分发给 sub-agent，
最后汇总所有 sub-agent 的报告，整理成一份完整的评测报告。

## 能力边界

静态评测基于 skill 目录下的所有源文件（`SKILL.md`、`mcp.json`、以及关联的 JS 代码等）进行文本分析，不执行、不运行任何代码。

- **评测范围**：语义层面的缺陷和风险。例如指令是否清晰、场景覆盖是否完整、API 用法是否合理、边界情况是否考虑。
- **不评测**：代码结构层面的缺陷。例如语法错误、JSON 格式问题、文件路径拼写错误等。这些在构建阶段就会被阻塞，不需要静态评测来发现。

## 步骤

### 1. 收集输入

确认以下四项输入。缺少必要项时停止并询问用户。

- **项目路径** — 小程序项目根目录的路径。必填。
- **输出文件** — 最终评测报告写入哪个文件。必填 — 用户未指定时必须主动询问。
- **评测范围** — 指定要评测的 skill 名称列表，或「全部」。默认：评测项目中的**每一个** skill。
- **并行度** — 同时最多能有多少个 sub-agent 在执行。必填 — 用户未指定时必须主动询问（可给出建议值供参考，如 `5~10`），由用户确认。该值决定主 agent 一次最多并行派发多少个 sub-agent，超出部分排队等待空位。

完成标准：项目路径、输出文件、评测范围、并行度均已确认。

### 2. 发现 skills

用项目绝对路径调用发现脚本：

```
node <本-skill-所在目录>/cli/find-mini-agent-skills.js <项目绝对路径>
```

脚本向 stdout 输出 JSON 对象，包含两个字段：

- `instruction` — AGENT 系统提示词（`agents.md`）的绝对路径，由 `app.json` 的 `agent.instruction` 指向。它是 AGENT 的系统提示词，项目内所有 skill 都由该 AGENT 调用，故对其执行均生效。项目未配置时该字段缺省。
- `skills` — JSON 数组，每个元素是一个 skill 对象，包含 `name`、`path`、`description`、`files`（记录 `SKILL.md` 和 `mcp.json` 是否存在），以及 `components`（组件清单，每项含 `path` 与 `dynamic` 布尔值，`true` 表示该组件是「实时动态组件」）。

按步骤 1 确定的评测范围从 `skills` 中筛选。如果用户指定了某个 skill 名称但脚本输出中不存在，报告并停止。

完成标准：已确认待评测的 skill 对象列表，以及 `agents.md` 的路径（若存在）。

### 3. 并行评测

评测分两类任务：

- **项目级任务**（1 个）：评测 `agents.md`（AGENT 系统提示词）。仅当步骤 2 发现 `instruction` 字段存在时启动，整个项目只跑一次。
- **skill 级任务**（每个 skill 5 个）：对每个待评测的 skill，分别启动 5 个 **sub-agent**，各自执行一个评测任务。

**并行度**：按步骤 1 确认的并行度执行。主 agent 一次最多并行派发该数量的 sub-agent，超出部分排队等待空位释放后再派发。

主 agent 向每个 **skill 级** sub-agent 传递：
- skill 的**目录路径**（绝对路径）
- skill 的 `name` 和 `description`
- 对应任务定义文件的路径（绝对路径）
- 本 skill（alipay-skills-static-eval）的**根目录路径**（绝对路径），供 sub-agent 读取 `references/` 下的文件
- skill 的**组件清单**（发现脚本输出的 `components`，每项含 `path` 与 `dynamic`）

主 agent 向**项目级** sub-agent 传递：
- `agents.md` 的**绝对路径**（步骤 2 的 `instruction` 字段）
- **待评测 skill 列表**（每项含 `name` 与 `mcp.json` 绝对路径），供 sub-agent 交叉比对 method 名
- 对应任务定义文件的路径（绝对路径）

| 任务 | 定义文件 | 粒度 |
|---|---|---|
| AGENT 系统提示词 | `tasks/instruction.md` | 项目级（每项目 1 次） |
| 召回与触发效果 | `tasks/recall.md` | skill 级 |
| 指引与示例质量 | `tasks/guidance.md` | skill 级 |
| JSAPI 使用合规 | `tasks/jsapi.md` | skill 级 |
| AXML 标签合规 | `tasks/axml.md` | skill 级 |
| 安全性与用户体验 | `tasks/security-ux.md` | skill 级 |

Sub-agent 自行读取任务定义文件和对应源文件，完成评测后返回报告。

**约束**：每个 sub-agent 只读自己对应的任务定义文件，不要读 `tasks/` 下其他任务文件。这会浪费上下文且无助于当前任务。

所有 sub-agent 全部并行运行 — 项目级任务与每个 skill × 每个 skill 级 task 的组合互不依赖。

完成标准：项目级任务（若启动）有 sub-agent 返回报告；每个 skill 的 5 个 skill 级 task 都有对应的 sub-agent 返回报告。如果某个 sub-agent 失败或超时，在汇总报告中标记该任务为「评测失败」，并附上失败原因，继续处理其他任务。

### 4. 汇总整理

收集所有 sub-agent 报告，整理出：

- **AGENT 系统提示词** — `agents.md` 的评测发现（若已评测）
- **逐 skill 分析** — 每个 skill 的显著发现
- **共性问题** — 跨 skill 反复出现的模式或缺陷
- **跨 skill 冲突检查** — 主 agent 自行检查：多个 skill 的 description 是否存在语义重叠，导致同一用户 query 可能匹配到多个 skill、意图路由不确定

**总结原则**：略过完美通过的检查项，只保留有发现（缺陷、风险、建议）的项。逐项罗列「✅ 通过」会稀释用户对真正问题的注意力。

完成标准：汇总文档已准备好。

### 5. 写入报告

将汇总结果以 Markdown 格式写入步骤 1 指定的输出文件。确认文件路径和大小。

完成标准：文件已写入并确认。

## 参考

### 发现脚本

`cli/find-mini-agent-skills.js` — 从小程序项目中发现已注册的 skills 及 AGENT 系统提示词。

- 输入：项目根目录的绝对路径
- 流程：读取 `mini.project.json` → 解析 `miniprogramRoot` → 读取 `app.json` → 提取 `agent.instruction`（AGENT 系统提示词）与 `agent.skills`
- 输出：JSON 对象输出到 stdout，含 `instruction`（`agents.md` 绝对路径，未配置时缺省）与 `skills` 数组（每项含 `name`、`path`、`description`、`SKILL.md` / `mcp.json` 是否存在，以及 `components`，含 `path` 与 `dynamic` 标记，`dynamic` 为 `true` 即「实时动态组件」）
- 出错时以非零退出码退出，错误信息输出到 stderr
