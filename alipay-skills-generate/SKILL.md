---
name: alipay-skills-generate
description: 通过静态分析支付宝小程序源码生成符合 Agent 模式规范的原子接口 Skills，包含接口提取、体验契约、组件渲染、半屏交互与宿主集成全流程
---

# 支付宝小程序 Skill 生成

## 1 职责边界

本 Skill 的唯一任务：**接收一个已有支付宝小程序项目，为其生成可运行的 Agent 模式 Skills**。

具体产出：
- 一个或多个 `skills/{skill-name}/` 目录结构（`apis/{apiName}.js` + 组件 AXML/ACSS/JSON/JS + utils）
- 每个 Skill 的 `mcp.json`（接口声明 + 组件声明 + 权限声明）
- 每个 Skill 的 `SKILL.md`（Skill 描述文档）
- 项目级全局提示词文件（默认 `AGENTS.md`，包含服务范围、Skill 路由与协作规则）
- `app.json` 集成配置变更

## 2 依赖条件

需要一个可读取完整源码、包含 `app.json` 和页面目录的支付宝小程序项目。

## 3 术语约定

原子接口是 `mcp.json` 中的单个可调用 API；原子组件用于对话流富交互；半屏页面由 `vctx.openDetailPage` 打开；关联原页面先由 `vctx.setRelatedPage` 配置，再由用户点击调用 `vctx.openRelatedPage()`；上行消息是原子组件发送给对话流的用户追问指令。

## 4 参考资料索引

| 文件 | 用途 | 加载时机 |
|------|------|----------|
| [JSAPI_BOUNDARY.md](references/JSAPI_BOUNDARY.md) | API 能力边界与判定规则 | Gate D/E 读取全文 |
| [SAFETY_POLICY.md](references/SAFETY_POLICY.md) | 动作风险分级、写操作确认、支付/资金承接策略 | Gate C 仅用 §2 风险等级表；Gate D/E 完整读取 |
| [CODE_TEMPLATES.md](references/CODE_TEMPLATES.md) | 代码模板与工具函数 | Gate E |
| [ANALYSIS_PATTERNS.md](references/ANALYSIS_PATTERNS.md) | 源码搜索与分析模式 | Gate B/C |
| [COMPONENT_TEMPLATES.md](references/COMPONENT_TEMPLATES.md) | 组件运行时骨架、模式差异与上行消息规范 | Gate E |
| [UX_EXPERIENCE.md](references/UX_EXPERIENCE.md) | 总体用户动线、通用体验契约与下一步出口设计 | Gate D/E |
| [ATOMIC_COMPONENT_DESIGN.md](references/ATOMIC_COMPONENT_DESIGN.md) | 视觉设计规范 | Gate E |
| [ACSS_SPEC.md](references/ACSS_SPEC.md) | ACSS 样式规范与约束 | Gate E |
| [STYLE_MIGRATION.md](references/STYLE_MIGRATION.md) | 样式迁移流程 | Gate E |
| [HALF_SCREEN.md](references/HALF_SCREEN.md) | 半屏页面规范 | Gate E |
| [SUBAGENT_PROTOCOL.md](references/SUBAGENT_PROTOCOL.md) | 大项目源码分析的子 Agent 角色、读取边界、交接产物和回传协议 | Gate B/C/E |

## 5 硬性约束

### 约束 A — 目录与分包

1. 所有 Skill 产出置于 `skills/{skill-name}/` 独立目录
2. `agent.skills[].path` 必须隶属于 `app.json.subPackages` 中某个分包，且该分包 `pages` 必须为空数组
3. 禁止引用 Skill 目录外的业务私有文件
4. 组件必须使用 `index.axml` / `index.acss` / `index.js` / `index.json`，对应 `componentPath` 固定为 `components/{name}/index`
5. 注册接口实现路径固定为 `apis/{apiName}.js`，文件名必须与 `mcp.json#apis[].name` 完全一致；通用工具放 `utils/`
6. 必需文件：`SKILL.md` + `index.js` + `mcp.json`
7. SKILL.md 不超过 16000 字节；mcp.json 不超过 24000 字节
8. **mcp.json 全部字符串值中禁止使用引号 `""''`**。需要表示引用或举例时，一律使用直角引号「」或去掉引号改用逗号/顿号分隔。此规则覆盖 `description`、`inputSchema.properties.*.description` 以及所有嵌套字符串字段
9. `app.json#agent.instruction` 必填；默认指向项目根目录 `AGENTS.md`，目标文件必须存在且不超过 10000 字节

### 约束 B — 阻断规则

遇到以下情况**立即停止生成**，向用户报告：

| 阻断条件 | 原因 |
|----------|------|
| 项目无 app.json | 非小程序项目 |
| 目标能力的唯一源码实现依赖原生插件且无法获取源码，同时无法确认同一源动作的其他实现、实际目标页面或必要上下文 | 无法取得完整源码事实 |
| 服务端逻辑强依赖浏览器环境 | 无法在小程序内复现 |

### 约束 C — JSAPI 边界摘要

Gate C 记录源码执行链中实际出现的 JSAPI、调用条件和可达依赖。Gate D/E 再完整读取 [JSAPI_BOUNDARY.md](references/JSAPI_BOUNDARY.md)，逐项判断接口与组件运行环境的支持性并完成入口裁决和实现。

### 约束 D — 组件约束

1. 基础组件仅允许使用：`view`, `text`, `image`, `button`, `scroll-view`, `swiper`, `swiper-item`；虚拟组件 `block` 不受此列表限制。确需自定义组件时必须在 `usingComponents` 注册且目标路径存在，并继续满足 Skill 目录与依赖边界
2. 所有文本和 `{{字段}}` 必须包裹在 `text` 内
3. `<text>` 是叶子节点，**禁止嵌套任何子元素**（包括 `<text>` 自身）
4. button 禁止 `open-type` 属性
5. 事件绑定仅支持 `view` 的 `onTap` / `catchTap`、`image` 的 `onLoad` / `onError`，以及 `swiper` 的 `onChange`
6. 组件 JSON 必须包含 `"styleIsolation": "apply-shared"`
7. 组件 AXML 根节点必须是单一 `<view>`
8. `scroll-view` 仅允许横向滚动，必须显式声明 `scroll-x`，禁止 `scroll-y="true"` 或纵向滚动
9. `swiper` 仅允许横向轮播，禁止 `vertical`、`adjust-vertical-height`、`disable-touch`、`onAnimationEnd` 和 `onTransition`

## 约束 E — 子 Agent 分析路由

源码规模达到 [SUBAGENT_PROTOCOL.md](references/SUBAGENT_PROTOCOL.md) 的启用条件时，Gate B/C/E 使用以下角色边界：

