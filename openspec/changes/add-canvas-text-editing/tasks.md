# 任务

## 1. Registry 编辑契约

- [x] 1.1 红测：Definition 把 method prop / 未知名称标记为可编辑文本时 Registry 拒绝
- [x] 1.2 `ComposeRendererDefinition` 增加可选原地文字编辑声明与校验
- [x] 1.3 暴露「按 Entity 查可编辑文本 prop」的查询入口并补 TSDoc

## 2. Registry 编辑中值覆盖

- [x] 2.1 红测：设置覆盖后 `measure` 收到覆盖值且 measurement revision 前进、缓存条目失效
- [x] 2.2 红测：清除覆盖后渲染与测量立即回到 authored props
- [x] 2.3 measurement adapter 支持按 Entity 设置/清除可编辑 prop 的运行时覆盖
- [x] 2.4 `ComposeRendererProps` 增加编辑态字段，且只在 `mode === 'editor'` 出现
- [x] 2.5 红测：`preview` 模式下不出现编辑态字段，文档与历史观察不到覆盖值

## 3. Engine 文字编辑会话

- [ ] 3.1 `pointer.down` 增加连击计数字段，surface 按平台惯例归一化后传入
- [ ] 3.2 context 增加「Entity 是否可原地编辑」判定入口与新建 Entity 回灌字段
- [ ] 3.3 红测：连击计数 1 走选择/移动，计数 2 进入会话；不可编辑 Entity 双击不进入
- [ ] 3.4 红测：回灌 `draw-text` 新建 Entity 后进入会话，且重复 context 更新只进入一次
- [ ] 3.5 红测：其他绘制工具创建时不进入会话
- [ ] 3.6 红测：会话期间指针拖拽不产生移动/缩放/旋转/框选命令
- [ ] 3.7 红测：`Esc`、目标外按下、选区变化、目标消失都退出会话
- [ ] 3.8 `StageInteractionController` 实现会话判定与 effect，保持无 DOM
- [ ] 3.9 单选可编辑 Entity 时 `Enter` 进入编辑，接入既有快捷键动作表

## 4. Stage 原地编辑与覆盖层

- [ ] 4.1 红测：编辑态不渲染八向与旋转手柄，只渲染编辑边框
- [ ] 4.2 Overlay 按编辑会话抑制手柄，与 TransformConstraints 抑制叠加
- [ ] 4.3 Stage 持有会话状态并作为 context 回传 Controller
- [ ] 4.4 Stage 供给连击计数、可编辑判定与 `createDrawing` 后的新建 Entity 回灌
- [ ] 4.5 编辑目标原地可编辑渲染、获取焦点，退出后焦点交还 surface
- [ ] 4.6 输入只写编辑中值覆盖不派发命令，退出时清除覆盖
- [ ] 4.7 退出时向 Registry 查 prop 名，按「有变化 / 为空 / 无变化」收敛为最多一条事务
- [ ] 4.8 验证 Auto width 在输入过程中经既有 measurement 链路实时改宽

## 5. Text 物料

- [ ] 5.1 Text Definition 声明 `text` 为可原地编辑文本
- [ ] 5.2 Text Renderer 支持编辑态原地渲染并保持排版一致
- [ ] 5.3 粘贴与输入只保留纯文本，剥离 HTML 标记

## 6. 端到端

- [ ] 6.1 e2e：点击创建 → 直接输入 → 点击别处提交 → 只增加一次事务
- [ ] 6.2 e2e：双击改写 → `Esc` 提交 → 撤销一次回到原内容
- [ ] 6.3 e2e：空内容退出删除实体且可撤销
- [ ] 6.4 复核既有 e2e 中用 `drawText` 创建文字的用例是否需要跟随调整

## 7. 验证

- [ ] 7.1 `bun run lint && bun run typecheck && bun run test && bun run build`
- [ ] 7.2 `bun run test:e2e`
- [ ] 7.3 `openspec validate add-canvas-text-editing --strict`
