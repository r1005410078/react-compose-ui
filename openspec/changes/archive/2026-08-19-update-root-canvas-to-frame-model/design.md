## 上下文

当前文档协议（v6）使用隐式 Canvas 作为结构根，配合文档级 `output`（固定世界原点 `(0,0)`、
`width/height`、`backgroundPaint`）表达输出区域。`rootIds` 可以平铺任意 Entity，Container 又能
承担同样的尺寸/背景/裁剪/原点职责，组件资产要求"单根任意 Entity"，Page Slot 引用页再复制一遍
同样的语义。五个概念职责高度重叠，暴露给用户的心智模型是混乱的。

横向对比确认了收敛方向：

| 引擎 | 根 | 容器 | 输出尺寸/适配 |
| --- | --- | --- | --- |
| Unity UGUI | 显式 `Canvas` 组件；嵌套 Canvas 只做重建隔离 | `RectTransform` + LayoutGroup | `CanvasScaler`，是根的属性 |
| Rive | `Artboard`，一等对象，一文件多个，Nested Artboard 即嵌套复用 | Artboard 内 Yoga 容器 | `Fit`/`Alignment` 由播放器传入，不入文件 |
| UE UMG | 根就是普通 Panel；`Canvas Panel` 只是"自由定位"这一种 Panel | 各种 Panel Slot | DPI Scaling + Viewport，项目设置 |
| Godot | 场景树 Control，无"画布对象" | `Container` 自动排布，否则 anchor/offset | Viewport size + Stretch Mode，项目设置 |
| Figma | Page 为纯工作区；`Frame` 为有尺寸画板 | Frame 自身即容器，可递归、可 Auto Layout | Frame 宽高即输出，按 Frame 导出 |

共识三条：无限画布不是文档内容；有尺寸的输出单位必须是显式一等节点；画板与容器应是同一概念
的两个角色。Rive 的 Artboard/Nested Artboard 用一个概念覆盖了本项目前四行的全部职责，是最贴近
本项目需求（组件嵌套 + 动画 + 模板）的参照。

## 目标/非目标

- 目标：用单一 Frame 概念替代隐式 Canvas 根、Container 的画板角色、组件文档单根、Page Slot 引用页。
- 目标：让组件嵌套、页面嵌套、动画作用域、模板复用共享同一套隔离规则与同一句用户解释。
- 目标：一次性完成三份协议破版，提供无损自动迁移。
- 非目标：状态机动画、Frame 的运行时动态实例化 API。

## 决策

### 决策 1：Frame 是 Component，不是新 Entity 类型

拥有 `Frame` Component 的 Hierarchy Entity 即为 Frame。理由：项目已是 ECS 组合模型，新增类型
会引入"Container 与 Frame 谁能装谁"的二元判定；作为 Component 则"升格"是加 Component、"降格"
是移除 Component，与既有 Composition/capability 语义一致，且任何普通 Container 都能原地成为可
复用组件根，无需"另存为组件"式的结构搬迁。

- 考虑过的替代方案：独立 `Frame` Preset（Figma 风格）。被否决，因为它使 Container→Frame 成为
  破坏 Entity id 的换类型操作，会打断动画轨道、实例覆盖与 Undo 链。

### 决策 2：Frame 是六重隔离边界

坐标原点、布局求解 Runtime、裁剪、动画时间轴、脚本作用域、预览/导出单位。

这是本方案的收敛点：一句"Frame 里面是一个独立的小世界"同时解释根画布、容器、组件、页面嵌套和
动画作用域，把当前五套解释合并成一套。布局隔离直接复用 Page Slot 与组件实例已有的嵌套文档 Runtime。

- 考虑过的替代方案：只隔离坐标与裁剪，动画与脚本仍是页面级。被否决，因为那样组件仍无法拥有
  自己的动画，"组件不支持动画"这个非目标会被永久固化。

### 决策 3：动画清单归属 Frame，轨道仍归属 Entity

`document.animations` → Frame 的 `Animations` Component。轨道保持在被动画 Entity 的 `Animation`
Component 上不变——该设计（随 Entity 复制、随 Entity 删除、路径即唯一键）本身是正确的。

嵌套实例的动画沿用 Rive nested input 模型：宿主只能控制实例的播放状态（play/pause/seek/mode），
不能对实例内部 Entity 打关键帧。这与 `instanceOverrides` 只含结构操作完全一致，无需新规则。

校验新增一条：轨道路径跨越 Frame 边界报稳定 issue——这是一条**不变量**，用于兜住任何绕过命令
层的非法写入；正常的跨 Frame 拖拽由决策 6 的重定位命令保证不会触发它。

