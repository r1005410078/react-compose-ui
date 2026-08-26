# 任务：把 WIRE 合并进 LINE

每一步先写一条**判别性**断言并验证为红，再实现到绿。全部完成后跑五道门
（`lint` / `typecheck` / `test` / `build` / `test:e2e`）。

## 1. `LINE` 取点来自端口时绑定

- [x] 红：`LINE` 的第一个点捕捉到端口、第二个点落在空白处，产出的曲线起点绑到该端口。
      判别点是**这条断言今天必然红**——现有规则明写 `LINE` 不绑。
- [x] 绿：`createStageLineSession` 的提交效果带上两端取点的端口来源；宿主
      `createStageDraftingCurveCommand` 对所有 `line` 调用既有的 `wireBindingsFor`。
- [x] 红：两个点都落在空白处时产出的曲线**没有** `Wire`。这条挡住「一律写一个空 `Wire`」
      的实现。
- [x] 红：连续取三点、中间那点在端口上时，两段都绑到它。

## 2. 跨父级不绑并说明

- [x] 红：端口所属实体与线段落地父级不一致时，该端不绑，且 `validateComposeDocument`
      不报 `wire.parent-mismatch`。
- [x] 绿：`createStageDraftingCurveCommand` 在算出落地父级之后逐端校验，丢弃父级不一致
      的绑定并回报一条说明。
- [x] 红：命令行显示了那条说明。判别点是**说明必须出现**——静默丢弃与「绑上了」在屏幕上
      无法区分。

## 3. 删除 `WIRE`

- [x] 红：命令行键入 `WIRE` 得到「未知命令」。
- [x] 绿：删除 `createStageWireCommand` / `createStageWireSession` 与
      `StageDraftingEffect.wire`；两点会话工厂的 `extras` 只剩 `arrow`。
- [x] 检查 `createStageDraftingCommands` 的顺序与既有用例，确认没有别处按下标取命令。

## 4. 工具栏去掉导线按钮

- [x] 红：绘图命令组是六个按钮且其中没有导线。
- [x] 绿：`DRAWING_COMMANDS` 去掉 `WIRE` 一行；`stage-toolbar-icons` 删除 `wire` 图标与
      它的联合类型成员；`editor-i18n` 删除 `drawWire` 两份文案。
- [x] 确认 `wire` 图标没有第二个消费者。

## 5. Wire Inspector 加解绑

- [x] 红：一条两端都绑定的导线上解除起点后，起点自由、终点不变、几何一个像素不动。
- [x] 绿：Inspector 的已绑定/失效行加解除按钮，走 `entity.component.update`。
- [x] 红：解除最后一端之后该 Entity 不再带 `Wire`。
- [x] 红：两端都自由的曲线上没有解除按钮。

## 6. 端到端

- [x] 一条从端口起笔的 `LINE`，移动被绑的符号，线的那一端跟着走。这是整刀的验收点：
      在此之前只有 `WIRE` 做得到。
- [x] 既有 e2e 里凡是敲 `WIRE` 的改成 `LINE`，并确认它们仍在证明原本要证明的事。

## 7. 文档

- [x] `AGENTS.md`：改写导线那一段——绑定跟着取点来源走，与哪条命令无关；补上跨父级不绑
      与 Inspector 解绑两条。
- [x] `docs/drafting-unification-roadmap.md`：记这一步与它推翻的那条决定。

## 交付记录

五道门全绿，e2e 175 → 178。

**端到端那条抓到了一个实现缺陷。**`applyStep` 在 `prompt` 这一档里先 `commit(...)` 再
`setNotice(null)`，而 `LINE` 逐段落地、提交正发生在这一档——说明在同一拍被抹掉。改成由
`commit` 把说明**交出去**，由 `applyStep` 决定写进命令行。三条 `sameParentWireEnds` 单元
用例全绿也挡不住它：缺陷在 UI 那一半。
