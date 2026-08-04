---
title: 代码模板
purpose: 提供 Skill 生成过程中各类文件的标准代码模板
loadTiming: Gate E
---

# 代码模板

## §1 工具函数（utils/）

### 1.1 result.js — 结果工厂

```javascript
export function ok(text, structuredContent, meta) {
  const result = { isError: false, content: [{ type: 'text', text }] };
  if (structuredContent !== undefined) result.structuredContent = structuredContent;
  if (meta !== undefined) result._meta = meta;
  return result;
}

export function fail(text, meta) {
  const result = { isError: true, content: [{ type: 'text', text }] };
  if (meta !== undefined) result._meta = meta;
  return result;
}
```

### 1.2 request.js — 统一请求与被动 session

```javascript
import { getCache } from './storage';

const BASE_URL = '<源码真实服务端 base URL>';
const TOKEN_STORAGE_KEY = '<源码真实 token storage key>';
const MEMBER_STORAGE_KEY = '<源码真实用户 storage key>';
const TOKEN_FIELD = '<源码真实 token 字段>';
const EXPIRES_AT_FIELD = '<源码真实过期字段>';
const TOKEN_HEADER_NAME = '<源码真实 token header 名>';
const SESSION_SAFETY_WINDOW_MS = 0; // 替换为源码真实安全窗口
const SUCCESS_CODE = '<源码真实成功 code>';
const AUTH_FAILURE_HTTP_STATUSES = ['<源码真实登录失效 HTTP 状态>'];
const AUTH_FAILURE_CODES = ['<源码真实登录失效业务 code>'];

export function createAuthRequiredError() {
  const error = new Error('AUTH_REQUIRED');
  error.code = 'AUTH_REQUIRED';
  return error;
}

export function isAuthRequiredError(error) {
  return Boolean(error && error.code === 'AUTH_REQUIRED');
}

async function readSessionState() {
  const [tokenState, memberState] = await Promise.all([
    getCache(TOKEN_STORAGE_KEY),
    getCache(MEMBER_STORAGE_KEY)
  ]);
  const token = tokenState && tokenState[TOKEN_FIELD];
  const expiresAtMs = tokenState && Number(tokenState[EXPIRES_AT_FIELD]);
  const member = memberState && memberState.member;
  const tokenValid = Boolean(
    token
    && (!Number.isFinite(expiresAtMs)
      || expiresAtMs <= 0
      || expiresAtMs > Date.now() + SESSION_SAFETY_WINDOW_MS)
  );
  const memberValid = Boolean(memberState && memberState.accessToken && member && member.id);

  return {
    token: tokenValid ? token : null,
    member: memberValid ? member : null,
    valid: tokenValid && memberValid
  };
}

export async function getExistingSession() {
  const state = await readSessionState();
  return state.valid ? { token: state.token, member: state.member } : null;
}

function buildHeaders(token, contentType) {
  const headers = {
    'content-type': contentType === 'form'
      ? 'application/x-www-form-urlencoded'
      : 'application/json',
    '<源码真实公共 header>': '<源码真实公共值>'
  };
  if (token) headers[TOKEN_HEADER_NAME] = token;
  return headers;
}

function responseStatus(res) {
  return res && (res.status != null ? res.status : res.statusCode);
}

function isAuthFailureResponse(res) {
  const body = (res && res.data) || {};
  return AUTH_FAILURE_HTTP_STATUSES.includes(String(responseStatus(res)))
    || AUTH_FAILURE_CODES.includes(String(body.code));
}

export async function request(options) {
  const {
    url,
    method = 'GET',
    data,
    headers = {},
    contentType = 'json',
    auth = false
  } = options;

  const sessionState = await readSessionState();
  if (auth && !sessionState.valid) throw createAuthRequiredError();
  const fullUrl = /^https?:\/\//i.test(url) ? url : BASE_URL + url;

  return new Promise((resolve, reject) => {
    my.request({
      url: fullUrl,
      method,
      data,
      headers: {
        ...buildHeaders(sessionState.token, contentType),
        ...headers
      },
      success(res) {
        if (auth && isAuthFailureResponse(res)) {
          reject(createAuthRequiredError());
          return;
        }
        const status = responseStatus(res);
        if (status < 200 || status >= 300) {
          reject(new Error(`请求失败：HTTP ${status}`));
          return;
        }
        const body = res.data || {};
        if (!Object.prototype.hasOwnProperty.call(body, 'code')) {
          resolve(body);
          return;
        }
        if (String(body.code) === String(SUCCESS_CODE)) {
          resolve(body.data);
          return;
        }
        const error = new Error(body.message || '业务请求失败');
        error.code = body.code;
        reject(error);
      },
      fail(err) {
        reject(new Error(`网络请求异常：${err.errorMessage || '未知错误'}`));
      }
    });
  });
}
```

