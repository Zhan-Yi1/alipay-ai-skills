---
title: 源码分析模式
purpose: 定义项目扫描阶段的搜索策略与功能识别规则
loadTiming: Gate B/C
---

# 源码分析模式

## §1 网络请求搜索

### 1.1 my.request 模式

**搜索正则**：
```
my\.request\s*\(
my\.httpRequest\s*\(
```

**提取信息**：
| 字段 | 提取方式 | 用途 |
|------|----------|------|
| url | 字面量或变量追溯 | 确定服务端接口 |
| method | 参数对象 method 字段 | GET/POST/PUT/DELETE |
| data/body | 参数对象 data 字段 | 记录实际请求参数和来源 |
| success 回调 | 回调函数体 | 记录实际消费的响应路径 |
| fail 回调 | 回调函数体 | 确定错误处理 |
| headers | 参数对象 headers | 是否携带 token |

**示例匹配**：
```javascript
// 模式 1：直接调用
my.request({
  url: 'https://api.example.com/orders',
  method: 'GET',
  data: { status, page },
  success(res) { /* 提取 res.data 结构 */ }
});

// 模式 2：封装函数
function fetchData(url, params) {
  return new Promise((resolve) => {
    my.request({ url, data: params, success: resolve });
  });
}

// 模式 3：async/await 封装
const res = await request({ url: '/api/list', method: 'POST', data });
```

### 1.2 URL 提取策略

| URL 形式 | 处理方式 |
|----------|----------|
| 完整 URL 字面量 | 直接提取 |
| 拼接变量（baseUrl + path） | 追溯 baseUrl 定义 |
| 配置文件引用 | 查找 config/env 文件 |
| 动态运算 | 追溯失败时询问用户确认；无法确认则按阻断规则处理 |

---

## §2 鉴权链路分析

### 2.1 my.getAuthCode 搜索

**搜索正则**：
```
my\.getAuthCode\s*\(
```

**追踪链路**：
```
my.getAuthCode → authCode → 发送到服务端 → 换取 token → 存入变量/storage → 后续请求 header
```

**提取信息**：
| 字段 | 说明 |
|------|------|
| scopes | auth_base / auth_user |
| authCode 传递目标 | 哪个服务端接口 |
| token 存储位置 | 变量 / Storage key |
| token 使用方式 | header / params |

### 2.2 鉴权模式识别

| 模式 | 特征 | 分析重点 |
|------|------|----------|
| 启动时鉴权 | app.js onLaunch 中调用 | 记录启动链与业务请求的真实依赖关系 |
| 按需鉴权 | 特定接口调用前鉴权 | 记录当前动作是否实际到达主动鉴权 |
| Token 缓存 | storage 中读写 token | 记录 key、结构、有效期、header 和运行时访问方式 |
| 无鉴权 | 未使用 getAuthCode | 记录无鉴权依赖及来源依据 |

分析要求：

- 从源码记录 token/session 的 storage key、结构、有效期、header 和请求信封。
- 从真实调用链记录登录接口、字段名、header 名称和鉴权错误分支。
- 对总体目标范围内且包含业务请求的可见动作，分别记录“已有 session 执行路径”和“缺失/失效 session 恢复路径”。已有 session 路径从 tap 开始，沿实际业务工具、请求层被动 session 判定、业务请求和校准依赖追踪；恢复路径记录停止点、可见提示及源码已有的独立登录 API、登录卡片或登录页面。
- 当前动作的任一路径到达 `my.getAuthCode`、主动换 token/刷新或模块私有状态时，记录从 tap 到该依赖及其后续分支的完整源码调用链。

在对应 `interface-spec.<scene>.md` 中按以下固定格式交接证据：

```text
可见动作请求闭包
- 已有 session：tap -> <源码业务函数> -> <请求层被动 session 与 header> -> <业务请求> -> <校准>
- 缺失/失效 session：<停止点> -> <登录提示> -> <独立登录 API、登录卡片或登录页面；无则 none>
```

---

## §3 Storage 数据流追踪

### 3.1 搜索正则

```
my\.(get|set|remove)Storage(Sync)?\s*\(
```

### 3.2 提取信息

| 字段 | 说明 |
|------|------|
| key | Storage 键名 |
| 读写方向 | get = 消费 / set = 生产 |
| 数据结构 | set 的 data 参数类型 |
| 使用场景 | 缓存/持久化/跨页通信 |

### 3.3 数据流图

```
页面 A (setStorage: 'userInfo')
    ↓
页面 B (getStorage: 'userInfo') → my.request headers
    ↓
页面 C (getStorage: 'userInfo') → 展示
```

> Gate C 记录生产方、消费方、key、数据结构和初始化来源；Gate D 再决定接口字段或 skill 内 storage。

---

## §4 AXML 事件绑定分析

### 4.1 搜索正则

```
on[A-Z]\w+\s*=\s*["']
catch[A-Z]\w+\s*=\s*["']
```

**主要事件**：

| 事件 | 搜索模式 | 含义 |
|------|----------|------|
| onTap | `onTap="methodName"` | 点击（最常用） |
| catchTap | `catchTap="methodName"` | 点击（阻止冒泡） |
| onSubmit | `onSubmit="methodName"` | 表单提交 |
| onChange | `onChange="methodName"` | 值变更 |
| onInput | `onInput="methodName"` | 输入中 |
| onConfirm | `onConfirm="methodName"` | 确认 |
| onScrollToLower | `onScrollToLower="methodName"` | 滚动到底（加载更多） |

### 4.2 事件 → 功能映射

追踪事件处理函数到 JS 文件，不得在 handler 名或第一次请求处停止：
```
AXML: onTap="handlePay"
  → JS: handlePay() { my.request({url: '/api/pay', ...}) }
    → 功能: 发起支付
```

