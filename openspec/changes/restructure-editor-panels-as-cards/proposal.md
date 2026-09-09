# 变更：面板卡片化，并把富余分给画布

## 原因

五个 Dockview 组今天贴在一起，边界是 1px 线，而**一条线两边是同一块底色**：它既可能是组的
边界，也可能是面板内部的分隔，屏幕上没有任何东西把「用户能拖动重排的那个单位」画出来。
同一条边界还有第二处不一致——看得见的是 1px，拖得到的是 4px 的不可见命中带，宽了三倍且没有
任何东西说明。

卡片化单独做是**净损失**（沟槽横 24 + 纵 18）。同时要做的是把右区那 122px 的空白还回来：
实测 400px 宽时轨道是 `120 / 242 / 38`，一个最多填四位数的输入框独吞 242px，而标签列一动不动。
调研 Unity / Godot / Unreal 三家引擎，**没有一家用固定像素标签列**，它们分的都是比例；
问题因此不是「400 太宽」，是**我们没有分配规则**。两件事一起做，画布可绘面积反而多 13%。

## 变更内容

- **桌面色与卡片色分成两个值**：深色主题下 `workspaceBackground` 与 `panelBackground` 今天
  **是同一个 `#101216`**，卡片浮在同色底上只剩边框在说话。只动桌面这一个值（→ `#0a0c0f`），
  卡片体、卡片头与画布保持今天的颜色，既有对比度不用重新验算。
- **每张卡 8px 圆角、卡间 6px 沟槽**，编辑器四边同样 6px。深色靠 1px 边框，浅色靠软阴影。
- **一张卡 = 一颗折叠开关管的那一块**（左区、画布区、右区、底区四张），**不是**一个 Dockview
  组。左区那颗开关一按收走两个组，画成两张卡等于让一颗按钮同时抓走两个看起来各自独立的对象。
- **沟槽就是 sash**：Dockview 7 的 `theme.gap` 提供真实间距，sash 加宽到与沟槽同为 6px，
  看得见的与拖得到的从此是同一条。
- **卡内不画任何横线**，分层全部交给既有的三档色阶；唯一还在的线是卡的外框。工具行取**画布
  自己的底色**（它服务画布，不服务卡头），命令行与画布之间同理。
- **标签行与工具行的内边距统一为 8**：活动标签的灰底与选中工具的蓝底是两块相距 30px 的实心
  矩形，它们的左边必须是同一个数（今天是 5 与 6）。
- **「设计 / 动画」模式切换器从工具栏行尾搬到文档标签行右端**：两行因此各有一个单一作用域——
  第一行说这是哪个文档、在编它的哪一层，第二行说用什么工具。顺带把货架上那 87px 还回去，
  16 格的绘图货架在 1280 下不再溢出。
- **Inspector 默认宽 400 → 288，最小宽 300 → 270**（可读下限 264 加一条沟槽——`theme.gap`
  把间距摊进各视图，画出来的盒比配置的窄几像素），`property-panel` 自己的 `min-width`
  300 → 264；标签列从固定 `120px` 改成按比例 `clamp(88px, 38%, 148px)`，分隔条照旧可拖。

## 影响

- 受影响的规范：`editor-workspace-layout`、`property-panel`
- 受影响的代码：
  - `packages/ui-context/src/providers.tsx`（深色 `workspaceBackground`）
  - `packages/editor/src/styles.css`、`packages/editor/src/compose-editor/compose-editor.tsx`
    （`theme.gap`、卡面、沟槽、工具行底色与内边距）
  - `packages/editor/src/workspace-layout/workspace-ids.ts`（`inspector` 宽度）
  - `packages/editor/src/workspace-layout/workspace-panels.tsx`、`workspace-chrome.tsx`
    （模式切换器换行）
  - `packages/property-panel/src/styles.css`（`min-width`、`--pp-label-width`）
  - `e2e/`（几何断言与黄金图）
- 归档次序：本变更的三条 MODIFIED（`文档标签条`、`设计与动画模式切换器`、`平铺式默认画布工具栏`）
  基于尚未归档的 `restructure-editor-top-bar` 与 `update-editor-chrome-density`，
  MUST 排在那两个之后归档。
- **BREAKING**：宿主若覆盖过 `--compose-workspace-bg` 之外的卡片相关变量、或依赖 Inspector
  默认 400px 的排版，需要跟着调整。已保存的工作区布局快照仍然可读——尺寸是像素值，
  沟槽由 `theme.gap` 在布局时扣除。
