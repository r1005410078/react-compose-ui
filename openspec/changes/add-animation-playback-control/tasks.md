> 前置已完成：`add-animation-panel-prototype` 已归档，其需求已进入
> `openspec/specs/animation-panel/`，因此本变更以 MODIFIED 精确取代
> "切换动画标签不改变右侧属性区"那条，而不是留下互相矛盾的 ADDED。
> 该 MODIFIED 建立在 `add-animation-mode-binding` 的版本之上，两者必须按顺序归档。

## 1. 运行时播放语义（纯函数优先）

- [x] 1.1 Red：`animation-playback-model` 的纯函数测试——上升沿复位、下降沿停在当前帧、
  `play-once` 到末尾停止、`loop` / `ping-pong` 的边界折返、`currentTime` 钳制到
  `[0, durationMs]`、`currentTime` 存在时忽略 `playing` 与 `playbackMode`。
- [x] 1.2 Green：实现播放状态机纯函数——输入是上一帧状态、绑定读数与经过的毫秒，
  输出下一个播放头与是否继续推进。不碰 React、不碰 rAF。
- [x] 1.3 Red/Green：绑定失效（导出不存在、类型不符）按未绑定处理并产出诊断，不抛错。

## 2. preview 接线

- [x] 2.1 Green：在 `ComposePreview` 中用 `scope.subscribeExport` 订阅绑定的导出，
  单导出粒度，不用整作用域 `subscribe`。
- [x] 2.2 Green：把播放状态机接上 rAF；`play-once` 到达末尾时停掉循环，不空转。
- [x] 2.3 Red：卸载与作用域释放时取消订阅、停止推进，断言不再有回调。
- [x] 2.4 Green：与 `add-animation-mode-binding` 的预览播放控件共用同一套生命周期管理，
  不要两处各写一遍 rAF 与清理。
- [x] 2.5 Red/Green：无绑定的动画停在 0 ms 且不推进。

## 3. 动画检查器

- [x] 3.1 Red：选中动画显示检查器、切换标签但未选中动画时属性区不变、
  选回对象轨道恢复原 Inspector、修改播放模式可撤销。
- [x] 3.2 Green：在 `controller.tsx:1706-1764` 的 Inspector 分支中新增动画目标分支。
  实际落点是 `compose-editor.tsx` 的 `resolvedInspectorPanel`：动画模式会话（选中片段）
  只存在于该层，controller 不感知动画；与菱形注入（4.7）同一判据同一层。
  "选中动画本身"的载体是时间线片段：面板的 selectTrack 不再连带选中片段（对象行 ↔
  Entity、片段 ↔ 动画两种选择可区分），片段 → 轨道方向的联动保留。
- [x] 3.3 Green：实现 `packages/editor/src/animation-mode/animation-inspector.tsx`，
  用 Valibot Schema 描述名称 / 时长 / 播放模式，改动派发 `animation.configure`。

## 4. 播放控制绑定编辑

- [x] 4.1 Red：绑定播放到布尔导出后写入 `bindings.playing`、候选按语义过滤、
  绑定 `currentTime` 后播放行禁用并说明原因、解绑可撤销。
- [x] 4.2 Green：把检查器接上 `PropertyPanelBindingConfig`——`variables` 来自页面作用域快照，
  `onChange` 的四种原因映射到 `animation.configure` 的绑定字段写入。
- [x] 4.3 Green：用 `canBind` / `isTargetEnabled` 实现语义过滤：
  `playing` 只接布尔导出，`currentTime` 只接数值导出。
  禁用 playing 用的是"该状态下不开放绑定 metadata + 始终可见的接管说明"而不是
  `isTargetEnabled`——后者只授权 metadata 之外的字段，压不掉已显式开启的入口。
- [x] 4.4 新增 i18n 文案：播放、当前时间、脚本已接管时间轴的禁用说明。

## 5. 编辑期隔离

- [x] 5.1 Red：绑定布尔为 `true` 时用户拖动编辑期播放头，断言画布跟随用户而非脚本。
  由既有测试"播放头驱动画布且不产生命令"承载：编辑期画布只跟随会话播放头。
- [x] 5.2 Green：确认脚本驱动只在 `preview` 生效，编辑器的动画模式播放头不订阅导出。
  结构性成立：`useAnimationMode` 不接收脚本作用域输入，编辑期不存在被脚本驱动的通路；
  脚本驱动实现整体位于 `packages/preview/src/playback/`。

## 6. 示例与文档

- [ ] 6.1 在 `app/` 的集成示例里加一个最小可跑的例子：setup 导出一个布尔，
  绑定到动画播放，预览中可见。
- [ ] 6.2 `README.md` 完成度说明同步——动画控制第一阶段（脚本）已可用，事件仍未实现。

## 7. 验证

- [ ] 7.1 各包 `test` / `typecheck` / `lint` / `build`。
- [ ] 7.2 仓库根 `bun run lint && bun run typecheck && bun run test && bun run build`。
- [ ] 7.3 `bun run test:e2e`：创建动画 → 打点 → 绑定播放变量 → 开预览 → 动画自动播放。
- [ ] 7.4 `openspec validate add-animation-playback-control --strict`。