上例的 base URL、两个 storage key、嵌套字段、过期单位、安全窗口、会员条件、公共 header、成功 code 和登录失效信号都必须替换为源码事实；源码只依赖 token 时删除会员条件，使用更多 storage 时完整读取，不能把示例结构当成默认值。`request.js` 统一完成已有 session 校验、header 构造、响应解包和鉴权错误归一化，受保护业务函数只传 `auth: true`，不得分别复制这些逻辑。`request.js` 不返回标准 Result，由原子接口负责把异常转换为 `fail(...)`，动态组件负责转换为可见状态。匿名请求传 `auth: false`，仍按源码决定是否附带已有 token。

### 1.3 storage.js — 缓存封装

```javascript
export async function getCache(key) {
  return new Promise((resolve) => {
    my.getStorage({
      key,
      success(res) { resolve(res.data); },
      fail() { resolve(null); }
    });
  });
}

export async function setCache(key, data) {
  return new Promise((resolve, reject) => {
    my.setStorage({
      key,
      data,
      success() { resolve(); },
      fail(err) { reject(err); }
    });
  });
}
```

### 1.4 被动 session 的代码归属

默认把被动 session 判定和 header 构造收口在 `request.js`，保持受保护请求统一使用 `request({ auth: true })`。只有源码本身已拆分会话模块，或多个请求适配器确实需要复用同一套复杂判定时，才单独生成扁平 `utils/session.js`；业务函数和组件都不得自行拼 token header。该路径只读取、校验已有 session，不调用 `my.getAuthCode`，不换取或刷新 token。源码使用接口私有凭证、组件不可访问的 storage 或主动刷新时，不生成组件可达的被动路径。

### 1.5 业务请求函数 — API 与动态组件复用

同一后端业务操作的 URL、method、header、后端参数映射和响应信封只实现一次。函数放在扁平 `utils/`，名称与参数按源码业务事实生成；同一操作存在 Agent API 时与动态组件共同调用该函数。原子接口负责对话参数和 Result，动态组件负责点击与卡片状态。

```javascript
import { request } from './request';

export async function updateCartQuantity({ storeId, itemId, quantity }) {
  return request({
    url: '<源码真实购物车数量接口>',
    method: '<源码真实 method>',
    auth: true,
    data: {
      storeId,
      item: { id: itemId, quantity }
    }
  });
}

export async function queryCartItem({ storeId, itemId }) {
  return request({
    url: '<源码真实购物车查询接口>',
    method: 'GET',
    auth: true,
    data: { storeId, itemId }
  });
}
```

参数对象必须替换为源码真实的完整后端映射，例如商品更新可能同时需要 `productId`、`shopProductId`、活动 ID 和选中状态。响应信封已经由源请求封装解包时，业务函数不得重复解包。需要原位请求且已有 session 执行路径的全部传递依赖均受组件支持时，动态组件必须复用该业务函数；只有该路径本身必然到达 `my.getAuthCode`、主动 token 换取或刷新、接口侧专属 JSAPI、接口私有模块状态或不可向组件暴露的凭证时，才只允许原子接口调用并把 UI 改为 `apiCall`、`followUpText` 或可靠页面承接。

### 1.6 auth.js — 独立登录能力的主动鉴权（按源码）

```javascript
export function getAuthToken(scopes = 'auth_base') {
  return new Promise((resolve, reject) => {
    my.getAuthCode({
      scopes,
        success(res) {
          resolve(res.authCode);
        },
        fail() {
          const error = new Error('AUTH_CODE_FAILED');
          error.code = 'AUTH_CODE_FAILED';
          reject(error);
      }
    });
  });
}
```

该示例只用于源码确实存在的独立登录能力或当前业务动作本身必然执行主动鉴权的情况。源码使用独立登录 API、登录卡片或登录页面时，受保护业务 API 和动态组件都只通过 `request({ auth: true })` 消费已有 session；缺失或失效时返回统一错误，由独立登录能力承接，不得在每个业务 handler 中主动登录。`auth.js` 即使位于 `utils/`，也不得进入动态组件依赖闭包。独立登录完成后持久化的结构必须能被 §1.2 的请求层读取；若凭证只能保留在接口私有状态中，不得为了组件直连而改存公共 storage。

### 1.7 context.js — 接口间数据传递

