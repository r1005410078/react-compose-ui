# 让动画进得了组件文档

## Why

上一刀（`add-instance-animation`）交付了**播放**：实例按被绑定的播放头采样嵌套文档，两个
实例各走各的姿态。但实现到端到端用例时撞墙了——**没人能做出要播的东西**。两处各自独立的
缺口：

- **组件文档进不了动画模式。**`workspace-panels.tsx` 里的判断是显式的，注释也写着理由：
  「动画绑定是页面级概念，组件文档本期不进动画模式」。规范里同一句话
  （`设计与动画模式切换器`）写着「组件文档与未启用页面系统的宿主本期不提供动画模式入口」。
- **创建组件不搬运动画清单。**`component-library` 整个包里一个 `Animations` 字样都没有，
  `createComponentExtractionPlan` 也不认识它。轨道住在 Entity 的 `Animation` Component 上，
  跟着 `collectSubtree` 走；清单住在 Frame 的 `Animations` 上，留在原地。把一个已经打好点的
  容器存成组件，得到的是一份**有轨道、没清单**的文档——而清单才是「有哪些动画」的事实来源。

结果是上一刀的端到端用例只能用示例应用里**手写**的「刀闸」组件资源。这一刀补上真实路径，
刀闸故事才第一次整条跑通。

**那条禁令的前提已经自己失效了。**它说「动画绑定是页面级概念」——而上一刀之后，绑定住在
宿主页面上那个实例 Entity 的 `Bindings` 上，**根本不在组件文档里**。组件文档里剩下的只有
清单与轨道，两样都是纯粹的文档内容。

## What Changes

- **`stage-engine`**：`createComponentExtractionPlan` 把**与被提取实体相关**的动画清单条目
  复制到新组件根的 `Animations.items` 上。**动画 id 必须逐字保留**——轨道按动画 id 分组
  （`Animation.clips[animationId]`），换个 id 等于把刚提取出来的轨道全部变成悬空数据。
  复制时丢掉 `source` 与 `bindings`：前者指向页面作用域的动画文件，后者指向页面导出，
  而嵌套文档没有脚本作用域（上一刀确认过的既有事实）。
- **`editor`**：模式切换器同样挂到组件文档的工具栏行。组件文档的空态创建入口**不落文件**，
  直接派发 `animation.create` 把清单写进文档。
- **`scene-animation`**：写明组件文档的动画**内嵌在资产里**，没有 `.animation.json`。

**不做**（各有理由，见 design）：给组件做动画文件、Variant 层的动画覆盖语义、在组件文档里
播放预览、把页面那条「一场景一份文件」的规则套到组件上、以及动画模式下的组件实例下钻。

## 一处实现前就查清的现状

**动画作用域解析已经能用，不用改。**`animationScopeFrameId` 解析的是
`controller?.document`——组件文档面板活动时它就是组件文档，而组件文档是单根且根必须是
Frame，`resolveTargetFrameId` 自然落在组件根上。这一刀因此只动 UI 闸门与提取器，
不动作用域。

## Impact

- Affected specs: `scene-animation`、`stage-engine`、`editor-workspace-layout`
- Affected code：
  - `packages/stage-engine/src/commands/component-extraction.ts`
  - `packages/editor/src/workspace-layout/workspace-panels.tsx`
  - `packages/editor/src/compose-editor/compose-editor.tsx`（空态创建分流）
  - `app/src/demo-asset-provider.ts`（删掉手写的刀闸组件资源，两个脚本导出保留）
  - `e2e/instance-animation.spec.ts`（改走真实创作路径）
  - `AGENTS.md`（去掉「目前还没有 UI 路径能把动画做进组件文档」那句现状）
- **非破坏性**：既有组件资产没有 `Animations`，读取按缺省处理，渲染逐像素不变。无文档迁移。
