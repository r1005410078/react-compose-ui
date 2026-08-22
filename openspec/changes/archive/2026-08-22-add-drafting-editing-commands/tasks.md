# 任务

每一步先写判别性断言并**验证红**，再实现。判别性的含义：断言在既有实现下必须失败，且失败
原因正是本条要建立的行为——「Curve 缺少 Renderer」那次的教训是断言被一条既有规则顺带满足。

## 1. stage-engine · 效果与上下文

- [x] 1.1 `StageDraftingEffect` 扩成携带 `segments` / `translate` / `duplicate` / `removed` /
      `reference`；`LINE` 既有用例不改一行仍绿（回归护栏）
- [x] 1.2 `StageDraftingContext` 加 `selection: readonly string[]`
- [x] 1.3 更新 `drafting-types.ts` 的 TSDoc：说明效果为什么描述「变更」而不是「几何」

## 2. stage-engine · MOVE / COPY

- [x] 2.1 红：`MOVE` 取三步后产出位移、会话结束
- [x] 2.2 红：`COPY` 连续两个落点产出两份，位移都相对最初基点
- [x] 2.3 红：启动上下文有选择集时跳过选择步骤
- [x] 2.4 红：`selection` 输入是**替换**（先后两批，作用后一批）
- [x] 2.5 实现 `move-copy-command.ts`（共用状态机，`repeat` 区分）
- [x] 2.6 绿

## 3. stage-engine · ERASE

- [x] 3.1 红：已有选择集时 `prompt` 为 `null`
- [x] 3.2 红：空选择集确认即取消
- [x] 3.3 实现 `erase-command.ts`；接进 `createStageDraftingCommands`
- [x] 3.4 绿

## 4. stage-engine · 选择语义分流

- [x] 4.1 红：`selectionMode: 'accumulate'` 下依次点击两个 Entity，两个都在选择集里
- [x] 4.2 红：`'accumulate'` 下 Shift 点击已选中的 Entity 将其移出
- [x] 4.3 红：`'accumulate'` 下无修饰键框选并入既有选择集
- [x] 4.4 绿：`StageInteractionContext.selectionMode`；`entity-select-move` 与
      `marqueeCombine` 各读同一个标记
- [x] 4.5 既有替换语义用例全绿（默认值护栏）

## 5. stage-engine · 提交漏斗

- [x] 5.1 红：`createDuplicateCommand` 接受显式偏移
- [x] 5.2 绿：`offset` 可选参数，默认 `{ x: 10, y: 10 }`
- [x] 5.3 红：多选 `MOVE` 只产出一条变换命令
- [x] 5.4 绿：`transformedSelection` + `translationMatrix` + `planTransformCommit`
- [x] 5.5 确认 `MOVE` 路径**不**经过 `planMovePreview`（不吸附、无激活阈值、不重挂载）

## 6. stage · 接线

- [x] 6.1 `useStageDrafting` 消费三种新效果，派发对应文档命令
- [x] 6.2 选择集变化时喂给等待 `selection` 的会话；启动命令时带上当前选择集
- [x] 6.3 `prompt` 为 `null` 的会话立刻推进（照 `ComposeCadCanvas` 的既有做法）
- [x] 6.4 `ERASE` 提交后清空选择集
- [x] 6.5 `compose-stage.tsx` 在绘图模式传 `selectionMode: 'accumulate'`
- [x] 6.6 命令行 status 增加「已选 N」标记（二态标记两种状态都渲染）

## 7. stage · 预览轮廓

- [x] 7.1 `StageDraftingOverlay` 增加轮廓层：`index.getWorldBounds(id)` + 当前位移
- [x] 7.2 `ERASE` 待删高亮共用同一层
- [x] 7.3 组件测试：取消后轮廓消失

## 8. 端到端

- [x] 8.1 纵向：进绘图模式 → 画两条线 → `M↵` → 点两条线（累加）→ ↵ → 基点 → 位移点 →
      两条一起移动 → 撤销一步全部回位
- [x] 8.2 `E↵` 先选后执行当场删除，选择集清空
- [x] 8.3 `CO` 连续放置两份
- [x] 8.4 Shift 点击移出选择集，命令作用范围同步
- [x] 8.5 基点捕捉到已有线端点（**非 100% 缩放**下断言）
- [x] 8.6 切回设计模式，点选仍是替换语义

## 9. 五道门 + 文档

- [x] 9.1 `bun run lint` / `typecheck` / `test` / `build` / `test:e2e`
- [x] 9.2 路线图回填步骤 2 收尾结果与被推翻的预判
- [x] 9.3 AGENTS.md：选择语义双轨、宿主拥有选择集、MOVE 共用提交漏斗而非拖动预览