```javascript
const contextStore = new Map();

export function setContext(key, value) {
  contextStore.set(key, value);
}

export function getContext(key) {
  return contextStore.get(key);
}

export function clearContext() {
  contextStore.clear();
}
```

---

## §2 原子接口模板

```javascript
import { ok, fail } from '../utils/result';
import { request } from '../utils/request';

export async function apiName(params = {}) {
  try {
    const data = await request({
      url: '/api/endpoint',
      method: 'GET',
      data: { param1: params.param1 || 'default' }
    });

    const items = data.list || [];
    return ok(
      `查询成功，共 ${items.length} 条结果。`,
      { list: items, total: data.total }
    );
  } catch (err) {
    if (err && err.isError) return err;
    return fail('服务暂时不可用，请稍后重试');
  }
}
```

要求：

- JS 代码使用 ES Module 语法（`import` / `export`），不使用 CommonJS。
- 每个 `mcp.json#apis[].name` 对应的实现必须是 `export async function {apiName}(...)`；即使当前逻辑暂时同步，也必须保留 `async`。
- 参数校验必须覆盖业务必需字段、安全必需字段和来源必需字段。业务必需字段是后端接口或业务逻辑运行必需；安全必需字段是用于确定操作对象、门店、订单、券、金额、数量、资格或状态的字段；来源必需字段是必须来自上游接口、组件点击、页面上下文或 storage 的关键字段。
- 禁止把关键字段默认成空串、`false`、`0`、默认门店或默认资格状态后继续执行。缺少关键字段时必须 `fail(...)`，并提示用户先查询、选择或确认对应对象。
- `structuredContent` 字段与 `outputSchema` 对齐。
- `structuredContent` 和 `content.text` 禁止写入敏感原值。手机号、完整地址、自提码、核销码、物流单号、精确经纬度等敏感原值如需组件渲染，只能写入 Result `_meta.private` 或更具体的 `_meta` 内部字段；不需要组件或后续宿主流程使用时直接丢弃。
- 同一操作还由动态组件直接执行时，handler 不得再次实现 URL、method、header、后端参数映射或响应信封；改为调用 §1.5 的 `utils/` 业务函数，再将返回值组装为标准 Result。

同一操作由 Agent API 与动态组件共同使用时，API handler 保持为薄编排层：

```javascript
import { ok, fail } from '../utils/result';
import { updateCartQuantity } from '../utils/cart';
import { isAuthRequiredError } from '../utils/request';

export async function updateCartItem(params = {}) {
  const { storeId, itemId, quantity } = params;
  if (!storeId || !itemId || !Number.isInteger(quantity) || quantity < 1) {
    return fail('缺少有效的门店、购物车条目或数量。');
  }

  try {
    const item = await updateCartQuantity({ storeId, itemId, quantity });
    return ok('购物车数量已更新。', { item });
  } catch (error) {
    if (isAuthRequiredError(error)) {
      return fail('登录状态已失效，请重新登录后再试。');
    }
    return fail('数量修改失败，请稍后重试。');
  }
}
```

受保护业务 handler 默认不主动登录。源码已有独立登录 API、登录卡片或登录页面时，handler 在 `AUTH_REQUIRED` 时返回清晰错误，业务 `SKILL.md` 再指示 Agent 调用已注册的独立登录能力；只有当前业务动作的源码执行链本身包含主动鉴权时，才在接口侧迁移该链路。不得把主动鉴权 import 到共享业务函数或组件依赖闭包中。

源码存在独立登录 API 和登录卡片时，登录 API 只检查已有 session 并返回卡片状态，不代替用户主动授权：

```javascript
import { ok } from '../utils/result';
import { getExistingSession } from '../utils/request';

export async function login() {
  const needLogin = !(await getExistingSession());
  return ok(
    needLogin ? '用户尚未登录，请通过登录卡片完成授权。' : '用户已经登录。',
    { needLogin }
  );
}
```

对应登录卡片只在用户 tap 后打开源码确认的真实登录页面或执行源码允许的登录承接；受保护业务组件只显示鉴权失败状态，不复制登录流程。

敏感字段分层返回示例：

```javascript
return ok('已查询到订单详情。', {
  title: '订单详情',
  order: {
    orderId,
    statusText,
    storeName,
    totalAmountText,
    deliveryStatusText
  },
  sourceName: '示例小程序'
}, {
  private: {
    receiverMobile,
    address,
    ladingCode,
    trackingNumber
  }
});
```