1. 主 Agent 只建立 `capability-index.json`，不通读项目源码。
2. 鉴权提取 Agent 生成 `auth-spec.md` 和必要的 `auth-spec.snippets.txt`；鉴权核对 Agent 按来源行号返回 `PASS` 或差异清单。
3. 主 Agent 先按源界面、连续用户流程、共享上下文和接口依赖把目标能力归入分析场景组；分析场景组只限定源码读取范围，不预设最终 Skill 归属。每个场景组由一个场景分析 Agent 从索引中的真实入口追踪全部相关实现，按源码证据生成一个 `interface-spec.<scene>.md`。场景分析 Agent 不写 Skill 代码。
4. 主 Agent 读取分析产物和参考规范，统一完成 `design.md`、全部 Skill、全局 instruction 文件和 `app.json` 集成；不为每个 Skill 启动实现 Agent。

子 Agent 通过 `.alipay-mode-skills/` 下的文件交接，不在消息中传递源码原文。
当前源界面中与用户总体目标能力对应的可见动作均进入场景分析；动作可能属于其他功能域时，记录其执行链和跨能力参数关系。可见动作的直接执行链递归追到请求、session、实际调用的 JSAPI、模块状态、刷新和失败分支，其他依赖按实际执行链局部追踪。

小项目不启动上述分析 Agent，主 Agent 直接按现有 Gate B/C 规则完成相同的场景分组和局部源码分析，并为每个分析场景组生成同格式的 `interface-spec.<scene>.md`。

### 约束 F — 不可逆能力默认排除

1. `destructive` 只用于 Gate B.5 能力收集过滤，不是新的风险等级、`actionEffect` 或产物字段。自动发现且用户未明确要求的不可逆能力默认排除；判定规则见 [SAFETY_POLICY.md §2.2](references/SAFETY_POLICY.md)。
2. 用户明确要求后才进入 Gate C 静态分析，并继续按 R3/R4/R5 裁决。后续阶段只复用现有安全字段，安全查询、详情或 handoff 可提供原页面 CTA，但不得生成默认排除动作的直接接口。

## 6 执行流程

## 6.1 执行清单（这将是你的任务 plan）

> **产物检查脚本**：Gate C/D/E/F 完成后运行 `node scripts/check-artifacts.mjs <project-path> --gate <C|D|E|F>` 做确定性检查。脚本检查文件是否存在、JSON 能否解析、目录结构，以及 Gate F 的全局 instruction 文件路径和字节上限；不校验完整字段语义或业务行为。有缺失时退出码为 1 并列出缺失项及应回的 Gate。Gate F 会级联检查 C、D、E、F，禁止跳过检查直接交棒给 `alipay-skills-static-eval`。

- [ ] **Gate A**：确认具体业务场景和原子能力；不明确时仅最小扫描 `app.json` 并一次性澄清。
- [ ] **Gate B**：完成配置、阻断条件、项目规模、鉴权、storage、能力入口和按需功能识别。
- [ ] **Gate C**：按分析场景静态追踪执行链、可见动作、判别分支、依赖和安全事实，落盘 `interface-spec.<scene>.md`，随后运行 Gate C 检查。
- [ ] **Gate D**：逐分支闭合 API 依赖，完成总体用户动线、schema、体验入口、组件运行时、Skill 划分、实现顺序和 `design.md`，随后运行 Gate D 检查。
- [ ] **Gate E**：统一读取一次规范，再逐 Skill 联合实现；整体核对源界面，并在每个组件写入前重新读取对应源码，随后运行 Gate E 检查。
- [ ] **Gate F**：基于全部最终 Skill 生成或更新全局 instruction 文件（默认 `AGENTS.md`），保留并更新 `app.json` 注册，运行级联 Gate F 检查，输出产物清单并交棒。

## 7 跨 Gate 跳转规则

| 场景 | 流向 |
|------|------|
| 正常主干 | A → B → C → D → E → F → 交棒 |
| 用户已明确全部原子能力 | 跳过 B.5 功能识别，A → B → C |
| 仅需更新组件样式且已有有效契约 | A（轻量）→ D(reuse) → E → F |
| 静态源码证据足以闭合全部目标能力 | C → D |
| 候选实现或字段来源仍不明确 | C → 定向核对最小源码路径；仍无法确认则返回 `need_confirm` |
| Gate E 发现新的不可迁移 API | E → C（回退重新评估） |
| Gate E 发现 schema 或体验决策不足 | E → D；体验契约缺字段时留在 D 补 `outputSchema` |
| mcp.json 结构变更 | F → D（重新契约） |
| 任一阶段触发阻断规则 B | 立即终止，输出阻断原因 |

**核心原则**：
1. 业务场景不明确时，**必须先澄清后生成**，严禁跳过 Gate A
2. 每个 Gate 必须完整产出"产出物清单"中的全部项才能跳转
3. 候选实现不明确时，定向核对最小源码路径；仍无法确认则返回 `need_confirm`，不得猜测接口、字段或运行时结果
4. 新增或变更能力不得跳过 Gate C，所有契约都必须有完整静态源码证据

### 增量与重入规则

工作区已存在 `skills/` 产物时：

| 用户意图 | 入口 Gate | 说明 |
|---------|---------|------|
| 新增一个原子能力 | Gate A（轻量）→ Gate B（复用并核对项目事实）→ Gate C | 先澄清新能力，再提取实现证据和能力契约并入增量清单 |
| 修改已有原子接口的执行行为 | Gate A（轻量）→ Gate B（复用并核对项目事实）→ Gate C | 重新验证受影响能力的实现证据，再进入 D → E → F |
| 仅修改已有接口的 schema/体验契约 | Gate A（轻量）→ Gate D(reuse) | 确认已有 `interface-spec` 仍有效后更新接口清单与体验契约 → E → F |
| 修改组件样式/模板 | Gate A（轻量）→ Gate D(reuse) | 重新读取对应源页面并确认已有接口规格和体验契约仍有效；缺失或失效时回到 Gate B/C 补齐，再在 Gate E 仅修改 `components/{x}/` |
| 补充半屏入口 | Gate A（轻量）→ Gate B（复用并核对项目事实）→ Gate C | 先验证目标页面、query、上下文要求和可达性，再进入 D，并在 Gate E 按 HALF_SCREEN.md 实现入口 |

> 重入时已生成且未触及的文件保持不变，只更新受影响的文件。

## 8 Gate 详细定义

---

### Gate A — 需求澄清（强制前置）

**契约**：

| 项 | 内容 |
|---|------|
| 入口条件 | 用户发起生成请求（任何请求都必须从本阶段开始） |
| 产出物 | 判定结果 + 自然语言目标及期望完成结果 + 必要时的澄清清单 |
| 下一步 | "明确"或澄清确认完毕 → Gate B |

