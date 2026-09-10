## 1. 共享右键菜单字号

- [x] 1.1 `compose-context-menu.tsx`：菜单项 13px、行高 28px、内边距 5px 8px；快捷键与分组
      标题 12px；图标仍 16px；子菜单与 checkbox / radio 项同步
- [x] 1.2 端到端量字号与行高（jsdom 不排版，Tailwind 类名在那里算不出字号，断言类名等于把
      实现细节当契约）
- [ ] 1.3 重跑并更新含右键菜单的黄金图

## 2. 物料面板两种排法

- [x] 2.1 `ComposeComponentLibraryPanel` 加受控 `mode`（`'grid' | 'list'`）与 `onModeChange`，
      缺省 `'grid'`；面板自身不持久化
- [x] 2.2 网格画法：无框格子、悬停底色与列表行一致、24px 图标、名字区固定两行高两行封顶、
      `grid-template-columns: repeat(auto-fill, minmax(84px, 1fr))`
- [x] 2.3 面板头一行：检索框常驻 + 右端网格 / 列表两颗按钮（`aria-pressed`）；货架上的
      `search` 开关与自定义对话框里那一行一并删除
- [x] 2.4 组件测试：默认网格；切换后瓦片改排；两颗按钮的按下态互斥；长名字在网格里排两行且
      `Dragged Card` 与 `Dragged Card Focused` 可分辨
- [x] 2.5 项目组件的「创建变体」入口在两种排法下都够得着

## 3. 排法进编辑器偏好

- [x] 3.1 偏好加 `palette.mode`，归一化与默认值（`'grid'`）
- [x] 3.2 编辑器把它接到面板的 `mode` / `onModeChange`；改它 MUST NOT 产生事务、会话历史或
      操作日志
- [x] 3.3 组件测试：切换排法只发一次 `onPreferencesChange`，文档与撤销栈不变

## 4. 画布右键「添加组件」

- [x] 4.1 `ComposeStageProps` 加 `addComponentMenu`（分组 + 条目：id / 名字 / 图标）与
      `onAddComponent(id, worldPoint)`；未注入时不渲染该项
- [x] 4.2 `StageContextMenu`：「添加组件」排在最上面，与其余项之间一条分隔；子菜单一层展开，
      分组标题 + 条目，文件夹不做三级
- [x] 4.3 世界落点取右键那一下的坐标；创建复用「根层落点按类型分流」，不另写一套
- [x] 4.4 编辑器：用喂给物料面板的**同一份**货架模型生成菜单树，不另建一份
- [x] 4.5 组件测试：菜单树与面板货架同源（藏掉一个 Preset，两处一起消失）
- [x] 4.6 端到端：在画布右键 → 添加组件 → 选一个符号，对象出现在右键那一点上；再从面板拖一个
      同样的进来，两者落点规则一致
- [x] 4.7 样式对齐设计稿：子菜单下限 208px、行首图标压暗（高亮才提亮）、浮层投影分深浅两套、
      分组标题上下比条目松一档

## 5. 基础物料显示名中文

- [x] 5.1 容器 / 组件切换器 / 曲线 / 圆 / 矩形 / 图表：只改 `label`，`defaultName` 保持英文
- [x] 5.2 更新依赖「添加 Container」这类可访问名的端到端与组件测试
- [x] 5.3 断言：新建对象在场景树里仍叫英文名（这条是本变更的边界，必须有用例钉住）

## 6. 验证

- [x] 6.1 各包 lint / typecheck / 单测：components、component-library、materials、stage、
      stage-engine、editor（`preferences` 与 `workspace-layout`）
- [x] 6.2 端到端：`canvas-add-component.spec.ts` 三条全绿
- [ ] 6.3 全仓 `bun run lint && bun run typecheck && bun run test && bun run build && bun run test:e2e`
      与黄金图更新——**等并行进行中的场景树改动落定后再做**：工作树里同时有 `scene-tree` 与
      `controller.tsx` 的未完成改动（`controller.tsx:401` 当前类型不通过），此刻更新黄金图会把
      那半成品的样子烤进基线
