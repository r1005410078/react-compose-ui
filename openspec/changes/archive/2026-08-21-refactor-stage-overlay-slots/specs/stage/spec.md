## ADDED Requirements

### Requirement: Overlay 层注册表

Stage Overlay MUST 由一组可注册的层组成，每层是纯呈现——输入是上下文，输出是 SVG 片段，
MUST NOT 持有手势状态或写文档。宿主 MUST 能追加自己的层而不修改 Overlay 本体。

绘制顺序 MUST 由显式的 `order` 数值决定，MUST NOT 依赖代码书写次序。SVG 没有 z-index，
**绘制顺序即命中顺序**：后画的元素压在上面，也先接收指针，因此顺序决定重叠区域归谁。
`order` MUST 两两不同，使顺序完全确定；id 重复时注册 MUST 失败。

两处顺序是硬约束：可编辑路径的顶点 MUST 画在缩放手柄之上——关键帧顶点常与对象角点重合，
压在手柄之下将永远拖不动；吸附参考线 MUST 画在最上层——它是瞬时反馈，被盖住等于没画。

层之间 MUST NOT 共享预先算好的派生包，各层 MUST 自行从上下文换算所需的屏幕几何。

#### Scenario: 宿主追加层

- **WHEN** 宿主传入一个 order 落在两个第一方层之间的层
- **THEN** 它在绘制序列中恰好排在那两层之间

#### Scenario: id 重复被拒绝

- **WHEN** 追加的层与既有层 id 相同
- **THEN** 注册抛错

#### Scenario: 关键顺序不被打破

- **WHEN** 校验默认注册表
- **THEN** 可编辑路径排在缩放手柄之上，吸附参考线排在最上层
