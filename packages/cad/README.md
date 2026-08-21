# @compose-ui/cad

无 React、无 DOM 的 CAD 文档协议与资源 Store。

`CadDocument` **复用 ComposeDocument 的 ECS 底座**——Entity 结构、Patch 代数、事务运行时、
Undo/Redo 与序列化全部共用，差异只在校验器与 Component 词汇。因此这里没有第二套事务实现。

CAD 是**无限图纸**：文档不带任何画布或输出尺寸，也没有 Frame，因此不受
「`Frame.size` 是尺寸唯一事实来源」这条 ComposeDocument 不变量约束。单位固定 `px`。
