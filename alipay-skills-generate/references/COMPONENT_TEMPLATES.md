---
title: 组件运行时与模式参考
purpose: 提供支付宝原子组件的运行时骨架、交互协议、类型差异与高风险状态处理
loadTiming: Gate E
---

# 组件运行时与模式参考

> 本文件是生成骨架规范，不可完全照抄。字段来自 API 契约，操作来自体验决策记录，样式来自源页面和设计规范。

## 目录

- [§1 硬约束](#1-硬约束)
- [§2 组件模式选择](#2-组件模式选择)
- [§3 UI 执行入口](#3-ui-执行入口)
- [§4 Result 状态骨架](#4-result-状态骨架)
- [§5 最小 AXML 骨架](#5-最小-axml-骨架)
- [§6 高风险交互](#6-高风险交互)
- [§7 样式、溢出与过期](#7-样式溢出与过期)
- [§8 自检](#8-自检)

## §1 硬约束

### 1.1 组件与事件

- 基础组件支持 `view`、`text`、`image`、`button`、横向 `scroll-view`、`swiper`、`swiper-item`；虚拟组件 `block` 不受此列表限制。确需自定义组件时在 `usingComponents` 注册并确认目标路径存在。`image` 必须声明 `mode`，`button` 禁止 `open-type`，`scroll-view` 必须声明 `scroll-x`。
- `swiper` 仅用于横向轮播，禁止 `vertical`、`adjust-vertical-height`、`disable-touch`、`onAnimationEnd` 和 `onTransition`。禁止 `input`、`textarea`、`form`、`web-view`、`picker` 和纵向滚动；输入、选择和长流程使用卡片选项、上行消息、半屏或原页面承接。
- 事件只使用 `view` 的 `onTap` / `catchTap`、`image` 的 `onLoad` / `onError` 和 `swiper` 的 `onChange`；禁止长按、触摸、显隐事件和其他未支持事件。
- AXML 根节点使用单一 `view`；所有文本和插值表达式放在叶子 `text` 中；`button` 文案也必须包在 `text` 中。
- 每个可交互元素都要有明确出口；不存在可靠下一步时删除操作，不生成死按钮。

### 1.2 文件和运行时

```text
components/{name}/
├── index.axml
├── index.acss
├── index.js
└── index.json
```

组件路径固定为 `components/{name}/index`。`index.json` 至少包含：

```json
{
  "component": true,
  "styleIsolation": "apply-shared"
}
```

`Component({})` 顶层只放支付宝组件定义项。事件 handler、Result 处理、数据映射和本地状态函数全部放入 `methods`；否则 `this.xxx()` 可能不可用。

默认原子组件不得调用 `my.request`、`my.tradePay` 或 `my.getAuthCode`。只有 Gate D 已裁决 `componentRuntime=dynamic`、记录直接请求/支付/定时器契约，并在当前组件声明 `permissions["scope.dynamic"]` 时，组件才能调用 `my.request`、`my.tradePay` 或定时器；动态组件仍不得调用 `my.getAuthCode`、其他网络 API 或上传下载能力。

所有组件都不得 import 原子接口 handler。动态组件可以复用 `utils/` 中的业务和请求工具，但必须递归确认全部传递依赖均符合动态组件 JSAPI 边界；URL、method、header、后端参数映射和响应信封应收口到 `utils/` 业务函数，不得在组件与 API 中分别实现。同一操作存在 Agent API 时，两端共同调用该业务函数。R2 写请求由用户 tap 触发，R3 在展示具体确认信息后由确认 tap 触发，并处理防重复、服务端校准和失败恢复；R4 最终身份或关键资料动作不得直接请求，支付仅可在满足 `SAFETY_POLICY.md` 的用户确认承接条件时由付款 CTA 调用 `my.tradePay`。R1 使用 `localState`，不得用定时器发起写操作。

动态请求、支付与定时器实现还必须满足：

- 直接请求结果更新组件 data，不伪装成原子接口 Result，也不写入 Agent 可见上行文本；写操作以响应或随后重查得到的服务端状态为准。
- 使用请求中标记避免同一请求或动作并发重入；失败时解除标记、保留或恢复旧数据并展示可见错误或重试出口。
- 保存 timer handle，在组件卸载时 clear；定时器回调不得发送需要 tap 手势的上行消息，也不得触发写请求。
- `my.tradePay` 只放在明确付款 CTA 的 tap handler 中；付款前展示最新订单、商户、金额和后果摘要，支付参数取自源码真实链路，并处理用户取消、失败、结果未知和成功后的重查。

## §2 组件模式选择

先按体验决策记录选模式，再按 API `outputSchema` 定义真实字段。下表是结构约束，不是固定 schema。

| 模式 | 适用场景 | 核心数据 | 特有约束 |
|---|---|---|---|
| 澄清 | 补字段、选择条件、确认输入 | `fields`、`options`、当前值 | 不生成真实输入控件；选项来自源码或接口事实 |
| 富媒体候选列表 | 图片、标签或主次值会影响选择 | `items[]` 中的图片、标题、摘要、关键值 | 卡内优先展示最多 3 个高价值项；图片不是判断依据时改用文本列表 |
| 文本列表 | 标题和少量文字即可比较 | `items[]` 中的标题、说明、状态 | 不生成无依据的图片占位；长列表分页或转半屏/原页面 |
| 摘要确认 | 执行前核对对象、字段与后果 | `summaryRows`、动作摘要 | 主操作最多 1 个；不得跳过安全确认 |
| 详情 | 单对象、状态或可回看记录 | `fields`、核心结论、状态 | 直接展示 2-4 个决策重点，最多 6 行；其余进入承接页 |
| 状态结果 | 成功、失败、已受理或处理中 | `type`、标题、说明、关键字段 | 视觉由 `type` 派生；不替代执行前确认 |

通用字段仅在契约需要时使用：

| 字段 | 语义 |
|---|---|
| `title` / `subtitle` | 当前结果标题与辅助说明 |
| `primaryActionText` | 仅当源交互映射明确存在独立主操作控件时使用；不是组件默认字段 |
| `secondaryActions` | 仅当源交互映射明确存在独立次操作控件时使用；最多 2 个，不是组件默认字段 |
| `sourceName` | 服务来源；不能作为 Result 渲染成功证据 |
| `warningText` / `partialFailure` | 部分失败或风险提示 |
| `operationSubmitted` / `refreshFailed` | 写操作受理及后续刷新状态；两者不能互相等同 |

### 2.1 条件 profile

Profile 只增加差异，不复制基础组件。

| Profile | 叠加到 | 必须增加 | 边界 |
|---|---|---|---|
| 资金确认 | 摘要确认 | 金额、相对方、动作后果、承接文案 | 遵循 `SAFETY_POLICY.md`；R4 只展示摘要并打开用户承接流程，不在卡片内自动执行 |
| 凭证详情 | 详情 | 状态、凭证标识、时间和必要金额摘要 | 敏感原值只从 `_meta.private` 读取；不得写回上行文本或非必要参数 |

如果业务无法归入以上模式，回到体验契约重新确定展示目标，不新增行业专用模板。

## §3 UI 执行入口

每个操作必须采用体验决策记录中的 `uiEntry`：`localState`、`my.request`、`tradePay`、`apiCall`、`followUpText`、`detailPage`、`relatedPage` 或 `none`。`agentEntry` 是 Agent 处理对应自然语言意图时首先调用的已注册 API，`agentMayExecute` 决定 Agent 是否可直接改变业务状态；最终动作由用户点击平台支付或在页面完成时，`agentEntry` 仍应返回摘要和 CTA。

Agent 入口与 UI 入口分别裁决。确定性操作需要在当前卡片原位执行，且请求实现及全部传递依赖符合动态组件边界时，使用 `uiEntry=my.request`，由组件调用收口请求契约的 `utils/` 业务函数；同一操作存在 Agent API 时共同复用，UI 不发送上行消息。请求链只能由接口侧安全执行、操作意图和参数完整且目标 API 已注册时使用 `apiCall`；需要补参、语义理解或跨能力编排时使用 `followUpText`。

支付动作只有在源码存在真实 `my.tradePay` 链路、最新可信结果提供完整支付摘要和参数、平台仍会展示最终支付确认时，才使用动态组件 `uiEntry=tradePay`；必须由用户点击付款 CTA 触发。其余支付场景使用 `detailPage` 或 `relatedPage`。

`uiEntry` 只描述动作如何执行，不描述点击区域或控件形态。先按源交互映射确定整项点击、局部图标、步进器、选项、Tab、开关或独立按钮等交互节点，再把执行入口绑定到对应节点；不得因存在 API 或出口就自动增加操作按钮。

`ctaRequired=true` 时必须实现用户可感知的继续操作出口。没有最终业务写 API 只能排除 Agent 直接执行；总体用户动线内的动作仍须由查询、详情或 handoff API 生成确认、半屏或原页面承接入口。`relatedPage` CTA 必须先用 `setRelatedPage` 配置真实页面，再在对应 tap handler 中调用 `openRelatedPage()`；不得只设置关联页、只发送 `followUpText` 或生成无导航效果的按钮，页面返回后按体验决策重新查询。

### 3.1 上行消息

```javascript
// followUpText：只发送自然语言上行
my.modelContext.getContext(this).sendFollowUpMessage({
  content: [{ type: 'text', text: '<按体验契约填写的上行文案>' }]
});

// apiCall：仅在体验契约选择 apiCall 时使用
my.modelContext.getContext(this).sendFollowUpMessage({
  content: [
    { type: 'text', text: '<按体验契约填写的上行文案>' },
    { type: 'api/call', data: { name: '<mcp.json 中已注册 API 名>', arguments: { /* 来自真实数据源 */ } } }
  ]
});
```

硬规则：

1. `api/call` 前必须有 `text`。
2. `name` 必须存在于当前 `mcp.json.apis[]`。
3. `arguments` 对齐目标 `inputSchema`，值来自 dataset、组件 data、接口结果或必要的 `_meta`。
4. `_meta.private` 原值不得进入自然语言文本，也不得进入非必要参数。
5. 写操作点击后立即进入提交态，收到 Result 后再解除；提交中禁止重复触发。
6. 请求链的全部传递依赖均受组件支持且需要原位执行时，确定性控件使用 `my.request`，不发送上行消息；请求链只能由接口侧执行、操作意图和参数完整且目标 API 已注册时使用 `apiCall`。仍需补参、语义理解或跨能力编排时使用 `followUpText`。

### 3.2 本地状态与页面承接片段

```javascript
// detailPage：url 必须来自源码真实页面或 app.json
my.modelContext.getViewContext(this).openDetailPage({
  url: `/pages/<detail>/index?id=${encodeURIComponent(id)}`
});

// relatedPage：query 必传；path 如传入则必须来自源码；打开只能发生在用户 tap 中
my.modelContext.getViewContext(this).setRelatedPage({ path, query });

// 放在 methods 的 onTap/catchTap handler 中
my.modelContext.getViewContext(this).openRelatedPage();

// localState：只做无需网络的本地状态变化
this.setData({ selectedId: id, notice: '' });
```

半屏实现读取 `HALF_SCREEN.md`。没有合法出口时使用 `none`，不要猜测页面路径或 API。

## §4 Result 状态骨架

下面只固定容易出错的状态转换。`buildViewData` 必须按当前模式、`outputSchema` 和字段映射实现，不得照抄占位字段。

```javascript
Component({
  data: {
    title: '',
    rows: [],
    sourceName: '',
    notice: '',
    partialFailure: false,
    stale: false,
    writeLocked: false,
    submitting: false,
    submittingId: '',
    privateData: {}
  },

  onInit() {
    const ctx = my.modelContext.getContext(this);
    ctx.on(my.modelContext.NotificationType.Result, ({ result }) => {
      this.applyResultPayload(result);
    });
  },

  methods: {
    applyResultPayload(result) {
      if (result && result.isError) {
        const content = Array.isArray(result.content) ? result.content : [];
        const firstText = content.find((item) => item && item.type === 'text');
        this.setData({
          notice: (firstText && firstText.text) || '当前操作失败，请稍后重试',
          submitting: false,
          submittingId: ''
        });
        return;
      }

      const data = (result && result.structuredContent) || {};
      const meta = (result && result._meta) || {};

      // 只有 refreshFailed=true 才是“操作已提交但刷新失败”。
      // 此分支不得覆盖 rows/items/order 等旧业务数据。
      if (data.refreshFailed === true) {
        this.setData({
          notice: data.warningText || '操作已提交，但最新状态暂时无法确认，请勿重复提交',
          partialFailure: false,
          stale: true,
          writeLocked: true,
          submitting: false,
          submittingId: ''
        });
        return;
      }

      const viewData = this.buildViewData(data, meta.private || {});
      this.setData({
        ...viewData,
        sourceName: data.sourceName || '',
        notice: data.warningText || (data.partialFailure ? '部分数据暂时无法获取，请稍后重试' : ''),
        partialFailure: data.partialFailure === true,
        privateData: meta.private || {},
        stale: false,
        writeLocked: false,
        submitting: false,
        submittingId: ''
      });
    },

    buildViewData(data, privateData) {
      // 按 outputSchema 映射成 AXML 实际绑定字段；删除本注释并实现。
      return {};
    },

    sendApiCall(text, name, args) {
      if (this.data.submitting || this.data.submittingId || this.data.writeLocked) return;
      this.setData({ submitting: true, notice: '' });
      my.modelContext.getContext(this).sendFollowUpMessage({
        content: [
          { type: 'text', text },
          { type: 'api/call', data: { name, arguments: args } }
        ]
      });
    }
  }
});
```

状态规则：

- `isError=true` 只更新提示、加载和提交状态，不清空已有业务数据。
- `warningText` 或 `partialFailure=true` 必须形成用户可见提示。
- `refreshFailed=true` 必须蕴含 `operationSubmitted=true`；反向不成立。`operationSubmitted=true` 单独出现按 API 的正常结果契约展示。
- 刷新失败时保留旧数据并锁定等价写操作，只允许只读刷新、查看详情或打开原页面；得到可信最新状态后才能解锁。
- Result 必须映射到 AXML 实际绑定字段。仅显示初始标题、来源页脚或静态文案不算渲染成功。

## §5 最小 AXML 骨架

以下骨架只示范通用容器和状态。正文和交互节点必须按 §2 的模式及源交互映射改写，不能把所有模式塞进一个万能组件。

```xml
<view class="agent-card">
  <text class="agent-card-title" a:if="{{title}}">{{title}}</text>

  <view class="agent-card-body">
    <!-- 按模式渲染 fields/options/items/summaryRows 等真实字段 -->
    <view class="agent-card-row" a:for="{{rows}}" a:key="id">
      <text class="agent-card-label">{{item.label}}</text>
      <text class="agent-card-value">{{item.value}}</text>
    </view>
  </view>

  <text class="agent-card-notice" a:if="{{notice}}">{{notice}}</text>

  <text class="agent-card-source" a:if="{{sourceName}}">服务由{{sourceName}}提供</text>
</view>
```

只有源交互映射或安全承接契约明确要求独立操作控件时，才在对应业务位置增加操作区和 `button`；整项点击或局部控件直接在源结构对应节点绑定事件。`ctaRequired=true` 的中间态必须在摘要附近提供清晰的继续操作出口。必须保留 `notice` 的可见节点和写操作的禁用条件。类名、正文结构和全部 ACSS 按 `ATOMIC_COMPONENT_DESIGN.md`、`ACSS_SPEC.md`、`STYLE_MIGRATION.md` 生成。

## §6 高风险交互

### 6.1 数量减少与移除

加减号、步进器等弱语义动作不得自动传 `confirmed=true`。数量从 1 减到 0 时转为明确确认。需要原位执行且已有 session 执行路径的全部传递依赖均受组件支持时，必须在 tap handler 中调用 `utils/` 业务函数修改数量；该函数内部使用 `my.request`，同一操作存在 Agent API 时由两端复用。请求链只能由接口侧执行时选择 `apiCall`。下面示范共享业务函数模式；函数名和参数必须替换为当前 Skill 的真实契约：

```javascript
import { queryCartItem, updateCartQuantity } from '../../utils/cart';
import { isAuthRequiredError } from '../../utils/request';

Component({
  data: {
    submittingId: '',
    notice: '',
    stale: false,
    writeLocked: false
  },

  methods: {
    onDecreaseTap(e) {
      const item = this.itemFromDataset(e.currentTarget.dataset || {});
      if (!item || this.data.submittingId || this.data.writeLocked) return;
      const quantity = Number(item.quantity || 0);
      if (quantity <= 1) {
        this.setData({ notice: '再减少将移出该项，请点击移出按钮确认' });
        return;
      }
      this.updateQuantityDirect(item, quantity - 1);
    },

    async updateQuantityDirect(item, nextQuantity) {
      this.setData({
        submittingId: item.id,
        notice: ''
      });
      let submitted = false;
      try {
        await updateCartQuantity({
          storeId: item.storeId,
          itemId: item.id,
          quantity: nextQuantity
        });
        submitted = true;
        const authoritativeItem = await queryCartItem({
          storeId: item.storeId,
          itemId: item.id
        });
        if (!authoritativeItem) throw new Error('refresh failed');
        this.replaceCartItem(authoritativeItem);
        this.setData({
          stale: false,
          writeLocked: false
        });
      } catch (error) {
        if (isAuthRequiredError(error)) {
          this.setData({
            notice: submitted
              ? '数量可能已更新，请登录后重新查询，暂时不要重复提交'
              : '登录状态已失效，请登录后重试',
            stale: submitted,
            writeLocked: submitted
          });
          return;
        }
        this.setData({
          notice: submitted
            ? '数量可能已更新，但最新状态暂时无法确认，请勿重复提交'
            : '数量修改失败，请重试',
          stale: submitted,
          writeLocked: submitted
        });
      } finally {
        this.setData({ submittingId: '' });
      }
    }
  }
});
```

该片段只示范动态组件通过全部传递依赖均受组件支持的 `utils/` 业务函数完成数量减少、防重复提交和服务端校准，不替代 §3 的 `uiEntry` 裁决。请求链的全部传递依赖均受组件支持且需要原位更新时必须使用此模式；只能由接口侧执行且已选择 `apiCall` 时，通过上行 `api/call` 调用已注册接口。数量从 1 减到 0 的移出动作必须使用独立、明确的确认控件，再按已裁决的 `uiEntry` 执行。

鉴权失败时，业务组件停止请求并展示可见提示。源码已有独立登录 API、登录卡片或登录页面时，由该能力负责登录，不强制在每个业务组件内复制登录控件；只有源交互映射本身包含登录入口时，才使用已验证的 `detailPage`、`relatedPage` 或 `followUpText` 实现。业务组件不得调用 `my.getAuthCode`。登录完成后由用户重试或重新查询；若写请求可能已成功而刷新时失去登录态，保持 `writeLocked=true`，直到取得可信最新状态后再解锁。

### 6.2 敏感值

- `structuredContent` 和自然语言 `content.text` 不放敏感原值。
- 组件确需展示时从 `result._meta.private` 读取，并只保留在组件内部。
- 不把 `_meta.private` 整体传入下一跳；仅在目标 `inputSchema` 必需且体验契约允许时取最小字段。

### 6.3 写操作恢复

- 点击后设置 `submitting` 或 `submittingId`，按钮同步禁用。
- 错误 Result 必须解除提交态，但保留旧数据。
- 刷新失败必须解除动画并保持 `writeLocked=true`，不能通过再次点击提交相同操作。
- 可信刷新成功后才能清除 `stale` 和 `writeLocked`。

## §7 样式、溢出与过期

### 7.1 ACSS

生成时：

1. 按 `ATOMIC_COMPONENT_DESIGN.md` 选择结构、信息层级、间距、字号和操作区。
2. 按 `STYLE_MIGRATION.md` 从源页面提取品牌色和视觉 token，并记录字段映射与色源。
3. 按 `ACSS_SPEC.md` 检查选择器、单位、布局和禁用项。
4. 为 `notice`、禁用态、选中态和点击反馈提供清晰视觉，但不得新增业务语义。

### 7.2 列表与溢出

- 富媒体列表和文本列表卡内优先展示最多 3 个高价值项。
- 超出时使用卡片内分页、半屏或关联原页面；禁止纵向滚动。
- 半屏和关联页只使用源码真实路径，具体实现读取 `HALF_SCREEN.md`。
- 组件直接展示的字段必须裁剪；不要通过缩小字号硬塞内容。

### 7.3 卡片过期

默认不主动过期。仅当体验契约明确旧卡不可再操作，且 `mcp.json.components[]` 已声明 `expirable: true` 和业务化 `expiredText` 时使用：

```javascript
const vctx = my.modelContext.getViewContext(this);

// 二选一：过期此前卡片，或按静态规范声明的 options 过期全部匹配卡片。
vctx.expirePreviousCards();
// my.modelContext.expireAllCards({
//   componentPaths: ['components/<name>/index'],
//   match: 'latest'
// });
```

`expireAllCards` 的 options 按需包含 `componentPaths` 或 `match: 'latest'`；无筛选条件时可省略。静态规范没有展开 `expirePreviousCards` 的 options 字段，不得套用前者字段。不要同时调用两个方法。纯展示卡片不需要过期逻辑。

## §8 自检

- [ ] 组件模式、字段、交互节点和出口全部来自总体用户动线、体验决策记录及源交互映射。
- [ ] 出口类型没有被自动实现为源页面不存在的按钮、链接或其他可见入口。
- [ ] 中间态结果已判断自然下一步；`ctaRequired=true` 的 R3/R4 动作有清晰可见的确认或 handoff 出口。
- [ ] 未因缺少最终业务写 API 删除自然语言入口或用户出口；`relatedPage` CTA 已配对 `setRelatedPage` 和 tap 中的 `openRelatedPage()`，并有返回后的查询入口。
- [ ] 源点击区域、控件形态、事件关系、状态反馈和交互顺序均已保留或有允许的差异依据。
- [ ] `index.js` 监听 Result，并把真实结果映射到 AXML 绑定字段。
- [ ] 所有自定义方法都在 `methods` 中。
- [ ] 错误 Result 不清空旧业务数据，且错误提示在 AXML 可见。
- [ ] 只有 `refreshFailed=true` 进入刷新失败分支；正常 `operationSubmitted=true` 未被误判。
- [ ] 刷新失败保留旧数据、解除提交动画、锁定等价写操作并给出恢复出口。
- [ ] 所有写操作都有防重复提交和错误恢复。
- [ ] `apiCall` 中的 `api/call` 前有 `text`，API 名和参数与 `mcp.json` 契约一致，且没有让 Agent 再判断明确的 UI 意图。
- [ ] Agent 入口和 UI 入口已分别裁决；总体范围内的用户意图有已注册 `agentEntry`，需要页面完成的动作未写成 `none`；`uiEntry=my.request` 仅用于需要原位执行且请求链的全部传递依赖均受组件支持的操作，`uiEntry=tradePay` 仅用于满足支付严格契约的用户付款 CTA。
- [ ] 普通组件未调用 `my.request` 或 `my.tradePay`；动态组件已声明 `scope.dynamic`，请求、支付与定时器均在 Gate D 契约范围内。
- [ ] `my.tradePay` 仅由付款 CTA 的 tap handler 调用，支付摘要与参数来自最新可信结果，回调覆盖取消、失败、未知和成功后的权威状态重查。
- [ ] 组件未调用 `my.getAuthCode`，未 import 原子接口 handler；动态组件所复用 `utils/` 的全部传递依赖均符合组件边界，且未用定时器发起写操作。
- [ ] 组件及其依赖中的每个 `my.*`、`my.modelContext`、Context 和 ViewContext 调用都在 `JSAPI_BOUNDARY.md` 对应运行环境的精确 allowlist 中；未列出的 API、参数字段和调用形态未生成。
- [ ] R1 使用 `localState`；请求链的全部传递依赖均受组件支持时，原位操作使用 `my.request`；只能由接口侧执行、意图和参数完整且目标 API 已注册时使用 `apiCall`，确需补参或推理时使用 `followUpText`。
- [ ] R2 控件具有提交态和防重复触发，并具备服务端状态/Result 校准、失败恢复、旧卡过期和 Agent 后续重查策略。
- [ ] 敏感原值未进入 `structuredContent`、上行文本或非必要参数。
- [ ] 每个可交互元素都有合法出口；没有死按钮、猜测 API 或猜测路径。
- [ ] AXML 文本位于叶子 `text`，未使用不支持的组件或事件；`swiper` 仅横向轮播且只绑定 `onChange`。
- [ ] ACSS 来自设计规范与源样式迁移，没有照抄本文件的通用类名和视觉值。
- [ ] 卡片不依赖纵向滚动；溢出内容有分页、半屏或原页面承接。
- [ ] 资金确认、凭证详情和过期处理仅在契约明确需要时启用。
