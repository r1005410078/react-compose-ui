# 变更：删除 Page Slot 页面嵌套

## 原因

Page Slot 与 Component Instance 是两套并行的嵌套文档 Runtime，但它实质是"弱化版组件实例"：
没有属性/结构覆盖、没有变体、编辑期不能下钻、不能离线渲染，唯一独占的能力是"引用的是
页面文件而不是组件文件"。

在 `add-page-navigation` 之后这条独占能力变成反模式：同一个页面既是可跳转的路由目标、
又是可被内嵌的片段，它的 `activeFrameId`、`setupScript` 与动画绑定服务于哪个身份没有
一致答案。删除它同时砍掉四份重复语义——第二套嵌套 Runtime、第二套循环/深度护栏、
第二处脚本 scope 隔离调用点、第二条 WidgetSwitcher 运行期规则。

## 变更内容

- **BREAKING** 删除 Page Slot 物料、Renderer、Preset、Inspector 与资源拖入创建路径。
- **BREAKING** `core` 删除基于祖先页面链与深度上限的嵌套护栏纯函数。页面引用值本身
  **保留**——跳转目标继续使用它。
- **BREAKING** `core` 新增显式单向迁移，把文档中的 `Renderer{type:'page-slot'}` Entity 降级为
  保留原几何与外观的空 Container，并返回列出原页面引用的稳定 issue。普通解析对含
  page-slot 的文档 MUST 返回 legacy issue 而不是静默丢弃。
- 清理 `compose-preview`、`page-script-runtime`、`component-registry`、`scene-animation`
  四份规范中把 Page Slot 与组件实例并列的条款；这些条款对**组件实例**的约束全部保留。
- `preview` 的页面加载端口保留，但其职责改为服务导航而不是槽位递归渲染。

## 影响

- 受影响规范：`basic-materials`、`compose-document`、`compose-preview`、
  `page-script-runtime`、`component-registry`、`scene-animation`
- 受影响代码：`packages/materials/src/page-slot/`（约 1046 行）、
  `packages/materials/src/create-basic-materials.ts`、`packages/materials/src/material-icons.tsx`、
  `packages/materials/src/material-inspector-kit/renderer-inspectors.tsx`、
  `packages/stage-engine/`（1 处）、`packages/preview/src/compose-preview/compose-preview.tsx`、
  `app/src/StageDemo.tsx`、`e2e/materials.spec.ts`
- **顺序依赖**：本变更 MUST 在 `add-page-navigation` 实现完成之后再实施。先删会留下
  "既不能内嵌也不能跳转"的能力空窗。

## 待确认

纯函数迁移只能降级为占位容器——它不能创建资源，因此无法自动把被内嵌的页面转成组件资产。
如果确认线上资产存在真实的 Page Slot 用量，需要另开一个变更提供编辑器动作
「把页面另存为组件」+「把 Page Slot 替换为组件实例」作为人工迁移路径。若用量只存在于
示例应用，则本变更的降级迁移已经足够。
