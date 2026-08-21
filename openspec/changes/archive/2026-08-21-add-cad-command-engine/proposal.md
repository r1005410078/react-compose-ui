# CAD 命令引擎与第一条直线

## Why

按 `docs/cad-document-roadmap.md` 步骤 5：打通第一条可运行的纵向流程——
**敲 `L↵` → 点两下画出一条线 → Ctrl+Z 撤销 → 存盘重开还在**。

这是整条 CAD 路线里**唯一真正从零开始**的部分，其余都是在已有结构上接线。要解决的契约缺口
在步骤 4 之前就已点明：

> **AutoCAD 的命令由键盘启动，不由 `pointer.down` 启动。**

现有插件契约 `claim(event: StagePointerDownEvent, ctx)` 只在指针按下时被询问，表达不了 `L↵`。
更麻烦的是**多步提示循环**（`指定第一点` → `指定下一点或 [闭合(C)/放弃(U)]` → …），而会话是
`update` / `commit` 两态。这层协议不设计，每把工具都会自己发明一遍。

## What Changes

**`@compose-ui/commands` 补上 Layer 2（多步提示会话）。** 步骤 3 刻意只做了 Layer 1，因为
当时没有消费者；现在有了。

- `ComposeCommandPrompt` / `ComposeCommandInput` / `ComposeCommandStep` / `ComposeCommandSession`
- `ComposeCommandDefinition` 与按别名解析文本的 `resolveComposeCommand`（`L` → LINE）
- 效果类型对消费者泛型：本包仍不依赖 `core`，不认识任何文档协议

**`@compose-ui/cad` 补上第一个图元与命令。**

- `CadLine`（两点）与 `CadPlacement`（所属图层）两个 Component，校验一并覆盖
- `cad.entity.add` / `cad.entity.remove` 命令 handler
- `LINE` 命令的**纯状态机**：`指定第一点` → `指定下一点或 [闭合(C)/放弃(U)]` 循环，
  `U` 退回上一个顶点，`Enter` 结束，`Esc` 取消整条命令

**新增 `@compose-ui/cad-canvas`（Layer 3）**：SVG 画布 + 命令行，把指针点与键盘输入喂给命令会话。
含滚轮缩放与中键平移——没有它们「无限图纸」只是句空话。

**`editor` 把 CAD 面板从空态换成真实画布。**

## 本刀不使用交互内核仲裁器

步骤 1 泛型化了仲裁器，本刀却直接由画布驱动命令会话，没有走它。这是**刻意的**：

CAD 目前只有平移、缩放与命令驱动的取点三种输入，彼此不竞争，用仲裁器是纯粹的仪式。而
`activate(command)` 这条入口该长什么样，要等步骤 6 有了选择、对象捕捉与真正竞争的手势才
知道——现在定形就是猜，与步骤 1 刻意不动 `pointerId` 是同一条判断。

**这意味着步骤 1 对 CAD 的收益推迟到步骤 6 兑现**；它当时的另一半价值——三个自称文档无关
却 import 了 Stage 类型的文件被清理并加了守卫——不受影响。

## Impact

- Affected specs: `commands`、`cad-document`
- Affected code: `packages/commands/src/command/`（新增）、`packages/cad/src/`、
  新增 `packages/cad-canvas/`、`packages/editor/src/cad/`
- 不影响 ComposeDocument 路径与既有包行为
