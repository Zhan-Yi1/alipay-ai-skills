---
title: 动作安全分级与承接策略
purpose: 定义 Agent Skill 对查询、写操作、订单、支付、资金、关键资料和不可逆动作的能力收集、风险分级、执行方式与降级规则
loadTiming: Gate C 仅使用 §2 风险等级表；Gate D/E 完整读取
---

# 动作安全分级与承接策略

## §1 核心原则

1. 按动作后果分级，不按业务域一刀切。交易链路中的购物车、下单、付款必须分别判断。
2. 参数来源可靠是所有写操作的硬门槛。商品 ID、SKU、数量、订单 ID、金额、地址、手机号等关键参数必须可追溯。
3. Agent 可以执行低风险、可撤销、非资金写操作；不得因为接口是 POST 或属于交易链路就自动降级。
4. 资金最终划转、支付确认、转账确认、退款提交、提现、充值等动作不得由 Agent 自动完成；允许展示摘要和用户点击触发的付款/资金入口。
5. JSAPI 能力边界仍以 `JSAPI_BOUNDARY.md` 为准。安全等级允许某动作时，还必须满足对应运行环境的 JSAPI 支持约束。
6. 证据不足时按更高风险处理；无法确认参数、后果或承接页时降级为展示、半屏说明或 `relatedPage`。
7. Agent 入口与 UI 入口分别裁决。确定性操作需要原位执行且已有 session 执行路径的请求实现及全部传递依赖符合动态组件边界时，必须使用 `my.request`；否则操作意图和参数完整且目标 API 已注册时使用 `apiCall`，需要补参或推理时使用 `followUpText`。R1 使用组件本地状态。具体入口选择遵循 `UX_EXPERIENCE.md §5.1`。

## §2 风险等级

| 等级 | 类型 | 处理策略 | 示例 |
|------|------|----------|------|
| R0 | 只读查询 | 可直接执行 | 查商品、查购物车、查订单、查物流、查优惠券 |
| R1 | 本地状态 | 可直接执行，仅影响组件内展示 | 展开、收起、筛选、排序、临时选择规格 |
| R2 | 低风险可撤销写操作 | 参数可靠时可直接执行；执行后展示结果和恢复/修改出口 | 加入购物车、修改购物车数量、移出购物车、收藏、取消收藏 |
| R3 | 中风险业务提交 | 必须展示确认信息；用户确认后可执行，或保留清晰 CTA 交给半屏/原页面承接 | 创建待支付订单、提交预约、取消订单、提交售后申请、使用优惠结算 |
| R4 | 高风险资金/身份/关键资料动作 | 禁止 Agent 自动执行；存在可靠流程时必须保留摘要和用户点击触发的承接入口 | 付款、转账、充值、提现、退款提交、实名认证、改手机号、改收款账户 |
| R5 | 默认排除、不可迁移或证据不足 | 不生成直接操作；记录排除原因，改为展示或 `relatedPage` | 未明确要求的不可逆动作、插件无源码、动态 URL 不可追溯、接口后果不明、参数来源不可靠 |

### 2.1 执行权限与用户继续能力分离

安全裁决必须分别回答以下问题，不得只用 `safetyLevel` 推导 UI：

| 裁决项 | 含义 |
|---|---|
| `userCanPerform` | 用户是否仍可通过可靠的原页面、半屏或平台流程完成该目标 |
| `agentEntry` | Agent 处理该自然语言意图时首先调用的已注册 API；可直接执行，也可返回确认或页面承接 CTA |
| `agentMayExecute` | Agent 是否可以直接调用接口改变业务状态 |
| `uiEntry` | UI 入口：`localState`/`my.request`/`apiCall(<apiName>)`/`detailPage`/`relatedPage`/`followUpText`/`none` |
| `confirmationRequired` | 执行或进入承接流程前是否需要展示具体确认信息 |
| `userGestureRequired` | 是否必须由用户点击触发 |
| `ctaRequired` | 当前结果是否必须提供清晰、可见的继续操作出口 |
| `executionFeasibility` | 执行是否受参数、路由、storage、插件或支付上下文阻断 |
| `freshnessPolicy` | 动作后如何以服务端结果校准卡片并防止 Agent 使用旧状态 |

