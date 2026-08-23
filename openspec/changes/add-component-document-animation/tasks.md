# Tasks

## 1. 提取器搬运清单（先验红）

- [ ] 1.1 `component-extraction.test.ts` 写红四条，**先跑确认红**：
      ① 组件 `items[0].id` 等于子级 `Animation.clips` 的键；
      ② 部分选区——一条动画给 A、B 都打了点，只提 A：组件只含 A 的轨道，**源条目仍在**
      且 B 的轨道未动；
      ③ 只给未提取实体打点的动画不出现在组件里；
      ④ 组件根没有 `source`，复制的条目没有 `bindings`
- [ ] 1.2 ① 是本刀的判别点：换新 id 的实现在「组件有一条动画」上是绿的，在 ① 上是红的
- [ ] 1.3 在 `createComponentExtractionPlan` 里按「轨道落在被提取实体上」筛选源清单条目，
      逐字复制（去掉 `bindings`）写进组件根的 `Animations.items`
- [ ] 1.4 源文档不得被修改：断言 `input.document` 与调用前 `toEqual`
- [ ] 1.5 **不改 `promoteComposeEntityToFrame`**：它还有别的调用方，没有源清单可搬
- [ ] 1.6 1.1 四条转绿

## 2. 组件文档的动画模式入口

- [ ] 2.1 `workspace-panels.tsx`：组件文档面板的工具栏行也渲染模式切换器
- [ ] 2.2 组件测试：组件文档面板出现「设计 / 动画」radiogroup，未启用页面系统的宿主仍然没有
- [ ] 2.3 查证（提案已初查，实现时复核）：`animationScopeFrameId` 在组件文档下落到组件根，
      `animationRuntime` 是组件文档自己的 runtime——若成立则这两处一行不改，并把结论写进注释

## 3. 空态创建分流

- [ ] 3.1 `handleCreateAnimationFromEmptyState` 按当前文档类型分流：页面走建文件那条，
      组件直接派发 `animation.create`
- [ ] 3.2 用例：组件文档下触发创建，**资源目录条目数不变**且 `Animations.source` 缺席。
      断言资源目录而不是只断言清单——「顺手落了个孤儿文件」正是这里最可能出的错
- [ ] 3.3 「载入绑定动画」入口只对有 `source` 的 Frame 出现，因此组件文档下不出现

## 4. 纵向（e2e）

- [ ] 4.1 改写 `e2e/instance-animation.spec.ts`：矩形 → 打旋转关键帧 → 存成组件 →
      放两个实例 → 各绑一个导出 → 断言两个姿态不同
- [ ] 4.2 途中断言组件文档里的时间线确实有那条轨道（否则「存成组件」那步静默丢了清单，
      而后面的断言会因为实例根本没动而以另一种方式失败，读起来像播放坏了）
- [ ] 4.3 删掉 `app/src/demo-asset-provider.ts` 里手写的刀闸组件资源；**保留**
      `openMs` / `closedMs` 两个导出与 `?switch-demo` 开关，e2e 绑定要用
- [ ] 4.4 确认删除后 `?switch-demo` 相关的黄金图仍然不受影响（默认关闭，本就不进快照）

## 5. 收口

- [ ] 5.1 `bun run lint`
- [ ] 5.2 `bun run typecheck`
- [ ] 5.3 `bun run test`
- [ ] 5.4 `bun run build`
- [ ] 5.5 `bun run test:e2e`
- [ ] 5.6 `bunx openspec validate add-component-document-animation --strict`
- [ ] 5.7 `AGENTS.md` 去掉「目前还没有 UI 路径能把动画做进组件文档」那句现状，
      换成「组件的动画内嵌在资产里，没有动画文件」这条规则
- [ ] 5.8 路线图步骤 5b 标记已交付，轨道 B 闭环
