## MODIFIED Requirements

### Requirement: 共享滚轮导航

本包 MUST 提供滚轮平移与缩放的 Hook。监听 MUST 手动装为**非 passive** 的原生监听——React 的
合成 wheel 是 passive 委托，在其上调用 `preventDefault` 只产生警告，拦不住页面滚动。

监听 MUST 只注册一次，最新的视口与回调 MUST 从内部 ref 读取：把它们放进依赖数组会让监听在
滚动过程中重装并丢帧。缩放 MUST 用指数换算，使放大与缩小对称。

Hook MUST 接受一个可选的**拦截谓词**。它 MUST 先于平移与缩放被调用；返回真表示本次滚轮已被
宿主消费，Hook MUST 就此返回且 MUST NOT 改动视口——但仍 MUST `preventDefault`，宿主页面照样
不滚动。

谓词 MUST 由宿主注入，本包 MUST NOT 自己判断该不该让路：判据要读宿主那边的状态（哪条命令在
跑、这一步接受什么），而本包不认识文档、选择集或命令。这与绘图上下文注入 `isGeometryEditable`
是同一条边界——想在这里判断就得先加一条依赖，而那条依赖会被本包的边界用例挡下。

#### Scenario: 滚轮不带动页面滚动

- **WHEN** 用户在画布上滚动滚轮
- **THEN** 画布平移或缩放
- **AND** 宿主页面不滚动

#### Scenario: 放大与缩小对称

- **WHEN** 用户滚动相同的距离先放大再缩小
- **THEN** 视口回到原始缩放

#### Scenario: 拦截谓词消费本次滚轮

- **WHEN** 注入的谓词对本次滚轮返回真
- **THEN** 视口不变，且宿主页面仍然不滚动

#### Scenario: 谓词缺席时行为不变

- **WHEN** 未注入拦截谓词
- **THEN** 滚轮平移与缩放的行为与本要求引入之前完全一致
