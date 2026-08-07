---
title: JSAPI 能力边界
purpose: 定义原子接口、原子组件与动态组件的可用 API 清单、禁用项及判定规则
loadTiming: Gate D/E 读取全文
---

# JSAPI 能力边界


## §1 新增 Agent API

本节是 `my.modelContext`、Context 和 ViewContext 的精确 allowlist；未列出的对象方法、参数字段或调用形态均不得生成。

### 1.1 原子接口注册

```javascript
import { apiName1 } from './apis/apiName1';
import { apiName2 } from './apis/apiName2';

const skill = my.modelContext.createSkill('skills/<skill-name>');
skill.registerAPI('apiName1', apiName1);
skill.registerAPI('apiName2', apiName2);
```

要求：
- `createSkill(skillPath?)` 传入 `skillPath` 时，必须与 `app.json#agent.skills[].path` 完全一致。
- `skill.registerAPI(name, handler)` 的 name 必须与 `mcp.json#apis[].name` 完全一致。
- 需要中间件时使用 `skill.use(async (ctx, next) => {})`。
- 单接口可使用 `my.modelContext.registerAPI(name, handler)` 快捷注册；生成多个接口或需要中间件时仍使用 `createSkill` + `skill.registerAPI`，同一 Skill 内不要混用两套注册方式。
- `my.modelContext.expireAllCards(options?)` 可在原子接口和原子组件侧设置卡片过期；`options.componentPaths` 限定组件路径，`options.match='latest'` 只匹配最新一张。
- 使用 `my.modelContext` 前注意低版本兼容性；基础库或宿主不支持时必须阻断或降级。

### 1.2 原子组件 Context

通知类型使用 `my.modelContext.NotificationType`，包含 `Input`、`Result`、`Overflow`、`Resize`、`Expire`。

| API | 支持情况 |
|-----|----------|
| `my.modelContext.getContext(this)` | 获取组件上下文 |
| `ctx.on(type, callback)` | 支持 Input、Result；卡片过期时触发 Expire |
| `ctx.off(type, callback?)` | callback 为空时移除该类型所有监听 |
| `ctx.sendFollowUpMessage({ content })` | 用户点击触发的上行消息 |
| `my.modelContext.expireAllCards(options?)` | 组件侧设置所有可过期卡片 |

### 1.3 原子组件 ViewContext

| API | 支持情况 |
|-----|----------|
| `my.modelContext.getViewContext(this)` | 获取视图上下文 |
| `vctx.on(type, callback)` | 支持 Overflow、Resize、Expire |
| `vctx.off(type, callback?)` | callback 为空时移除该类型所有监听 |
| `vctx.getDimensions()` | 获取卡片尺寸 |
| `vctx.setRelatedPage({ path?, query })` | 设置关联原页面，query 必传 |
| `vctx.openRelatedPage()` | 用户点击触发打开已设置的关联原页面 |
| `vctx.openDetailPage({ url })` | 用户点击触发打开半屏详情页 |
| `vctx.expirePreviousCards(options?)` | 设置之前的卡片过期，不含当前卡片 |

---

## §2 原子接口侧支持矩阵

本节适用于 Skill 注册入口、`apis/*.js`，以及从这些文件通过 `import` / `require` 可达的全部依赖模块。

### 2.1 明确支持

本节是原子接口上下文原有 `my.*` API 的精确 allowlist；未列出的 API 均按不支持处理。

