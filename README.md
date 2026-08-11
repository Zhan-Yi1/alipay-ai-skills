# 支付宝小程序 AI 开发模式辅助 Skills 工具集

把已有支付宝小程序源码改造为可被小程序 AI 调度的 **原子接口 + 原子组件**，并对生成的 Agent Skills 进行静态质量评测。

## 仓库结构

本仓库包含 2 个独立 Skill：

| Skill | 作用 |
|---|---|
| [`alipay-skills-generate`](./alipay-skills-generate/SKILL.md) | **生成**：静态分析支付宝小程序源码，提取业务执行链、网络接口与 JSAPI，设计并生成 `skills/{skill-name}/` 原子接口和原子组件，同时完成 `mcp.json`、全局指令与 `app.json` 集成 |
| [`alipay-skills-static-eval`](./alipay-skills-static-eval/SKILL.md) | **评测**：从项目配置中发现 Agent Skills，通过多个独立评测任务检查召回、指引、JSAPI、AXML、安全性与用户体验，并汇总为 Markdown 报告 |

## 工作流

```text
支付宝小程序源码 ──▶ alipay-skills-generate ──▶ skills/ 产物 ──▶ alipay-skills-static-eval ──▶ 静态评测报告
```

- **生成**负责源码分析、能力设计、代码生成、宿主配置集成和确定性产物检查
- **生成完成后**交棒给 `alipay-skills-static-eval`，对全局指令和各 Skill 进行语义质量评测
- **静态评测**只分析文本和配置，不执行原子接口或组件代码，也不替代语法、JSON、路径和真机运行校验

## 前置要求

| 项 | 说明 |
|---|---|
| **Coding Agent** | 支持加载和执行 Skills；运行 `alipay-skills-static-eval` 时还需支持并行子 Agent |
| **Node.js** | 用于执行产物检查与 Skill 发现脚本，建议使用 Node.js 18 或更高版本 |
| **小程序源码** | 项目需可完整读取，并包含 `app.json` 和页面目录 |
| **Agent 配置** | 静态评测目标需在 `app.json` 的 `agent.skills` 中完成注册；使用 `agent.instruction` 时，其指向的指令文件也必须存在 |

## 快速开始

### 1. 安装 Skills

在支付宝小程序项目目录中运行：

```bash
npx skills@latest add ant-mini-program/alipay-ai-skills
```

### 2. 生成 Skills

在支持 Skills 的 Coding Agent 中输入：

```text
使用 alipay-skills-generate 帮我把这个支付宝小程序的「商品检索 + 订单管理」做成小程序 AI Skills
```

Skill 会按 6 个 Gate 执行：需求澄清 → 项目扫描 → 源码执行事实与契约提取 → 接口及体验设计 → 代码实现 → 配置集成。主要产出包括：

- `skills/{skill-name}/`：`SKILL.md`、`mcp.json`、`index.js`、原子接口、原子组件和工具模块
- `AGENTS.md`：项目级服务范围、Skill 路由与协作规则
- `app.json`：`agent.skills` 与对应分包配置
- `.alipay-ai-skills/`：源码分析、接口契约和设计过程产物

建议每次聚焦一组连续的业务场景，完成生成和校验后再增量扩展。

详见 [`alipay-skills-generate/SKILL.md`](./alipay-skills-generate/SKILL.md)。

### 3. 静态评测 Skills

`alipay-skills-static-eval` 需要明确项目路径、报告路径、评测范围和并行度。建议一次性提供完整参数：

```text
使用 alipay-skills-static-eval 评测 /absolute/path/to/miniprogram 中的全部 Skills，
将报告写入 /absolute/path/to/miniprogram/static-evaluation.md，并行度设为 5
```

Skill 会执行：

1. 从 `mini.project.json`（如有）和 `app.json` 中发现全局指令与已注册 Skills
2. 对全局指令执行项目级评测
3. 对每个 Skill 分别评测召回与触发、指引与示例、JSAPI、AXML、安全性与用户体验
4. 汇总逐 Skill 问题、共性问题和跨 Skill 路由冲突，写入指定 Markdown 文件

评测基于 `SKILL.md`、`mcp.json`、组件和关联 JavaScript 等源文件进行语义分析，不会运行项目代码。

详见 [`alipay-skills-static-eval/SKILL.md`](./alipay-skills-static-eval/SKILL.md)。