### 决策 4：模板复用 Base/Variant，不引入第三套机制

- 用一次即断开的模板 → 实例化后 detach，一次性展开为普通 Entity 树。
- 改母版全体跟随的模板 → 就是 Base Component，已有 Apply/Revert。
- 多分辨率/多状态模板 → 就是 Variant，已有 appliedLineage 与 resolvedSnapshot。
- 页面模板 → 页面的根 Frame 引用某个 Frame 资产。

### 决策 5：适配参数不入文档

`fit`/`alignment` 是 Preview 的 props（Rive 做法），因为同一份内容在不同宿主容器里的适配策略不同，
把它写进文档会让同一文档无法在多宿主复用。

### 决策 6：跨 Frame 拖拽同时搬迁动画轨道

跨 Frame 拖拽 MUST 在同一事务中把被拖动子树的轨道重定位到目标 Frame，而不是拒绝落点。理由：
实施工程师在多画板/组件化过程中会频繁重组结构，"先删轨道再重建"的出路在真实工作流里代价过高。

代价是 `@compose-ui/animation` 需要新增一套轨道重定位命令，且要处理目标 Frame 已有同名动画的
歧义。歧义不静默解决：命令要求宿主显式给出目标分组 id，Stage 在提交前弹出"合并到哪条动画 /
新建动画"的选择。关键帧的时间、值、插值与空间切线全部逐字段保持，重定位只改变归属。

- 考虑过的替代方案：拒绝携带轨道的跨 Frame 落点并提示。被否决，理由如上。

### 决策 7：Frame 相关动作以当前选中 Frame 为目标

原点十字标记锚定**活动 Frame 的局部原点**（而非全局世界 `(0,0)`），标尺刻度随之以活动 Frame
局部坐标读数。适配画布、缩放到 Frame 等动作以**当前选中 Frame** 为目标；选中的不是 Frame 时
解析为最近祖先 Frame；无选择时才回退到 `defaultFrameId`。`defaultFrameId` 只承担回退与预览
默认目标两个职责，不覆盖显式选择。

## 风险/权衡

- **跨 Frame 拖拽的轨道搬迁**引入新的命令与歧义分支 → 命令为纯函数、拒绝静默合并、与结构变更
  共享单个事务，撤销时两侧 Frame 清单一并还原；补重定位与撤销的单测和 e2e。
- **深层嵌套的布局成本**：每个 Frame 一个求解 Runtime。Page Slot 与实例已是该模型，属已知成本，
  但多画板 + 深嵌套会放大 → 实现阶段补基准测试，超阈值时降级为惰性求解（仅可见 Frame）。
- **升格泛滥**：技术上任何 Container 都能升格，用户随手升格会让隔离边界变成困扰 → 产品约束：
  只在「创建组件」「新建画板」「绑定动画」「独立导出」四个动作里自动升格，不提供裸的升格按钮。
- **一次性三协议破版**：需要可靠迁移器 + 迁移夹具 → 迁移算法本身无损，且全部为纯函数，可用
  golden fixture 覆盖。

## 迁移计划

**ComposeDocument v6 → v7**（纯函数、无损、确定性）：

1. 新建一个 Frame Entity 作为唯一根，id 由文档稳定派生。
2. `output.width/height` → 根 Frame 的 `Frame.size`；`output.backgroundPaint` → 根 Frame 的
   `Appearance.backgroundPaint`。
3. 原 `rootIds` 的全部 Entity 成为根 Frame 的 `Hierarchy.childIds`，顺序保持。
4. `document.animations` → 根 Frame 的 `Animations`。
5. `canvas.guides` 世界坐标 → 根 Frame 局部坐标；因原点本就是 `(0,0)`，为恒等变换。
6. `canvas.grid`/`smartSnap` 保留在 `document.canvas`（编辑器视口设置，非内容）。

**Component Asset v1 → v2**：单根若已是带 `Frame` 的 Container 则原地通过；否则包一层 Frame，
`Frame.size` 取原根 Transform.size，原根成为唯一子级。

**ComposePageFile 1 → 2**：`animation` 引用移到默认 Frame；`defaultFrameId` 填为唯一根 Frame。

回滚：三个迁移器均为纯函数且不修改输入，未执行迁移的旧文件保持可读（返回结构化 legacy issue），
与 v5→v6、Component 旧草案的既有做法一致。

## 待解决问题

- 无（原两项已由决策 7 确定）。