| 分类 | API |
|------|-----|
| 基础 | `my.env`、`my.SDKVersion`、`my.getAuthCode` |
| 发起请求 | `my.request` |
| 网络 | `my.getNetworkType`、`my.onNetworkStatusChange`、`my.offNetworkStatusChange` |
| 系统信息 | `my.getAppBaseInfo`、`my.getDeviceBaseInfo` |
| 数据缓存 | `my.setStorage`、`my.setStorageSync`、`my.getStorage`、`my.getStorageSync`、`my.getStorageInfo`、`my.getStorageInfoSync`、`my.removeStorage`、`my.removeStorageSync`、`my.clearStorage`、`my.clearStorageSync` |
| 位置与手机号 | `my.getLocation`、`my.openLocation`、`my.chooseLocation`、`my.getPhoneNumber` |
| 拨打电话 | `my.makePhoneCall` |
| 设置 | `my.getSetting` |
| 账号信息 | `my.getAccountInfoSync` |
| 隐私信息授权 | `my.getPrivacySetting`、`my.openPrivacyContract` |
| 图片视频 | `my.saveImageToPhotosAlbum` |
| 地址 | `my.chooseAddress`、`my.chooseInvoiceTitle` |
| 扫码 | `my.scan` |

### 2.2 明确不支持

| 分类 | API |
|------|-----|
| 其他网络 | WebSocket、`my.connectSocket` 及 §2.1 未列出的网络 API |
| 云开发 | `CloudContext.init`、`CloudContext.callFunction`、`CloudContext.database` |
| 上传下载 | `my.uploadFile`、`my.downloadFile` |
| 交互反馈 | `my.showToast`、`my.hideToast` |
| 旧版或未列明系统信息 | `my.getDeviceInfo`、`my.getWindowInfo`、`my.getSystemInfo` |
| 分享、文件、设置与授权 | `my.showSharePanel`、`my.openDocument`、`my.openSetting`、`my.authorize` |
| 图片视频 | `my.chooseImage`、`my.previewImage`、`my.generateImageFromCode`、`my.getImageInfo` |
| 支付 | `my.tradePay` |
| 订阅 | `my.requestSubscribeMessage` |
| WiFi | `my.startWifi`、`my.getWifiList`、`my.getConnectedWifi`、`my.connectWifi`、`my.stopWifi`、`my.setWifiList` |
| 振动 | `my.vibrate`、`my.vibrateShort`、`my.vibrateLong` |
| 渲染上下文 | `my.createMapContext`、`my.createCanvasContext` 等 MapContext/CanvasContext 通用调用 |
| 未列明界面弹窗 | `my.showModal`、`my.alert`、`my.confirm`、`my.showActionSheet`、`my.showLoading` 等未在支持列表中声明接口侧支持的 UI API |

---

## §3 组件侧支持矩阵

本节适用于 `mcp.json#components[].path` 对应入口及其通过 `import` / `require` 可达的整棵组件依赖树。`permissions["scope.dynamic"]` 决定组件运行环境：未声明时按「原子组件」列判定，声明后按「动态组件」列判定。权限只作用于对应组件及其组件树，不改变同一 Skill 内其他组件；同一共享模块被多个上下文引用时，必须分别满足每个引用上下文的 allowlist。

### 3.1 原子组件明确支持

本节是普通原子组件侧原有 `my.*` API 的精确 allowlist；未列出的 API 均按不支持处理。动态组件继承本节能力并按 §3.2 额外获得 `my.request` 和 `my.tradePay`。

| 分类 | API |
|------|-----|
| 基础 | `my.env`、`my.SDKVersion` |
| 系统信息 | `my.getAppBaseInfo`、`my.getDeviceBaseInfo` |
| 数据缓存 | `my.setStorage`、`my.setStorageSync`、`my.getStorage`、`my.getStorageSync`、`my.getStorageInfo`、`my.getStorageInfoSync`、`my.removeStorage`、`my.removeStorageSync`、`my.clearStorage`、`my.clearStorageSync` |
| 位置 | `my.openLocation` |
| 交互反馈 | `my.showToast`、`my.hideToast` |
| 拨打电话 | `my.makePhoneCall` |
| 账号信息 | `my.getAccountInfoSync` |
| 隐私信息授权 | `my.getPrivacySetting`、`my.openPrivacyContract` |
| 图片视频 | `my.previewImage`、`my.generateImageFromCode` |
| 振动 | `my.vibrate`、`my.vibrateShort`、`my.vibrateLong` |
| Agent | `my.modelContext.NotificationType/expireAllCards`、`ctx.on/off/sendFollowUpMessage`、`vctx.on/off/getDimensions/setRelatedPage/openRelatedPage/openDetailPage/expirePreviousCards` |

