## 上下文

动画链路的三层现状：

| 层 | 现状 |
|---|---|
| 文档协议 | `ComposeKeyframeInterpolation = hold \| linear \| cubic(control[4])`，挂在**出向段**（`packages/animation/src/animation-types.ts:26`）；控制点只校验四个有限数（`animation-commands.ts:86`） |
| 领域逻辑 | 采样器牛顿法 + 二分兜底求 `cubic-bezier`（`animation-sampler.ts:41`）；命令 `animation.keyframe.interpolation.set` 已存在并可撤销 |
| 编辑器 | 面板动作 `set-interpolation` → 命令的翻译已就位（`animation-document-adapter.ts:263`），但**没有任何 UI 会发出这个动作** |

因此本次是纯表示层变更：不新增、不修改任何文档协议或命令。

## 目标 / 非目标

- 目标：动画模式下选中关键帧后，能用预设、曲线拖拽或数值输入改写该帧的出向插值，且可撤销。
- 目标：删掉协议不支持的「弹簧」假标签，消除会话里的死状态。
- 非目标：spring 插值（需要扩 `ComposeKeyframeInterpolation`、采样器数值积分、校验、动画文件
  与 preview，另立提案）。
- 非目标：Figma 的 Libraries（缓动库收藏/共享）。
- 非目标：在 Entity Inspector 或动画检查器里提供第二个缓动入口。
- 非目标：批量编辑多个关键帧的缓动。

## 决策

### 决策 1：缓动编辑只出现在画布 Inspector 的「动画」Section

用户选定：编辑入口只有一处，就在「当前时间」下方，与既有的动画文件/播放/当前时间同属一个
Section，共用属性面板 Root 的搜索、筛选与列宽。

- 已知取舍：选中某个 Entity 时右侧是 Entity Inspector，看不到缓动区，用户需要先点画布空白处
  回到画布 Inspector。这是有意接受的范围收缩——先把一条纵向流程做完整，入口扩散留给后续提案。
- 显示条件：动画模式激活 + 页面已绑定动画且镜像就绪 + 时间线当前选中了某个关键帧。任一不满足
  就不渲染这三行，Section 保持现在的样子。

### 决策 2：曲线编辑器落在 `@compose-ui/animation-panel`，Editor 用属性面板自定义渲染器接入

- `animation-panel` 已声明与文档协议同构但不依赖它的 `ComposeAnimationInterpolation`，且本身
  就是「动画时间线与关键帧属性组件」包，曲线编辑器是它的自然成员：新增 `src/easing-editor/`
  功能目录，导出受控组件与预设表。
- `editor` 通过属性面板既有的 `renderers` + `metadata.editor` 机制把它嵌进 Section
  （先例：页面脚本成员列表，`packages/editor/src/pages/page-script-scope-panel.tsx:344`），
  不引入任何外来 chrome，也不嵌套第二个属性面板 Root。
- 不下沉到 `@compose-ui/components`：只有一个第一方消费者，且「缓动」是动画领域词汇。

### 决策 3：预设是表示层数据，不进协议

预设就是一张「名称 → 控制点」表，全部可由现有 `cubic` 表达：

```text
Hold                 { kind: 'hold' }
Linear               { kind: 'linear' }
Ease in              cubic(0.42,  0,    1,     1)
Ease out             cubic(0,     0,    0.58,  1)
Ease in and out      cubic(0.42,  0,    0.58,  1)
Ease in back         cubic(0.36,  0,    0.66, -0.56)
Ease out back        cubic(0.34,  1.56, 0.64,  1)
Ease in and out back cubic(0.68, -0.6,  0.32,  1.6)
```

匹配用 1e-6 容差；不匹配任何预设时显示 Custom bezier。back 系列的 y 越界已被现有校验接受
（只要求有限数），所以无需改协议。

### 决策 4：控制点约束由 UI 承担，不收紧文档校验

- x 分量在编辑器内钳制到 `[0, 1]`：`cubic-bezier` 的 x 必须单调，越界会让采样器的二分兜底
  收敛到无意义的 t。
- y 分量不限制：回弹缓动依赖 y 越界。
- 不在 `@compose-ui/animation` 里补 x 范围校验：那会让既有文档变成非法数据，属于破坏性收紧，
  而采样器对病态控制点已有迭代上限与二分兜底，不会挂死。

### 决策 5：一次拖拽 = 一步撤销

拖动控制柄期间持续派发 `set-interpolation`，共享 `mergeKey = animation-easing:<keyframeId>`，
由 core 事务运行时的 750 ms 合并窗口（`packages/core/src/runtime.ts:364`）合成一条事务。
先例：删除对象轨道组（`animation-document-adapter.ts:290`）、输出背景色
（`canvas-inspector.tsx:246`）。松手不额外提交，避免产生一条空 Patch。

### 决策 6：修正出向语义（既有实现与既有规范都反了）

插值描述的是「本帧 → 下一帧」。当前两处取反：

- `compose-animation-panel.tsx:1311` 把区间算成 `上一帧 → 本帧`。
- `specs/animation-panel/spec.md` 的「关键帧间的插值曲线段」要求点选曲线段选中该段**终点**帧，
  而真正控制这段曲线的是**起点**帧的插值——按原规范操作会编辑到不相干的那一帧。

两处一并改为起点语义。这是行为修正，写成 MODIFIED 而不是悄悄改代码。

### 决策 7：末帧可编辑并说明

末帧的出向段没有下一帧，采样时不参与求值。禁用会丢数据：拖动关键帧改变前后顺序后，原末帧
可能变成中间帧，它携带的插值应当继续有效。因此照常可编辑，并在缓动区渲染一条常驻说明。

### 决策 8：删除弹簧标签是破坏性 API 变更

`ComposeAnimationPanelValue.easingEditor` 是必填字段，`setEasingEditor` 是会话上下文方法，
两者都从公共 API 移除；`useAnimationMode` 的会话状态同步删字段。包尚无外部消费者，直接删除
优于保留一个永远为 `'curve'` 的死字段。

## 风险 / 权衡

- **入口单一** → 打完关键帧的用户停在 Entity 选中态，找不到缓动区。缓解：Section 说明文案与
  文档说明「先点画布空白处」；后续提案再决定是否扩散入口。
- **拖拽合并窗口** → 拖动中途停顿超过 750 ms 会拆成两条事务，撤销需要两步。可接受：与既有色板
  拖动的行为一致。
- **删除 `easingEditor`** → 若有外部宿主已经在构造 `ComposeAnimationPanelValue`，需要删字段才能
  编译。变更说明中标注 BREAKING。
- **二维控制柄的可访问性** → 拖拽对键盘与读屏用户不可用。缓解：单行数值输入是等价的完整编辑
  路径，控制柄本身也支持方向键微调，两条路径都有本地化 accessible name。

## 迁移计划

无数据迁移：文档、动画文件与关键帧结构均不变。既有的 `cubic` 关键帧会被预设表识别为对应预设
或 Custom bezier，无需改写。宿主侧唯一动作是从 `ComposeAnimationPanelValue` 字面量里删掉
`easingEditor`。

## 待解决问题

- 归档顺序：本变更的增量假定 `add-animation-asset-and-mode-switcher` 先归档（画布「动画」
  Section 的需求目前还在那个变更里）。若归档顺序颠倒，需要把本变更 ADDED 的缓动需求与它合并
  审阅一次。
