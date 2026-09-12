## 1. Core 协议

- [x] 1.1 `ComposeLayout` 改为按 `type` 判别的联合；新增 `ComposeGridLayout`
      （`columns` / `rowHeight` / `rowGap` / `columnGap` / `padding` / `float`）与
      `createDefaultComposeGridLayout`
- [x] 1.2 `collectComposeLayoutValidationIssues` 按 `type` 分派；未知 `type` 拒绝且不回退到
      `flex`（判别性用例：写坏的 grid 不得静默按 flex 求解）
- [x] 1.3 新增可选 `ComposeGridItem` Component（`x` / `y` / `w` / `h` / 可选 `minW` / `minH`）、
      `getComposeGridItem` 读取入口与校验；缺席即不在格中
- [x] 1.4 `w` 超出 `columns` 在**读取时**钳制且不回写（用例：改回更多列时跨度复原）
- [x] 1.5 确认协议版本不变、不需要迁移器：两者都是可选新增，缺席时既有文档逐像素不变

## 2. Core 网格求解器

- [x] 2.1 新建 `core/grid-geometry.ts`：碰撞检测、向下推挤、重力上浮，纯函数，
      输入输出都是 `{id, x, y, w, h}` 的数组；不读文档、Snapshot 或任何 DOM 对象
- [x] 2.2 次序钉死为**先推挤后重力**，重力跳过本次手势的目标（用例：反过来会把刚推下去的浮回来）
- [x] 2.3 只向下推、只向上浮（两条各一个判别性用例：同尺寸不交换、不向左靠）
- [x] 2.4 连锁推挤用例（A→B→C）与 20 张卡的终止性用例
- [x] 2.5 从 `core` 公共入口导出；**不**拆到 `layout-engine`（`stage-engine` 不依赖它）

## 3. Layout Engine 预解算

- [x] 3.1 `applyEntityStyle` 之前插入网格预解算 pass：容器内容盒宽 → 列宽 → 各子级绝对矩形
- [x] 3.2 格中子级作为 `POSITION_TYPE_ABSOLUTE` 节点喂给 Yoga，显式 position 与 width/height
- [x] 3.3 Hug 容器的内容高度取网格总行高（用例：删卡后容器收缩）
- [x] 3.4 格中子级的 `LayoutItem` 轴尺寸模式被忽略而不是拒绝（切换布局的中间态不应失败）
- [x] 3.5 容器变宽时列宽跟着变、格坐标与行高不变（用例）
- [x] 3.6 确认既有的样式增量缓存对网格容器仍然有效（父级 Layout 引用变化即失效）

## 4. Stage Engine 规划

- [ ] 4.1 落点解算：被拖盒左上角 → 格坐标，钳制到 `[0, columns - w]`
- [ ] 4.2 网格 move 走独立规划路径，**不改** `planTransformCommit` 的既有 `flow` 分流分支
- [ ] 4.3 缩放吸到最近格线，尊重 `minW` / `minH`
- [ ] 4.4 目标 + 被推挤兄弟写在**同一条 batch**（用例：一次撤销三者同时回去）
- [ ] 4.5 推挤结果来自 §2 的同一个求解器，本包不另算一遍
- [ ] 4.6 拖出网格删 `GridItem` + 烘焙 Absolute 几何；拖入网格按落点写 `GridItem`
- [ ] 4.7 待解决问题：多选一起拖时推挤按选区包围盒算（在 `design.md` 里记着，落地前定）

## 5. Stage 画布反馈

- [ ] 5.1 格线覆盖层：列带 + 行线，与预解算共用同一份列宽行高；容器手势期长高时跟着覆盖新行
- [ ] 5.2 显形判据：按下网格内子级 / 正在拖动或缩放 / 容器本身被选中；静息不画
- [ ] 5.3 占位影子：吸格、虚线、标出落点格坐标与跨度
- [ ] 5.4 跟手的对象不吸格（用例：拖动期间它的屏幕位置等于光标位移）
- [ ] 5.5 缩放读数以**格**为单位，不印像素
- [ ] 5.6 **把 move 接进预览求解通道**：目标在网格容器内时提交 `previewDocument`；
      rAF 合并、`clearPreview` 配对、卸载兜底全部复用既有实现
- [ ] 5.7 重新验证「预览 Snapshot 不进入交互 Controller 的 context」在网格下仍成立
      （网格的提交几何是格坐标，不从 Snapshot 反算像素）
- [ ] 5.8 取消手势立即恢复提交态渲染，无残留几何、无历史条目（用例）

## 6. Materials Inspector

- [ ] 6.1 `LayoutActionMenu` 的 `items` 加第二项「网格」；引导卡改为二选一（标题与正文
      同时覆盖两种布局）
- [ ] 6.2 `planEnableComposeGridLayout`：加 grid Layout + 子项转 Flow + 就近落格 + 碰撞求解，
      一条事务；任一子项锁定时不生成命令
- [ ] 6.3 `planRemoveComposeGridLayout` 与 flex↔grid 切换；入口上明示丢弃的字段
- [ ] 6.4 网格「布局」分组：列数、行高、项间距、内边距、重力开关
- [ ] 6.5 项间距与内边距**复用** `FLEX_RENDERERS` 的 `gap` / `padding` editor
- [ ] 6.6 分组标题栏：布局类型状态标记 + 重置（值等默认时禁用）+ 菜单
- [ ] 6.7 列数字段下的内联分段指示条；**不**做三节点实时预览
- [ ] 6.8 几何 Inspector 第三档：格位置 + 格跨度顶掉位置/自身对齐；尺寸降只读；
      外边距隐藏；旋转与基点照常
- [ ] 6.9 键入格坐标走与拖动同一个求解器（用例：两个入口结果一致）
- [ ] 6.10 「忽略 Auto Layout」开关文案按父级布局类型切换，网格分支删 `GridItem` + 烘焙尺寸

## 7. 验证

- [ ] 7.1 `bun run lint` / `typecheck` / `test` / `build`
- [ ] 7.2 `bun run test:e2e`（涉及画布交互与 Inspector）
- [ ] 7.3 端到端：拖动推挤 + 重力 + 缩放吸格 + 撤销一步全回去
- [ ] 7.4 回归：既有 Auto Layout 与绝对定位文档逐像素不变（黄金图）
- [ ] 7.5 `openspec validate add-grid-layout --strict`
