# 任务

## 1. 共享点阵与取整

- [x] 1.1 Red：在 stage-engine 补纯函数测试——同一 step/offset/zoom 下，标尺点阵是网格点阵的
      子集；落点以世界坐标为左边界覆盖 1 CSS px，且首线按设备像素取整
  - Red command/result/reason：`bun run --filter @compose-ui/stage-engine test`；5 failed；
    `createAxisLattice is not a function`，共享点阵尚不存在，符合预期。
- [x] 1.2 Green：抽出 `createAxisLattice`、`latticeLinePosition`、`latticeLineBand`，
      `createRulerTicks` 与 `createVisibleGridAxis` 改为共用
  - Green command/result：`bun run --filter @compose-ui/stage-engine test`；41 passed。
  - 行为变化：网格首线现按设备像素取整，`createVisibleGridAxis` 在 dpr 1 下 screenOffset
    由 1.25 变为 1；已更新 `grid-rendering.test.ts` 并补 dpr 2/4 用例。
- [x] 1.3 Refactor：确认 stage-engine 未引入 DOM 依赖，公共入口补 TSDoc
  - Result：`bun run lint`（含 check:architecture）与 `bun run typecheck` 通过。

## 2. Canvas 标尺

- [x] 2.1 Red：补组件测试——容器保留 test ID 与 ARIA、canvas 为 aria-hidden、不再输出逐刻度节点
  - Red command/result/reason：`bun run --filter @compose-ui/stage test`；
    `Failed to resolve import "./ruler-painter"`，painter 尚不存在。
- [x] 2.2 Green：以 Canvas 2D 重写标尺，绘制主刻度、居中数字、选区标记
  - Green command/result：`bun run --filter @compose-ui/stage test`；49 passed。
  - 绘制几何用记录型假 ctx 单测，不依赖 jsdom canvas。
- [x] 2.3 绘制调度收敛到单次 rAF；指针位置走命令式句柄，不进 React state
- [x] 2.4 移除 SVG 刻度节点与相关 CSS，颜色改为容器 CSS 自定义属性，浅色主题只覆盖变量
  - jsdom 无 ResizeObserver，按仓库既有做法加 `typeof` 保护，并补一次挂载时兜底测量。

## 3. Figma 视觉

- [x] 3.1 数字居中于刻度线，两轴一致（纵向标尺整体旋转后复用同一套几何）
- [x] 3.2 保留细刻度并建立三级层次：细刻度 8px 阈值、数字 48px 阈值，同源于 createAxisLattice
  - 评审反馈「小的颗粒的还是需要的」，撤回最初「只保留主刻度」的设计；细刻度短线、数字刻度
    长线、主网格线上的刻度高亮，三者左边界规则一致。
- [x] 3.3 选区区间高亮重做，保留起止端点与最多两位小数的尺寸数字
- [x] 3.4 新增指针位置游标线，指针离开 Stage 时清除

## 5. 辅助线方向与删除提示

- [x] 5.1 Red：补 stage-engine 手势测试——顶部标尺拖出水平 guide、左侧拖出垂直 guide、
      拖回所属标尺删除、停留标尺内给出删除光标
  - Red command/result/reason：`bun run --filter @compose-ui/stage-engine test`；5 failed；
    创建出的 guide 轴与标尺同向（顶部标尺给出竖线），删除判定同样按错误的轴，`guide-delete`
    光标不存在。
- [x] 5.2 Green：ruler 轴与 guide 轴改为反向映射，创建/移动的删除区判定抽成
      `isInsideOwningRuler`，快照新增 `guideDelete` 并派生 `guide-delete` 光标
  - Green command/result：`bun run --filter @compose-ui/stage-engine test`；47 passed。
- [x] 5.3 自定义删除光标：箭头右下角带红叉的 data-URI，原生 `no-drop` 语义是「不能放」而非
      「会删除」，不适用

## 4. 验证

- [x] 4.1 改写 e2e 中依赖 `data-world-value` 的断言
  - 世界原点对齐改为断言「原点落在画布网格线上」（标尺与网格共用点阵，由单测保证）；
    负坐标可见改为断言滚动条 `aria-valuenow` 落到负值。
- [x] 4.2 新增标尺专项 e2e 与黄金图，覆盖容器语义、选区高亮与游标线
  - 全量黄金图以 `--update-snapshots=all` 重新生成，使其反映 Canvas 标尺而非旧 SVG。
- [x] 4.3 运行 lint、typecheck、test、build、test:e2e
  - `integration.spec.ts:541` 在基线提交 `16a5a43` 上同样失败（场景树面板拦截点击），
    与本变更无关，已 stash 复跑确认。
- [x] 4.4 `openspec validate refactor-stage-ruler-canvas --strict`；valid
  - 规范修正：分数屏幕间距下 CSS 平铺无法逐条对齐设备像素，场景改为「两者仍落在同一位置、
    抗锯齿表现一致」，不再承诺全缩放下每条线都不模糊。