`agentMayExecute=false` 不蕴含 `agentEntry=none` 或 `userCanPerform=false`。当动作是当前中间态的自然下一步，且用户仍可通过可靠流程完成时，只降级执行方式，不截断用户旅程：使用能返回最新摘要和确认或页面承接 CTA 的查询、详情或 handoff API 作为 `agentEntry`，相关 R3/R4 动作保留 CTA。只有动作与当前目标无关、`userCanPerform=false`，或 R5 且没有可靠 Agent/UI 承接路径时，才允许 `agentEntry=none` 或不提供 CTA，并记录理由。

`agentMayExecute=true` 也不蕴含 UI 必须暴露同一动作。UI 入口按 `UX_EXPERIENCE.md §5.1` 独立裁决：需要原位执行且请求链的全部传递依赖均受组件支持时设置 `uiEntry=my.request`；只能由接口侧安全执行且操作意图和参数完整时设置 `uiEntry=apiCall(<apiName>)`；需要补参、理解或编排时设置 `uiEntry=followUpText`。R1 动作使用 `uiEntry=localState`。

### 2.2 不可逆能力默认收集边界

`destructive` 是能力收集过滤语义，不是新的 `safetyLevel`、`actionEffect` 或最终 `mcp.json` 字段。用户未明确要求时，对执行后无法撤销或通过明确恢复路径还原的动作默认不收集为原子能力：注销或销户、永久删除业务数据、不可恢复清空、解绑关键关系、永久退订、解散组织、踢出成员或退出且无法恢复原关系等。

关键词只用于发现候选，不直接决定排除。可参考 `logoff`、`close`、`cancel`、`delete`、`remove`、`clear`、`unbind`、`unsubscribe`、`dissolve`、`kick`、`quit`、`exit`、注销、销户、删除、移除、清空、解绑、退订、解散、踢出、退出，并结合源码回答：动作是否永久生效、是否有撤销/回收站/重新绑定等恢复路径、影响单项还是整个账号或组织。

移出购物车、取消收藏、取消订单、退出登录、删除可从回收站恢复的草稿等不能仅因命中关键词被排除，应按实际后果继续判定 R2/R3。支付、退款、转账、充值、提现和实名等资金或身份动作继续按 R4 处理，不归入本收集过滤规则。

自动发现的不可逆能力在 Gate B.5 标记 `skipped: destructive`，原因复用 `experienceGoal`；Gate C/D 使用现有 R5、`agentMayExecute=false` 和 `downgradeReason` 记录，不新增接口字段。若存在能返回安全摘要和原页面 CTA 的查询、详情或 handoff API，可将其作为 `agentEntry`；没有可靠承接时才使用 `none`。用户在 Gate A 或功能清单确认时明确要求纳入，才继续静态分析，并按实际后果执行 R3/R4/R5 裁决。

## §3 商业链路标准映射

| 用户意图/动作 | 默认等级 | 生成策略 |
|---------------|----------|----------|
| 搜索商品、查看商品详情 | R0 | 直接调用查询接口，按需展示列表或详情 |
| 加入购物车 | R2 | 商品 ID、SKU、数量可靠时直接调用加购接口，展示购物车摘要 |
| 修改购物车数量、勾选、取消勾选、移出购物车 | R2 | 参数可靠时直接执行；执行后刷新摘要并提供修改/恢复/查看购物车出口 |
| 清空购物车 | R3 | 批量且影响范围大，必须明确确认；确认信息包含数量和范围 |
| 结算购物车、提交订单、下单 | R3 | 保留「去结算/确认下单」CTA；优先通过 `openDetailPage` 打开真实小程序页面，由用户在页内完成确认和下单；不得在 handoff 前预先创建订单 |
| 付款、去支付 | R4 | 保留用户点击触发的付款 CTA；优先通过 `openDetailPage` 打开真实订单/支付前页面，由用户在页内完成支付，不得自动扣款或自动确认支付 |
| 退款、转账、充值、提现 | R4 | 展示摘要和用户点击触发的原页面/平台入口；不得自动提交资金动作 |
| 取消订单 | R3 | 按业务后果判断；通常需要明确确认或交原页面承接 |
| 修改地址、手机号、实名信息、收款账户 | R4 | 不自动执行；展示摘要并交原页面/平台流程 |