约束：
- `openRelatedPage` 必须由用户点击触发；调用前先用 `setRelatedPage({ path?, query })` 设置来自源码的真实页面和 query，不传页面参数给 `openRelatedPage()`。
- `openDetailPage` 必须由用户点击触发；参数通过 `url` 的 query 字符串传递。
- 过期全部匹配卡片调用 `my.modelContext.expireAllCards(options?)`，不得调用不存在的 `ctx.expireAllCards()`。
- 使用点需要现取 `ctx` / `vctx`，避免在点击 handler 中使用旧缓存引用。

### 3.2 动态组件额外支持

动态组件继承 §3.1 的全部能力，并额外支持以下能力：

| 分类 | API / 能力 |
|------|------------|
| 发起请求 | `my.request` |
| 支付 | `my.tradePay` |
| 定时器 | `setTimeout`、`clearTimeout`、`setInterval`、`clearInterval` |

确需组件直接请求、支付或使用定时器时，在对应 `components[]` 声明：

```json
"permissions": {
  "scope.dynamic": {
    "desc": "说明组件直接请求、支付或定时器的具体业务用途"
  }
}
```

约束：
- `scope.dynamic` 是组件粒度权限；同一 Skill 内未声明的组件仍按 §3.1 判定，不得调用 `my.request`、`my.tradePay` 或定时器。
- `desc` 必须是非空业务说明，写清直接请求的数据和刷新触发方式、用户点击发起的具体支付流程或定时器用途；不能只写「需要网络」「动态能力」。
- 动态组件新增的 `my.*` 能力只有 `my.request` 和 `my.tradePay`。`my.getAuthCode`、其他网络 API、上传下载及 §3.3 中的 API 仍不支持。
- `my.request` 的技术可用不等于业务动作可直接执行；请求用途、鉴权可行性、数据边界和写操作策略仍须遵循 `UX_EXPERIENCE.md` 与 `SAFETY_POLICY.md`。
- `my.tradePay` 只能在用户明确点击付款 CTA 的 tap handler 中调用。调用前必须展示来自最新可信结果的订单、商户和金额摘要，支付参数必须来自源码真实支付链路；不得由定时器、生命周期、Agent 自动调用或普通原子组件调用。支付结果和取消/失败分支按 `SAFETY_POLICY.md` 处理。
- 动态组件可以直接或通过 `utils/` 业务函数间接调用 `my.request`，但必须按 §3.2.1 递归检查当前动作从组件 tap 出发的直接执行闭包；闭包中的任一依赖使用 §3.3 能力、接口注册上下文或接口私有凭证/模块状态时，整条链均不得在组件中使用。
- 组件不得 import 原子接口 handler。Agent API 与动态组件可以复用全部传递依赖均受组件支持的 `utils/` 业务函数，以统一 URL、method、header、后端参数映射和响应信封；文件名或是否属于请求/鉴权封装本身不作为禁止依据。
- 目录不承担运行时隔离；依赖闭包承担。继续使用扁平 `utils/` 即可：组件只能到达组件侧支持的依赖，API 可以额外依赖主动鉴权或接口侧工具。
- 定时器回调不具备 tap 手势，不得在回调里主动 `ctx.sendFollowUpMessage(...)`；改为用户点击触发或由原子接口返回新结果。
- 不得因为声明了 `scope.dynamic` 就推断 `my.request`、`my.tradePay` 之外的额外 `my.*` 可用。

### 3.2.1 动作级鉴权路径判断

动态组件资格的判定单位是“一个可见动作从组件 tap 出发的直接执行闭包”，不是整个项目、Skill、`auth-spec.md`、登录模块或原子接口 handler。对每个需要原位请求的确定性动作，分别追踪：

