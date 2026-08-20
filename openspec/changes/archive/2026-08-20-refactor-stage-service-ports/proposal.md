# 变更：Stage 注入面聚合为 services 与 policy

## 原因

这是 [Stage 插件化内核重构路线图](../../../docs/stage-plugin-kernel-roadmap.md) 的**步骤 1**，
本身不改变任何用户可见行为，只把注入面整理成后续内核可以接收的形状。

当前 Stage 的注入面有两个具体问题：

1. **宿主模式语义被拍平成散装布尔。** `lockGestureParent` 是动画模式钉上去的，
   `marqueeMode` 是框选模式钉上去的。`compose-editor.tsx:2137` 处以
   `...(animationMode.active ? { lockGestureParent: true } : {})` 的条件 spread 表达模式，
   模式本身在 Stage 内部不存在，只剩互不相识的布尔分支。下一个编辑器模式会继续钉。
2. **注入通过 `cloneElement` 完成，覆盖优先级靠注释维持。** `compose-editor.tsx:2123` 用
   `addDefaultElementProps(controller?.stage, {...})` 向 Stage 元素克隆注入九项属性；
   `editor-controller/viewport-bound-panels.tsx:25` 的注释专门叮嘱后来者
   「必须原样透传这些属性，并保持注入值覆盖 controller 默认值的既有优先级」——
   这是注入机制不正规的自白，类型系统对此一无所知。

## 变更内容

- **BREAKING** `ComposeStageProps` 新增 `services` 与 `policy` 两个聚合对象：
  - `services`：宿主拥有的能力端口——`dispatch`、`registry`、`assetResolver`、
    `pageLoader`、`scriptModuleLoader`、`clipboard`、`onClipboardChange`、`layoutRuntime`。
  - `policy`：宿主拥有事实来源、Stage 只消费的开关——`marqueeMode`、
    `lockGestureParent`、`gridVisible`。
- **BREAKING** 上述同名平铺 prop 删除，不提供兼容别名或运行时迁移层
  （与 `docs/vnext-react-api-migration.md` 的既有取向一致）。
- 受控协议与逐帧数据**保持平铺不动**：`document`、`layoutSnapshot`、
  `layoutPreviewSnapshot`、`layoutError`、`viewport`、`tool`、`selectedIds`、
  `activeFrameId`、`scriptScope`、`shortcuts`、`onShortcutAction` 及其 `onChange`。
- `ComposeEditor` 对 Stage 的 `cloneElement` 注入改为显式 prop 组合函数，覆盖优先级
  由类型表达；`controller.stage` 元素入口对直接渲染它的宿主保持可用。
- 动画模式改为组装一个 `policy`，而不是条件 spread 一个布尔。
  运动路径相关 prop 本步不动（属步骤 5）。

## 影响

- 受影响的规范：`stage`（注入面、选择与框选、复制剪切粘贴）、
  `editor-workspace-layout`（资源拖入桥接、Stage 属性组合）
- 受影响的代码：
  - `packages/stage/src/types.ts`（`ComposeStageProps` 聚合两个对象）
  - `packages/stage/src/stage-surface/compose-stage.tsx`（读取点改为 `services.*`/`policy.*`）
  - `packages/editor/src/compose-editor/compose-editor.tsx:2123`（删除 Stage 的
    `addDefaultElementProps`，改显式组合；动画模式组装 policy）
  - `packages/editor/src/editor-controller/controller.tsx`（暴露可组合的 stage props）
  - `packages/editor/src/editor-controller/viewport-bound-panels.tsx`（透传注释随机制删除）
  - `app/`、`apps/storybook/` 的 Stage 用例与相关单测、e2e 调用点
