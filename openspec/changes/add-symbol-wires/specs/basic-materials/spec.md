# basic-materials 规范增量

## ADDED Requirements

### Requirement: Wire Inspector 显示两端的绑定状态

`Wire` MUST 自带内建 Component Inspector，为两端各显示三种状态之一：自由、已绑到某个端口、
**失效**（绑定指向的实体或端口不存在）。

失效 MUST 与自由可区分。两者的几何都来自作者文档，屏幕上看不出差别，而含义完全不同——一个是
作者本来就没接，另一个是接过的东西没了。这与实例动画把失效的清单引用标出来是同一条判断。

#### Scenario: 三种状态各自可读

- **WHEN** 一条导线一端自由、一端绑定，另一条导线的绑定目标已被删除
- **THEN** Inspector 分别显示自由、已绑定与失效