**判定规则**（必须同时满足 2 项才算"明确"）：

| # | 判定项 | 示例 |
|---|--------|------|
| ① | 指明**具体业务名词** | "商品检索""订单管理""会员签到"；非"核心功能""主要能力" |
| ② | 可推断**至少 2-3 个原子能力的粒度** | "检索商品 + 展示列表 + 查看详情"；非"业务相关" |

任一不满足 → 进入下方澄清流程。

**A.1 不明确时的引导流程**：

1. **最小扫描**：只读 `app.json` 的 `tabBar.list`、`pages`（一级路径）、`subPackages.root`。**禁止**读 JS/AXML/ACSS，禁止做依赖分析。
2. **归纳候选**：基于路径关键词（见 `references/ANALYSIS_PATTERNS.md` 页面功能识别表）归纳 3~6 个候选场景。
3. **向用户提问**（一次问完，别反复打断）：
   - 希望把哪些业务场景做成 Agent Skill？
   - 每个场景希望暴露给 Agent 的原子能力大致是什么？
   - 是否涉及登录态、位置、购物车、下单、支付/资金、身份或关键资料动作？
4. **等用户回复后**才能进入 Gate B。严禁在用户确认前扫描源码或生成代码。

澄清结果按“用户自然语言目标 → 期望完成结果 → 目标业务场景 → 期望原子能力”列出，并单列是否涉及登录、位置、购物车、下单、支付资金或关键资料。用户请求已经明确时直接归纳，不额外提问。

---

### Gate B — 项目扫描

**契约**：

| 项 | 内容 |
|---|------|
| 入口条件 | Gate A 产出明确的业务场景与原子能力清单 |
| 产出物 | ① 配置字段；② 鉴权迁移清单；③ storage 初始化清单；④ 插件使用情况；⑤ 总体目标能力与真实入口坐标；大项目另有 `capability-index.json`、`auth-spec.md` 和鉴权核对结果 |
| 下一步 | 用户已明确所有原子能力 → Gate C；否则 → Gate B.5 功能识别 |
| 阻断条件 | 未提供源码目录 / 目标能力的唯一实现依赖无法获取源码的插件，且无可验证替代实现或可靠页面承接路径 → 阻断规则 B |

**B.1 配置扫描**：

读 `app.json` / `app.js`，提取 `pages` / `tabBar` / 已有 `agent` / `minAppVersion`。检查阻断条件（约束 B），并按 [SUBAGENT_PROTOCOL.md](references/SUBAGENT_PROTOCOL.md) 判定是否启用子 Agent 分析路由。

**B.2 鉴权逻辑扫描（必做）**：

小项目由主 Agent 按本节提取鉴权事实。大项目按 [SUBAGENT_PROTOCOL.md](references/SUBAGENT_PROTOCOL.md) 启动一个鉴权提取 Agent 和一个鉴权核对 Agent：前者读取 `app.js`、请求封装、登录/签名文件和主包 storage 初始化逻辑，落盘 `.alipay-mode-skills/auth-spec.md` 与必要的 `.alipay-mode-skills/auth-spec.snippets.txt`；后者按来源文件和行号核对，输出 `PASS` 或差异清单。核对 Agent 不修改业务代码，也不重新扫描未引用文件。

鉴权事实至少包括：
1. token/session 存取 key（关键词 `getStorageSync` + `token`/`session`/`userId`）
2. 请求 header 鉴权方式（`Authorization` / `Bearer` / 自定义 header）
3. 登录入口（`my.getAuthCode` / 主动调用登录接口）
4. 换 token 接口（授权码后的 `my.request` 地址与参数）
5. 签名、动态参数、响应信封、鉴权错误和匿名降级分支

扫描本身必做；目标能力不涉及网络、登录态或授权时，鉴权迁移清单和大项目的 `auth-spec.md` 明确记录无鉴权依赖及判断依据，不得编造 token、登录入口或换 token 接口，也不得因此阻断该能力。

**迁移策略**（形成鉴权迁移清单，Gate E 写入分包工具模块）：
- 源码使用独立登录 API、登录卡片或登录页面时，受保护业务 API 和动态组件只消费已有 session，通过统一请求封装的 `auth: true` 触发校验；缺失或失效时停止业务请求并返回可见提示，由独立登录能力承接，不得为每个业务 handler 默认新增主动登录
- 当前生成范围内的受保护能力依赖该登录流程时，只生成或复用一份有源码依据的独立登录 API/卡片/页面承接，并在业务 `SKILL.md` 中说明鉴权失败后调用它；不得把同一登录流程复制到各业务 API 或组件
- 统一请求封装按源码完整复现 session 判定、全部相关 storage key、嵌套值结构、有效期与安全窗口、公共 header、成功信封和登录失效信号；业务函数不得自行读取 token、拼接鉴权 header 或重复解包响应
- 只有当前业务动作的源码执行链本身必然到达 `my.getAuthCode`、换 token 或主动刷新时，才仅在接口侧迁移该链路；组件始终只能被动消费已有 session
- 项目、`auth-spec.md`、登录模块或原子接口 handler 中存在主动鉴权，不表示每个业务动作依赖主动鉴权。Gate C 按动作记录实际 session 执行链，Gate D 再按 `JSAPI_BOUNDARY.md §3.2.1` 裁决动态组件资格
- 仅接口使用的 token 可存当前 Skill 模块级变量；禁止假设主包内存态可直接复用，也不得为了让组件直连而把接口私有凭证改存公共 storage
- 无鉴权接口跳过

**B.3 主包 storage 初始化扫描（必做）**：

扫 `app.js` 与主包 `.js` 中的 `my.{set,get,clear}Storage*`，提取 `key` / `defaultValue` / `initCondition` / `sourceFile`。

迁移：
- `setStorageSync` 初始化值 → 分包 `ensureStorageInit()` 重建
- 异步获取后写 storage → 分包首次调用时自行重发请求并缓存

形成 **storage 初始化清单**。

**B.4 总体目标范围与入口核对（必做）**：

以 Gate A 确认的全部目标能力为同一总体范围，将每项能力关联到真实页面、可见文案、AXML 事件和 handler 坐标。大项目把这些坐标写入 `capability-index.json`；小项目在当前上下文保留同样的定位结果。这里仅定位源码入口，执行链和交互设计分别在 Gate C、Gate D 完成。

**B.5 功能识别（用户未明确原子能力时）**：

针对 Gate A 选定的候选场景对应页面，按 `references/ANALYSIS_PATTERNS.md` 分析：
1. 页面用途、交互事件、数据流向
2. 从用户视角识别功能点（每个功能 = 一个原子接口）
3. 分析数据依赖（A 的返回值被 B 使用）

