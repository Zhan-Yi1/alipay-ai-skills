在支付宝小程序智能体模式下，原子接口、原子组件、半屏详情页都有一定的限制。

## 新增 API
`my.modelContext` 是智能体运行时的核心能力。注意低版本兼容性判断。

### 原子接口
+ 创建 Skill：`my.modelContext.createSkill(skillPath?)`
    - 注册原子接口：`skill.registerAPI(name, handler)`
    - 注册中间件：`skill.use(async (ctx, next) => {})`
+ 快捷注册原子接口：`my.modelContext.registerAPI(name, handler)`
+ 设置过期：`my.modelContext.expireAllCards(options?)`
    - `options.componentPaths`：仅过期指定组件路径的卡片
    - `options.match: 'latest'`：仅过期最新一张卡片

### 原子组件
+ 设置过期：`my.modelContext.expireAllCards(options?)`
    - `options.componentPaths`：仅过期指定组件路径的卡片
    - `options.match: 'latest'`：仅过期最新一张卡片
+ 通知类型常量：`my.modelContext.NotificationType`
    - 取值：`Input`、`Result`、`Overflow`、`Resize`、`Expire`

#### Context
+ 获取上下文：`my.modelContext.getContext(this)`
+ 设置监听：`ctx.on(type, callback)`
    - 支持 Input、Result；卡片过期时会触发 Expire
+ 移除监听：`ctx.off(type, callback?)`
    - callback 非必传，此时将移除该类型下所有监听
+ 发送上行消息：`ctx.sendFollowUpMessage({ content })`

#### ViewContext
+ 获取视图上下文：`my.modelContext.getViewContext(this)`
+ 设置监听：`vCtx.on(type, callback)`
    - 支持 Overflow、Resize、Expire
+ 移除监听：`vCtx.off(type, callback?)`
    - callback 非必传，此时将移除该类型下所有监听
+ 获取卡片尺寸：`vCtx.getDimensions()`
+ 设置关联页：`vCtx.setRelatedPage({ path?, query })`
+ 打开关联页：`vCtx.openRelatedPage()`
+ 打开半屏详情页：`vCtx.openDetailPage({ url })`
+ 设置之前的卡片过期：`vCtx.expirePreviousCards(options?)`

## 原有 API
原有小程序 API 在智能体模式下并不是全部可用，不同运行环境支持的接口有所不同，支持情况如下表。

若某个分类下的 API 都支持，细分 API 则不会全部列出，请跳转到接口文档查看。原则上，不再提供已标为废弃版本的 API。