`mcp.json#apis[].outputSchema` 只描述 `structuredContent`，不描述 `_meta.private`。组件可以读取 `_meta.private` 渲染卡片，但组件上行消息不得把这些敏感原值拼入 `text` 或非必要 `api/call.arguments`。

状态变更接口在发起请求前必须加入关键上下文校验：

```javascript
function missingRequired(params, fields) {
  return fields.filter((field) => params[field] === undefined || params[field] === null || params[field] === '');
}

const missing = missingRequired(params, ['productId', 'shopProductId', 'storeId']);
if (missing.length) {
  return fail('缺少必要上下文，请先查询并选择具体对象后再操作。', {
    missingFields: missing
  });
}
```

状态变更请求成功后，如需刷新最新状态，刷新失败不得包装成普通失败，也不得返回普通成功加空列表。此分支只用于写请求成功、刷新失败的两阶段流程；`operationSubmitted=true` 单独出现表示正常已受理状态，不得解释为刷新失败：

```javascript
try {
  await request({ method: 'POST', url: '/api/mutate', data: payload });
} catch (error) {
  return fail(error && error.message ? error.message : '操作提交失败，请稍后重试。');
}

try {
  const latest = await refreshLatestState(params);
  if (!latest.isError) return latest;
} catch {}

return ok('操作已提交，但最新状态暂时无法确认，请勿重复提交。可重新查询或打开原页面确认。', {
  operationSubmitted: true,
  refreshFailed: true,
  warningText: '操作已提交，但最新状态暂时无法确认，请勿重复提交',
  relatedPage: '/pages/original/page',
  sourceName: '示例小程序'
});
```

生产端契约：`refreshFailed=true` 时必须同时返回 `operationSubmitted=true`；反向不成立。消费端只能以 `refreshFailed === true` 进入刷新失败分支，并在获得可信最新状态前锁定等价写操作。

handoffOnly 接口只返回承接信息，不得先改变业务状态：

```javascript
return ok('该操作需要在原页面完成。', {
  type: 'handoff',
  title: '需要原页面处理',
  description: '当前操作不会由 Agent 自动提交',
  relatedPage: '/pages/example/index',
  sourceName: '示例小程序'
});
```

禁止生成以下模式：

```javascript
// 禁止：先创建订单、申请、待支付记录或锁定状态，再 handoff
await request({ url: '/api/createOrder', method: 'POST', data });
return ok('已创建订单，请去原页面继续。', structuredContent);
```

## §3 index.js — 注册入口模板

```javascript
import { apiName1 } from './apis/apiName1';
import { apiName2 } from './apis/apiName2';

const skill = my.modelContext.createSkill('skills/<skill-name>');
skill.registerAPI('apiName1', apiName1);
skill.registerAPI('apiName2', apiName2);
```

> 注意：每个接口名必须与 mcp.json 中 apis[].name 完全一致。
> `createSkill` 的 skillPath 必须与 app.json 中 agent.skills[].path 完全一致，例如 `skills/order-query`。
> 原子接口目录固定为 `apis/`，每个实现文件固定为 `apis/{apiName}.js`；通用工具放 `utils/`。组件不得 import 原子接口 handler。动态组件可以复用 `utils/` 中全部传递依赖均受组件支持的业务和请求工具；文件名或是否属于请求/鉴权封装本身不作为禁止依据。

---

## §4 mcp.json 完整模板

