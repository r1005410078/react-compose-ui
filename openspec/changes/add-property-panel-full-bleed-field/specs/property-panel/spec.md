## ADDED Requirements

### Requirement: 贴边整行的自定义 renderer 内容区

系统 MUST 提供第三种自定义 renderer 布局，使内容区在跨越三列的同时不带任何左右内缩，
内容盒的左右边界 MUST 与所在属性行一致。该布局 MUST 是显式 opt-in：renderer 默认布局与
字段 metadata 都可以声明它，metadata 优先于 renderer 默认值；未声明时既有普通三列与全宽
布局的位置 MUST 保持不变。贴边布局 MUST 只影响水平内缩，行的纵向内缩、上边框、背景、
标题行、操作轨道、搜索筛选、只读、重置与受控提交语义 MUST 与全宽布局一致。

#### Scenario: 声明贴边布局的可视化字段

- **WHEN** 一个自定义 renderer 或字段 metadata 声明贴边布局
- **THEN** 该字段在紧凑标题行显示属性名与统一操作，内容区在下一行跨越三列且左右不留内缩
- **AND** 内容盒的左右边界与所在属性行一致

#### Scenario: 未声明贴边的全宽字段保持原位

- **WHEN** 同一面板中另一个字段仍声明全宽布局
- **THEN** 它的内容区继续按属性名列的缩进对齐，位置不因新布局发生变化

#### Scenario: metadata 覆盖 renderer 默认布局

- **WHEN** renderer 默认声明全宽布局而字段 metadata 声明贴边布局
- **THEN** 该字段按贴边布局渲染
