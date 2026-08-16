# 变更：拖动文字高度手柄转为 Fixed，对齐 Figma

## 原因

Text 的宽高默认都是 Hug（随内容自适应），且声明了 `heightDependsOnWidth`（换行会让内容变高）。
Stage 的 resize 手柄预览阶段（`transformedSelection`，`packages/stage-engine/src/interaction-controller.ts`）
因此对所有 Hug 高度的 Entity 一律丢弃拖拽产生的高度变化，回填原有高度——这是为了保护"拖窄后重新
换行变高，若被写死会被自己的框裁掉"这个场景（`基础组件.spec.md` 已文档化）。

但这个保护目前不区分具体拖的是哪个手柄：用户专门去拖顶部/底部（纯高度）手柄、明确想要一个固定高度
时，改动同样被无声丢弃，表现为"怎么拖都拖不高"，没有任何反馈。这与 Figma 的行为不一致——Figma 的
Auto Height 文字宽度可拖（触发重排），但专门拖高度手柄会自动切换成 Fixed Size 并应用新高度。

已确认命令层（`packages/core/src/builtin-commands.ts` 的 `appendSpatialTransformPatches`）和
Stage 手势提交阶段（`interaction-controller.ts` 里 `finished.type === 'resize'` 分支）已经按
`handle.includes('n'|'s')` 正确识别"这次改没改高度"并据此把 `LayoutItem.height.mode` 写成
`fixed`——只是预览阶段先一步把值丢弃，下游代码从未收到真正被拖过的值。

## 变更内容

- `transformedSelection`/`transformedResizeSelection`（`stage-engine`）新增 `handle` 参数：当
  正在拖的手柄是纯高度手柄（`n`/`s`）时，不再无条件保留 Hug 高度，让拖拽产生的高度值进入预览与
  提交流程；拖宽度或对角手柄时行为不变（继续保留 Hug 高度，交给内容重排）。
- 不改动命令层：`appendSpatialTransformPatches` 已经会在高度值真的变化时把 `height.mode` 写成
  `fixed`，无需重复实现。
- 更新 `basic-materials` 规范中"内建 Text 物料"需求的文字，明确按手柄区分这两种行为，并新增一条
  拖动纯高度手柄的场景。

## 影响

- 受影响规范：`basic-materials`
- 受影响代码：`packages/stage-engine/src/interaction-controller.ts`
- 不涉及 Schema 变更、不引入新依赖；`LayoutItem.height.mode` 的 `fixed` 值已存在，只是文字之前
  没有拖拽路径能触达它
