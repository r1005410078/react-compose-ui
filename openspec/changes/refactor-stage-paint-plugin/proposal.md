# 变更：把渐变控制柄拖拽拆成交互插件

## 原因

[路线图](../../../docs/stage-plugin-kernel-roadmap.md) 步骤 3 按优先级自上而下的第六刀
（`paint`，1300）。

这一刀顺带消掉一处**已经存在的重复**：`paint-sample` 抽取时把「世界坐标 → Paint 归一化局部
坐标」的换算原样内联进了 `samplePaintAt`，与 controller 里的 `paintAtLocalPoint` 是同一段
逆世界矩阵除以 resolved 尺寸。paint 插件需要同一段换算，因此把它连同 `updatePaintFromPointer`
一起提到 `paint-geometry.ts`，两个插件共用——否则这次抽取会把重复变成三份。

## 变更内容

- 新增 `paint-plugin.ts`，优先级 1300 取自 `STAGE_GESTURE_PRIORITY`，登记进
  `STAGE_EXTRACTED_PLUGIN_FACTORIES`。
- 新增 `paint-geometry.ts`：`paintSpacePoint`（原 `paintAtLocalPoint`，按返回值改名——它返回的
  是局部点不是 Paint）与 `updatePaintFromPointer` 随插件迁出 controller，`paint-sample` 改用
  前者，删除内联的同段换算。
- 接管条件不满足（未打开 Paint 编辑、选区不止一个、目标被锁）时返回 `consumed` 而非 `null`：
  控制柄压在 Entity 自己身上，放行会让这次按下退化成一次移动手势。
- `isCompatibleWith` = 空间基线成立 + `paintEditing` 仍指向该 Entity + 选区恰好是它。基准 Paint
  是按下当刻从 Appearance 取的副本，并发文档变化后提交等于用过期基准覆盖别人的编辑。
- `paintHandlesFor` **留在 controller**：它是快照派生字段的计算，不属于手势。

## 影响

- 受影响的规范：`stage-engine`（无 DOM Paint 编辑与图层采样会话）
- 受影响的代码：`interaction-kernel/paint-plugin.ts`（新增）、`paint-geometry.ts`（新增）、
  `interaction-kernel/paint-sample-plugin.ts`、`interaction-kernel/extracted-plugins.ts`、
  `interaction-kernel/index.ts`、`interaction-controller.ts`
