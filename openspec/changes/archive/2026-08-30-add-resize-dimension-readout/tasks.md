## 1. 几何

- [x] 1.1 `resizeReadoutPoints(bounds, handle, nextBounds)` 纯函数：原点 = 冻结盒的对角，
      落点 = 新盒上手柄那一侧的角
- [x] 1.2 单元测试：八个手柄各自的原点与落点；`cartesian` 读数恒等于新盒的宽高

## 2. 快照通道

- [x] 2.1 `StageInteractionSnapshot.resizePreview`（`{ origin, point } | null`）
- [x] 2.2 `resize-plugin` 每次 `publish` 带上它；`commit` / `cancel` 回 null
- [x] 2.3 单元测试：拖角手柄、拖边手柄、松手后为 null

## 3. 渲染

- [x] 3.1 Stage 由 `resizePreview` 组装 `resolveStageDynamicInput` 的入参（`cartesian`，
      两个字段恒 `idle`）
- [x] 3.2 来源互斥：`draftingSession.dynamicInput ?? resizeReadout`
- [x] 3.3 单元测试：读数不挂光标条、不挂锁；量值不出负数；框位置跟着缩放走

## 4. 端到端

- [x] 4.1 拖角手柄时宽高两个数出现，值等于选区框
- [x] 4.2 拖边手柄时两个数都在，其中一个不动
- [x] 4.3 松手后读数消失（并入 4.1）
- [x] 4.4 读数取吸附之后的包围盒（拖 43，读数是 688）

## 5. 验证

- [x] 5.1 `bun run lint` / `typecheck` / `test` / `build`
- [x] 5.2 `bun run test:e2e`

## 备注

- 4.4 原写「非 100% 缩放下断言」，改成吸附断言：读数是**世界量**，与 `zoom` 无关，缩放只挪框的
  位置——那一条由 `resize-readout.test.ts` 的「框位置跟着视口缩放走」覆盖，端到端再抄一遍不
  增加判别性。
