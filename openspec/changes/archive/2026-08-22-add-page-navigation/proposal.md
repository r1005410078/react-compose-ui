# 变更：页面跳转模式

## 原因

页面之间目前只能靠 Page Slot 内嵌,而内嵌是"弱化版组件实例"——没有覆盖、没有变体、
不能下钻、不能离线。复用这件事已经由 Component Asset v2 与变体完整承担,页面应该回到
它本来的身份:**一个可被跳转到的目标**。

但"跳转"今天一样都没有:文档协议里没有任何交互概念,页面脚本作用域没有导航 API,
`ComposePreview` 接受的是一份已经采样好的文档而不是一个可切换的页面。本变更补齐这一层,
并让 `activeFrameId`「决定生成真实页面时渲染哪一块」这条既有语义第一次真正落地。

## 变更内容

- **BREAKING** `core` 新增可选 `Interaction` Entity Component,声明 trigger → action。
  v1 只支持 `click` 一种 trigger 与 `navigate` / `navigate-back` 两种 action;navigate 的目标
  复用既有页面引用值。文档版本号不变——`Interaction` 是可选 Component,缺省文档继续合法。
- `core` 新增导航端口协议 `ComposeNavigationPort`,与既有 `ComposePageDocumentLoader` 同样
  只在 core 定义类型、由 `pages` 提供实现、被 `preview` 消费。
- 新增 `page-navigation` 能力:无 React、无 DOM 的导航会话模型放在 `@compose-ui/pages`,
  承载当前页面、返回栈、从 `homePageKey` 起步与目标缺失时的稳定 issue。
- `@compose-ui/preview` 新增 `ComposePageHost`:按导航会话加载页面、渲染其 `activeFrameId`
  指向的 Frame、切页时释放上一页的 setup scope。
- `ComposePreviewDialog` 在宿主提供导航会话时成为**页面预览**:点击带 `Interaction` 的
  Entity 真的跳转,场景选择器只作用于当前页面。未提供会话时保持现有文档预览行为。
- `@compose-ui/script-runtime` 的 scope 创建选项接受宿主注入的导航端口,`ctx` 暴露
  `navigate` / `navigateBack` 作为条件跳转的逃生舱。
- `@compose-ui/materials` 注册 `Interaction` 的 Component Definition 与 Inspector,目标页面
  复用既有的 node 属性拖入赋值。
- Stage 编辑期 MUST NOT 因 `Interaction` 改变命中测试或触发跳转。

## 影响

- 受影响规范:`compose-document`、`page-navigation`(新增)、`compose-preview`、
  `page-script-runtime`、`basic-materials`、`stage`
- 受影响代码:`packages/core/src/document-types.ts`、`packages/core/src/page/`、
  `packages/pages/`、`packages/preview/`、`packages/script-runtime/src/scope.ts`、
  `packages/materials/`、`packages/stage/`
- 不影响:Page Slot 在本变更中原样保留。删除它是后续 `remove-page-slot` 的范围,
  顺序上必须等跳转可用之后,避免出现"既不能内嵌也不能跳转"的空窗。
