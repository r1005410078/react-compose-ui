## REMOVED Requirements

### Requirement: 输出区域检查命中

**原因**：v7 删除了「不进入文档的隐式 Canvas 检查目标」，output 命中类型、output selection
effect 与宿主回调三者自那时起就没有任何生产端接线——没有代码产生该命中，也没有宿主传入回调，
`startMarquee` 中的对应分支不可达。场景现在是普通 Entity，点击它走的是常规 entity 命中。

**迁移**：点击场景空白区域由既有 entity 命中与命中收敛规则处理；点击所有场景之外的空白工作区
清空选择，由宿主决定呈现什么（编辑器呈现页面配置面板）。
