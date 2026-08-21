# 变更：动画文件默认按场景独立，页面配置面板逐场景列出绑定

## 原因

当前一页所有根场景共用一份动画文件（按 Frame 分区），编辑器创建动画时复用页面上任意
场景已绑定的引用；页面配置面板只显示激活场景的一行动画绑定，绑定随作用域悄悄切换，
用户看不出"哪块场景绑了哪份文件"。既然 `Animations.source` 本来就是 per-Frame 的文档
状态、加载与保存路径也早已按 assetKey 分组支持多文件，把默认策略改为一场景一份文件、
并让页面配置面板如实列出每块根场景的绑定，能消除隐性状态并让文件粒度与场景隔离一致。

## 变更内容

- 编辑器创建动画不再复用页面上其他场景已绑定的文件引用：每块场景默认创建自己的动画
  文件，命名取「页面名-场景名」，同名冲突追加序号（既有机制）。
- 页面配置面板「动画」分组从"激活场景单行绑定"改为**按 `rootIds` 逐场景动态列出**的
  绑定行：每行显示场景名与绑定文件，支持绑定/更换/解绑/快捷创建，并标注激活场景与
  当前动画作用域场景。
- 保存回写从"合并回同一份文件"泛化为"按各场景绑定的文件聚合回写"：同一份文件只写
  一次，不同文件各自写入；单份文件写入失败须显式报告且不阻塞其余保存。
- 既有共享文件页面**不迁移**：文件格式（`frames` 分区表）与 `animation.source.set`
  命令不变，多场景指向同一份文件仍是合法状态，继续原样加载与保存。
- 顺带修正 `editor-workspace-layout` 中"画布动画绑定属性"需求里已过时的"绑定 MUST NOT
  进入撤销历史"措辞，与 `scene-animation` 已归档的 `update-animation-binding-to-document`
  变更对齐（引用写入是可撤销文档命令；文件资产创建仍是资源写入）。

## 影响

- 受影响的规范：`editor-workspace-layout`（画布动画绑定属性、空动画的创建引导、
  多场景动画会话）、`scene-animation`（动画文件格式，仅措辞澄清）
- 受影响的代码：
  - `packages/editor/src/compose-editor/compose-editor.tsx`（删除 `activePageAnimationReference`
    复用逻辑、空态创建按场景命名、面板接线）
  - `packages/editor/src/animation-mode/`（`PageAnimationScopePanel` 改为逐场景绑定列表，
    `createPageAnimationFile` 命名入参由调用方传场景名）
  - `packages/editor/src/pages/use-page-workspace.ts`（保存循环补部分失败提示；
    加载/合并逻辑已按 assetKey 分组，无结构变更）
  - 编辑器 i18n 文案与相关单测/E2E
