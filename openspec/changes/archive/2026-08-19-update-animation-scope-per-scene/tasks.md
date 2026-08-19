# 任务

## 1. 动画文件协议按场景分区（`packages/animation`）

- [x] 1.1 `ComposeAnimationFile` 从单条 `animation` 改为按 Frame id 分区的清单集合；
      `COMPOSE_ANIMATION_FILE_SCHEMA_VERSION` 升到 2。
- [x] 1.2 解析、序列化与默认构造器跟随；解析对未知版本、非法分区键与非法清单返回结构化 issue。
- [x] 1.3 新增 `migrateComposeAnimationFileV1ToV2(input, frameId)` 显式单向迁移（纯函数，
      不修改输入）；普通解析对 v1 返回 legacy issue。
- [x] 1.4 单测：多分区往返、迁移、非法输入、只取目标分区。

## 2. 会话按 Frame 分桶（`packages/editor/src/pages/use-page-workspace.ts`）

- [x] 2.1 `animationFrameId/animationEntryId/animationRevision/animationManifest` 四个标量
      改为按 frameId 索引的映射。
- [x] 2.2 打开页面：读一次文件，把各分区水合进对应 Frame 的 `Animations.items` 镜像。
- [x] 2.3 `setPageAnimation` 的目标 Frame 改为调用方传入的作用域 Frame，不再用会话固定值。
- [x] 2.4 保存回写：遍历所有有镜像的 Frame，合并成一份文件写回；镜像被撤销移除时跳过该分区
      而不是删除文件。
- [x] 2.5 单测：两块场景各自绑定、合并回写、解除其一不影响其二。

## 3. 作用域跟随选中（`packages/editor/src/compose-editor/compose-editor.tsx`）

- [x] 3.1 `animationScopeFrameId` 改为 `resolveTargetFrameId(document, selectedIds, activeFrameId)`，
      去掉会话固定值优先。
- [x] 3.2 时间线、文件选择器、`useAnimationMode`、关键帧 Inspector 全部复用该结果（已在
      `update-scene-container-parity` 中统一到一处，这里只改解析规则）。
- [x] 3.3 时间线头部显示当前作用域场景名。

## 4. 预览与发布只取目标分区（`packages/preview`）

- [x] 4.1 确认预览按 `frameId` 读取该 Frame 的镜像清单，不受同文件其他分区影响；补齐缺口。

## 5. 文档与验证

- [x] 5.1 `README.md` / `AGENTS.md` / `openspec/project.md` 同步：一页一份动画文件、按场景
      分区、作用域跟随选中；并写明**脚本保持页面级**这个刻意的不对称。
- [x] 5.2 `bun run lint && bun run typecheck && bun run test && bun run build`
- [x] 5.3 新增 e2e：两块场景各自建动画并保存重开仍在；选中场景 B 的对象时间线切到 B；
      清空选择回到激活场景；解除 B 的绑定不影响 A。
- [x] 5.4 `bun run test:e2e`（含受影响黄金图重出并逐张确认）
- [x] 5.5 `openspec archive update-animation-scope-per-scene --yes` 后
      `openspec validate --all --strict`

## 6. 实施中发现并一并修掉的既有缺陷

- [x] 6.1 **清单写入抹掉动画文件绑定。** `manifestPatch` 以整个 `Animations` Component 写入
      却只写 `items`，任何 create/delete/configure 都会把该 Frame 的 `source` 抹掉。页面保存的
      是文档，绑定因此丢失，下次打开水合不出任何清单。修复：写入时带上既有 `source`，
      并补 `animation-commands.test.ts` 回归（回退即变红）。
- [x] 6.2 **保存覆盖会话中途写入的绑定。** `Animations.source` 住在文档里，却由
      `setFrameAnimation` 这条页面文件写入产生，运行时文档并不知道；保存直接写运行时文档就
      把刚绑好的引用覆盖掉。表现是第二块场景建动画时找不到既有文件，多造出一份
      `Home 2.animation.json`。修复：保存前按 Frame 把页面文件里的 `source` 补回待存文档。
- [x] 6.3 **第二块场景建动画会另造文件。** 空态创建引导无条件新建文件，撞上同名就退化成
      `Home 2.animation.json`。修复：页面已有绑定时复用那一份，只在头一次建动画时造文件；
      复用分支补建一条该场景的清单（文件里还没有它的分区）。

## 7. 实施中发现的真实约束

- 绑定动画写的是页面文件，而页面文件里的文档是**上次保存**的那份：刚画出来、尚未保存的场景
  不在其中，Store 会以「不是 Frame」拒绝绑定。与激活场景是同一条约束，e2e 因此在新建场景后
  先保存再建动画。