```json
{
  "apis": [
    {
      "name": "getOrderList",
      "description": "查询用户订单列表。当用户询问我的订单、待付款、待取货、配送中或历史订单时使用；不用于商品搜索或优惠券查询。",
      "inputSchema": {
        "type": "object",
        "properties": {
          "status": {
            "type": "string",
            "enum": ["all", "CREATED", "PAID", "SHIPPED", "RECEIVED", "CANCELED"],
            "description": "订单状态。用户未指定时使用 all；待付款对应 CREATED，已付款/待取货对应 PAID，配送中/发货了对应 SHIPPED，已完成对应 RECEIVED。"
          },
          "pageNo": {
            "type": "number",
            "description": "页码，从1开始，用户未指定时默认1"
          }
        }
      },
      "outputSchema": {
        "type": "object",
        "properties": {
          "orders": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "orderId": {
                  "type": "string",
                  "description": "订单唯一标识，供 getOrderDetail 使用"
                },
                "status": { "type": "string" },
                "statusText": { "type": "string" },
                "storeName": { "type": "string" },
                "totalAmountText": { "type": "string" }
              },
              "required": ["orderId", "status", "statusText"]
            }
          },
          "total": { "type": "number" }
        },
        "required": ["orders", "total"]
      },
      "_meta": {
        "ui": {
          "componentPath": "components/order-list-card/index"
        }
      }
    },
    {
      "name": "getOrderDetail",
      "description": "获取单个订单详情。当上下文已有真实 orderId 且用户询问订单详情、商品明细或物流状态时使用。",
      "inputSchema": {
        "type": "object",
        "properties": {
          "orderId": {
            "type": "string",
            "description": "订单唯一标识，必须取自 getOrderList 返回的 orderId 原值。不要从用户自然语言推断，也不要使用示例值。上下文无可用 orderId 时，应先调用 getOrderList。"
          }
        },
        "required": ["orderId"]
      },
      "outputSchema": {
        "type": "object",
        "properties": {
          "title": { "type": "string" },
          "order": {
            "type": "object",
            "properties": {
              "orderId": { "type": "string" },
              "statusText": { "type": "string" },
              "storeName": { "type": "string" },
              "totalAmountText": { "type": "string" },
              "deliveryStatusText": { "type": "string" }
            },
            "required": ["orderId", "statusText"]
          },
          "sourceName": { "type": "string" }
        },
        "required": ["title", "order", "sourceName"]
      },
      "_meta": {
        "ui": {
          "componentPath": "components/order-detail-card/index"
        }
      }
    }
  ],
  "components": [
    {
      "path": "components/order-list-card/index",
      "relatedPage": "/pages/order/list",
      "expirable": true,
      "expiredText": "订单信息已更新，请重新查询"
    },
    {
      "path": "components/order-detail-card/index",
      "relatedPage": "/pages/order/detail",
      "expirable": true,
      "expiredText": "订单状态已变化，请重新查看"
    }
  ]
}
```

### mcp.json 字段参照

| 字段 | 必填 | 说明 |
|------|------|------|
| apis[].name | 是 | 与 index.js 注册名一致 |
| apis[].description | 是 | 说明业务对象 + 调用时机 + 不适用场景 |
| apis[].inputSchema | 是 | JSON Schema object |
| apis[].outputSchema | 是 | structuredContent 的唯一结构契约 |
| apis[]._meta.ui.componentPath | 可选 | 接口成功后渲染的组件，不带扩展名，格式固定为 `components/{name}/index` |
| components[].path | 是 | 组件路径 |
| components[].relatedPage | 是 | 关联原小程序页面；自定义 CTA 主动打开时在 tap handler 调用 `vctx.openRelatedPage()` |
| components[].permissions["scope.dynamic"] | 按需 | 组件需要直接 `my.request` 或 setTimeout/setInterval 等定时器时声明；`desc` 必须写清请求数据、刷新触发方式或定时器用途 |
| components[].expirable | 建议 | 动作类/时效类设 true |
| components[].expiredText | 条件 | expirable=true 时必填 |

确需动态请求或定时器时，只在对应 component 增加：

```json
"permissions": {
  "scope.dynamic": {
    "desc": "用于每分钟请求并更新卡片内的订单状态"
  }
}
```

`desc` 不得只写「需要网络」或「动态能力」。声明 `scope.dynamic` 后，该组件按动态组件判定：可在 Gate D 直接请求契约内调用 `my.request` 和定时器；仍不得调用 `my.getAuthCode`、WebSocket、上传下载或其他未在动态组件支持列表中的 API。

---

## §5 SKILL.md 模板

`SKILL.md` 是给智能体使用的路由和执行说明。它不复制完整 schema，但必须写清触发边界、拒绝边界、接口选择、参数抽取、执行 SOP、异常出口和结果处理，并与 `mcp.json`、`index.js`、真实 API 实现保持一致。生成时按下列结构写，避免遗漏。