购物车管理属于 R2，前提是接口只改变购物车状态，不创建订单、不锁库存、不触发支付、不产生不可逆履约。若加购接口同时触发下单、锁库存、支付或履约，按实际后果升级为 R3/R4。

下单通常属于 R3：Agent 可以在用户点击确认后创建待支付订单，但付款仍属于 R4。若源码中的下单接口调用后会直接拉起支付、免密扣款、自动代扣或服务端合并扣款，则该接口按 R4 处理，不得由 Agent 自动调用。

R3/R4 的最终动作不能由 Agent 自动执行，不表示自然语言意图没有入口。用户说「去结算」「支付这个订单」「申请退款」时，`agentEntry` 应调用能返回最新购物车、订单或售后摘要及可靠 CTA 的已注册 API，`agentMayExecute=false`，再由用户点击完成最终动作。

## §4 参数来源规则

允许的关键参数来源：
- 上游原子接口返回的 structuredContent 或 Result `_meta`
- AXML dataset、组件 data、页面 query
- 源码可追溯的 storage key，且已确认 Agent 上下文可访问
- 用户在对话中明确提供并经字段校验的输入
- 半屏或组件中用户点击/选择产生的输入

禁止的关键参数来源：
- 模型根据商品名、金额、订单描述自行猜测 ID
- 只从展示文案反推价格、手机号、地址或 SKU
- 未确认结构的主包内存态
- 不在 source-dossier、接口契约或用户请求中的页面、URL、字段

### 4.1 输出分层与敏感字段规则

`structuredContent` 和 `content.text` 会被 Agent 消费，禁止写入敏感原值。Result `_meta` 是组件/宿主可见、Agent 不消费的内部字段。敏感原值确有组件渲染或后续宿主流程需要时，只能写入 `_meta.private` 或更具体的 `_meta` 内部字段；组件可读取 `_meta` 渲染卡片，但不得把这些原值写回上行消息文本或不必要的 `api/call.arguments`。组件和后续 API 都不需要的敏感原值直接丢弃，不放 `structuredContent`，也不放 `_meta`。

敏感原值包括：手机号、身份证号、会员号、完整收货地址、门牌号、自提码、核销码、快递/物流单号、精确经纬度、支付/储值/账户相关原始标识。

`structuredContent` 只放状态、摘要、展示文本、门店名、距离文案、数量、金额展示文本等 Agent 可见字段；`mcp.json#apis[].outputSchema` 只描述 `structuredContent`，不描述 `_meta.private`。

### 4.2 状态变更接口 required 推导规则

任何 `actionEffect` 为 `reversibleWrite`、`businessSubmit`、`fundsOrIdentity` 的接口，`mcp.json#apis[].inputSchema.required` 必须覆盖三类字段：

- 业务必需字段：后端接口或业务逻辑运行必需。
- 安全必需字段：确定操作对象、门店、订单、券、金额、数量、资格或状态所必需。
- 来源必需字段：必须来自上游接口、组件点击、页面上下文或 storage 的关键字段。

商品/购物车类：
- `addCartItem`：`productId`、`shopProductId`、`storeId`、`quantity`。
- `updateCartItem`：`productId`、`shopProductId`、`storeId`、`quantity`。
- `removeCartItems`：`productIds`、`storeId`。
- 删除、清空、`quantity=0` 必须有 `confirmed` 或交原页面/半屏确认。
- `confirmed=true` 只能来自明确表达动作后果的用户输入或组件操作，如删除、移出、清空、取消订单、确认提交。加号、减号、数量步进器、查看、详情、选择、下一步等弱语义动作不得自动生成 `confirmed=true`。

优惠券类：
- `receiveCoupon`：`activityId`、`storeId`、`confirmed`。
- 是否外部券、同步券、付费券、是否可领取，不得只信任 Agent 传入字段；无法可靠表达时必须重新查询校验或降级。

