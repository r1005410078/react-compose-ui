# 绘图模式的编辑命令与 CAD 选择语义

## Why

绘图模式现在只能**画**：`LINE` 落地了，但画完的东西在绘图模式里既搬不动、也复制不了、也删不掉。
用户唯一的出路是切回设计模式——而这恰好证伪了「绘图模式是一套完整的工作方式」这句话。

`MOVE` / `COPY` / `ERASE` 与 CAD 选择语义（点中累加、Shift 移出）是**同一个用户故事的两半**，
必须一刀落地：

- 选择语义单独落地没有消费者。用户会发现「点两下选中了两个东西，然后没有任何操作可做」，
  而且页面编辑器的「点一下换一个」在设计模式里仍然正确，看起来只是坏了。
- 编辑命令单独落地不可用。`MOVE` 的第一步就是「选择对象」，而在替换语义下点第二个对象会
  丢掉第一个——三条命令全部退化成单选操作。

这是路线图步骤 2 的收尾一刀，做完绘图模式才算一套能用的工作方式。

## What Changes

- **`stage-engine`**：新增 `MOVE`(`M`) / `COPY`(`CO`) / `ERASE`(`E`) 三条绘图命令；
  `StageDraftingEffect` 从「只描述新几何」扩成「描述本步产出的变更」（新曲线 / 位移 /
  复制 / 删除）；`StageDraftingContext` 带上启动当刻的选择集。
- **`stage-engine`**：`StageInteractionContext` 新增 `selectionMode`，`entity-select-move`
  与 `marquee` 两个插件按它分流——`'replace'`（默认，页面语义）与 `'accumulate'`（CAD 语义）。
- **`stage-engine`**：`createDuplicateCommand` 的固定 `+10` 偏移改为可选参数，默认不变。
  `COPY` 要的是精确落点，不是「错开一点免得盖住原件」。
- **`stage`**：`useStageDrafting` 消费三种新效果并派发文档命令；选择集变化时喂给正在等待
  选择的会话；`ERASE` 提交后清空选择集；绘图模式下把 `selectionMode` 切到 `'accumulate'`。
- **`stage`**：绘图 Overlay 增加**被作用对象的包围盒轮廓预览**（MOVE/COPY 跟随光标，
  ERASE 高亮待删）。
- **文档**：路线图回填步骤 2 收尾结果；AGENTS.md 记录选择语义的双轨与「宿主拥有选择集」。

**不做**（各有理由，见 design）：完整幽灵渲染预览、`ROTATE`/`SCALE`/`OFFSET`/`TRIM`、
MOVE 跨父级重挂载、把选择集代数下沉到 `core`。

## Impact

- Affected specs: `stage-engine`、`stage`
- Affected code: `packages/stage-engine/src/drafting/`、`packages/stage-engine/src/interaction-kernel/`、
  `packages/stage-engine/src/commands/structure-commands.ts`、`packages/stage-engine/src/interaction-controller.ts`、
  `packages/stage/src/drafting/`、`packages/stage/src/stage-surface/compose-stage.tsx`
- 协议版本不变；`ComposeDocument` 不变；没有迁移。
- `StageDraftingEffect` 是步骤 2 引入的新公共类型，本刀扩展它；无第三方消费者。
