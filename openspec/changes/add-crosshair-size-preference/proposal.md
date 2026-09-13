# 变更：十字光标长度成为可选的编辑器偏好，并与画笔分开表述

## 原因

设置 › 画布 › 十字光标 现在只有一组选项——「渐隐（默认）/ 晕圈」——而那组选的是**画笔**
（线怎么画）。用户读成了**长度**，选「晕圈」期待短十字，得到的仍是贯穿图面的长十字，于是
报「选择短臂，出来的还是长臂」。

文案要负主要责任：分组只写「十字光标」、不说这一组管什么，而说明文字的第一句就是「渐隐：
贯穿图面的对齐参照」——「贯穿图面」四个字直接指向长度。

更根本的是**长度本来就该可选而当前不可选**：它是 `ComposeWorkspaceSession.crosshairSize`，
只有工作区切换能改它，而三个内建工作区刚刚被统一成同一个值——于是现在它在界面上完全够不着。

## 变更内容

- `ComposeEditorPreferences` 增加 `crosshairSize: number`，**1–100 的整数百分比**，默认 **5**。
  越界钳进范围并取整，缺席或非有限数回落默认值。这**整条照抄 AutoCAD 的 `CURSORSIZE`**：
  同样是 1–100 的整数、同样是「占屏幕尺寸的百分比」、同样的默认值 5，同样在选项对话框里
  配一个**数值框加滑块**。
- **`ComposeWorkspaceSession.crosshairSize` 删除**（**BREAKING**，公共类型）：长度此后只有
  偏好这一个事实来源。三个内建工作区的值刚刚被统一，删除它不改变任何既有行为；留着它会让
  同一个数有两处来源，而工作区那一处已经够不着了。
- 设置 › 画布 › 十字光标一节拆成两组，各自带一行说明：**画笔**（渐隐 / 晕圈）与**长度**
  （数值框 + 滑块，1–100）。画笔那组的说明删掉「贯穿图面」字样——它属于长度。
  数值框与滑块是**同一个值的两个入口**，照抄 AutoCAD：滑块用来粗调与看范围，数值框用来
  精确给数，两者必须联动。
- 搜索匹配集加入「长度」「臂长」。

## 影响

- 受影响的规范：`editor-preferences`（新增偏好、设置分类的两组）、`editor-workspace-layout`
  （会话开关不再含臂长）。
- 受影响的代码：`packages/editor/src/editor-preferences/*`、
  `packages/editor/src/workspace-layout/workspace-definition.ts`、
  `packages/editor/src/editor-controller/controller.tsx`、
  `packages/editor/src/compose-editor/compose-editor.tsx`、`packages/editor/src/editor-i18n.ts`。
- 受影响的用例：`e2e/builtin-workspaces.spec.ts` 断言三边臂长相等，改为不再从工作区读它。
