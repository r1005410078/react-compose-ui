## 1. 桌面色

- [x] 1.1 `packages/ui-context/src/providers.tsx`：深色 `workspaceBackground` 改为 `#0a0c0f`，
  `panelBackground` / `surfaceRaised` / `surfaceSunken` 一个字节不动；浅色不动
- [x] 1.2 组件测试断言两种主题下 `--compose-workspace-bg !== --compose-panel-bg`

## 2. 沟槽与卡面

- [x] 2.1 `compose-editor.tsx`：`workspaceTheme` 加 `gap: 6`
- [x] 2.2 `styles.css`：Dockview 容器四边内边距 6px，桌面色作它的底
- [x] 2.3 `.dv-sash` 的可见与命中宽度调到 6px（JS 里那个 `sashWidth = 4` 只用于摆位，
  用 `margin` 抵掉 1px 偏移），沟槽内不画任何线
- [x] 2.4 卡面（底、8px 圆角、上缘高光）画在**根分支的直接视图**上，边框用 `inset` 阴影而不是
  真 `border`——分支节点内部的视图由 JS 按像素绝对定位，真边框会让它们溢出 2px；`box-shadow`
  不参与布局，还跟着圆角走（原计划用伪元素，改成 inset 阴影之后不需要它）
- [x] 2.5 浅色主题的卡面换成软阴影 `0 1px 2px rgb(16 24 40 / 6%)`，不画 1px 灰线
- [x] 2.6 卡片不加 hover / active 高亮；确认 `disableFloatingGroups` 仍然开着

## 3. 左区上下一体

- [x] 3.1 卡面画在左列那个**分支节点**上，两个组自己透明、不圆角——接缝那 6px 因此露出的就是
  卡自己的底，不需要各自向对方多画一段（原计划的越界绘制因此没有必要）
- [x] 3.2 段界只留色阶（`surface-raised` 头压在 `panel-bg` 内容上），不画横线
- [x] 3.3 端到端断接缝处的计算背景色等于卡片底色而不是桌面色；断两段仍可拖动改高度
- [x] 3.4 端到端断「拖一个底栏面板到左区」之后左区仍是一张卡

## 4. 画布卡的头

- [x] 4.1 工具栏行去掉 1px 下边框，底改为 `--compose-surface-sunken`
- [x] 4.2 文档标签条与工具栏行的 `padding-inline` 统一为 8px
- [x] 4.3 命令行去掉上边框，底回到 `--compose-surface-raised`
- [x] 4.4 画布卡的圆角只作用在外框：标尺与命令行横贯整宽

## 5. 模式切换器换行

- [x] 5.1 `workspace-panels.tsx` / `workspace-chrome.tsx`：`EditorModeSwitcher` 从工具栏行
  移到文档标签条行尾，放在 `tablist` 之外并钉在横向滚动区之外
- [x] 5.2 样式换成头部行的画法（灰底圆角、无外框盒、无竖线），工具按钮按下态不动
- [x] 5.3 删掉工具栏行里为它留的竖线与占位；确认溢出仍只从货架尾部取
- [x] 5.4 组件测试：标签上按方向键不会走进切换器；端到端断 1280 下绘图货架 16 格不进「更多」

## 6. Inspector 宽度

- [x] 6.1 `workspace-ids.ts`：`inspector` 改为
  `{ initialWidth: 288, minimumWidth: 264 + WORKSPACE_CARD_GAP }`——可读下限 264 加一条沟槽，
  因为 `theme.gap` 把间距摊进各视图、画出来的盒比配置的窄几像素
- [x] 6.2 `property-panel/src/styles.css`：`min-width: 300px` → `264px`
- [x] 6.3 比例规则落在**组件**里（`LABEL_WIDTH_RATIO` / `MAX_AUTO_LABEL_WIDTH`，未调整过时
  宽度为 `null`）而不是 CSS：组件本来就把 `--pp-label-width` 逐帧写成内联像素值，写在 CSS 里
  那份永远轮不到，两处还会漂移。CSS 只留一个挂载前的兜底值。拖分隔条写入像素值、
  「恢复默认列宽」放回 `null`
- [x] 6.4 组件测试：284 宽下轨道约 `108 / 138 / 38`；变宽时标签列跟着长、到 148 封顶
- [x] 6.5 端到端：拖到 264 时面板不溢出容器，最长的下拉读得完

## 7. 回归与验证

- [x] 7.1 `theme.gap` 专项回归：收起 / 展开三侧、快照保存与恢复、底部 edge group 折叠、
  工作区切换后尺寸正确
- [x] 7.2 更新既有几何断言：画布内容顶边 97 → 102（卡的边框是 inset 阴影、不占布局），
  左右栏起点各右移 6；`emptyWorkspaceRect` 改按**图面**取空白（标尺、滚动条与命令行厚度不同，
  一个统一的安全距会在某一侧留缺口）
- [x] 7.3 **样式类断言一律断计算后的值**（桌面色、卡面色、工具行底色、接缝色），不只断 class
  ——本仓库已经有过一次样式靠层叠静默失效。既有那批几何断言是先红后绿的（改样式时它们自己
  红了）；新写的卡片断言是在实现之后补的，只验证了绿
- [x] 7.4 重出黄金图
- [x] 7.5 `bun run lint` / `typecheck` / `test` / `build` / `test:e2e` 全绿

## 8. 落地时多做的两处

- [x] 8.1 沟槽里那条紫线：shell 那一层的 splitview 在 `.compose-editor__dockview` 之外，
  `--dv-separator-border` 到不了它，改按 Dockview 的 `dv-splitview-has-margin` 类关掉分隔线
- [x] 8.2 底部组的标签行在下面，两头圆角跟着翻过来；它的头部底色也在**组**这一层再落一次
  （edge group 住在 shell 里，dockview 根上那份变量到不了）