产出 camelCase JSON，每项包含 `functionName`、`pages`、`sourceApis`、`suggestedAtomicInterfaces`、`needsComponent` 和 `experienceGoal`；按 `ANALYSIS_PATTERNS.md §4.3` 识别不可逆候选并结合实际后果与恢复路径判断。默认排除项额外包含唯一可选字段 `skipped: destructive`，使用空 `suggestedAtomicInterfaces`，将原因写入现有 `experienceGoal`，不新增其他字段；用户在二次确认时明确要求纳入后，才移除该标记并进入 Gate C。

**必须将功能清单发给用户二次确认**才能进入 Gate C。

---

### Gate C — 源码执行事实与契约提取

**契约**：

| 项 | 内容 |
|---|------|
| 入口条件 | 已有用户确认的目标原子能力清单；Gate B 项目事实已完成，或在增量流程中已复用并重新核对 |
| 产出物 | 每个分析场景组一个非空 `interface-spec.<scene>.md`，以紧凑静态源码事实覆盖组内能力、可见动作和接口关系；源码涉及网络业务 API 时另含 URL、请求和响应字段事实 |
| 下一步 | 所有目标能力均被场景规格覆盖，且执行实现、参数来源、响应消费和失败分支均有完整静态源码证据 → Gate D |
| 阻断条件 | 任一能力的源码执行实现、源码实际跳转的目标页面或必要参数来源均无法确认；或目标链路依赖无法获取源码且无可验证的同源实现 → 阻断规则 B |

**C.1 提取范围与实现事实**：

先把用户确认的总体目标能力按源界面、连续用户流程、共享关键上下文和直接上下游字段依赖归入分析场景组。分析场景组只限定源码读取范围，不预设最终 Skill 归属。同一源界面上的可见动作只要对应总体范围内任一目标能力，就随该界面进入分析；动作连接其他功能域时同时记录跨能力参数关系。

小项目由主 Agent 仅扫描场景组对应的页面/模块。大项目按 [SUBAGENT_PROTOCOL.md](references/SUBAGENT_PROTOCOL.md) 为每个分析场景组启动一个场景分析 Agent；主 Agent 只读取 `capability-index.json`、接口规格和短摘要，不通读完整业务源码。场景组内每个目标能力都从真实入口追踪实际执行链，不得以没有网络请求为理由跳过 Gate C。

- 源码存在网络业务 API 或云函数时，提取入口、URL/云函数、method、header、data、鉴权、参数来源、响应字段、失败分支和源码位置。
- 能力由本地计算、storage、JSAPI 或组件状态完成时，提取入口、本地逻辑、输入输出、状态变化、失败分支和源码位置。
- 源码通过页面跳转完成动作时，提取入口、目标页面、query、参数来源、上下文要求和失败分支。

每个场景规格按 [SUBAGENT_PROTOCOL.md §7.3](references/SUBAGENT_PROTOCOL.md) 交接证据：记录场景入口和共享请求、鉴权、storage、刷新事实，再逐个执行链记录真实入口、输入输出、参数来源、JSAPI 和失败分支，最后记录可见动作、跨能力接口关系和未确认事实。共享事实只记录一次；接口项只展开自身差异和下游实际消费的源字段。

对当前源界面中与总体目标能力对应的加减器、勾选、收藏、切换、整项点击等可见操作，按 `ANALYSIS_PATTERNS.md §4` 追踪完整执行链。记录源页面是立即执行还是先确认，请求使用绝对值还是增量值，成功后如何得到权威状态，以及失败、连续点击和旧状态如何处理。

列表、搜索或聚合结果通过判别字段进入不同下游动作时，逐个记录源码可达判别值、handler 分支、下游请求或页面跳转，以及实际传递字段。多个判别值共享同一执行链时合并记录；存在未追踪分支时写入最小待核对路径。

**C.2 依赖与鉴权追踪**：

递归追踪 `import` / `export`，记录执行链实际使用的封装、常量、鉴权逻辑及其可达依赖。涉及网络业务 API 时结合 Gate B 鉴权迁移清单标注登录态、token 来源和登录方式；其他能力仅在涉及 storage、授权或页面上下文时记录对应依赖。

目标实现依赖 `plugin://` / 原生插件且无法获取源码，同时无法确认同一源动作的其他实现、实际目标页面或必要上下文时触发阻断。

**C.3 JSAPI 与依赖事实**：

记录执行链实际调用的 JSAPI、调用位置、参数来源、触发条件和后续分支，并把 JSAPI 连同请求、storage、模块状态及其他可达依赖保留在完整源码执行链中。

**C.4 可见动作事实**：

记录点击区域、控件形态、事件关系、源码已有的校验或确认、完整参数来源、动作后果、成功刷新和失败恢复；按 `references/SAFETY_POLICY.md §2` 风险等级表标注安全等级。对不可逆候选同时核对动作是否永久生效、是否有撤销或回收站等恢复路径，以及用户是否在 Gate A 或功能清单确认时明确要求纳入；默认排除时复用 R5、`agentMayExecute=false` 和 `downgradeReason` 表达，不增加接口字段。对包含业务请求的可见动作记录已有 session 执行路径、缺失或失效 session 恢复路径，以及两条路径实际调用的鉴权、storage、JSAPI 和模块状态。

**C.5 源码实现判断**：

| 源码发现 | 处理 |
|----------|------|
| 存在唯一网络业务 API，参数和返回路径清晰 | 形成静态结论，进入 C.6 |
| 存在多个候选网络业务 API 或参数模糊 | 记录候选和差异，定向核对最小源码路径；仍无法确认时返回 `need_confirm` |
| 不含网络请求，本地逻辑、storage 或 JSAPI 链路清晰 | 形成静态契约，进入 C.6 |
| 源码只提供页面跳转，且路径、query 和上下文清晰 | 记录页面执行事实，进入 C.6 |
| 不含网络请求且实现或边界不明确 | 定向核对相关源码；仍无法确认时返回 `need_confirm`，不得猜测 |
| 源码执行实现、源码实际跳转的目标页面和必要参数来源均无法确认 | 阻断规则 B |

**C.6 场景能力契约交接**：

按场景规格紧凑汇总候选接口标识、源码位置、实际输入输出、参数来源、依赖、JSAPI、鉴权、安全等级、失败分支、候选差异和未确认事实。源码涉及网络业务 API 时增加源码可证实的 URL/云函数、method、请求字段和响应消费路径；涉及页面跳转时增加目标页面、query 和上下文要求；可见动作记录点击区域、事件关系、完整执行链、已有 session 路径、恢复路径及其实际可达依赖；默认排除的不可逆动作记录排除原因和可靠原页面，但不列为候选接口；接口关系逐值记录判别字段、源码分支和跨能力传递字段。所有结论只来自静态源码，不得编造运行时样本。这些源码事实交给 Gate D 完成后续设计。