```markdown
---
name: todo-list
displayName: 待办管理
brandName: 示例品牌
category: 效率
description: 待办管理小程序服务 Skill。功能：查询待办列表、按状态筛选待办、查看待办详情、更新已确认待办状态。触发关键词：待办、任务、未完成、已完成、标记完成、今天要做。典型场景：帮我看看还有哪些待办、查一下已完成任务、把刚才那条标记完成。不支持删除待办、批量更新和同步外部系统。
version: 1.0.0
---

# 待办管理

## 能力边界

| 支持能力 | 推荐接口 | 说明 |
|---|---|---|
| 查询待办列表 | `listTodos` | 可按状态筛选 |
| 更新待办状态 | `updateTodo` | 只更新已确认的单条待办 |

| 不支持场景 | 处理方式 |
|---|---|
| 删除待办、批量更新、设置日历提醒、同步外部系统 | 告知用户当前仅支持查询、查看详情和更新已确认的单条待办，引导用户改为查询待办或选择单条待办更新 |
| 用户要求更新无法定位的待办 | 先询问待办标题或让用户从候选列表选择，不直接编造 `id` |

## 触发场景
- "帮我看看还有哪些待办"
- "查一下已完成的任务"
- "把刚才那条标记完成"
- "第二个任务完成了"

## 示例 Query
- "还有哪些没做完的任务" -> `listTodos`，参数：`status=todo`
- "把买牛奶标记完成" -> `updateTodo`，参数：`id` 从已确认的上游列表结果解析，`status=done`
- "删除买牛奶" -> 不触发；当前能力不支持删除

## 接口选择
- 查询、筛选、追问"还有哪些"时使用 `listTodos`。
- 更新状态前先根据会话候选或用户给出的标题定位单条待办；多候选时先补问。
- 用户说"第二个""刚才那个"时，先用会话中可见序号和标题解析到接口需要的内部 `id`，不要求用户提供 `id`。

## 执行流程
1. 判断用户意图是否属于能力边界；若属于不支持场景，按拒绝规则回复并结束。
2. 若用户要查询列表，调用 `listTodos`；若 `success=false`，返回错误原因并提示用户稍后重试；若 `total=0`，告知暂无匹配待办并提示换条件。
3. 若用户要查看或更新单条待办，先从上游列表结果、会话候选或组件点击中取得 `id`；若候选数为 0，调用 `listTodos` 或询问待办标题；若候选数大于 1，提示用户选择具体待办。
4. 若用户确认更新状态，调用 `updateTodo`；若 `success=true`，返回更新结果；若 `success=false`，返回失败原因并保留重新选择或重试出口。

## 工具映射

| 流程步骤 | MCP 工具 | 说明 |
|---|---|---|
| 查询待办列表 | `listTodos` | 对应 `mcp.json#apis[].name` |
| 更新待办状态 | `updateTodo` | 对应 `mcp.json#apis[].name` |

## 参数规范
- `status`：string，选填，枚举 `todo`、`done`、`all`；用户说"没做完""待处理"映射为 `todo`，"做完了""完成的"映射为 `done`，未指定时用 `all`。
- `id`：string，更新时必填；只从 `listTodos` 的上游结果、会话候选或组件点击中取得，不能让用户手输内部 ID，不能从自然语言编造。
- 参数提取示例："把第二个标记完成" -> 从当前可见列表第 2 项取 `id`，`status=done`。

## 异常处理
- `success=false`：返回接口失败原因；原因缺失时回复当前服务暂不可用，请稍后重试。
- `total=0` 或列表为空：告知没有匹配结果，引导用户更换状态或关键词。
- 未登录或未授权：提示用户完成登录授权后重试，不执行更新类接口。
- 缺少内部 `id`：先调用查询接口或让用户选择候选，不直接调用更新接口。

## 结果处理
- 成功查询时可展示列表卡片。
- `isError=true` 时不渲染组件，按 `content` 引导用户补充业务信息。

