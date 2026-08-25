## REMOVED Requirements

### Requirement: 框选工具快捷键

**Reason**: 该动作 `stage.marqueeTool` 与它切换的 `marquee` 工具都已在「工具集只保留没有别的入口的动作」一刀里删除，仓库里今天一个引用都没有；剩下的「不改变当前框选判定模式」在判定模式删除之后同样失去指称。一条 MUST 同时指向两个不存在的东西，留着比删掉更容易误导。

**Migration**: 无。`select` 在空白处拖拽本来就是框选。
