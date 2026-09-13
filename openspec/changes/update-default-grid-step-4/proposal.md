# 变更：网格默认步长改为 4

## 原因

默认步长一直是 8（页面与动画种子同值，绘图另有 10）。8 对间距与控件高度够用，但**够不着
图标、描边与徽标这一级**：一枚 16 的图标想往左挪半格、一条 1px 的分隔线想对齐到 4 的位置，
在 8 的网格上只能关掉吸附徒手放——而关掉之后这次落点就彻底自由，下一次想对齐又没有参照。

4 是界面设计通行的基础模数（Material、iOS HIG 与主流设计系统的间距、字号与控件高度都按 4 的
倍数取值）。改成 4 之后**原来落在 8 上的每一个点仍然落在格点上**——8 是 4 的倍数，既有排版
一个像素都不会被挪走；多出来的只是两格之间那一档。

绘图的 10 不动：那一条有自己的理由（AutoCAD `SNAPUNIT` 的默认值，且接端子靠端口捕捉、
从来不靠网格够着）。

## 变更内容

- `createDefaultCanvasSettings` 的 `grid.stepX/stepY` 由 8 改为 4；`primaryLineEvery` 不变
  （仍是 4，因此主线间隔由 32 变成 16，细/中/粗三级为 4/16/64）。
- 页面与动画工作区的新建种子 `DEFAULT_WORKSPACE_SEEDS` 同步改为 4×4，与默认画布设置保持
  「逐字相同」这条既有关系。
- 绘图工作区种子保持 10×10、对齐吸附关，一个字不改。
- 只改**新建**文档的初值：已有文档的 `canvas.grid` 是文档字段，本变更 MUST NOT 改写它们。

## 影响

- 受影响 specs：`compose-document`（默认画布设置）、`editor-workspace-layout`（内建工作区种子）
- 受影响代码：`packages/core/src/canvas-settings.ts`、
  `packages/editor/src/workspace-layout/workspace-definition.ts`、`README.md`
- 非破坏性：协议、命令与公共 API 形状不变，只有默认值变化。
