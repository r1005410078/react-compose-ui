## Why

今天在画布上点一个 Group 里的对象，选中的是**那个对象**，Group 只有在点到子级之间的空隙、
框选或从场景树里才选得到。分组因此在画布上几乎不可用：用户把几个符号组成一组，是为了此后
**把它们当一个东西**搬、复制、删；而现在点上去搬走的是其中一个，组只在场景树里存在。

Figma 的分组交互是这个问题的通行解法，用户的肌肉记忆也来自那里：**单击选中最外层的 Group，
双击进入一层**；进去之后单击兄弟直接选中兄弟，点空白即退出；`⌘` 点击是无视门槛的深选。
本仓库的组件实例已经走同一条规则（单击选实例整体、双击逐层下钻），Group 是它缺掉的另一半。

## What Changes

- `stage-engine` 新增一个纯函数解算 `resolveStageGroupHit`：把指针命中的最深 Entity 按
  Group 门槛解算成这次按下真正作用的对象。规则只有三条——单击选**最外层还没进入**的 Group；
  双击**穿过一层**（落到门槛的直接子级）；`command` 深选无视门槛。「已进入」**从选区派生**：
  选区里任何一项的严格祖先都算进入过，因此不另存状态，场景树里选中一个子项与画布上的进入
  天然一致；选中 Group 自己**不算**进入。锁定的门槛不下钻。
- 四个读实体命中的插件（收敛、空心移动兜底、几何编辑兜底、选中并拖动）**读同一个解算结果**。
  双击穿过一层的那一下只改选区：不开始移动，也不进入文字或几何编辑。
- `stage` 侧两条入口跟上：组件实例的双击下钻在实例被未进入的 Group 门着时让位（那一下先进
  Group）；右键菜单与左键过同一道门槛。
- 容器（Frame、Auto Layout 容器）**不是**门槛：容器的子级一直是直接可点的，场景更是画布本身。

## Impact

- 受影响规范：`stage-engine`（实体命中的选中与拖动、顶层容器体的命中收敛、新增 Group 门槛
  一条）、`stage`（组件实例内部下钻与命中、新增 Group 门槛在 Stage 侧的两条入口）。
- 受影响代码：`stage-engine/hit-testing/group-selection.ts`（新）、
  `stage-engine/interaction-kernel/{group-hit,move-plugin,marquee-plugin,hollow-move-fallback-plugin,geometry-edit-fallback-plugin}.ts`、
  `stage/stage-surface/instance-drilldown/use-stage-instance-drilldown.ts`、
  `stage/stage-surface/pointer-session/use-stage-root-handlers.ts`、`stage/stage-surface/compose-stage.tsx`。
- 协议不变，不需要迁移。**行为变更**：以前单击 Group 里的对象直接选中它，现在选中的是 Group；
  要直接选中子级，双击进入或按住 `Ctrl`/`⌘` 点击。既有的「Ctrl 拖动子级」端到端用例因此
  原样成立。
- 不在本次范围：框选对 Group 子级的处理（今天框选会把 Group 与它的子级一并选上）、`Enter` /
  `Shift+Enter` 的键盘进出（`Enter` 在图面上已经是「重复上一条命令」）。