1. **已有 session 执行路径**：组件 tap → 组件实际 import 的共享业务函数 → 统一 `request({ auth: true })` → 请求层读取并校验已有 session、构造 header → 业务请求 → 写后查询或状态校准。
2. **缺失/失效 session 恢复路径**：请求层校验失败或业务响应表示鉴权失效 → 停止业务请求 → 清理无效 session（如源码需要）→ 显示登录提示 → 由源码已有的独立登录 API、登录卡片或登录页面承接。

匿名请求把第一条视为“不需要 session 的直接执行路径”，无需构造第二条，仍按同一动作的实际依赖闭包裁决。

Gate C 的接口规格记录已有 session 执行路径、缺失或失效 session 恢复路径、实际调用的 JSAPI、storage、模块状态和后续分支。Gate D 对照本节逐项判断这些依赖的组件侧支持性并确定首个不支持依赖；恢复路径同时保留源码已有的独立登录 API、登录卡片或登录页面及其触发条件。

### 3.3 原子组件与动态组件均不支持

除 §3.1 和 §3.2 明确列出的能力外，其他 `my.*` API 均不支持。

| 分类 | API |
|------|-----|
| 鉴权 | `my.getAuthCode` |
| 网络 | `my.getNetworkType`、`my.onNetworkStatusChange`、`my.offNetworkStatusChange`、WebSocket 等未在组件支持列表声明的网络 API |
| 云开发 | `CloudContext.init`、`CloudContext.callFunction`、`CloudContext.database` |
| 上传下载 | `my.uploadFile`、`my.downloadFile` |
| 旧版或未列明系统信息 | `my.getDeviceInfo`、`my.getWindowInfo`、`my.getSystemInfo` |
| 位置与手机号 | `my.getLocation`、`my.chooseLocation`、`my.getPhoneNumber` |
| 设置与授权 | `my.getSetting`、`my.openSetting`、`my.authorize` |
| 分享与文件 | `my.showSharePanel`、`my.openDocument` |
| 图片视频 | `my.chooseImage`、`my.saveImageToPhotosAlbum`、`my.getImageInfo` |
| 支付订阅与地址 | `my.requestSubscribeMessage`、`my.chooseAddress`、`my.chooseInvoiceTitle` |
| WiFi | `my.startWifi`、`my.getWifiList`、`my.getConnectedWifi`、`my.connectWifi`、`my.stopWifi`、`my.setWifiList` |
| 扫码 | `my.scan` |
| 页面路由 | `my.navigateTo`、`my.redirectTo`、`my.navigateBack`、`my.switchTab`、`my.reLaunch` |
| 未列明界面弹窗 | `my.showModal`、`my.alert`、`my.confirm`、`my.showActionSheet`、`my.showLoading` 等未在支持列表中声明组件侧支持的 UI API |
| 渲染上下文 | `my.createMapContext`、`my.createCanvasContext` 的通用调用 |
| DOM/BOM | 任意 DOM / BOM API |

---

### 3.4 Gate D 执行入口裁决

Gate D 只依据 §3.2.1 的已有 session 执行路径裁决 `componentRuntime` 和 `uiEntry`。该路径的全部传递依赖均受组件支持，且请求契约已收口到共享 `utils/` 业务函数时，需要原位请求的动作必须使用动态组件 `uiEntry=my.request`。

支付入口单独裁决：源码存在真实 `my.tradePay` 链路、最新可信结果提供订单/商户/金额摘要和全部支付参数、平台仍保留最终支付确认时，可使用动态组件 `uiEntry=tradePay`；必须由明确付款 CTA 的 tap handler 调用，并在回调后通过已注册查询 API 重查权威状态。任一条件不满足时使用 `detailPage` 或 `relatedPage`。

项目或接口侧存在主动鉴权不构成否决证据。源码使用独立登录能力时，受保护业务 API 和动态组件都只通过统一请求层消费已有 session，主动鉴权仅由独立登录 API、登录卡片或登录页面负责。只有当前业务动作的源码执行链本身包含主动鉴权时，原子接口才迁移该链路后调用共享业务函数。组件的 import 闭包不得包含主动鉴权模块。

