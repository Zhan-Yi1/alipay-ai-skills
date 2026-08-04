---
title: 半屏页面
purpose: 定义 Agent 卡片打开半屏承载页、完成页内任务并返回对话继续的规范
loadTiming: Gate E
---

# 半屏页面

> 高度预估判定溢出、已有详情流程或中间态需要用户确认/继续时，可挂半屏入口。卡片内展示摘要并提供明确 CTA，由组件点击事件打开半屏；生成前必须确认目标流程可在半屏限制内完成。

## §1 适用边界

半屏页面是从 Agent 原子组件打开的承载页，用于展示不适合放进卡片的信息或承接已有详情流程。

适用场景：

| 场景 | 示例 |
|------|------|
| 详情内容过长 | 订单完整信息、商品完整介绍、服务记录详情 |
| 源业务已有详情页 | 列表项点击进入 `pages/order/detail` |
| 需要补充说明或确认 | 中风险操作的确认说明、复杂规则说明 |
| 中间态继续操作 | 结算摘要、提交预约前确认、进入单页可完成的用户承接流程 |
| 富文本或图文内容 | 文章、活动详情、商品图文详情 |

不适用场景：

- 简单单条信息展示，卡片可以完整表达
- 无源码证据的页面路径
- 需要离开半屏继续跳转的流程

承载页来源：
- 使用项目内已有小程序页面；路径必须来自 `app.json` 的 `pages` / `subPackages.pages`，或源码中真实 `navigateTo` / `redirectTo` / `switchTab` 证据。
- 半屏入口只负责打开承载页。若没有合适承载页，改用 `apiCall`、`relatedPage`、`followUpText` 或纯结果展示。

### 1.1 承接可行性裁决

选择 `detailPage` 前追踪目标页面及其关键 handler，记录后续路由、必需 storage、前序接口、插件和支付上下文：

| 流程事实 | 承接方式 |
|---|---|
| 单页可完整展示、确认并结束 | `detailPage` |
| 需要 `navigateTo`、`redirectTo`、`switchTab` 等后续路由 | `relatedPage` |
| 依赖当前页面内存、复杂 storage、插件或完整支付上下文 | 优先 `relatedPage` |
| 缺少可靠路径或必要参数 | 不生成失效入口；记录 `handoffFeasibility` 和 `downgradeReason` |

R3/R4 动作采用 `relatedPage` 时仍应保留自然语言入口和用户可感知的继续操作出口：`agentEntry` 调用查询、详情或 handoff API 返回最新摘要和 CTA，组件先配置真实关联页，再由用户 tap 调用 `openRelatedPage()`；不得因为半屏不可行就把可由原页面完成的目标写成「不支持」。

## §2 调用入口

半屏只能从原子组件内打开。原子接口没有组件实例 `this`，拿不到 `viewCtx`。

```javascript
Component({
  methods: {
    onOpenDetail(e) {
      const dataset = e.currentTarget.dataset || {};
      const id = encodeURIComponent(dataset.id || '');

      my.modelContext.getViewContext(this).openDetailPage({
        url: `/pages/order/detail?orderId=${id}`
      });
    }
  }
});
```

```xml
<view class="detail-link" data-id="{{item.id}}" onTap="onOpenDetail">
  <text>查看详情</text>
</view>
```

要求：
- `openDetailPage` 必须在用户点击事件中调用。
- 参数通过 `url` query 字符串传递，不传独立 `query` 对象。
- `url` 指向宿主已有页面路径，参数必须来自接口结果、dataset、组件 data、Result `_meta` 或用户已确认输入。
- 体验决策必须写明用户在页内完成的目标，以及返回对话后用于恢复的已注册查询接口；继续状态变更、金额计算、结算或下单前重新查询。

## §3 半屏页内 Agent API 边界

当前静态规范只声明原子组件通过 `getViewContext(this).openDetailPage({ url })` 打开半屏，没有声明半屏 Page 内可用的 `getContext()`、`sendFollowUpMessage()` 或卡片重放能力。生成半屏承载页时不得添加这些未列明调用；需要回到对话流时，在原子组件中使用静态规范已支持的上行消息，或改用可靠的卡片/原页面出口。

## §4 Agent 半屏限制

支付宝 Agent 半屏页执行环境与普通小程序页面一致，但会对离开半屏、页面路由和广告相关能力做拦截。规划半屏承接时，如果承载页核心流程依赖这些能力，应改用 `relatedPage` 或其他出口。

### 4.1 跳出半屏类

```text
my.restartMiniProgram
my.openEmbeddedMiniProgram
my.navigateToMiniProgram
my.navigateBackMiniProgram
my.exitMiniProgram
my.ap.navigateToAlipayPage
my.ap.openAlipayApp
my.ap.openURL
MapContext.openMapApp
```

### 4.2 页面路由类

```text
my.switchTab
my.reLaunch
my.redirectTo
my.navigateTo
my.navigateBack
```

### 4.3 分享与广告

```text
onShareAppMessage
my.createRewardedAd
my.createRewardedVideoAd
my.createInterstitialAd
ad
ad-feeds
```

### 4.4 导航组件

```text
navigator
```

### 4.5 web-view 承载页

若半屏承载页内含 `web-view`，Agent 半屏会拦截跳到外部地址的重定向。链接、`location.href`、`location.assign()`、`location.replace()`、`window.open()`、`meta refresh`、`form submit` 等跳到非当前页地址时都可能被拦截。

半屏切到全屏后仍按 Agent 半屏管控；Agent 卡片右下角唤起的全屏不是本节所说的半屏承载页。

## §5 与原子接口和组件的关系

| 维度 | 原子接口 | 原子组件 | 半屏承载页 |
|------|----------|----------|------------|
| 运行时上下文 | Skill API 侧 | 原子组件渲染上下文 | 普通小程序页面，叠加 Agent 半屏限制 |
| 打开半屏 | 不可 | `getViewContext(this).openDetailPage({ url })` | - |
| 打开关联原页面 | 不可 | `getViewContext(this).openRelatedPage()` | - |
| 上行消息 | 不可 | `getContext(this).sendFollowUpMessage(...)` | 静态规范未声明，不生成 |
| 默认是否需要 | 必要时返回 UI 数据 | 有 UI 时生成 | 默认不挂，仅溢出、详情、确认或中间态继续语义需要且流程可行时挂 |

## §6 自检

- [ ] 卡片已先做字段裁剪；只有溢出、详情、确认或中间态继续语义时才挂半屏入口。
- [ ] `openDetailPage` 调用点在组件 `methods` 的用户点击 handler 内。
- [ ] 降级为 `relatedPage` 时，目标已通过 `setRelatedPage` 配置，`openRelatedPage()` 调用点位于用户点击 handler 内。
- [ ] `url` 来自源码真实页面路径，query 参数来源可靠。
- [ ] 半屏承载页核心流程不依赖 §4 中会被拦截的跳转、路由、广告或 navigator 能力。
- [ ] 已追踪目标 handler 的后续路由、storage、前序接口、插件和支付上下文，并记录 `handoffFeasibility`；不适合半屏的流程已改用可靠承接。
- [ ] 总体用户动线写明生成入口的 `agentEntry`、页内目标和返回后的查询接口，没有把半屏或原页面当作无后续的终点。
- [ ] 半屏页内未生成静态规范未声明的 `getContext()`、`sendFollowUpMessage()` 或卡片重放调用。