对当前源界面中与用户总体目标能力对应的每个可见操作，追踪并记录：

```text
点击区域/控件
  → handler 与冒泡关系
  → 前置校验、弹窗或规格选择
  → 请求/本地状态/页面跳转
  → 完整参数及来源
  → 成功后的局部更新或重新查询
  → 失败提示、回滚和防重复提交
```

列表、搜索或聚合结果通过 `type`、`productType`、`business`、`status` 等判别字段选择下游动作时，沿 handler 的每个源码可达分支继续追踪，记录“判别值 → 分支条件 → 请求/本地逻辑/页面跳转 → 参数及来源”。当前结果可能返回的判别值必须分别记录；多个值进入同一执行链时可以合并为一行。

尤其对加减数量、勾选、收藏、切换等确定性控件，额外记录：

- 源页面是否点击后立即更新，还是先进入确认、规格选择或复杂流程。
- 请求使用绝对目标值还是增量值，连续点击时如何避免乱序。
- 响应是否返回权威数量、价格、库存和合计，还是需要额外刷新。
- 请求的 URL、method、header、参数映射、响应信封和全部可达依赖，包括实际调用的 JSAPI、storage 和模块状态。
- 分别写出已有 session 执行路径和缺失/失效 session 恢复路径。
- 记录当前动作的全部可达依赖；存在未追到真实来源或超出读取边界的依赖时，记录未确认事实和最小待核对路径。

### 4.3 不可逆能力候选筛选

在 Gate B.5 功能识别和 Gate C 可见动作分析中，搜索 handler、请求路径、可见文案和功能名中的以下候选词：

```text
logoff close cancel delete remove clear unbind unsubscribe dissolve kick quit exit
注销 销户 删除 移除 清空 解绑 退订 解散 踢出 退出
```

命中只表示需要核对语义，不表示一定排除。沿实际执行链确认动作是否永久生效、是否存在撤销/回收站/重新绑定等恢复路径，以及影响单项、账号还是组织。移出购物车、取消收藏、取消订单、退出登录和可恢复删除按实际后果继续走 R2/R3；支付、退款、转账、充值、提现和实名按 R4，不作为本规则的默认排除对象。

用户未在 Gate A 明确要求的不可逆能力，在功能清单中保持现有字段，并设置空 `suggestedAtomicInterfaces`、`needsComponent: false`、`skipped: destructive`，将判断理由写入 `experienceGoal`。用户在功能清单确认时明确要求纳入后，才进入 Gate C 静态分析。

---

## §5 页面功能识别表

### 5.1 识别维度

| 维度 | 信号 | 示例 |
|------|------|------|
| 列表查询 | 列表渲染 + 分页参数；横向列表可用 `scroll-view scroll-x`，纵向列表需截断 + 查看更多 | 订单列表 |
| 详情展示 | 页面参数(id) + 单条数据请求 | 订单详情 |
| 表单提交 | form + input + submit 按钮 | 地址编辑 |
| 搜索 | input + 搜索图标 + 请求 | 商品搜索 |
| 状态切换 | tab + 筛选条件 + 列表刷新 | 订单状态筛选 |
| 无网络请求 | 纯计算/展示/跳转 | 关于页面 |

### 5.2 功能 → 接口粒度对应

| 页面功能 | 建议接口粒度 | 说明 |
|----------|-------------|------|
| 列表 + 筛选 | 1 个接口（含筛选参数） | 不拆分为多个列表接口 |
| 列表 + 详情 | 2 个接口 | getList + getDetail |
| 表单提交 | 1 个接口 | submit/create/update |
| 搜索 | 1 个接口 | search（可复用列表接口） |
| 独立操作 | 1 个接口或默认排除 | 非不可逆的 cancel/confirm 按实际风险设计；不可逆 delete 等按 §4.3 默认排除 |

### 5.3 页面功能清单模板

```markdown
| 页面路径 | 功能描述 | 关键API | 可迁移 | 建议接口名 |
|----------|----------|---------|--------|-----------|
| pages/order/list | 订单列表+筛选 | my.request | ✅ | getOrderList |
| pages/order/detail | 订单详情 | my.request | ✅ | getOrderDetail |
| pages/user/bindPhone | 绑定手机号 | my.getPhoneNumber | ⚠️ | bindPhone（接口侧支持；按身份敏感动作完成安全裁决，组件侧不得调用） |
| pages/user/account | 注销账号 | my.request | 原页面承接 | 不生成（`skipped: destructive`） |
```

---

## §6 插件与压缩代码检测

### 6.1 插件引用检测

**搜索**：
```
app.json → "plugins" 字段
*.axml → <plugin-component>
```

**处理规则**：

| 情况 | 处理 |
|------|------|
| 有插件源码可读 | 正常分析 |
| 插件为第三方无源码 | 触发阻断（约束 B） |
| 插件为内部可获取源码 | 额外扫描插件目录 |

### 6.2 压缩/混淆代码检测

**信号**：
- 单行超过 500 字符
- 变量名为单字母（a, b, c）
- 无缩进结构
- 无注释

**处理规则**：

| 情况 | 处理 |
|------|------|
| 仅部分文件压缩 | 尝试格式化后分析 |
| 核心逻辑压缩 | 询问用户提供未压缩源码；无法提供且无法识别核心链路时触发阻断 |
| 全项目压缩 | 触发阻断 |

### 6.3 npm 包检测

**搜索**：
```
node_modules/ 目录
package.json → "dependencies"
import xxx from '非相对路径'
```

**处理**：
- 工具库（lodash/dayjs）→ 在生成代码中替换为原生实现
- 网络库（axios）→ 替换为 my.request
- UI 库 → 不迁移，用原生组件重写