订单类：
- 订单查询为 R0。
- 取消订单、确认收货、退款申请为 R3/R4，必须确认或交原页面。

## §5 执行、确认和 CTA 规则

用户旅程保护规则：
- 先判断当前结果是终态还是中间态。购物车、待确认订单、待支付订单、预约摘要等通常是中间态，必须判断用户自然的下一步。
- 当动作是当前中间态的自然下一步、`userCanPerform=true` 且存在可靠 `uiEntry` 时，设置 `ctaRequired=true`，并用能生成该 CTA 的查询、详情或 handoff API 作为 `agentEntry`。不得因 `agentMayExecute=false`、没有注册写接口或采用 handoffOnly 而删除自然语言入口或继续操作出口。
- `relatedPage`、`detailPage` 或平台承接必须形成用户可感知的下一步；`relatedPage` CTA 必须在用户 tap 中调用 `openRelatedPage()`，只有内部配置不算完成用户旅程。体验决策同时写明传入上下文、页内目标和返回后的查询入口。
- 业务 Skill 应写「不由 Agent 自动执行，用户通过某入口继续」，不得把可承接的 R3/R4 动作笼统写成「不支持」。

R2 直接执行要求：
- 接口证据清晰，参数来源可靠，后果可撤销或可修改。
- `apiCall` 的接口 Result 用 `content.text` 描述已执行结果；动态组件直接调用 `my.request` 时在组件内展示成功、失败或待确认状态，不写成尚待执行。
- UI 提供恢复或下一步出口，例如查看购物车、修改数量、移出、继续结算。
- 状态变化后过期旧卡片，避免用户继续操作过时状态。
- 确定性 R2 控件需要原位执行，且已有 session 执行路径的请求实现及全部传递依赖符合动态组件边界时，必须使用 `my.request` 并把请求契约收口到 `utils/` 业务函数；同一操作存在 Agent API 时共同复用。请求链只能由接口侧安全执行且操作意图和参数完整时，使用 `apiCall` 精确调用已注册接口。点击后必须进入提交态并禁止重复触发；组件请求以写响应或后续查询结果校准，`apiCall` 以新 Result 校准。
- 参数需要补充、语义需要理解或涉及跨能力编排时使用 `followUpText`。`apiCall` 的目标 API 未注册时改用其他可靠入口；所有执行方式都不能保持原交互语义时，改用 `detailPage`、`relatedPage` 或 `followUpText`，并记录降级理由。

R3 确认要求：
- 确认卡片或半屏必须展示关键对象、数量、金额、地址/时间、业务后果。
- 不能使用笼统的「确认继续」替代具体确认。
- 用户点击确认后才能通过动态组件 `my.request`、`apiCall` 或承接页面调用创建订单、取消订单、提交预约等接口。
- 购物结算、下单等原页面已有完整表单、风控或复杂确认流程时，优先用 `detailPage` 打开真实页面由用户完成；核心流程受半屏能力拦截或缺失必需上下文时，改为配置真实 `relatedPage` 并由 CTA 调用 `openRelatedPage()`。

R4 用户显式承接要求：
- Agent 不得自动调用扣款、支付确认、转账确认、退款提交、提现、充值等最终资金接口。
- 可以展示付款/资金摘要和 CTA。CTA 必须由用户点击触发。
- CTA 应优先使用 `detailPage` 打开源码真实订单/支付前页面，或承接到平台支付流程；半屏不可行时改用可靠 `relatedPage`，并由用户 tap 调用 `openRelatedPage()`。
- 摘要至少展示金额、商品或服务、商户/收款方、订单号或业务号；缺失关键字段时不得生成付款 CTA。
- 如果打开入口后会自动免密扣款、自动代扣或无平台/原页面二次确认，则不得生成该入口，改为 `relatedPage` 或说明。

