---
title: ACSS 支持画像
purpose: 定义原子组件样式运行环境的能力边界与约束
loadTiming: Gate E
---

# ACSS 支持画像

原子组件样式运行在支付宝支持的 ACSS 子集内。生成样式时优先使用保守、可预期的写法。

## §0 标准卡片 Token

| Token | 值 |
|-------|----|
| 卡容器圆角 | `20px` |
| 模块容器圆角 | `4px` / `8px` / `12px` / `16px` |
| 卡内边距 | `16px` |
| 模块间距 | `12px` |
| 组内间距 | `2px` / `4px` / `6px` / `8px` / `12px` |
| 标题字号 | `15px`，行高 `21px` |
| 辅助字号 | `13px`，行高 `18px` |
| 补充字号 | `11px`，行高 `15.5px` |
| 数字字号 | `28px` / `21px` / `17px` / `15px` |
| 强文本 | `#000000` |
| 辅助文本 | `#666C81` |
| 补充文本 | `#999DAB` |
| 弱文本 | `#BFC2CA` |
| 高亮蓝 | `#1677FF` |
| 链接文本 | `#4B6B99` |
| 警示文本 | `#FF3141` |
| 主按钮背景 | `linear-gradient(90deg, #0F2E7F 0%, #3363E3 100%)` |
| 次按钮背景 | `rgba(22, 119, 255, 0.12)` |
| 次按钮文本 | `#0B2B80` |
| 分割线/置灰底 | `rgba(0, 0, 0, 0.04)` |

生成卡片样式时必须以本表 token 为准，不得自行降级为其他字号或圆角体系。

## §1 单位与颜色

推荐单位：

- `vw`：首选，便于按卡片宽度估算高度。
- `px`、`rpx`、`%`、`em`：可用。
- `rem`：可用但根字号不可控，尽量不用。

颜色可用：

- `#RRGGBB`、`#RGB`
- `0xrrggbb`
- `rgb()`、`rgba()`
- 颜色名称、`transparent`、`currentcolor`

不使用 `hsl()` / `hsla()`。

## §2 CSS 变量

静态校验禁止 CSS 自定义属性：

- 禁止定义 `--token-name: value`。
- 禁止通过 `var(--token-name)` 或 `var(--token-name, fallback)` 使用。
- 主题色、文字色、边框色必须在组件 ACSS 中写成具体色值，例如 `#1677ff` 或 `rgba(...)`。

## §3 选择器

仅使用类名选择器和简单后代类选择器。静态校验禁用复杂选择器：

- 推荐：`.card`、`.item-title`。
- 可用：`.card .item-title`。
- 不使用：元素选择器、子代选择器 `>`、相邻兄弟 `+`、通用兄弟 `~`、属性选择器、伪类、伪元素。
- 不支持：`>>>`、`/deep/`、`::shadow`、`:host`、`:host-context()`。
- 不用通配符 `*`。

`styleIsolation: apply-shared` 影响：组件可继承外部样式，类名需加组件前缀防冲突，推荐 `.{component}-{element}` 命名。

## §4 At-Rules 与 CSS 函数

支持的 at-rule：

- `@import`：引入外部样式。
- `@font-face`：声明自定义字体，引用的字体文件仅支持 `.ttf` 格式。
- `@media`：支持媒体查询，可用于响应式适配。

不支持的 at-rule：

- `@supports`：原子组件不使用特性查询。
- `@keyframes`：原子组件禁止动画（见 §8）。

支持的 CSS 函数：

- `calc()`：动态计算长度值。
- `rgb()` / `rgba()`：颜色值。
- `linear-gradient()` / `radial-gradient()`：背景渐变。

不支持的 CSS 函数：

- `min()`、`max()`、`clamp()`：数学比较函数。
- `env()`、`constant()`：安全区域函数。
- `hsl()` / `hsla()`：HSL 颜色。
- `color-mix()`、`lab()`、`lch()`、`oklab()`、`oklch()`：高级颜色函数。

## §5 布局

常用支持属性：

```text
display
position
box-sizing
width height min-width min-height max-width max-height
top right bottom left
margin margin-* padding padding-*
flex flex-direction flex-wrap flex-grow flex-shrink flex-basis flex-flow
align-items align-self align-content justify-content justify-items justify-self
gap row-gap column-gap
aspect-ratio
overflow overflow-x overflow-y
order
```

原子组件规则：

- 不用 `display: grid`、`display: table`、`display: inline-flex`。
- 不用 `float`。
- `scroll-view` 仅允许横向 `scroll-x`；`swiper` 仅允许横向轮播，不依赖纵向滚动。
- 根节点不写 `height`、`min-height`、`max-height`。
- `position: fixed`、`sticky` 不用于卡片结构。
- 不写 `z-index`。

## §6 边框、背景、阴影

可用：

```text
border border-* border-color border-style border-width border-radius
background background-color background-image background-size background-position background-repeat background-clip
box-shadow opacity visibility
```

规则：

- `border` 简写必须包含 style，例如 `border: 0.5px solid #e5e5e5`。
- `box-shadow` 可自由使用，支持多层。
- 背景可以使用线性/径向渐变，但不做多层复杂背景。

## §7 文本

可用：

```text
color
font-size font-weight font-style font-family
line-height
text-align
text-overflow
text-shadow
word-break
overflow-wrap
white-space
letter-spacing
-webkit-box-orient
-webkit-line-clamp
```

禁用 `text-decoration`。

省略模板：

```css
.ellipsis {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.clamp-2 {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}
```

## §8 动画

原子组件禁止使用动画和过渡效果。

不得生成：

- `animation`、`animation-*`
- `transition`、`transition-*`
- `@keyframes`
- 会产生运动、渐隐渐显、颜色缓动或尺寸缓动的动态样式

点击、加载、选中等状态只能做静态样式切换；状态变化必须即时完成，不写缓动过程。

## §9 图像与遮罩

可用：

```text
object-fit
object-position
filter
clip
clip-path
-webkit-mask-image
-webkit-mask-size
-webkit-mask-position
-webkit-mask-repeat
```

规则：

- 图片容器固定尺寸，避免加载后撑高。
- 遮罩只用单层。

## §10 禁用清单

以下为各章节禁止项的汇总速查，冲突时以上述各章节描述为准。

```text
display: grid
display: table
display: inline-flex
grid-*
position: fixed
position: sticky
z-index
float
direction
writing-mode
zoom
all
contain
scroll-behavior
scroll-snap-*
overscroll-behavior-*
transition
transition-*
text-decoration
animation
animation-*
@keyframes
@supports
cursor
outline-*
resize
will-change
backdrop-filter
mix-blend-mode
isolation
column-count
column-width
touch-action
text-transform
word-spacing
tab-size
caret-color
counter-*
border-image-*
list-style-image
offset-*
quotes
unicode-bidi
--*
var()
-webkit-appearance
-webkit-text-fill-color
-webkit-text-stroke-width
-webkit-tap-highlight-color
```