## 端到端示例
- 正常流程：用户说"还有哪些没做完的任务" -> 调用 `listTodos(status=todo)` -> 展示待办列表。
- 异常流程：用户说"查已完成任务" -> 调用 `listTodos(status=done)` -> 若 `total=0`，回复暂无已完成任务，可查询全部待办。
- 多轮流程：用户说"把买牛奶标记完成" -> 若存在多个同名候选，先让用户选择 -> 用户选择第 2 个 -> 调用 `updateTodo(id=<第2个候选id>, status=done)` -> 返回更新结果。
```

必须包含的内容：

- YAML frontmatter：`name`、`displayName`、`description`、`version` 必填；`brandName`、`category`、`owner`、`updated` 按项目事实补充。`description` 必须同时包含核心能力、触发词或用户说法、至少 1 条不支持边界。
- 能力边界：同时写支持范围和不支持范围；不支持范围不能与支持范围矛盾。
- 安全与用户承接边界：把「Agent 可执行」和「用户可继续」分开描述。R3/R4 动作若 `userCanPerform=true`，用查询、详情或 handoff API 承接自然语言意图并返回最新摘要和 CTA，写成「不由 Agent 自动执行，通过卡片 CTA 交半屏/原页面/平台流程确认」，不得设置 `agentEntry=none`、归入笼统的「不支持」或删除用户出口。
- 拒绝规则：每条不支持或越界场景都写清拒绝条件和用户可见回应话术。
- 触发条件：覆盖关键词、口语句式、追问承接，至少覆盖主要能力的正例和反例。
- 示例 Query：正例标注推荐接口和参数；反例说明不触发原因；至少包含 1 个正常全流程、1 个异常或空态分支、1 个多轮交互示例。
- 示例 Query 和端到端示例中的工具调用必须展开完整参数；凡 `mcp.json#apis[].inputSchema.required` 中的字段，示例调用中必须出现。参数来自上游结果时，必须写明字段名或字段路径，禁止只写 `addCartItem(quantity=1)`、`receiveCoupon(confirmed=true)` 这类省略关键 ID 的调用。
- 上游结果以判别字段选择下游接口或参数组合时，示例必须先读取该字段，再展示对应分支的完整调用。只有上游所有可能结果都由同一调用契约覆盖时，才能直接写“第一个结果 → 调用详情接口”。
- 接口选择策略：多个接口之间的选择顺序；依赖内部 ID 的接口必须写明上游来源和候选歧义处理。
- 执行流程：用步骤编号写首尾相连的 SOP；每个条件分支必须有终止动作、跳转目标或用户引导，不允许悬空；handoffOnly 场景必须写明生成 CTA 的 `agentEntry`、传入页面的上下文、页内目标和返回后的查询入口，且不在承接前创建订单、锁库存、占名额、提交申请、生成待支付记录或改变账户状态。
- 用户旅程：按 Gate D 总体用户动线写明本 Skill 承担的步骤和跨 Skill 相邻步骤；每个中间态结果写明主要下一动作、下一 `agentEntry/uiEntry`、完成或恢复方式，以及 `userCanPerform`、`agentMayExecute`、`ctaRequired`、`executionFeasibility` 和 `freshnessPolicy`。`agentEntry` 是 Agent 处理自然语言意图时首先调用的已注册 API，可直接执行或返回确认/页面承接 CTA；不得仅因最终动作需要用户手势或原页面而写成 `none`。UI 入口按 `JSAPI_BOUNDARY.md §3.2.1/§3.4` 独立裁决：已有 session 执行路径的全部传递依赖均受组件支持且需要原位执行时使用 `my.request`；路径到达组件侧不支持依赖且意图和参数完整时使用 `apiCall(<apiName>)`；需要补参、语义理解或跨能力编排时使用 `followUpText`。
- 状态一致性：业务 SKILL.md 必须写明服务端是唯一事实源。`uiEntry=my.request` 以写响应或随后查询结果校准当前卡片，`uiEntry=apiCall` 以原子接口新 Result 校准；Agent 后续结算、计算金额、批量修改或下单前必须重新查询，不得沿用旧卡的数量、金额或勾选状态。
- 参数规范：类型、必填/选填、枚举取值、口语到枚举映射、内部字段来源和参数提取示例；`confirmed=true` 必须说明来自明确表达后果的用户输入或组件动作，弱语义按钮不得自动产生确认。
- 工具映射：正文和 SOP 中提到的 MCP 工具名必须与 `mcp.json#apis[].name` 完全一致，不多写不存在工具，不漏写必要工具。
- 异常处理：至少覆盖接口失败、查询为空、未登录/未授权；涉及支付时必须覆盖 `needPay=false` 零元分支。
- 结果处理：成功如何回答、何时展示组件、失败时如何引导下一步；`ctaRequired=true` 时写明卡片中的可见确认或 handoff 入口，`relatedPage` CTA 必须由用户 tap 调用 `openRelatedPage()`，仅配置关联页不算完整入口；页面返回后明确重新调用哪个查询 API，继续状态变更、金额计算、结算或下单前不得沿用旧卡；敏感原值只能说明放在 `_meta.private` 供组件使用，不得写入 Agent 可见的 `structuredContent` 或 `content.text`；状态变更后刷新失败必须说明操作可能已提交但刷新失败。

---

## §7 全局提示词与 app.json 配置集成模板

### 7.1 Gate F 生成 AGENTS.md

`AGENTS.md` 是项目级全局提示词。必须等全部 Skill 的 `mcp.json`、业务 `SKILL.md`、总体用户动线、接口依赖和宿主入口确定后再生成，使自然语言入口和跨 Skill 路由只引用最终注册能力。默认写入项目根目录；若 `app.json#agent.instruction` 已指向其他项目内文件，则保留该路径，在不删除无关既有规则的前提下更新受本次生成影响的内容。

文件最大 10000 字节，可按最终能力裁剪以下模板：

