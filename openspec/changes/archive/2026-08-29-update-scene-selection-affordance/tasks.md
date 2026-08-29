# 实现任务

## 1. 命中收敛（stage-engine）

- [x] 1.1 `shouldConvergeToMarquee` 删掉 `selectedIds.includes(hit.entityId)` 与
      `childIds.length > 0` 两条例外，并把参数里不再需要的 `selectedIds` 一并移除
- [x] 1.2 `shouldConvergeToMarquee` 增加 `command` 修饰键旁路：按住时不收敛
- [x] 1.3 更新 `marquee-converge-plugin.test.ts`：空场景收敛、已选中场景收敛、
      command 直选、单击清空选区、嵌套容器与 Group 不受影响
- [x] 1.4 更新受影响的 `entity-select-move-plugin.test.ts` 断言

## 2. 框选排除场景（stage-engine）

- [x] 2.1 `resolveMarqueeSelection` 把 `isComposeFrameEntity(entity) && rectContains(...)`
      改成：`rootIds` 直接成员一律排除，其余 Frame 保持既有的「包住框选区则排除」
- [x] 2.2 `marquee-selection.test.ts` 补窗交蹭边、从外面框住、嵌套 Frame 三组用例

## 3. 场景默认外观（core / materials）

- [x] 3.1 `COMPOSE_DEFAULT_SCENE_APPEARANCE.backgroundPaint` 改为
      `DEFAULT_COMPOSE_BACKGROUND_PAINT`（透明 solid），并改写常量注释：删掉「MUST 与
      Container 相同」，写明为什么由用户决定背景、边界为什么改由 chrome 承担
- [x] 3.2 `frame.test.ts` 把「与 Container 同底色」断言换成「背景透明」与「不随 Container
      默认值联动」
- [x] 3.3 `materials/src/frame/preset.tsx` 注释同步；`preset.test.ts` 补场景透明 / 容器不透明
      的对照断言
- [x] 3.4 检查 `page-file.ts` 初始场景与「新建场景」命令，确认没有第二处硬编码底色

## 4. 场景边界描边（stage）

- [x] 4.1 `StageWorldUnderlay` 的 `.compose-stage__output-boundary` 矩形加描边；更新它上面
      那段「这一层不为场景补画任何装饰」的注释
- [x] 4.2 `styles.css` 为 `.compose-stage__output-boundary` 定义描边 token，
      `stroke-width` 恒为 1（该 svg 在屏幕空间，不随 zoom 变粗），保持 `pointer-events: none`
- [x] 4.3 组件测试：描边存在、不随 zoom 变粗、不接收指针事件
- [x] 4.4 检查黄金图与视觉回归基线，按需重新生成（6 张：场景背景透明 + 新增边界描边）

## 5. 端到端

- [x] 5.1 e2e：在空场景体上拖拽产生框选而不是搬走场景（`e2e/scene-selection-affordance.spec.ts`）
- [x] 5.2 e2e：选中场景后在其空白处拖拽仍是框选
- [x] 5.3 e2e：command 点体拖动场景仍然可用；标签拖动不受影响
- [x] 5.4 e2e：新建场景背景透明、边界仍然可见

## 6. 验证

- [x] 6.1 `bun run lint`
- [x] 6.2 `bun run typecheck`
- [x] 6.3 `bun run test`
- [x] 6.4 `bun run build`
- [x] 6.5 `bun run test:e2e`
