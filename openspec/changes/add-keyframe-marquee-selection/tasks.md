# 任务：时间线关键帧框选与批量移动、删除

- [x] 1.1 `animation-panel` 类型：`selectedKeyframeIds` 替换 `selectedKeyframeId`；`select` 动作改
      `keyframeIds`；新增 `move-keyframes` / `remove-keyframes` 动作类型，TSDoc 说明与
      `move-keyframe` 的分工
- [x] 1.2 模型：`resolveComposeAnimationMarqueeSelection` 纯函数与单测（跨轨道、擦边算碰到、
      未渲染的不参与）
- [x] 1.3 模型：`moveComposeAnimationKeyframes(value, ids, deltaMs)` 整组钳制（越界、与同轨道未
      选中帧的时间冲突）与单测；删除轨道 / 删除对象轨道时从集合里清掉悬空 id
- [x] 1.4 Provider：`selectKeyframe` 支持替换 / 切换两种模式，新增 `selectKeyframes`、
      `moveKeyframes`、`removeSelectedKeyframes`；`selectedKeyframe` 收窄为恰好一个成员时有值
- [x] 1.5 时间线：车道空白处的框选手势（pointer capture 在 scale 容器上、按下点未离开即还原成
      属性轨道点击、`Shift` 累加、矩形覆盖层）
- [x] 1.6 时间线：关键帧按下不收敛选区、松手未移动才收敛；拖动与 ArrowLeft/ArrowRight 作用于
      整个选区；`Delete` / `Backspace` 删除选区；右键菜单按成员数换条目
- [x] 1.7 字段面板：多选显示「已选 N 个关键帧」，不显示单帧字段；i18n 两种语言
- [x] 1.8 `editor`：`use-animation-mode` 会话状态改为数组；`translateAnimationPanelAction` 翻译
      `move-keyframes` / `remove-keyframes` 成共享 `mergeKey` 的命令，单测断一次事务
- [x] 1.9 组件测试（Testing Library）：框选跨两条轨道选中三个关键帧；`Shift` + 点切换；从多选
      中拖动一个成员其余跟着走；`Delete` 发出一个 `remove-keyframes`
- [x] 1.10 端到端：两条轨道各打两帧，框选后整体拖 40 ms（对每一档吸附步长都整除），撤销一步全部回去；再框选后 `Delete`，
      撤销一步全部回来
- [x] 1.11 `AGENTS.md` 补一句：时间线的关键帧选区是集合，单选是退化情形
- [x] 1.12 `bun run lint` / `typecheck` / `test` / `build` / `test:e2e`
