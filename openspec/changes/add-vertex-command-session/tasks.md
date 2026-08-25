# Tasks

## 1. 判别性用例先验红

- [x] 1.1 新增 e2e：双击进入几何编辑，断言命令行**不再**显示上一条命令留下的「已取消」。
      **先跑确认红**——今天就是它
- [x] 1.2 同一条：在夹点上按下，断言命令行出现「指定新位置」的提示。今天没有任何提示
- [x] 1.3 原地按下松开，断言该夹点点亮且提示仍在；此时几何未变
- [x] 1.4 点亮后在命令行键入一个绝对坐标并确认，断言顶点**正好**落在那个坐标上（捕捉与网格
      都开着）。今天这一步得到的是「未知命令」
- [x] 1.5 点亮后按 `Escape`，断言夹点熄灭、几何不变、几何编辑会话仍在；再按一次才退出
- [x] 1.6 点亮期断言**不画拾取框**（今天的规则是「未拖动就画」，会多画一个）
- [x] 1.7 回归：非 100% 缩放下按住夹点拖走并松手，断言落点、单条撤销记录与「松手后无点亮」
- [x] 1.8 选中一条曲线后键入 `VERTEX ↵`，断言夹点出现。**先跑确认红**——今天是「未知命令」
- [x] 1.9 选中两条曲线后键入 `VERTEX ↵`，断言命令行给出说明而不是什么都不发生

## 2. `stage-engine`：夹点取点会话

- [x] 2.1 `createStageGripSession`：以 `{ entityId, gripId, origin }` 启动的一点会话，
      复用 `@compose-ui/commands` 的四态推进
- [x] 2.2 效果落进 `planStageDraftingEdits`，产出与拖动同一条 `entity.curve.set`
- [x] 2.3 落点应用复用既有的 `applyStageCurveGrip`，不另写曲线数学
- [x] 2.4 Vitest：取点即提交、取消不产出效果、与拖动对同一落点算出逐字相同的 `ComposeCurve`

## 2b. `stage-engine`：`VERTEX` 命令

- [x] 2b.1 `createStageVertexCommand`（id `VERTEX`、别名 `VE`），复用 `ERASE` 那条两次序
      共用的状态机；候选不是恰好一个时以 `rejected` 表达
- [x] 2b.2 `StageDraftingContext` 增加可选的「能否几何编辑」谓词，缺席视为全部可编辑——
      引擎不读文档
- [x] 2b.3 效果新增「进入几何编辑」一项，宿主消费
- [x] 2b.4 Vitest：已选一个当场提交、空选提示、多选被拒、谓词挡掉不可编辑项

## 3. `stage`：按会话对象启动

- [x] 3.1 `useStageDrafting` 开放一个按**会话对象**启动的入口，与既有的按名启动并列；
      共用 `applyStep`、`prompt`、`reference` 与 `notice` 的既有通道
- [x] 3.2 启动时把 `reference` 设成夹点原位置，橡皮筋因此白拿
- [x] 3.3 进入几何编辑会话时清 `notice`
- [x] 3.4 `useStageDrafting` 接 `onEnterGeometryEditing`，消费「进入几何编辑」效果；
      谓词由 Stage 用 `geometryEditing.isGeometryEditable` 注入

## 4. `stage`：点亮状态

- [x] 4.1 `use-stage-geometry-editing` 在 `pointerdown` 就开会话；`end` 阶段按指针是否移动过
      分流（移动过则提交并结束，原地则保留点亮）
- [x] 4.2 排除点的事实来源从「正在拖的夹点」放宽成「正在被会话作用的夹点」，读文档几何
- [x] 4.3 `Escape` 两级：有会话先取消，无会话才退出几何编辑
- [x] 4.4 组件测试：覆盖层的点亮态与活动顶点互相独立（`data-vertex-hot` / `data-vertex-active`）。
      「原地松手之后会话仍在」由 e2e 1.3 承担——它要两个 Hook 真的接在一起才成立
- [x] 4.5 **实现时才发现的一条**：连击中的按下不得点亮夹点。`path.change` 的起始阶段带上
      连击计数，宿主据此在原地松手时取消而不是点亮；e2e 补一条，并做过反向验证

## 5. 呈现

- [x] 5.1 热夹点样式（`data-vertex-hot`），与悬停的纯 CSS 反馈并存不打架
- [x] 5.2 拾取框条件收成「会话在跑 ∧ 没点亮 ∧ 没拖动」
- [x] 5.3 提示文案与 `VERTEX` 标题进 `stage-i18n` 的中英两份

## 6. 规范与文档

- [x] 6.1 两份规范增量（已写）
- [x] 6.2 AGENTS.md：把「不做热夹点」改写成「拖动期不做、点亮期要做」，写清两者的差别；
      补「顶点取点是一条命令会话」与 `Escape` 的两级
- [x] 6.3 路线图（含「踩过的坑」里连击那一条，记下第一版修法为什么错）：路线图：决策 11 的三个入口补上「命令行敲 `VERTEX` 进既有几何」这一条，
      并记下取点管线的顶点这一半已经接齐；「被推翻的判断」表加一行热夹点

## 7. 五道门

- [x] 7.1 `bun run lint`
- [x] 7.2 `bun run typecheck`
- [x] 7.3 `bun run test`
- [x] 7.4 `bun run build`
- [x] 7.5 `bun run test:e2e`
