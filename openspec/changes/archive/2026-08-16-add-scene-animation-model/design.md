## 上下文

动画是 README 与 `AGENTS.md` 都标记为"仍需独立 OpenSpec"的最后几块空白之一。当前
`packages/core` 里 grep `keyframe|animation` 零命中，动画的全部形态只存在于 `animation-panel`
这个演示原型里。后续的动画模式、属性面板打点按钮和画布运动路径都要读同一份事实来源。

参考实现是 Rive 的 Animate Mode：Artboard 持有 animations 列表，每个对象在动画中持有自己的 keys；
插值挂在关键帧的**出向段**，三种类型 Linear / Cubic / Hold。运动路径参考 After Effects，
关键帧顶点携带一对空间切线。

## 目标/非目标

- 目标：轨道数据挂在被动画的 Entity 上，使复制、删除、Group 与组件继承自动正确。
- 目标：动画领域独立成包，采样是纯函数，Stage 与 Preview 可复用。
- 目标：位置轨道能直接求值出可编辑的运动路径几何。
- 非目标：不实现动画模式 UI、不实现打点按钮、不实现画布覆盖层、不改任何 React 包。
- 非目标：不做状态机、不做混合（blend）、不做骨骼与约束。

## 决策

### 决策：轨道存在 Entity 的 `Animation` Component 上，不存在文档顶层

`validateComposeDocument` 对 `entity.components` 只检查 key 是 PascalCase、value 是合法 JSON
（`packages/core/src/document.ts:583-592`），白名单只用于"必须存在"的检查。所以新增一个
`Animation` Component 不需要修改 core 的任何校验代码。

真正的理由不是省事，而是结构操作的正确性：

| 用户操作 | 轨道在文档顶层 | 轨道在 Entity Component |
|---|---|---|
| 复制粘贴 Entity | 动画不跟随，粘贴逻辑需专门处理 | 免费跟随 |
| 删除 Entity | 留下孤儿轨道，需要额外的失效检测 | 自动消失，撤销自动恢复 |
| Group / Ungroup | 需手工搬迁轨道 | 免费 |
| 提取项目组件 / 实例继承 | 组件无法自带动画 | 走既有 `instanceOverrides` 代数，组件自带动画 |

考虑过的替代方案：
- **`ComposeDocument.animations` 存完整轨道树** —— 上表四行全部要手工补偿，且会把动画域
  钉死在 core 里（`ComposeDocument` 引用它、`validateComposeDocument` 封闭）。
- **独立 Animation Asset** —— 需要新建 Store、Resolver 与目录 UI，且页面可移植性变差。
- **bump 到 v7 并写迁移** —— 为一个可选字段引入显式单向迁移，与"简单优先"冲突。

### 决策：文档只保留动画清单，且只有四个字段

`durationMs`、`playbackMode` 与"这个页面有哪几条动画"是文档级事实，挂不到任何单个 Entity 上。
`ComposeDocument.animations` 因此保留，但每条只含 `{ id, name, durationMs, playbackMode }`。

考虑过让时长从最后一个关键帧派生、播放模式归会话，以做到零 core 改动。否决原因是用户把时长
调成 5 秒、刷新后回到默认值，是实打实的 UX 退化。四个字段的清单换掉这个退化是划算的。

清单与轨道是两种东西，就像 `ComposePageFile` 里 `setupScript` 与 `document` 是两种东西，
不算把一个域劈成两半。

### 决策：播放控制绑定挂在清单条目上，复用 `ComposePageExportReference`

播放与当前时间是**整条动画**的属性，不属于任何单个 Entity，因此挂在清单条目而不是
`Animation` Component 上。引用格式直接复用 `ComposeBindings.rendererProps` 已在用的
`ComposePageExportReference`（`{ scope: 'page', exportName }`），这样属性面板的绑定入口、
变量选择器与 `script-runtime` 的 `subscribeExport` 全部原样可用。

用 `bindings` 命名空间而不是平铺 `playing` / `currentTime` 两个字段，是为了后续加事件
（`onComplete`、`onLoop`）时不再动清单条目的顶层形状。

不给 `bindings` 加 `version`：`ComposeBindings.version: 1` 是改造既有数据时留的，
新字段没有需要区分的历史形态。

本变更只定义数据形状与校验，运行时如何订阅与推进由 `add-animation-playback-control` 定义。

### 决策：清单条目改用 `JsonObject &` 交叉写法

