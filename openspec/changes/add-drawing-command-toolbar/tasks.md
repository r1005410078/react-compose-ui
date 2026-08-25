# 任务

## 1. 先红

- [x] 1.1 新增 `e2e/drawing-command-toolbar.spec.ts`：点 `RECTANGLE` 按钮 → 命令行提示取点
- [x] 1.2 同文件：取两个点后画布上多出一个矩形曲线
- [x] 1.3 同文件：会话进行中按钮是按下态，`Escape` 之后不是（两半写在同一条里）
- [x] 1.4 同文件：工具栏上不再有形状 split button
- [x] 1.5 同文件：`ARROW` 画出的曲线带 `markerEnd`
- [x] 1.6 跑 1.1–1.5，确认**都红**

## 2. stage-engine

- [x] 2.1 新增 `ARROW` 命令：与 `LINE` 共用会话工厂，只多一个 `markerEnd` seed
- [x] 2.2 单元用例：`ARROW` 与 `LINE` 的落点行为一致，只有 Renderer props 不同

## 3. stage

- [x] 3.1 `ComposeStageHandle.startCommand`，实现是把 id 喂给命令行已在用的那个启动函数
- [x] 3.2 `onActiveCommandChange` 上报当前会话的命令 id（结束时报 `null`）
- [x] 3.3 组件用例：句柄启动的会话与敲名字启动的**同一条**（提示文本一致）

## 4. editor

- [x] 4.1 工具栏新增绘图命令组（七个按钮），按下态读 Stage 上报的 id
- [x] 4.2 删除形状 split button 与 `draw-rectangle` / `draw-arrow` / `draw-circle` 三个工具值
- [x] 4.3 清理三个工具值的键位、图标引用与 i18n 文案；新增 pline / arc / wire 三个图标
- [x] 4.4 `grep` 确认仓库里零残留

## 5. 文档

- [x] 5.1 `AGENTS.md`：绘图入口收敛成一套，并记下「加而不换会让仲裁器冲突用鼠标就能触发」
- [x] 5.2 `docs/drafting-unification-roadmap.md` 记一条

## 6. 五道门

- [x] 6.1 `bun run lint`
- [x] 6.2 `bun run typecheck`
- [x] 6.3 `bun run test`
- [x] 6.4 `bun run build`
- [x] 6.5 `bun run test:e2e`

## 7. 观察项

- [x] 7.1 既有 e2e 红了 10 条，逐条判过：两条断的是被删掉的能力本身（Shift 等长宽 → 删除；
      形状主图标同步 → 重写成 `ARROW` 的两点取向），五条只是拿形状工具当「画个东西」的手段
      （改走命令或 `创建容器`），三条因命令**不回选**与「空心矩形盒中心点不中」连带（改读
      Entity 自己的盒 / 取样点移到描边上 / flow 子级改用容器）
- [x] 7.2 `stage-drawing-container-preview.png` 新建、`stage-layer-order-menu.png` 重生成
- [x] 7.3 推论：「画完曲线直接进几何编辑」眼下没有触发者——曲线不再有绘制工具。那条分支的
      判据是「画出来的东西能不能几何编辑」而不是工具名，因此自己失效，不必删