---

### Gate D — 原子接口设计

**契约**：

| 项 | 内容 |
|---|------|
| 入口条件 | 每个目标能力均已被一个 `interface-spec.<scene>.md` 覆盖，且已有完整静态源码证据；未确认项已定向核对或返回用户确认 |
| 产出物 | ① 原子接口清单（含 Skill 归属和 schema）；② API 依赖图；③ storage key 清单；④ 总体用户动线与逐组件体验决策；⑤ Skill 实现顺序 |
| 下一步 | 产出物齐全 → Gate E |

**D.1 源交互与能力关系复核**：

1. 按源页面或源结果组件汇总 Gate C 的可见动作、父子事件、参数来源和跨能力接口关系。总体目标范围内的每个可见动作都进入体验决策；源界面上的局部控件与整项点击分别保留为独立动作。
2. 根据 Gate A 的自然语言目标先在现有 `design.md` 中形成“用户说法 → 前置补参或上下文 → 所需业务结果或动作 → 主要下一动作 → 完成条件”的总体用户动线骨架，再设计接口、组件和 Skill 归属；此时不预选 API 或 UI 入口。D.2/D.4 完成后回填 Result/组件、`agentEntry`、`uiEntry` 和页面承接后的重查入口。中间态必须有主要下一动作，次要动作按需保留，不能把所有源码动作无差别平铺。
3. 当一个动作消费另一个能力的结果时，在现有 API 依赖图中记录生产接口、消费接口和真实传递字段，并在总体用户动线中连接两个步骤。生产结果存在判别字段时，对每个源码可达判别值分别记录消费实现和真实传递字段；只有每个值都有源码支持的实现、完整参数路径和对应 Agent 能力时才算闭合。事实不足时回 Gate C 补充。
4. Gate A 明确要求由 Agent 返回业务结果的查询或详情能力，不能以 `relatedPage` 或 `detailPage` 代替缺失的 Agent 调用链。总体范围内用户可表达的动作都必须有自然语言可达的 Agent 处理入口；最终动作必须由用户在页面完成时，入口应调用能返回对应结果和 CTA 的查询、详情或 handoff API，而不是直接记为 `none`。某个判别分支缺少实现或字段来源时，定向回 Gate C 补该分支；仍无可调用实现时，向用户确认是否接受页面承接，不得静默缩减能力范围。
5. Gate B.5 默认排除的不可逆动作不进入原子接口清单和 API 依赖图。在它是现有安全结果的自然下一步且源码存在可靠页面时，可由查询、详情或 handoff API 返回原页面 CTA；没有安全 Agent 承接能力时才设置 `agentEntry=none`。用户明确要求纳入的不可逆动作按实际后果继续执行 R3/R4/R5 裁决，不因明确要求而放宽安全等级。
6. 对业务确实适用且有源码/API 证据的对话模式逐项闭合：模糊意图如何澄清或推荐、规格/时间/地点等字段如何用自然语言修改、历史记录或个人资产如何查询后继续操作、订单或服务进程如何重新查询或动态更新。纯工具型或源码不支持的模式明确记为不适用，不得为通过检查编造能力。

**D.2 接口字段设计**：

每条接口含：
- `name`：lowerCamelCase，动作+业务对象（如 `getOrderList`），Skill name 用 `^[a-z][a-z0-9-]{1,39}$`
- `description`：30-80 字（硬上限 120 中文字符或 240 字节）。首句用 `{动作}{具体业务对象}` 说明接口是什么，再写 `当用户{触发条件}时使用；不用于{不适用场景}`；不得以入参维度开头，不写内部请求、鉴权或处理流程，不与同 Skill 其他接口形成包含或重叠职责
- `inputSchema`：仅 Agent 需从用户获取的参数；`required` 表示 Agent 可安全调用该接口所必需的字段集合，不是后端接口最低必需字段。每个输入字段都写能指导填参的 description：普通字段如需举例，提供多个不同样本并说明用户未提供时的处理；ID 字段明确上游接口和字段路径，禁止从自然语言推断或使用示例值。**所有 description 字符串禁止中文引号 `""''`，用直角引号「」或顿号替代**（如：用户说「紧急」「重要」映射为高，「一般」映射为中）
- `outputSchema`：对应 structuredContent 结构；后续组件、API、SKILL.md 示例或多轮调用会消费的字段必须声明到可消费字段层级
- `_meta.ui.componentPath`：**可选**，格式固定为 `components/xxx/index`；纯操作型/中间态可省

用户可控字段存在合理静态边界时必须写入 JSON Schema：自由文本使用 `minLength`/`maxLength`，金额、数量、固定时间范围等使用 `minimum`/`maximum` 或等价约束；固定枚举由 `enum` 约束。无法预知合理上限的分页/批量参数和完全由可信上下文派生的只读内部参数不强行拍固定上限，但必须由后端限制或实现分批处理。

`inputSchema` 禁止暴露 `apiKey`、`secret`、`token`、`password`、`accessKey` 等凭据字段。鉴权凭据只能由源码确认的 storage、请求封装或接口私有安全上下文读取，不能让 Agent 或用户传入。

`inputSchema.required` 必须包含：
- 业务必需字段：后端接口或业务逻辑运行必需
- 安全必需字段：用于确定操作对象、门店、订单、券、金额、数量、资格或状态的字段
- 来源必需字段：description 中声明必须来自上游接口、组件点击、页面上下文或 storage 的关键字段

状态变更接口中，凡是用于确定操作对象、门店、订单、券、金额、数量、资格或状态的字段，默认 required。禁止只在 description 写“必须来自上游”，但不放进 required。

**D.2.1 outputSchema 契约硬约束**：

`outputSchema` 是接口返回 `structuredContent` 的唯一契约。`structuredContent` 保持业务语义稳定；展示派生逻辑放在组件侧，内部链路信息放入 `_meta`。

如果 output 字段会被源交互映射中的组件动作、后续 API、SKILL.md 示例或多轮调用消费，则 `outputSchema` 必须声明到可消费字段层级。数组字段不能只写 `items: array`，必须声明 `items[].productId`、`shopProductId`、`storeId`、`quantity`、`activityId`、`price`、`canReceive` 等关键字段。

上游结果通过判别字段选择下游实现或参数组合时，`outputSchema` 同时声明判别字段和各分支实际消费的非敏感标识。消费链能归一为相同业务语义、相同 required 参数集合和相同输出契约时，由一个接口显式接收判别字段；任一项不同则设计为多个接口，并在 API 依赖图中分别连接。