| **分类** | **API** | **说明** | **原子接口** | **原子组件** | **动态组件** |
| --- | --- | --- | --- | --- | --- |
| 基础 | [my.env](https://opendocs.alipay.com/mini/api/env) | 获取客户端环境变量 | 支持 | 支持 | 支持 |
| | [my.SDKVersion](https://opendocs.alipay.com/mini/api/sdk-version) | 获取基础库版本 | 支持 | 支持 | 支持 |
| | [my.getAuthCode](https://opendocs.alipay.com/mini/api/openapi-authorize) | 获取授权码 | 支持 | | |
| 发起请求 | [my.request](https://opendocs.alipay.com/mini/api/owycmh) | 发起 HTTPS 网络请求 | 支持 | | 支持 |
| 网络 | [my.getNetworkType](https://opendocs.alipay.com/mini/api/network-status) | 获取网络类型 | 支持 | | |
| | [my.onNetworkStatusChange](https://opendocs.alipay.com/mini/api/on-network-status-change) | 监听网络状态变化 | 支持 | | |
| | [my.offNetworkStatusChange](https://opendocs.alipay.com/mini/api/off-network-status-change) | 取消监听网络状态变化 | 支持 | | |
| 系统信息 | [my.getAppBaseInfo](https://opendocs.alipay.com/mini/0717lu) | 获取小程序基础信息 | 支持 | 支持 | 支持 |
| | [my.getDeviceBaseInfo](https://opendocs.alipay.com/mini/071680) | 获取设备基础信息 | 支持 | 支持 | 支持 |
| 数据缓存 | [my.setStorage](https://opendocs.alipay.com/mini/api/eocm6v) | 异步存储数据 | 支持 | 支持 | 支持 |
| | [my.setStorageSync](https://opendocs.alipay.com/mini/api/cog0du) | 同步存储数据 | 支持 | 支持 | 支持 |
| | [my.getStorage](https://opendocs.alipay.com/mini/api/azfobl) | 异步读取数据 | 支持 | 支持 | 支持 |
| | [my.getStorageSync](https://opendocs.alipay.com/mini/api/ox0wna) | 同步读取数据 | 支持 | 支持 | 支持 |
| | [my.getStorageInfo](https://opendocs.alipay.com/mini/api/zvmanq) | 异步获取缓存相关信息 | 支持 | 支持 | 支持 |
| | [my.getStorageInfoSync](https://opendocs.alipay.com/mini/api/uw5rdl) | 同步获取缓存相关信息 | 支持 | 支持 | 支持 |
| | [my.removeStorage](https://opendocs.alipay.com/mini/api/of9hze) | 异步删除缓存数据 | 支持 | 支持 | 支持 |
| | [my.removeStorageSync](https://opendocs.alipay.com/mini/api/ytfrk4) | 同步删除缓存数据 | 支持 | 支持 | 支持 |
| | [my.clearStorage](https://opendocs.alipay.com/mini/api/storage) | 异步清除本地缓存 | 支持 | 支持 | 支持 |
| | [my.clearStorageSync](https://opendocs.alipay.com/mini/api/ulv85u) | 同步清除本地缓存 | 支持 | 支持 | 支持 |
| 位置 | [my.getLocation](https://opendocs.alipay.com/mini/api/mkxuqd) | 获取用户当前位置 | 支持 | | |
| | [my.openLocation](https://opendocs.alipay.com/mini/api/as9kin) | 使用内置地图打开位置 | 支持 | 支持 | 支持 |
| | [my.chooseLocation](https://opendocs.alipay.com/mini/api/location) | 打开地图选择位置 | 支持 | | |
| | [my.getPhoneNumber](https://opendocs.alipay.com/mini/api/getphonenumber) | 获取手机号 | 支持 | | |
| 交互反馈 | [my.showToast](https://opendocs.alipay.com/mini/api/fhur8f) | 显示消息提示框 | | 支持 | 支持 |
| | [my.hideToast](https://opendocs.alipay.com/mini/api/iygd4e) | 隐藏消息提示框 | | 支持 | 支持 |
| 拨打电话 | [my.makePhoneCall](https://opendocs.alipay.com/mini/api/make-call) | 拨打电话 | 支持 | 支持 | 支持 |
| 设置 | [my.getSetting](https://opendocs.alipay.com/mini/api/xmk3ml) | 获取小程序授权状态 | 支持 | | |
| 账号信息 | [my.getAccountInfoSync](https://opendocs.alipay.com/mini/api/my.getAccountInfoSync) | 获取小程序账号信息 | 支持 | 支持 | 支持 |
| 隐私信息授权 | [my.getPrivacySetting](https://opendocs.alipay.com/mini/0b1o5r) | 获取隐私设置 | 支持 | 支持 | 支持 |
| | [my.openPrivacyContract](https://opendocs.alipay.com/mini/0b1na1) | 打开隐私协议 | 支持 | 支持 | 支持 |
| 图片视频 | [my.previewImage](https://opendocs.alipay.com/mini/api/media/image/my.previewimage) | 预览图片 | | 支持 | 支持 |
| | [my.saveImageToPhotosAlbum](https://opendocs.alipay.com/mini/api/media/image/my.saveImagetophotosalbum) | 保存图片到相册 | 支持 | | |
| | [my.generateImageFromCode](https://opendocs.alipay.com/mini/api/media/image/my.generateimagefromcode) | 根据内容生成图片 | | 支持 | 支持 |
| 支付 | [my.tradePay](https://opendocs.alipay.com/mini/api/openapi-pay) | 发起支付 | 支持 | | |
| 地址 | [my.chooseAddress](https://opendocs.alipay.com/mini/api/choose-address) | 选择收货地址 | 支持 | | |
| | my.chooseInvoiceTitle | 选择发票抬头 | 支持 | | |
| 扫码 | [my.scan](https://opendocs.alipay.com/mini/api/scan) | 扫码 | 支持 | | |
| 振动 | [my.vibrate](https://opendocs.alipay.com/mini/api/buzz) | 振动 | | 支持 | 支持 |
| | [my.vibrateShort](https://opendocs.alipay.com/mini/api/vibrate-short) | 短振动 | | 支持 | 支持 |
| | [my.vibrateLong](https://opendocs.alipay.com/mini/api/vibrate-long) | 长振动 | | 支持 | 支持 |