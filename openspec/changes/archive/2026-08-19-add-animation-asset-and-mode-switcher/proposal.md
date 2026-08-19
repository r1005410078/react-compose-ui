# 变更：动画文件资产、设计/动画模式切换器与画布动画绑定

## 原因

当前进入动画模式的唯一入口是底部工具组的「动画」标签，动画本身只是
`ComposeDocument.animations` 里的一条清单，没有资产形态：无法在资源浏览器中看到、
无法跨页面复用、也无法像页面脚本那样在画布 Inspector 中显式绑定。同时时间线空态由
「轨道数为 0」触发，已有动画但尚未打关键帧时仍显示「创建动画」引导，重复触发还会
追加被 UI 忽略的第二条动画。

## 变更内容

- 新增 Compose Animation 文件资产（`.animation.json`）：只存动画清单与变量绑定
  （id/名称/时长/播放模式/bindings），关键帧轨道仍留在被动画 Entity 的 `Animation`
  Component 上；`@compose-ui/animation` 提供解析/序列化/命名协议。
- `ComposePageFile` 新增可选 `animation` 稳定资源引用（providerId/assetKey/scope），
  容缺解析，`pageSchemaVersion` 保持 1；`ComposePageStore` 新增 `setPageAnimation`
  乐观并发写入。动画文件是静态权威：打开页面时水合进文档镜像
  `ComposeDocument.animations`，保存页面时把清单变化回写动画文件。
- 页面文档工具栏行（保存按钮旁）新增「设计 / 动画」模式切换器，取代底部「动画」
  标签成为动画模式入口：切到动画时底部 Dockview 动态加入并激活时间线面板且展开
  底部组；切回设计时移除时间线面板并恢复 资源/命令/日志 与折叠状态。
- 画布 Inspector 在「页面脚本」上方新增「动画」区块：列出/绑定/创建/取消关联
  同级动画文件，并复用动画检查器的变量绑定编辑（页面脚本导出 → bindings）。
- 时间线空态触发从「无轨道」改为「无绑定动画」：「创建动画」创建动画文件并默认
  绑定当前页面；已绑定但会话镜像缺失（如撤销越过水合事务）时提供「载入绑定动画」
  入口；已绑定的动画即使零轨道也显示正常时间线。

## 非目标

- 不引入「脚本」独立模式。
- 不支持多动画选择（沿用 `animations[0]` 约定）。
- 组件文档本期不提供动画模式入口（绑定是页面级概念）。
- 不要求 Asset Provider 认识动画 media type；文件按名称后缀识别。

## 影响

- 受影响的规范：`editor-workspace-layout`、`scene-animation`、`pages`
- 受影响的代码：`packages/animation`（新增 animation-file 协议）、
  `packages/core/src/page/*`（页面文件 `animation` 字段）、
  `packages/pages/src/page-store.ts`（`setPageAnimation`）、
  `packages/animation-panel`（受控 `empty`）、
  `packages/editor`（模式切换器、底部 Dockview 重组、画布 Inspector 动画区块、
  页面打开水合与保存回写、空态改造）、`e2e/integration.spec.ts`
