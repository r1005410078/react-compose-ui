# @compose-ui/component-library

项目 Component Asset 的 Store、继承解析与混合组件目录。Store 不依赖 React/DOM；面板只发布创建意图，
不依赖 Stage、Editor、Scene Tree 或 Asset Browser。

Component Asset v1 使用 `application/vnd.compose-ui.component+json` 与 `.component.json`。Base 保存
Group 单根 ComposeDocument v6 和暴露属性；Variant 保存同 Provider/scope 的直接父引用、稳定 ID
语义覆盖、applied lineage 与离线 resolved snapshot。继承和实例嵌套上限均为八层。

`createComposeComponentStore()` 在 Asset Provider 上提供 list/read/create/save/resolve/subscribe、
取消、缓存失效、迟到请求隔离和 revision 冲突。`ComposeComponentLibraryPanel` 混合呈现 Registry
Preset、Base 与 Variant；未配置 Store 时维持纯 Preset 模式。Apply/Revert、显式更新、Base 暴露属性
与实例覆盖均通过本包公共领域操作完成，但场景事务仍由 Editor 拥有。

实例覆盖分为 `properties` 与 `operations` 两个分区。结构操作复用 Variant 的稳定操作代数，因此
`applyComposeInstanceOverrides()` 把它 Apply 到 Variant 父源时可以原样并入其操作列表，父源是 Base
时由同一 Applier 落到文档；两个分区一并写入，结构排在属性之前以匹配解析顺序。
`updateComposeComponentInstanceFromSource()` 会逐条试应用结构操作，锚点在最新父链中失效的单独列为
冲突，避免失效操作留到渲染期才整体失败。`readComposeComponentInstance()` 只在实体完全缺少
`instanceOverrides` 时对旧 `propertyOverrides` 走显式迁移。