手机号、完整地址、自提码、核销码、物流单号、精确经纬度等敏感原值禁止写入 `structuredContent` 和 `content.text`。Result `_meta` 是组件/宿主可见、Agent 不消费的内部字段；如组件渲染或后续宿主流程确需原值，只写入 `_meta.private` 或更具体的 `_meta` 内部字段；组件和后续 API 均不需要的敏感原值直接丢弃。`outputSchema` 不描述 `_meta.private`。

**D.3 按需关联组件**：

按 `references/COMPONENT_TEMPLATES.md §2` 选择组件模式。单值/中间数据可不配组件；涉及后续交互、确认、状态反馈或结果集合时必须明确 `_meta.ui.componentPath`。

**D.4 体验契约设计**：

读取 [UX_EXPERIENCE.md](references/UX_EXPERIENCE.md)、[SAFETY_POLICY.md](references/SAFETY_POLICY.md) 和完整的 [JSAPI_BOUNDARY.md](references/JSAPI_BOUNDARY.md)，先复核总体用户动线，再为每个有 `_meta.ui.componentPath` 的 API 产出体验决策记录。对 Gate C 执行链中的实际可达依赖逐项判断接口侧、原子组件和动态组件支持性，并在这里确定首个组件侧不支持依赖。将 D.1 汇总的可见动作逐项写入源交互映射，并对每个源码可达判别值分别裁决 Agent 入口、UI 入口、组件运行时、安全、确认、可行性和新鲜度。`agentEntry` 表示 Agent 收到该自然语言意图后首先调用的已注册 API；该 API 可以直接执行，也可以返回结果、确认或页面承接 CTA，是否直接改变业务状态由 `agentMayExecute` 单独表示。Agent 入口与 UI 入口相互独立；不得因为最终动作需要用户手势或原页面完成，就把仍可由 Agent 理解和承接的动作写成 `agentEntry=none`。

入口裁决只消费 Gate C 的执行路径和参数来源事实。事实不足时回 Gate C，业务字段不足时回 D.2 补 `outputSchema`；Gate E 不得临时新增契约外的路径、接口调用或业务动作。

**D.5 技能划分与产出物要求**：

完成接口、组件和体验决策后再划分 Skill：

- 以功能域作为 Skill 划分的第一原则。每个 Skill 对应用户能自然表达、Agent 能稳定召回的一类功能。
- 原子接口服务于同一主功能对象，且触发词、用户目标、连续流程或共享业务函数高度相关时优先归入同一 Skill。
- 需要原位请求的组件与对应 Agent API 归入能复用同一 `utils/` 业务函数的 Skill。确需拆分时，通过已注册 API 和用户可审计参数承接，不复制另一 Skill 的私有请求或鉴权逻辑。
- Skill 归属不改变 D.1/D.4 已确定的源点击区域、控件形态、功能入口和动作承接。
- Skill 划分确定后，按 API 依赖图和总体用户动线写出覆盖全部 Skill 且不重复的实现顺序及排序依据：先实现被多条动线依赖的基础/承接能力和跨 Skill 参数生产者，再实现消费者；同层依赖按主要用户动线从起点到终点排列，互不依赖时沿用 Gate A 目标顺序。存在环时记录环内关系，并以主要用户动线的首个入口确定环内顺序；不得因环而重新拆分已冻结的契约。
- 原子接口清单写明 `skill`、`name`、`description`、`inputSchema`、`outputSchema`、可选 `_meta.ui.componentPath`
- API 依赖图仅在接口间需要传递内部上下文时产出；storage key 命名统一 `skills_{skillName}_{dataName}`
- 多个 Skill 之间只允许通过用户可审计的参数来源传递，不得依赖另一个 Skill 的私有模块变量
- `design.md` 单列 Gate B.5 默认排除能力，记录功能名、源码位置、排除原因和可靠原页面；不得延续内部标记或补造直接 API
- 上述设计产物全部完成后，按“总体用户动线 → 原子接口与依赖 → 排除能力 → 逐组件体验决策 → Skill 实现顺序”统一汇总并落盘非空 `.alipay-mode-skills/design.md`，再运行 `node scripts/check-artifacts.mjs <project-path> --gate D`

---

### Gate E — 接口与组件联合实现

**契约**：

