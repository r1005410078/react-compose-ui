# @compose-ui/component-library

项目 Component Asset 的 Store、继承解析与混合组件目录。Store 不依赖 React/DOM；面板只发布创建意图，
不依赖 Stage、Editor、Scene Tree 或 Asset Browser。

Component Asset v1 使用 `application/vnd.compose-ui.component+json` 与 `.component.json`。Base 保存
单根 ComposeDocument v6（根可以是容器或任意 Entity）；Variant 保存同 Provider/scope 的直接父引用、稳定 ID
语义覆盖、applied lineage 与离线 resolved snapshot。继承和实例嵌套上限均为八层。

`createComposeComponentStore()` 在 Asset Provider 上提供 list/read/create/save/resolve/subscribe、
取消、缓存失效、迟到请求隔离和 revision 冲突。`ComposeComponentLibraryPanel` 混合呈现 Registry
Preset、Base 与 Variant；未配置 Store 时维持纯 Preset 模式。Apply/Revert、更新与实例覆盖均通过本包
公共领域操作完成，但场景事务仍由 Editor 拥有。

实例覆盖只有结构操作一个分区。操作复用 Variant 的稳定操作代数，因此 `applyComposeInstanceOverrides()`
把它 Apply 到 Variant 父源时可以原样并入其操作列表，父源是 Base 时由同一 Applier 落到文档。
`updateComposeComponentInstanceFromSource()` 与 `planComposeInstanceAutoSync()` 都逐条试应用操作，
锚点在最新父链中失效的单独列为冲突，避免失效操作留到渲染期才整体失败；前者服务显式更新，后者
服务组件源保存后的自动同步，两者共用同一判据，因此本地保存与外部 revision 变化行为一致。
`readComposeComponentInstance()` 对旧 `propertyOverrides` 与旧 `properties` 分区走显式迁移。
