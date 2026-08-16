## 上下文

项目已有一套完整的"脚本导出 → 属性绑定"链路，本变更不发明新机制，只是把动画接进去：

- `ComposePageScriptScope`（`packages/script-runtime/src/types.ts:122`）暴露具名导出，
  `getExport` 读值、`subscribeExport` 订阅单个导出、`invokeMethod` 调方法。
- 导出是 `{ kind: 'value', value, reactive }` 或 `{ kind: 'method', method }`。
- 持久化引用格式是 `ComposePageExportReference = { scope: 'page', exportName }`
  （`packages/core/src/document-types.ts:251`），`ComposeBindings.rendererProps` 已在用。
- 属性面板的 `PropertyPanelBindingConfig` 提供绑定入口、变量选择器与
  `bind` / `unbind` / `reset` / `remap` 四种变化原因。

## 目标/非目标

- 目标：动画能被页面脚本启动、停止，或整条时间轴交给脚本驱动。
- 目标：绑定的编辑体验与 Renderer Props 绑定一致，用户不需要学第二套。
- 非目标：不做事件回调（`onComplete` / `onLoop`）、不做播放速度、不做状态机、
  不做多动画之间的转换与混合。
- 非目标：不改变编辑器内的手动播放行为——脚本只驱动运行时，不抢编辑期播放头。

## 决策

### 决策：`playing` 的上升沿复位播放头

`false → true` 时先把播放头置 `0` 再开始推进，`true → false` 时停住并保持当前帧。

理由是绑定布尔的主用例是"某个条件满足了，播一次入场动画"，用户期望每次条件重新满足都从头播。
纯 play/pause 语义下这个用例做不到，必须再引入一个复位入口。

代价是 `true → false → true` 无法表达"继续"。这是有意取舍：需要暂停续播的场景可以改用
`currentTime` 绑定自己算时间。已写进"待解决问题"，若实际使用中反馈强烈，再补一个
`resumeOnResume` 之类的开关，而不是现在就把语义做复杂。

### 决策：绑定 `currentTime` 时脚本完全接管，`playing` 被忽略

两种驱动方式同时生效会产生"谁赢"的竞争。规则定死：只要 `currentTime` 绑定存在，
播放头就是该导出的值（钳制到 `[0, durationMs]`），运行时不自行推进，`playing` 不起作用。
检查器在这种状态下把播放绑定入口置为禁用并说明原因，而不是让用户配出一个无效组合。

`playbackMode` 在 `currentTime` 绑定下同样不生效——脚本给什么时间就是什么时间，
循环与往返由脚本自己决定。

### 决策：动画检查器由"时间线选中动画"触发

`controller.tsx:1706-1764` 目前按选择状态分五个 Inspector 分支。新增第六个分支：
动画模式下当前选中的是动画本身（而不是某个对象轨道或属性轨道）时，渲染动画检查器。

这与"选中什么就检查什么"的既有心智一致，也对齐 Rive 的 Timeline Options。
代价是它推翻了 `add-animation-panel-prototype` 里"切换动画标签不改变右侧属性区"那条需求——
那条需求当时的意图是"动画面板不要抢走 Inspector"，现在的规则更精确：
标签切换本身不改变 Inspector，**选中动画**才改变。

考虑过的替代方案：
- **动画模式下常驻在属性面板顶部** —— 永久占高度，且与"选中即检查"不一致。
- **挂在 CanvasInspector 里** —— 零新增分支，但动画藏在一个和它无关的地方，可发现性差。

### 决策：编辑期画布不被脚本驱动

编辑器里播放头是会话状态，由用户拖动或播放按钮控制。如果脚本导出也驱动编辑期画布，
用户拖播放头会和脚本打架。运行时驱动只在 `preview` 生效。

编辑器提供的验证手段是预览对话框——用户改完绑定，开预览就能看到脚本驱动的效果。

### 决策：订阅粒度用 `subscribeExport` 而不是 `subscribe`

`subscribe` 是整个作用域的变更通知，任意导出变化都会触发。动画只关心一到两个导出，
用 `subscribeExport` 避免无关导出的高频变化把动画的重算带起来。

### 决策：值类型不匹配时静默不播，并发一条 diagnostic

`playing` 绑定到一个非布尔导出、或 `currentTime` 绑定到非数值导出时，不抛错、不猜测转换，
按"未绑定"处理并通过 `scope.reportDiagnostic` 报告。运行时渲染不能因为一个坏绑定而崩。

## 风险/权衡

- **`playing` 为 true 时 rAF 常驻**：动画播完（`play-once` 到达末尾）后必须停掉 rAF，
  不能空转。`loop` / `ping-pong` 下确实需要常驻，这是预期成本。
- **`currentTime` 每次变化都要重采样整条动画**：脚本高频写入（比如绑定滚动进度）时
  每帧一次全量采样。先测量；`applyComposeAnimationAtTime` 已经保证未命中的 Entity
  引用不变，下游 memo 能挡住大部分重渲。
- **绑定的导出在脚本热重载后消失**：按未绑定处理并报 diagnostic，不清除文档中的绑定——
  绑定是用户的意图，脚本临时坏掉不该悄悄改文档。
- **预览对话框关闭时必须停掉订阅与 rAF**：与 `add-animation-mode-binding` 里的
  预览播放控件共用同一套生命周期管理，避免两处各写一遍。

## 迁移计划

无。`bindings` 是可选字段，既有文档不含它即不受脚本驱动。

## 待解决问题

- `true → false → true` 无法"继续播放"是本次的有意取舍，需要实际使用后复核。
- 事件回调（`onComplete`、`onLoop`）与播放速度留给后续变更；`bindings` 命名空间已经
  为它们留好位置。