| 项 | 内容 |
|---|------|
| 入口条件 | Gate D 的总体用户动线、原子接口清单、API 依赖图、storage key 清单、体验决策和 Skill 实现顺序均已完成 |
| 产出物 | 完整的每个 `skills/{skill-name}/`：mcp.json、业务 SKILL.md、index.js、apis/*、utils/*、components/*，以及按需半屏入口 |
| 下一步 | 接口与组件联合实现完成 → Gate F |
| 回退条件 | 契约、schema、参数来源、体验决策不足或未执行 Gate D → 停止实现并回 Gate D；发现不可迁移 API → 回 Gate C |

**E.0 执行单位与前置任务（强制）**：

进入 Gate E 后，在选择第一个 Skill 前按序完整读取一次 `JSAPI_BOUNDARY.md`、`UX_EXPERIENCE.md`、`SAFETY_POLICY.md`、`STYLE_MIGRATION.md`、`ATOMIC_COMPONENT_DESIGN.md`、`ACSS_SPEC.md`、`COMPONENT_TEMPLATES.md` 和按需的 `HALF_SCREEN.md`。这些规范服务于本次 Gate E 的全部 Skill，不按 Skill 重复完整加载；上下文切换后缺少某项规则时，只重新打开对应章节。

Gate E 以一个 Skill 目录为执行单位，并严格按 `design.md` 的实现顺序选择下一个未完成 Skill，不得临时任选、跳过或并行写入。选定当前 Skill 后，只处理该 Skill 的契约、接口、工具、注册入口和组件；完成当前 Skill 的 E.1-E.5 后才能进入顺序中的下一个 Skill。发现顺序所依赖的契约不成立时回 Gate D 修订设计及顺序；全部 Skill 完成后统一执行 E.6。

1. 读取 Gate D 的 Skill 实现顺序并确认当前 Skill 是下一个未完成项，再读取其总体用户动线、技能划分、原子接口清单、API 依赖图、storage key 清单和体验决策；存在跨 Skill 的已注册 API 承接时，同时读取动线中的相邻步骤和 API 依赖图中与当前组件直接相连的接口契约。确认这些产出完整后再开始当前 Skill。
2. 对每个有 UI 的能力读取对应源页面的 AXML、JS、ACSS 和其引用的业务组件，确认：① 页面与列表组织方式；② 信息分组和字段顺序；③ 功能入口、点击区域和交互控件；④ 分类、选中、禁用、售罄等业务状态；⑤ 可见操作的 handler、校验/确认、请求/跳转、刷新和失败恢复链路。此处用于核对整体契约，不能替代 E.4 中紧邻每个组件写入前的重新读取。
3. 对照当前 Skill 的 Gate D 设计、`outputSchema` 和参数来源，确认接口 Result 或已裁决的动态组件请求能提供组件所需的结构、字段、状态和真实参数。缺少关键分组、字段、状态或功能入口所需参数时，立即回 Gate D，不得先压平结构、丢弃字段或删除入口再继续生成。

代码模板见 `references/CODE_TEMPLATES.md`。

**E.1 为当前 Skill 生成 mcp.json 与业务 SKILL.md**：

先按 [CODE_TEMPLATES.md §4](references/CODE_TEMPLATES.md) 生成 `mcp.json`：

- `apis[]`：每个接口的 name/description/inputSchema/outputSchema/_meta.ui.componentPath
- `components[]`：每个组件的 path/relatedPage/expirable/expiredText/permissions
- 仅当体验决策已裁决组件需要直接 `my.request`、`my.tradePay` 或定时器时声明 `scope.dynamic`，`desc` 必须写清具体业务用途；该权限不开放组件侧 `my.getAuthCode` 或其他未支持 API
- Gate B.5 默认排除的能力不得出现在 `apis[]`、`index.js` 注册、`apis/*.js`、组件直接请求或 `api/call` 中；业务 `SKILL.md` 仅在拒绝边界说明应前往原页面，或引用已设计的安全承接入口

再按 [CODE_TEMPLATES.md §5](references/CODE_TEMPLATES.md) 生成业务 `SKILL.md`。内容必须覆盖触发边界、拒绝边界、接口选择、参数抽取、总体用户动线中的本 Skill 步骤、执行 SOP、页面承接后的继续方式、异常出口、结果处理和示例，并以 Gate D 设计为依据。

业务 `SKILL.md` 的唯一读者是 Agent：只写会改变其理解、接口选择、参数提取、分支决策或用户回应的内容。接口本身的功能和适用边界只在 `mcp.json#apis[].description` 完整定义，业务 `SKILL.md` 的工具清单只写前置条件与上下游关系；跨接口规则写在业务 `SKILL.md`。禁止写卡片布局、配色、字段位置等视觉设计稿，禁止写需求背景、验收、排期等项目管理内容，也禁止写宣传文案。

业务 `SKILL.md` 还必须：明确列出支持与不支持范围且无矛盾；覆盖适用的模糊意图、自然语言修改、历史/资产和服务状态更新路径；所有已注册 API 都被引用且不引用未注册 API；每个正常、失败、查询为空、首次使用、无历史/缓存、未登录、缺少门店/商品/订单等前置状态以及取消/超时分支都有终止、补参、重试或恢复出口；工具无返回、查询失败或证据不足时要求如实告知，禁止编造业务结果；至少给出一个正常端到端示例、一个异常或空态示例和一个适用时的多轮示例。

端到端示例必须展开完整 tool 调用参数。凡 `mcp.json#apis[].inputSchema.required` 中的字段，示例调用中必须出现；参数来自上游结果时，必须写明字段名或字段路径。禁止生成 `addCartItem(quantity=1)`、`receiveCoupon(confirmed=true)` 这类省略关键 ID 或上下文的示例。

上游结果通过判别字段选择下游实现或参数组合时，示例先读取判别字段，再展开对应分支的完整调用。只有所有源码可达判别值都由同一消费契约覆盖时，才能直接使用“第一个结果 → 调用详情接口”一类表述。

**E.2 实现当前 Skill 的原子接口**：

每个原子接口：
1. ES Module：命名导出 `export async function {apiName}`，与 `index.js` 注册入口的命名导入保持一致
2. 参数校验（必填参数缺失 / ID 非真实来源 → 返回 error）
3. 动作安全处理：R2 可直接执行并返回结果和恢复出口；R3 仅在用户已明确确认时执行；R4 不自动执行资金/身份最终动作，只返回摘要和用户点击承接信息；handoffOnly 只能返回承接信息，不得先创建订单、锁库存、占名额、提交申请、生成待支付记录或改变账户状态
4. 鉴权（受保护业务请求通过统一请求封装的 `auth: true` 校验已有 session；独立登录能力或源码业务链本身要求时，才在接口侧执行主动鉴权）
5. 发起请求（调 `request.js` 封装）
6. 数据加工（格式化/截取/敏感字段分层），同时保留体验决策和组件交互需要的业务分组、字段、状态与真实参数
7. 返回标准 Result：`ok(text, structuredContent, meta)`
8. catch 异常：返回 `fail(errorText)`
9. 按 [JSAPI_BOUNDARY.md](references/JSAPI_BOUNDARY.md) 的原子接口精确 allowlist 检查注册入口、handler 及全部传递依赖中的 `my.*`、`my.modelContext` 和 Context 方法；静态规范未列入原子接口环境的 API 或调用形态一律不得生成

仅当状态变更请求已成功、后续刷新查询失败时，按 `SAFETY_POLICY.md` 返回 `operationSubmitted=true`、`refreshFailed=true` 和用户可见 `warningText`，不得按普通失败返回或返回普通成功加空列表。`refreshFailed=true` 必须蕴含 `operationSubmitted=true`，反向不成立；`operationSubmitted=true` 单独出现是正常已受理状态。组件必须保留旧业务数据、标记状态待确认并锁定等价写操作，只允许只读查看、重新查询或打开原页面确认。

**E.3 完成当前 Skill 的工具模块、注册入口与契约**：

- `result.js`：提供 `ok(text, structuredContent, meta)` + `fail(text, meta)` 标准 Result 工厂
- `request.js`：封装 `my.request` 为 Promise；按源项目实际封装替换，本蓝图不约束具体形态
- 鉴权：需要鉴权的接口入口使用当前 Skill 内迁移后的鉴权链路，不规定函数名
- 复用边界：原子接口 handler 只供注册入口调用；API 与动态组件可复用 `utils/` 中的业务请求函数。供组件使用的工具必须递归检查全部传递依赖，且只能使用对应组件运行时支持的 JSAPI
- 多上下文校验：同一 `utils/` 文件被原子接口、原子组件或动态组件中的多个上下文引用时，分别按每个引用上下文的精确 allowlist 检查；任一上下文不支持的 `my.*` 都不得从该入口可达
- 单一实现：同一后端业务操作的 URL、method、header、后端参数映射和响应信封只在 `utils/` 中实现一次；同一操作存在 Agent API 时与组件复用该函数，两端分别保留对话编排和 UI 状态编排
- 目录结构、工具模块和注册入口按 `CODE_TEMPLATES.md §1-§3` 生成
- `structuredContent` 只写入 `mcp.json#apis[].outputSchema.properties` 声明过的业务语义字段
- `_meta` 承载模型不消费的内部字段，可供组件和宿主流程读取渲染；组件不得把 `_meta.private` 原值写入上行文本或非必要 `api/call.arguments`
- `createSkill` 的 `skillPath` 必须与 Gate F 将写入的 `app.json#agent.skills[].path` 完全一致

**E.4 当前 Skill 的组件联合实现**：

依据当前 Skill 的 Gate D 设计生成全部组件。

1. 紧邻每个组件写入前，重新读取该组件对应源页面和引用业务组件的相关 AXML、JS、ACSS 代码段，复核业务结构、字段顺序、点击区域、事件关系、状态和反馈；该复读不得被 E.0 的整体核对替代。
2. 每个组件均生成完整的 `index.axml`、`index.acss`、`index.js`、`index.json` 四个文件，并使用 Gate D 已裁决的组件模式、字段、参数来源和 `uiEntry`。
3. 动态组件只实现体验决策内的直接请求、支付或定时器并声明 `scope.dynamic`；普通组件不得调用 `my.request` 或 `my.tradePay`。`my.tradePay` 只能由用户明确点击付款 CTA 后调用，并使用源码真实支付参数。组件不得 import 原子接口 handler，动态组件复用 `utils/` 时必须确认其全部传递依赖均符合组件运行时边界。
4. 组件交互与状态遵循 [UX_EXPERIENCE.md](references/UX_EXPERIENCE.md) 和 [SAFETY_POLICY.md](references/SAFETY_POLICY.md)，样式遵循 [STYLE_MIGRATION.md](references/STYLE_MIGRATION.md)、[ATOMIC_COMPONENT_DESIGN.md](references/ATOMIC_COMPONENT_DESIGN.md) 和 [ACSS_SPEC.md](references/ACSS_SPEC.md)。组件的交互方式和文字优先参考小程序源页面。
5. 按 [JSAPI_BOUNDARY.md](references/JSAPI_BOUNDARY.md) 的精确 allowlist 逐个检查当前组件及其依赖中的 `my.*`、`my.modelContext`、Context 和 ViewContext 调用；静态规范未列入对应运行环境的 API、参数字段或调用形态一律不得生成。

**E.5 当前 Skill 的半屏与过期（按需）**：

- 半屏在体验契约确认有详情、补充信息、确认或中间态继续语义，且目标流程不依赖半屏拦截能力时生成；否则选择可靠 `relatedPage` 或其他出口，按 [HALF_SCREEN.md](references/HALF_SCREEN.md) 实现。卡片过期仅在业务存在时效或状态失效语义时生成，声明与调用必须配对

**E.6 总体用户动线回放**：
全部 Skill 的 E.1-E.5 完成后，按 `design.md` 的总体用户动线逐条回放代表性自然语言：确认首个 `agentEntry` 已注册、跨步骤字段可传递、主要下一动作可见、UI 点击执行已裁决入口、页面承接带齐上下文且返回后能重查、失败/空态/鉴权分支能恢复或明确结束。发现断点时回 Gate D，不新增动线外接口或按钮。

---

### Gate F — 配置集成与交棒

**契约**：

| 项 | 内容 |
|---|------|
| 入口条件 | Gate E 的 mcp.json、业务 SKILL.md、接口、工具模块、组件和半屏入口已全部完成 |
| 产出物 | 全局 instruction 文件（默认 `AGENTS.md`）+ 更新后的 app.json + 生成产物清单 |
| 下一步 | 配置均已更新 → 交棒 |

**全局提示词与 app.json 配置**：

配置模板见 [CODE_TEMPLATES.md §7](references/CODE_TEMPLATES.md)。

- 全部 Skill 的最终 `mcp.json`、业务 `SKILL.md` 和依赖关系确定后，再生成或更新项目级全局提示词文件；缺少 `agent.instruction` 时默认创建项目根目录 `AGENTS.md`，并设置 `agent.instruction: "AGENTS.md"`
- 已有 `agent.instruction` 且目标文件存在时保留其路径和与本次生成无关的既有规则，仅更新受本次 Skill 变更影响的服务范围、路由与协作内容；字段存在但文件缺失时在该相对路径创建文件，不另设第二份全局提示词
- 全局提示词基于最终注册能力和总体用户动线生成，覆盖小程序服务范围、各 Skill 职责与触发边界、自然语言意图到 `agentEntry` 的路由、接口选择和调用顺序、跨 Skill 参数关系、页面承接及返回后的继续方式、默认排除的不可逆动作及其原页面边界、结果可信度与敏感信息规则、回答风格和猜你想问方向；不得引用未注册 Skill/API 或复制完整 schema
- 全局提示词不得包含「忽略以上指令」「无视前面的规则」「你现在是」等覆盖模型基础行为的越狱式内容；只约束业务角色、事实来源和服务边界
- 全局提示词只约束回答应包含的业务信息、真实性、语气和简洁度，不得硬性规定表格、JSON、固定标题等回复呈现格式
- 全局提示词中每个 method 名必须与最终 `mcp.json#apis[].name` 逐字一致（含大小写）；写入后从全部最终 mcp.json 汇总名称并交叉比对
- 全局提示词文件不超过 10000 字节；写入后逐项核对其中引用的 Skill/API 与最终 `app.json`、`mcp.json` 一致
- `agent.skills[].path` 指向每个生成的 `skills/{skill-name}` 目录
- `agent.skills[].path` 必须隶属于 `subPackages` 中某个分包（例如 `root: "skills"`），且该分包 `pages` 为空数组
- `agent.skills[].name` 与 SKILL.md frontmatter name 一致
- `agent.skills[].description` **必填**，建议 50-120 中文字符，硬上限 200 中文字符或 400 字节；写明具体业务对象、核心能力、常见用户说法或触发词和至少一条不支持边界，避免「帮助使用小程序」等宽泛表述，并与其他 Skill description 做语义去重
- `agent.instruction` **必填**，值为项目内全局提示词文件的相对路径
- 保留已有 `agent.skills`，新增或更新本次生成的所有 Skill 项
- `lazyCodeLoading` 与 `component2` 是接入前置项，缺失时记录为待补

### 收尾 — 生成交棒（强制）
Gate F 完成后，必须在回复中明确告知用户：

代码生成与配置集成已完成，且 `check-artifacts.mjs --gate F` 已通过。下一步请使用 `alipay-skills-static-eval` skill 对产物进行静态评测：

- project-path：<abs-path>
- 输出文件：<abs-path>/static-evaluation.md
- 评测范围：本次生成的 Skill 名称列表，或全部
- 并行度：与用户确认后的数值

交棒步骤不可省略。仅输出代码不算完成，必须在对话中显式提示用户切换到静态评测 skill。
