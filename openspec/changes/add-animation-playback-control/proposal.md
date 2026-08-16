# 变更：用页面脚本变量控制动画播放

## 原因

前三个变更让用户能做出动画并在编辑期预览，但运行时没有任何东西能启动它——动画只会在编辑器里
被播放头拖着走。第一阶段用**页面 setup 脚本**提供控制面：把动画的播放状态绑定到 setup 导出的
一个布尔成员，`true` 播放、`false` 停止；或者把播放头直接绑定到一个数值成员，由脚本完全接管
时间轴。事件（`onComplete` 之类）留给后续变更。

## 变更内容

- `editor` 新增动画检查器：在时间线选中动画本身时，右侧属性区显示该动画的名称、时长、
  播放模式与播放控制绑定。这**取代**了 `add-animation-panel-prototype` 里
  "切换动画标签不改变右侧属性区内容"的约束。
- 播放控制绑定复用属性面板既有的绑定入口与变量选择器，持久化为
  `ComposeAnimation.bindings`（由 `add-scene-animation-model` 定义）。
- 定义运行时播放语义：`playing` 的上升沿把播放头复位到 `0` 再推进，下降沿停在当前帧；
  绑定 `currentTime` 时脚本完全接管时间轴，`playing` 被忽略。
- `preview` 按上述语义订阅页面作用域并驱动动画；编辑器的画布在动画模式下仍由手动播放头控制，
  不被脚本抢走。

## 影响

- 受影响规范：`animation-panel`、`editor-workspace-layout`、`compose-preview`、
  `page-script-runtime`
- 受影响代码：`packages/editor/src/animation-mode/`（新增动画检查器与绑定接线）、
  `packages/editor/src/editor-controller/controller.tsx`（Inspector 分支新增动画目标）、
  `packages/preview/src/compose-preview/`、`packages/preview/src/preview-dialog/`
- 依赖 `add-scene-animation-model` 与 `add-animation-mode-binding` 先落地；
  本变更对"编辑器中可见的动画区"的 MODIFIED 建立在后者的版本之上，两者必须按顺序归档
