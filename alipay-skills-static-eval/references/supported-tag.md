原子组件可使用的基础组件有限，建议使用结构简单、交互清晰的方式。

| **组件** | **支持范围** |
| --- | --- |
| view | 支持 |
| text | 支持 |
| button | 不支持 `open-type`  |
| image | 支持，建议使用稳定可访问的网络地址 |
| scroll-view | 仅支持横向滚动（scroll-x） |
| swiper | 仅支持横向轮播，禁用vertical/adjust-vertical-height/disable-touch属性、onAnimationEnd/onTransition事件 |
| swiper-item | 支持 |


> block 这样的虚拟组件不受运行时支持列表限制


使用建议：

+ 优先保证卡片在固定宽高约束下完整呈现
+ 仅支持 View tap 点击、Image load、Image error、Swiper change 事件，不支持其他交互事件
