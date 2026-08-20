## 上下文

- 复用能力已由 Component Asset v2 + 变体 + `instanceOverrides` 承担;Page Slot 与它高度重叠
  且更弱,同时是第二套嵌套 Runtime、第二套循环护栏、第二处脚本 scope 隔离调用点。
- 现有可用地基:`homePageKey` 已在 `app.json` 清单里;`ComposePageDocumentLoader` 已是
  "按引用加载完整页面包装、支持取消、变更通知"的协议;`useComposePageScriptScope`
  已封装加载/热重载/dispose 竞态;`{kind:'method', role:'event-handler'}` 的绑定解析链路
  已打通并有测试。
- 现有缺口:文档协议没有交互概念;脚本作用域没有导航 API;`ComposePreview` 只接受
  已采样文档,`pageLoader` 目前只是透传给 Page Slot 的 `pageDocumentPort`。

## 目标/非目标

- 目标:一条可运行的纵向流程——在画布上给任意 Entity 配一个"点击跳转到某页面",
  在预览里点击后真的换页,且上一页的 setup scope 被释放。
- 目标:声明式为主,不写 JavaScript 也能配出跳转。
- 非目标:URL 路由、浏览器地址栏、前进/后退键。大屏运行在全屏容器里,引入 URL 会
  额外绑定一套宿主契约。
- 非目标:跳转参数传递。协议上给 `params` 留位置,v1 不实现。
- 非目标:按钮物料。`Interaction` 挂在任意 Entity 上,矩形/图片/容器都能成为跳转源;
  带标签与状态的按钮物料是独立的视觉便利,不在本变更的关键路径上。
- 非目标:删除 Page Slot。见 `remove-page-slot`。

## 决策

- 决策:`Interaction` 是 **Entity Component**,不是 Renderer Prop。
  考虑过的替代方案:给每个可交互物料加 `onClick` event-handler prop contract。否决,因为
  那样每个物料都要自己声明一遍,且跳转会被绑死在"有按钮物料"这个前提上;Component
  的做法与 `Lock`、`Clip`、`WidgetSwitcher` 一致,任意 Entity 加上就获得能力。

- 决策:导航**类型定义在 `core`、实现在 `pages`、消费在 `preview`**。
  这不是新发明,而是照抄 `ComposePageDocumentLoader` 的既有分层——它同样是 core 里的
  协议类型、`pages` 里的实现、`preview` 里的端口 prop。这样 `preview` 不需要依赖 `pages`,
  架构边界不变。

- 决策:声明式动作是主路径,脚本 `navigate` 是逃生舱,两者走**同一个导航端口**。
  考虑过的替代方案:只做脚本。否决,目标用户是实施工程师,为每个跳转写一个 setup 导出
  摩擦太大。只做声明式也否决:按权限/按数据跳不同页这类条件跳转做不了。

- 决策:跳转目标是**页面**,渲染的是该页面的 `activeFrameId`。
  这条语义早已写在 pages spec 里("生成真实页面时渲染的 Frame"),跳转模式让它第一次
  真正被执行。目标页面有多个根 Frame 时不提供选择——那是编辑期的事。

- 决策:编辑期 Stage **不触发跳转、不改变命中**。Stage 是布局态;跳转只在预览里生效。
  考虑过的替代方案:Stage 加一个"交互模式"。否决,已经有动画模式,再加一个模式会让
  模式矩阵继续膨胀,而预览对话框本来就是验证运行时行为的地方。

- 决策:返回只做 `navigateBack()` 与显式返回栈,不做 URL。大屏的实际需求是"回上一页"
  或"回首页",不是浏览器历史。

## 风险/权衡

- 风险:`Interaction` 与未来可能的更完整"事件-动作"体系撞车 → 缓解:v1 把 `triggers`
  设计成数组、`action` 设计成可判别联合,新增 trigger/action 时不需要改已有文档。
- 风险:切页时旧页面的 effect cleanup 没跑完导致定时器泄漏 → 缓解:`ComposePageHost`
  复用 `useComposePageScriptScope`,它已经处理了 dispose 竞态;为切页补专门的测试。
- 风险:跳转目标页面被删除或重命名 → 缓解:目标存的是 `assetKey`(跨重命名/移动稳定),
  解析不到时发布稳定 issue 并停留在当前页,不静默黑屏。
- 权衡:`Interaction` 让 `Renderer` 之外的 Entity 也能接收指针事件,预览的事件层要区分
  "物料自己的交互"与"Interaction 的跳转"。约定 Interaction 处理器挂在 Entity 容器上、
  不阻止冒泡到物料内部,避免抢走物料自身的交互。

## 迁移计划

- 纯新增:不含 `Interaction` 的既有文档继续合法且行为不变,无需迁移。
- 宿主未提供导航会话时 `ComposePreviewDialog` 保持现有文档预览行为,示例应用可分两步接入。
- 回滚:移除 `Interaction` 的注册与 `ComposePageHost` 即可;文档里残留的 `Interaction`
  作为未知可选 Component 被保留而不是报错。

## 待解决问题

- 跳转发生时是否需要一个可配置的转场动画?倾向 v1 不做,但如果大屏演示强依赖,应在
  实现前确认,因为它会影响 `ComposePageHost` 是否需要同时持有两页。
