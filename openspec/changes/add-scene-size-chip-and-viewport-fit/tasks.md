# 任务：场景标签尺寸胶囊、尺寸弹框与视口适配

## 1. core：共享尺寸预设

- [x] 1.1 `core/src/frame.ts` 导出 `ComposeSceneSizePreset`、`COMPOSE_SCENE_SIZE_PRESETS`
      与 `findComposeSceneSizePreset`，并从 `core/src/index.ts` 公开
- [x] 1.2 单测：反查命中/未命中、列表为六个既有分辨率
- [x] 1.3 `materials/frame/frame-inspector.tsx` 改为消费 core 常量，下拉标签与既有一致

## 2. Stage：尺寸胶囊

- [x] 2.1 `container-labels.ts` 的 `ComposeContainerLabel` 增加 `size`，取自 `Frame.size`
- [x] 2.2 `container-label-layer.tsx` 在激活标记后渲染尺寸胶囊，pointerdown 阻断冒泡，
      双击打开弹框；锁定态与重命名输入态结构不变
- [x] 2.3 `styles.css` 增加胶囊样式（flex 不收缩，与既有控件同一套色板）
- [x] 2.4 `stage-i18n.ts` 增加胶囊与弹框文案（zh-CN / en-US）
- [x] 2.5 锁定态标签改为保留播放、激活标记与尺寸胶囊：名称退成 `is-locked` 只读 span，
      尺寸胶囊 disabled 且双击不开弹框
- [x] 2.6 单测：胶囊显示当前尺寸、双击打开弹框、pointerdown 不触发选中与重命名、
      锁定场景仍显示三个控件且胶囊只读

## 3. Stage：场景尺寸弹框

- [x] 3.1 新增 `scene-size-dialog/` 功能目录（实现、类型、index、测试）
- [x] 3.2 预设选择写入草稿、自定义输入、非法值禁用确认、每次打开重置草稿
- [x] 3.3 单测：预设→确认、自定义→确认、非法值禁用、取消不提交、重开重置

## 4. Stage：视口适配

- [x] 4.1 新增 `stage-surface/viewport-fit.ts` 纯函数，抽自键盘路径的 `fitViewport`
      并由键盘路径、尺寸提交与首次适配共用
- [x] 4.2 `compose-stage.tsx` 提交 `entity.frame.size.set` 后按**新尺寸**适配
- [x] 4.3 `compose-stage.tsx` 首次有效 surface 测量后对激活场景适配一次；
      新增 `autoFitActiveFrame` 属性（默认开启）
- [x] 4.4 单测：viewport-fit 纯函数（居中、留白、缩放钳制、非正尺寸返回 null）

## 5. 验证与文档

- [x] 5.1 `bun run lint && bun run typecheck && bun run test && bun run build`
- [x] 5.2 `bun run test:e2e`；更新因初始视口适配与尺寸胶囊而变化的黄金图；
      依赖确定性取景的既有用例改用示例应用的 `?no-auto-fit`（新增 `autoFitActiveFrame`
      controller 选项后由 app 透出）
- [x] 5.3 e2e：双击尺寸胶囊 → 选预设 → 场景尺寸与视口同时变化
- [x] 5.4 同步 AGENTS.md 场景段落（尺寸胶囊是第二个入口、首次进入适配激活场景）
