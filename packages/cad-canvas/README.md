# @compose-ui/cad-canvas

AutoCAD 风格的 CAD 编辑画布：SVG 图面 + 命令行。

**命令由键盘启动**——键入 `L↵` 开始画线，随后画布上的点击成为命令的一步输入。画布只负责把
指针点与键盘输入归一化后转发给命令会话，不理解任何命令有几步：状态机住在
`@compose-ui/cad`，协议住在 `@compose-ui/commands`。

无限图纸：滚轮缩放、中键平移，没有画布边界。
