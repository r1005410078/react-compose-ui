## ADDED Requirements

### Requirement: 组件文档的动画内嵌在资产里

组件资产的动画清单 MUST 住在组件文档中组件根 Frame 的 `Animations.items` 上，
MUST NOT 使用独立的 `.animation.json` 动画文件，组件根的 `Animations.source` MUST 缺席。

理由是实例读取路径已经定死了这一点：实例渲染的是 `resolvedSnapshot.document`，它把整份组件
文档原样嵌进宿主 Entity，清单就在其中；再配一份文件会产生第二份清单，而实例永远读不到它。

组件文档中动画清单条目的 `bindings` MUST 缺席：嵌套文档没有脚本作用域，该声明在任何实例上
都解析不出值。驱动实例的是宿主侧实例 Entity 上的播放头 Renderer Prop。

组件文档的保存 MUST 因此自动带上清单，MUST NOT 存在把清单聚合回文件的回写步骤。

#### Scenario: 组件文档内创建动画不落文件

- **WHEN** 用户在组件文档的时间线空态触发创建
- **THEN** 组件根的 `Animations.items` 新增一条清单，资源目录不新增任何动画文件
- **AND** 该 Frame 的 `Animations.source` 仍然缺席

#### Scenario: 保存组件带上清单

- **WHEN** 用户在组件文档里打了关键帧并保存
- **THEN** 写回的组件资产中清单与轨道都在文档里
- **AND** 页面上引用该组件的实例按新快照播放同一条动画

#### Scenario: 组件动画不携带页面绑定

- **WHEN** 组件文档中的动画来自一条曾绑定页面导出的页面动画
- **THEN** 组件文档中该清单条目不含 `bindings`
- **AND** 实例的播放头只由宿主侧 Renderer Prop 决定
