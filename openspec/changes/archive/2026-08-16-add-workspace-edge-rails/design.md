## 上下文

`packages/editor` 用单一 `DockviewReact` 实例承载四区工作台（Scene Graph、Canvas、
Inspector、底部工具区）。`initializeWorkspace`（`workspace-layout.ts:159-160`）的注释已经
记录了一条硬约束，本次设计决策基于直接阅读 `dockview-core@7.0.2` 源码验证：

- `ShellManager`（`dockview-core/dist/cjs/dockview/dockviewShell.js`）用一个 HORIZONTAL 的
  `_outerSplitview` 承载 `[left 边缘视图？][middle column][right 边缘视图？]`。
- `middle column`（`MiddleColumnView`）自身是 VERTICAL 容器，`top`/`bottom` 边缘组通过
  `middleColumn.addTopView`/`addBottomView` 挂在它内部。
- 因此 `top`/`bottom` 边缘组的可用宽度天然等于 `middle column` 的宽度，即“除去 `left`/
  `right` 边缘组之后剩下的中间区域”，无法横跨整个 shell 宽度——这与调用 `addEdgeGroup` 的
  先后顺序无关，是网格嵌套结构本身决定的，不存在能同时拿到两者的原生配置项。

当前实现的取舍是放弃 `left`/`right` 作为真正的 Dockview Edge Group（改用主网格里的普通
`Group`），从而让 `bottom` 边缘组的宽度不再受两侧影响，代价是两侧失去了 Edge Group 专属的
“折叠为窄轨道 + 展开”原生交互。

## 目标/非目标

- 目标：
  - Scene Graph、Component Inspector 具备 Dockview 边缘组原生的折叠为窄轨道、点击展开、
    记忆展开前尺寸的交互与视觉。
  - 底部工具区（资源/动画/命令/日志）继续横跨整个编辑器宽度，不因两侧折叠/展开而改变宽度
    或位置。
  - 不引入新的外部依赖（复用已有的 `dockview-react`）。
- 非目标：
  - 不改变底部工具区内部的标签集合、顺序或既有行为。
  - 不改变“可选场景历史分栏”的用户可见行为，只调整它的挂载父级。
  - 不实现跨刷新/跨会话持久化折叠状态（沿用现有“临时布局状态”约束，仅存活于当前实例）。

## 决策

- **决策：用嵌套 `DockviewReact` 实例拿到原生边缘组折叠体验，而不是给现有主网格 `Group`
  手写一套自定义折叠 UI。**
  - 原因：本仓库已经有一个几乎同构、已经上线验证过的先例——`SceneToolsDockview`
    （`workspace-panels.tsx`）就是在外层 Scene Graph 面板内部再挂一个独立
    `DockviewReact`，用于场景内容和历史的上下分栏，并且已经处理好了
    `disableDnd`/`disableFloatingGroups`/`themeAbyss`/双层 landmark `aria-label` 消歧
    等细节。本次改动是把同一个模式复用到更大的范围（scene + canvas + inspector），
    而不是引入新模式。手写自定义折叠 UI 需要重新实现宽度动画、最小/折叠尺寸约束、
    展开后尺寸记忆、以及与主题的視覺对齐，边际成本明显高于复用已验证的组件。
  - 考虑过的替代方案：
    - 自定义折叠交互（不使用 Dockview 边缘组）：改动面更小，但会产生第二套折叠实现
      需要独立维护，且难以做到与 Dockview 官方边缘组完全一致的视觉/键盘行为。
    - 调整 `addEdgeGroup` 调用顺序试图让 `bottom` 绕开 `middle column`：已通过阅读
      `ShellManager` 源码排除——`top`/`bottom` 挂载点由 `position` 参数直接决定调用
      `addTopView`/`addBottomView` 还是外层 `addView`，与调用顺序无关，无法绕开。

- **决策：外层 Dockview 只保留一个中央面板 + `bottom` 边缘组，不再持有 `left`/`right`。**
  - 原因：这是让 `bottom` 保持满宽的唯一方式（见上文源码结论）。中央面板的内容整体替换为
    内层 `DockviewReact`。

## 风险/权衡

- **多一层 Dockview 实例的挂载/卸载与 ResizeObserver 开销** → 复用 `SceneToolsDockview` 已经
  验证过的写法（`disableDnd`、`disableFloatingGroups`、独立 `rootRef` + `handleReady`
  幂等检查），并在 Strict Mode 重放场景下补充组件测试，验证左右侧各自只有一个内层 Edge
  Group（沿用现有“Strict Mode 重放初始化”规范场景的验证方式）。
- **双层嵌套后的可访问性 landmark 歧义**（内外两层都可能出现同名 `aria-label`）→ 沿用
  `SceneToolsDockview` 现有的“内层 landmark 改用不同可访问名称”处理方式，扩大到新的内层
  canvas/inspector landmark。
- **样式作用域**：内层 Dockview 需要复用外层已经加载的 `@compose-ui/editor/styles.css`
  中的深色主题类，不能引入第二套主题状态 → 内层沿用外层同款 `theme={themeAbyss}` 与既有
  CSS 类命名前缀，不新增 Tailwind 配置。
- **现有“可选场景历史分栏”子 Dockview 现在会变成三层嵌套 Dockview**（外层 → 中层新引入的
  scene/canvas/inspector 层 → 内层 scene/history 分栏）→ 只是挂载父级从“主网格里的普通
  Group 面板”变成“中层 Dockview 的 `left` 边缘组面板”，`SceneToolsDockview` 组件本身逻辑
  不变，风险局限在验证嵌套层级增加后 resize/dispose 时序是否仍然正确。

## 迁移计划

1. 先在 `workspace-layout.ts` 拆出两个独立的初始化函数：外层（中央面板 + bottom 边缘组）
   与中层（scene/canvas/inspector 边缘组），互不改变各自面板 ID、组件 ID 常量。
2. 新增中层 `DockviewReact` 承载组件（参考 `SceneToolsDockview` 结构），在 `compose-editor.tsx`
   里把它作为外层唯一中央面板的内容渲染。
3. 迁移 `SceneToolsDockview` 的挂载点到新中层的 `left` 边缘组面板，行为保持不变。
4. 更新组件测试与 `app/` Playwright e2e：折叠/展开断言、底部满宽断言、Strict Mode 重放
   面板数量断言、可访问名称消歧断言。
5. 无需数据迁移或兼容旧序列化布局——“临时布局状态”约束已经规定不持久化 Dockview JSON。

## 待解决问题

- 折叠后的轨道宽度、竖排文字样式细节是否需要与 Dockview 默认值不同（当前计划先用 Dockview
  默认折叠尺寸，实现后再对照参考图微调）。
