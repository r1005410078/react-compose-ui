## 1. 协议

- [x] 1.1 `ComposeCommandPrompt.fields`（`absolute` / `polar` / `cartesian`）

## 2. core 数学

- [x] 2.1 `composePointToFields` / `composeFieldsToPoint`
- [x] 2.2 `applyComposeFieldOverride`（含 `cartesian` 的符号沿用）
- [x] 2.3 用例：正反算互逆、覆盖一个字段另一个不动、量值与符号

## 3. 命令声明字段

- [x] 3.1 第一个点 `absolute`；`RECTANGLE` 对角点 `cartesian`；其余 `polar`
- [x] 3.2 用例：各命令各步的 `fields`

## 4. 命令行

- [x] 4.1 `onTextChange`
- [x] 4.2 `onFieldAdvance` 接管 `Tab`
- [x] 4.3 组件测试

## 5. 标注几何

- [x] 5.1 `dynamic-input-geometry.ts` 纯函数（三种参数化 + 断开 + 短标注退化）
- [x] 5.2 单元测试：断点落在标注线上、弧半径等于长度、框在中点、短标注不断开

## 6. Stage 接线

- [x] 6.1 活动字段与锁定状态；取到点后清空
- [x] 6.2 锁定在解算之后生效
- [x] 6.3 裸数字 = 活动字段值；完整坐标仍优先
- [x] 6.4 覆盖层渲染

## 7. 测试

- [x] 7.1 组件测试：取第二点时两个数值出现且与落点一致
- [x] 7.2 组件测试：`100` 回车 = 直接距离输入
- [x] 7.3 组件测试：`260` Tab 之后长度锁死
- [x] 7.4 端到端：画线时长度角度可见、锁定后指针跑远几何不跟

## 8. 验证

- [x] 8.1 `bun run lint` / `typecheck` / `test` / `build`
- [x] 8.2 `bun run test:e2e`
