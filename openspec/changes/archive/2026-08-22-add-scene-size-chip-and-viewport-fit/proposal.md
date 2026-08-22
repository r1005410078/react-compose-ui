# 变更：场景标签尺寸胶囊、尺寸弹框与视口适配

## 原因

场景（根 Frame）的尺寸是大屏搭建里最先要确认、也最常改的一件事，但现在只能在选中场景后
从 Inspector 的「场景」分组里读和改。画布上没有任何地方显示「这块场景是多大」，用户必须先
选中、再看右侧面板，才能回答一个应该一眼看见的问题。

同时，视口没有任何「对齐到内容」的起点：编辑器每次进入都停在固定的 `{x: 80, y: 64, zoom: 1}`。
1280×720 的场景在 100% 缩放下超出可视区域，用户进来第一件事永远是手动缩放和平移。改尺寸
之后同样如此——把场景从 1280×720 改成 3840×2160，画布上只会看到它的左上角。

## 变更内容

- 场景标签在名称与激活标记之后增加一个**尺寸胶囊**，常驻显示该 Frame 的 `Frame.size`。
  它与播放按钮、激活标记一样在 `pointerdown` 阶段阻止冒泡，不参与名称的选中与重命名判定。
- **锁定场景的标签保留全部三个控件**：此前锁定态标签只剩一个名字 `<span>`，播放与激活标记
  一并消失。锁保护的是场景的内容与几何，而「它是谁、多大、是不是发布目标」恰恰是用户
  判断要不要解锁的依据。锁定只收走改这块场景的入口：名称不再可选中/重命名，尺寸胶囊只读。
  场景默认**不**锁定，锁定始终是用户的显式选择。
- **双击尺寸胶囊**打开场景尺寸弹框：左侧是常见分辨率预设，右侧是自定义宽高输入；确认后
  以 `entity.frame.size.set` 提交一次可撤销事务。
- 尺寸提交成功后 Stage **对该场景做一次视口适配**，使新尺寸整体可见。
- Stage **首次布局就绪**时对**激活场景**做一次视口适配，替代固定初始视口。该行为可由宿主
  通过 `autoFitActiveFrame` 关闭。
- 常见分辨率预设从 `@compose-ui/materials` 的 Frame Inspector 私有常量上移为
  `@compose-ui/core` 的公开常量，Stage 与 Inspector 共用同一份事实来源——同一组预设出现在
  两个入口，不能各写一份。

## 影响

- 受影响的规范：`stage`（场景标签的激活与预览入口、新增两条需求）、`compose-document`
  （新增场景常见尺寸预设常量）、`editor-workspace-layout`（controller 透传首次适配）
- 受影响的代码：
  - `packages/core/src/frame.ts`（`COMPOSE_SCENE_SIZE_PRESETS`、`findComposeSceneSizePreset`）
  - `packages/stage/src/container-label-layer/`（尺寸胶囊几何与渲染）
  - `packages/stage/src/scene-size-dialog/`（新增功能目录）
  - `packages/stage/src/stage-surface/viewport-fit.ts`（新增：适配几何纯函数，抽自键盘路径）
  - `packages/stage/src/stage-surface/compose-stage.tsx`（尺寸提交 + 适配、首次适配）
  - `packages/stage/src/types.ts`、`packages/stage/src/stage-i18n.ts`
  - `packages/materials/src/frame/frame-inspector.tsx`（改为消费 core 常量）
  - `packages/editor/src/editor-controller/controller.tsx`（`autoFitActiveFrame` 选项透传）
  - `app/src/StageDemo.tsx`（示例宿主用 `?no-auto-fit` 演示关闭自动适配）
  - 相关单测与 e2e 黄金图（初始视口从固定值变为适配激活场景；依赖确定性取景的既有
    用例改走 `?no-auto-fit`）

## 非目标

- 不改变尺寸数值本身在 Inspector 几何分组里的唯一编辑位置；尺寸胶囊是**第二个入口**而非
  第二份事实来源，两者都只派发 `entity.frame.size.set`。
- 切换页面时的视口行为不在本次范围内：适配只在 Stage 首次布局就绪时发生一次。