`bindings` 是可选字段，而 `interface X extends JsonObject` 的索引签名 `JsonValue` 不接受
`undefined`。`ComposeAppearance`（`document-types.ts:226`）出于同样原因就是交叉写法。

### 决策：轨道不保存 `entityId`，也不保存自己的 `id`

轨道住在 Entity 里，`entityId` 是冗余的，冗余字段迟早和宿主对不上。属性路径本身就是轨道在
该 Entity 该动画内的唯一键，再给一个 `id` 会造出第二套身份并可能漂移。校验拒绝同一动画内
路径重复的轨道。

时间线 UI 需要的稳定行 ID 由 `editor` 合成（`entityId` + 动画 ID + 路径），属于表示层。

### 决策：位置是一条 `vector2` 轨道，不是 x / y 两条标量轨道

运动路径的空间切线是二维量，必须和位置值挂在同一个关键帧上。拆成两条标量轨道后，
"这个顶点的出向切线"就没有归属了，而且两条轨道的关键帧时间可能不对齐，路径无从定义。

时间线左栏仍然可以把一条 `vector2` 轨道显示成 `Position · X` / `Position · Y` 两行——
那是展示层的事。

### 决策：插值挂在出向段，与 Rive 一致

`ComposeKeyframe.interpolation` 描述"本帧 → 下一帧"。最后一帧的 `interpolation` 无意义但仍保留，
这样拖动关键帧改变顺序时不需要搬运插值数据。`cubic` 的 `control` 采用标准 CSS
`cubic-bezier(x1, y1, x2, y2)` 四元组，便于和 CSS/Web Animations 互通。

### 决策：`applyComposeAnimationAtTime` 只重建被触及的 Entity

未被任何轨道命中的 Entity 保持原引用。Stage 和 Preview 的子树 memo 依赖引用相等，
否则播放时每帧都会让整棵场景失效。

### 决策：`animation.keyframe.set` 是 upsert，而不是 create + update 两条命令

打关键帧在 UI 上只有一个入口（菱形按钮 / auto-key），它需要同时处理三种情况：
Component 不存在、轨道不存在、该时间已有帧。拆成多条命令会把这个判断推给每一个调用方。

### 决策：值以 `JsonValue` 存储，由 `track.valueKind` 判别

`ComposeKeyframe.value` 不做泛型判别联合。Component 数据本身就是 `JsonObject`，
判别联合会让 Patch 的 `JsonValue` 约束和类型收窄互相打架。校验负责保证 `value` 的形状与
`valueKind` 一致，采样器据 `valueKind` 分派。

## 风险/权衡

- **校验强度下降**：轨道校验从"文档加载即强制"降级为"命令入口强制 + 宿主可选调用全量校验"。
  core 不认识 `Animation` Component，手工编辑过的页面文件里的坏动画数据不会在加载时被拦下。
  缓解：包导出 `collectComposeAnimationIssues(document)` 供宿主在加载后调用；命令 handler
  始终校验自己的输入；采样器对坏数据静默跳过而不是抛错。这是选择 ECS 存储的真实代价。
- **跨 Entity 查询需要遍历**：读取"这条动画有哪些轨道"要遍历带 `Animation` Component 的实体。
  实体量级是几十到几百，且时间线 UI 本来就按 Entity 分组渲染，遍历反而更直接。
- **`cubic` 求解需要牛顿迭代，播放时每帧每轨道都要算** → 迭代上限固定 8 次并带二分兜底，
  先测量再考虑缓存；`AGENTS.md` 要求有性能数据才引入复杂度。
- **清单里的动画 ID 与 Component 里的分组键可能对不上** → 全量校验报告悬空分组；
  删除动画的命令同时清理所有 Entity 上对应的分组。
- **颜色插值在 sRGB 分量线性做，饱和色过渡会发灰** → 基础能力接受这个偏差，
  后续要换 OKLab 时采样器是唯一改动点。

## 迁移计划

无。core 新增可选字段，`Animation` 是新的可选 Component，老文档与老代码双向兼容。

## 待解决问题

- 一个文档可以有多条动画，但基础能力阶段 UI 只会用第一条。多动画的选择与切换语义
  留给后续提案定义，本变更只保证数据结构允许多条。
- 组件实例继承动画后，实例覆盖单个关键帧的语义未定。本变更只保证 `Animation` Component
  随既有覆盖代数流动，不为动画定义专门的覆盖操作。