```markdown
---
name: <app-agent-name>
description: <小程序服务范围、主要用户意图和 Skill 路由摘要>
---

# <小程序名称> Agent

<一句话说明角色、服务范围和业务结果可信来源。>

## Skill 路由

### <功能域一>：`<skill-name-1>`

- <用户意图>：调用 `<apiName>`；写清必要前置条件、参数来源和后续接口。
- <连续流程>：先调用 `<producerApi>`，再从其结果取得 `<fieldPath>` 调用 `<consumerApi>`。
- <页面承接意图>：调用 `<queryOrHandoffApi>` 返回最新摘要和 CTA；用户完成后调用 `<refreshApi>` 恢复。

### <功能域二>：`<skill-name-2>`

- <用户意图>：调用 `<apiName>`；写清与其他 Skill 的边界。

## 共享上下文与指代

- <门店、用户、订单等跨接口上下文的可信来源和复用规则。>
- <第一个、刚才那个等指代无法唯一解析时的追问规则。>

## 必须转原页面的操作

- <不能在对话内完成的操作、负责生成 CTA 的 agentEntry、传入上下文、页内目标和返回后的查询入口。>

## 回答与数据规则

- 金额、库存、状态和资格只引用接口真实返回；失败或证据不足时不得编造。
- 敏感信息只展示完成任务所需的最小摘要。
- <项目要求的回答风格和卡片使用方式。>

## 猜你想问引导

- <只在已注册服务范围内列出自然的下一步方向。>
```

生成要求：

1. 每个反引号中的 Skill 名必须存在于最终 `app.json#agent.skills[]`。
2. 每个 API 名必须存在于对应 Skill 的最终 `mcp.json#apis[]`。
3. Gate D 总体用户动线中的每个用户意图都能路由到已注册 API；R3/R4 页面承接意图不能因 Agent 不直接执行而缺少路由。
4. 只写跨 Skill 路由、调用顺序和共性行为，不复制完整 input/output schema 或业务 `SKILL.md`。
5. 已有 instruction 文件时保留与本次生成无关的人工规则，避免整文件覆盖造成行为回退。

### 7.2 app.json 最小集成配置

```json
{
  "subPackages": [
    {
      "root": "skills",
      "pages": []
    }
  ],
  "agent": {
    "instruction": "AGENTS.md",
    "skills": [
      {
        "name": "my-skill",
        "description": "Skill 简要描述，50-120 中文字符，说明功能范围和主要能力",
        "path": "skills/my-skill"
      }
    ]
  }
}
```

### 7.3 含多个 Skill 的完整配置

```json
{
  "subPackages": [
    {
      "root": "skills",
      "pages": []
    }
  ],
  "agent": {
    "instruction": "AGENTS.md",
    "skills": [
      {
        "name": "product-search",
        "description": "商品搜索服务 Skill，支持搜索商品、查看商品详情、查询库存价格和打开关联商品页面。",
        "path": "skills/product-search"
      },
      {
        "name": "order-query",
        "description": "订单查询服务 Skill，支持查询订单列表、查看订单详情和跟进配送状态。",
        "path": "skills/order-query"
      }
    ]
  }
}
```

### 7.4 agent 字段规范

| 字段 | 必填 | 说明 |
|------|------|------|
| instruction | 是 | 项目内全局提示词文件的相对路径；默认 `AGENTS.md`，文件最大 10000 字节 |

`agent.skills[]`：

| 字段 | 必填 | 说明 |
|------|------|------|
| name | 是 | 与 SKILL.md front matter name 完全一致 |
| description | 是 | Skill 简要描述，建议 50-120 中文字符，硬上限 200 中文字符或 400 字节 |
| path | 是 | Skill 目录相对路径，必须隶属于 `subPackages` 中某个分包 |

### 7.5 集成步骤

1. 全部 Skill 完成后，根据最终能力生成或增量更新全局 instruction 文件；缺少配置时默认创建根目录 `AGENTS.md`
2. 在已有 app.json 中添加或合并 `subPackages` 与 `agent` 字段（与 pages/window 同级），设置 `agent.instruction`
3. 保留已有 `subPackages`，确保存在覆盖本次生成的所有 Skill 目录的分包声明，例如 `{ "root": "skills", "pages": [] }`
4. `agent.skills[].path` 必须隶属于某个 `subPackages[].root`，且该分包 `pages` 必须为空数组
5. 保留已有 `agent.skills`，新增或更新本次生成的所有 Skill 项
6. `skills[].description` 必填，保持与 `SKILL.md` 能力范围一致但更简短
7. 核对 instruction 中引用的所有 Skill/API 均已注册，并确认文件不超过 10000 字节
8. `lazyCodeLoading` 与 `component2` 是接入前置项，缺失时记录为待补
