# 任务

## 1. Registry 编辑契约

- [ ] 1.1 红测：Definition 把 method prop / 未知名称标记为可编辑文本时 Registry 拒绝
- [ ] 1.2 `ComposeRendererDefinition` 增加可选原地文字编辑声明与校验
- [ ] 1.3 暴露「按 Entity 查可编辑文本 prop」的查询入口并补 TSDoc

## 2. Engine 文字编辑会话

- [ ] 2.1 红测：点击创建后发布进入编辑 effect；拖拽创建同样进入
- [ ] 2.2 红测：select 工具双击可编辑 Entity 进入会话，双击不可编辑 Entity 不进入
- [ ] 2.3 红测：会话期间指针拖拽不产生移动/缩放/旋转/框选命令
- [ ] 2.4 红测：`Esc`、目标外按下、选区变化、目标消失都退出会话
- [ ] 2.5 `StageInteractionController` 实现会话判定与 effect，保持无 DOM
- [ ] 2.6 单选可编辑 Entity 时 `Enter` 进入编辑，接入既有快捷键动作表

## 3. Stage 原地编辑与覆盖层

- [ ] 3.1 红测：编辑态不渲染八向与旋转手柄，只渲染编辑边框
- [ ] 3.2 Overlay 按编辑会话抑制手柄，与 TransformConstraints 抑制叠加
- [ ] 3.3 Stage 持有会话状态并作为 context 回传 Controller
- [ ] 3.4 编辑目标原地可编辑渲染、获取焦点，退出后焦点交还 surface
- [ ] 3.5 退出时按「有变化 / 为空 / 无变化」收敛为最多一条事务
- [ ] 3.6 验证 Auto width 在输入过程中经既有 measurement 链路实时改宽

## 4. Text 物料

- [ ] 4.1 Text Definition 声明 `text` 为可原地编辑文本
- [ ] 4.2 Text Renderer 支持编辑态原地渲染并保持排版一致
- [ ] 4.3 粘贴与输入只保留纯文本，剥离 HTML 标记

## 5. 端到端

- [ ] 5.1 e2e：点击创建 → 直接输入 → 点击别处提交 → 只增加一次事务
- [ ] 5.2 e2e：双击改写 → `Esc` 提交 → 撤销一次回到原内容
- [ ] 5.3 e2e：空内容退出删除实体且可撤销
- [ ] 5.4 复核既有 e2e 中用 `drawText` 创建文字的用例是否需要跟随调整

## 6. 验证

- [ ] 6.1 `bun run lint && bun run typecheck && bun run test && bun run build`
- [ ] 6.2 `bun run test:e2e`
- [ ] 6.3 `openspec validate add-canvas-text-editing --strict`