handoffOnly 规则：
- handoffOnly 表示 Agent 只提供摘要、原因、`detailPage`、`relatedPage`、`relatedQuery` 或 `followUpText`。
- handoffOnly 场景不得在承接前调用会创建订单、锁库存、占名额、提交申请、生成待支付记录或改变账户状态的接口。
- 如果必须先创建业务对象才能跳原页面，该动作不再是 handoffOnly，应升级为 R3 businessSubmit：必须展示将创建的对象、金额、门店和后果，用户明确确认后才能调用创建接口，创建成功后再承接原页面。

状态变更后刷新失败规则：
- 仅适用于状态变更请求已成功或已被服务端受理、随后刷新最新状态失败的两阶段流程；纯查询接口和正常异步受理结果不得套用此分支。
- 状态变更请求成功后，后续刷新查询失败时，不得返回普通失败。
- 不得返回普通成功加空列表，除非真实刷新结果就是空列表。
- 必须返回 `operationSubmitted=true`、`refreshFailed=true`、`warningText`，并提示用户不要重复提交，可重新查询或打开原页面确认。
- 可能返回该分支的 API 必须在 `outputSchema` 声明 `operationSubmitted`、`refreshFailed`、`warningText` 以及实际返回的恢复出口字段。
- `refreshFailed=true` 必须蕴含 `operationSubmitted=true`；`operationSubmitted=true` 不蕴含刷新失败，单独出现时表示正常已受理状态，按该 API 的正常结果契约展示。
- 组件收到 `refreshFailed=true` 时保留旧业务数据，清除加载动画但标记 `stale=true`、`writeLocked=true`；等价写操作保持禁用，只允许只读刷新、查看详情或打开原页面。获得可信最新状态后才能解除锁定。

默认门店禁止规则：
- 涉及门店库存、购物车、优惠券领取、价格、配送范围的接口，若无用户已选门店、上游结果门店或授权定位结果，不得静默选择门店列表第一项后继续执行状态变更。
- 纯展示场景可使用推荐门店，但必须在返回中标记 `guessedStore=true`，且不得用于写操作。

## §6 降级规则

出现以下情况时，不生成直接操作：
- 用户未明确要求，且源码证明动作会造成无可靠恢复路径的不可逆后果。
- 参数来源不可靠或关键字段缺失。
- 接口后果不明，无法判断是否资金流转、锁库存或不可逆履约。
- 目标能力依赖插件且无法获取源码。
- JSAPI 在当前运行环境不可用且没有保留用户意图的替代方式。
- 原流程依赖复杂风控、实名、支付密码、银行卡、动态表单或平台支付页，且 Skill 无法可靠承接。
- 原页面路径或支付/结算入口无法从源码证据追溯。

降级优先级：
1. 展示摘要 + 配置真实 `relatedPage` + 用户点击调用 `openRelatedPage()` 承接原流程。
2. 展示摘要 + 半屏承载页说明或补字段。
3. 仅展示结果和不支持原因。
4. auto 版记录 exclude 或 downgradeReason；人工版询问用户是否接受降级。

## §7 Gate 产物字段

接口、组件和体验决策产物中应记录：
- `safetyLevel`：R0/R1/R2/R3/R4/R5
- `actionEffect`：readOnly/localState/reversibleWrite/businessSubmit/fundsOrIdentity/unknown
- `userCanPerform`：用户是否仍可通过可靠流程完成目标
- `agentEntry`：Agent 处理该自然语言意图时首先调用的已注册 API；直接执行、返回确认或页面承接 CTA 均可，仅无可靠 Agent 承接路径时为 none
- `agentMayExecute`：Agent 是否可直接执行该动作
- `uiEntry`：localState/my.request/apiCall(<apiName>)/detailPage/relatedPage/followUpText/none
- `parameterProvenance`：关键参数来源和源码证据
- `confirmationRequired`：是否需要确认
- `userGestureRequired`：是否必须用户点击触发
- `ctaRequired`：是否必须提供清晰可见的继续操作出口
- `executionFeasibility`：目标接口/页面、参数、鉴权、路由、storage、插件和支付上下文是否允许该执行方式
- `freshnessPolicy`：服务端校准、旧卡过期与 Agent 后续重查策略
- `recoveryExit`：撤销、修改、查看原页面、重新查询等恢复出口
- `downgradeReason`：降级或排除原因