只有已有 session 执行路径本身必然到达 §3.3 API、主动 token 换取/刷新、接口注册上下文、接口私有状态或不可暴露凭证，或者共享请求封装无法在不复制敏感逻辑的前提下提供被动模式时，才不得在组件中执行该路径。因鉴权选择 `apiCall` 时，必须引用“组件 tap → 共享业务函数 → 首个组件侧不支持依赖”的可达调用链；只写“项目使用 `my.getAuthCode`”或“接口需要登录”均为无效证据。

| 场景 | 入口裁决 |
|------|----------|
| 项目存在 `my.getAuthCode`，当前动作只从 storage 被动读取有效 token | 需要原位请求时使用动态组件 `my.request` |
| 源码使用独立登录 API、登录卡片或登录页面，当前业务动作只调用 `request({ auth: true })` | 需要原位请求时使用动态组件 `my.request`；缺失或失效 session 时提示登录并由独立能力承接 |
| 当前业务动作的源码 handler 本身主动登录后调用共享业务函数，组件可用已有 session 直接调用该函数 | 需要原位请求时使用动态组件 `my.request` |
| 当前动作共享请求封装会自动调用 `my.getAuthCode` 或主动刷新，且无法安全拆出被动模式 | 参数完整且 API 已注册时使用 `apiCall` |
| token 仅存在接口私有内存或组件不可访问的凭证区 | 参数完整且 API 已注册时使用 `apiCall` |

---

## §4 半屏详情页约束

半屏详情页是从原子组件打开的承接页。支付宝半屏页执行环境与普通小程序页面一致，但 Agent 拉起的半屏会拦截离开半屏、页面路由和广告相关能力。具体列表见 `HALF_SCREEN.md`。

- 半屏入口只能由原子组件在用户点击事件中通过 `vctx.openDetailPage({ url })` 打开。
- 半屏承载页路径必须来自源码真实页面或 `app.json` 注册页面。
- 静态规范未声明半屏页内可调用 `my.modelContext.getContext()` 或其他额外 Agent Context API；不得在生成的半屏页面中使用这些未列明能力。
- 若承载页核心流程依赖 `my.navigateTo`、`my.redirectTo`、`my.switchTab`、`my.navigateToMiniProgram`、`navigator`、广告组件或外部 H5 重定向等被拦截能力，应改用 `relatedPage`、`apiCall` 或 `followUpText` 承接。

---

## §5 判定规则

### 级别 1 — 可直接使用

- API 在 §2、§3.1 或 §3.2 对应运行环境中明确支持；组件是否属于动态组件以自身 `permissions["scope.dynamic"]` 为准。
- 若 API 需要用户点击触发（如组件侧 `vctx.openRelatedPage`、`vctx.openDetailPage`），必须在 tap 回调中调用。
- `scope.dynamic` 只在原子组件能力上增加 `my.request`、`my.tradePay` 和定时器，不开放其他 `my.*`。

### 级别 2 — 需替代方案

API 在当前运行环境不支持，但存在等价承接：

| 原始意图 | 替代方式 |
|----------|----------|
| 接口侧 toast/提示 | Result 的 `content.text` |
| 接口侧预览图片 | 返回图片 URL，由组件 `image` 或组件侧 `my.previewImage` 承接 |
| 确定性 R2 组件状态变更 | 按 §3.2.1 核对当前动作；需要原位更新且已有 session 执行路径的全部传递依赖均受组件支持时，必须在 tap 中直接 `my.request`；否则参数完整且目标 API 已注册时使用 `apiCall`，其余情况关联原页面 |
| 需要 Agent 补参、理解或跨能力编排 | 使用 `followUpText` 返回 Agent 流程 |
| 组件侧页面跳转 | 关联原页面使用 `vctx.setRelatedPage` + tap 中的 `vctx.openRelatedPage()`；半屏使用 `vctx.openDetailPage` |
| 组件侧选择位置/扫码/选择图片 | 关联原页面承接 |

### 级别 3 — 不可迁移

API 在当前运行环境不支持，且没有可保留用户意图的替代方案时，判定为不可迁移：询问用户是否排除该能力或改用关联原页面。
