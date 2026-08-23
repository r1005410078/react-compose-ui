# 组件内动画在实例里播放：一个被绑定的播放头

## Why

刀闸故事差最后一环。数据模型上五件事已经具备四件：组件根**必须是 Frame**（因此天然是动画
作用域，清单就挂在它的 `Animations` 上）、采样器已泛型到「任何带 `entities` 的文档」、实例
渲染器本来就跑一份完整嵌套文档加独立 Yoga Runtime、`instanceOverrides` 的 `set-field` 能给
每个实例不同的值。缺的只有一件：**实例内部从来不被采样**。

`packages/materials/src/component-instance/renderer.tsx` 里一个 `Animation` 字样都没有。
`scene-animation` 规范里那句「宿主对某个组件实例发出 seek 到 200 ms，该实例内部按其自身动画
在 200 ms 采样」写了很久，一直没有实现，也没有任何一条用例覆盖它——因为**没有任何入口能发出
这个 seek**。

结果是：组件作者能在组件文档里把刀闸的合闸/分闸做成一条动画并在动画面板里看它动，但那条动画
一旦被实例引用就永远停在 0 ms。用户能做出刀闸，做不出**会动的**刀闸。

## What Changes

给 `component-instance` Renderer 加**两个 Prop**，实例内部按它们采样：

| Prop | 类型 | 含义 |
| --- | --- | --- |
| `animation` | `string \| null` | 组件根 Frame 清单里的动画 id；`null` 表示不采样 |
| `animationTime` | `number` | 播放头毫秒，钳到 `[0, durationMs]` |

**关键在于这两个 Prop 走的是既有的 `Bindings.rendererProps` 机制**，与 Text 的 `content`、
Image 的 `src` 一模一样。`Bindings` 是宿主页面上**那个实例 Entity 自己的 Component**，因此
「每个实例一个值」是构造上成立的，不需要任何新机制：八个刀闸就是八个 Entity，各自绑到页面
脚本的八个导出。

- **`materials`**：实例渲染器在解析完覆盖之后、喂给嵌套 Layout Runtime 之前采样一次；新增
  两条 `propContracts` 与一个 Renderer Inspector（动画下拉 + 播放头数值，两行都可绑定）。
  本包新增对 `@compose-ui/animation` 的依赖——只用 `applyComposeAnimationAtTime` 一个函数。
- **`scene-animation`**：把「宿主对嵌套 Frame 的唯一动画能力是播放控制：play、pause、seek
  与播放模式」收窄成**只有 seek**，并写明 seek 的入口就是上面这个被绑定的 Prop。
- **`animation`** 包与采样器**一行不改**。

**不做**（理由见 design）：实例内的自动播放与循环、实例内的时钟、把 `Animations.items` 做成
可被实例覆盖的数组、给嵌套文档一份自己的脚本作用域、播放头的归一化 0–1 单位。

## 这推翻了路线图里的一句话

路线图步骤 5 写着「要在提案里定的是**粒度**」，并给了两个候选：接受 `Animations.items` 整份
替换，或者重新引入一层被删掉的「暴露属性」声明。

**两个都不用。**那段推理默认了「实例要改的是组件文档里的绑定」，于是撞上「数组只作为字段
整体写入」。但实例是宿主页面上的一个普通 Entity，而 Entity 早就有一套逐实例的绑定机制。
把绑定放在**宿主侧**而不是被覆盖的组件文档侧，粒度问题不是被解决的，是根本不存在。

推论：组件文档里那份 `Animations.bindings` 在实例内**永不生效**。这不是新规矩，是既有事实——
`ResolvedComponentContent` 渲染嵌套文档时不传 `scriptScope`，嵌套文档没有作用域可解析。

## Impact

- Affected specs: `scene-animation`、`basic-materials`
- Affected code：
  - `packages/materials/src/component-instance/renderer.tsx`（采样）
  - `packages/materials/src/component-instance/definition.tsx`（propContracts + inspector）
  - `packages/materials/src/component-instance/animation-inspector.tsx`（新）
  - `packages/materials/package.json`（新增 `@compose-ui/animation` 依赖）
  - `AGENTS.md`（materials 的允许依赖清单）
- **非破坏性**：两个 Prop 都缺省。既有实例 `animation` 缺席，采样不发生，渲染逐像素不变。
  无文档迁移。
