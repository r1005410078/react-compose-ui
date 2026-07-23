## 上下文

正式 Application Document、Command、Operation 和 Transaction 尚未稳定，但当前示例已经存在
场景结构和属性编辑，需要一条可运行、可撤销的会话历史。历史 UI 必须独立于 editor，以便未来
由 transaction/inverse History Extension 提供同一控制协议。

## 目标/非目标

- 目标：提供独立、通用的不可变快照历史 Hook、受控列表和编辑器快捷键。
- 目标：使用 Dockview 原生面板和 sash，把历史放到场景树下方。
- 目标：验证场景结构和属性修改共享一条原子历史时间线。
- 非目标：正式文档 Schema、事务微内核、持久化、协作历史和 Scene/Global 筛选。

## 决策

- `@compose-ui/history` 只依赖 React peer，不依赖仓库其他业务包；editor 可以依赖它。
- `useHistory<T>` 保存不可变快照引用并依靠结构共享控制成本，不隐式深拷贝或序列化 `T`。
- 对外分离 `HistoryNavigationController` 与携带 `value/commit/reset` 的 `HistoryController<T>`，
  未来 transaction-backed 实现只需适配前者即可继续复用面板和 editor 集成。
- 时间线从旧到新保存基线与动作；新分支丢弃 redo，连续相同 `mergeKey` 在默认 750ms 内合并。
- 默认保留 100 个动作且基线不计入上限；裁剪后提升最早可达快照为“较早状态”。
- HistoryPanel 只消费受控协议，最新记录在上，点击记录调用 `navigate`。
- editor 在原 Scene Graph 外层面板中按需挂载子 Dockview，场景树与 History 分别成为上、下
  两个子 Dockview 面板；没有历史输入时不挂载子 Dockview，并保持原单栏行为。
- 选择、展开、焦点和 Dockview 布局属于 Editor State，不写入历史。

## 风险/权衡

- 快照引用可能被宿主原地修改 → 公共文档明确要求不可变更新，测试覆盖结构共享路径。
- 高频输入产生噪声 → 通过语义 `mergeKey` 和时间窗合并，结构操作保持独立。
- 全局快捷键可能影响宿主 → 只返回容器事件处理器，由 editor 在自身焦点范围内挂载。
- 嵌套 Dockview 增加一层布局状态 → 子工作区只在启用历史时创建，禁止拖拽和浮动，使用稳定
  panel/group ID，并依靠 Dockview 原生约束维持 160px/120px 最小高度。

## 迁移计划

现有 `ComposeEditor` 未提供 history 时不渲染分栏，保持兼容。示例改为使用新 Hook；没有持久化
迁移。未来 core History Extension 可以直接提供 `HistoryNavigationController`。
