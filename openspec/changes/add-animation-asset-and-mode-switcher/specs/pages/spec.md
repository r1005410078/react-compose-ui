## ADDED Requirements

### Requirement: 页面动画关联写入

页面文件 MUST 支持可选的动画稳定资源引用（providerId、assetKey、scope）：解析 MUST
容忍字段缺失并归一化为 null（`pageSchemaVersion` 保持 1），序列化 MUST 总是写出该字段，
非 null 时 MUST 校验引用形状。Page Store MUST 以页面文件的 expected revision 原子改写
该引用，支持关联、更换和解除；它 MUST NOT 解析动画文件内容，MUST NOT 根据文件名隐式
猜测动画关系，也 MUST NOT 因解除引用自动删除动画资源。

#### Scenario: 旧页面文件容缺解析

- **WHEN** 解析一个没有动画引用字段的既有页面文件
- **THEN** 解析成功且动画引用归一化为 null，文档与 setupScript 不受影响

#### Scenario: 关联稳定动画引用

- **WHEN** 宿主把一个可引用动画文件关联到页面
- **THEN** Page Store 写入其 providerId、assetKey 与持久性 scope 并返回新页面 revision
- **AND** 动画文件随后重命名或移动不改变页面关联

#### Scenario: 解除动画不删除资源

- **WHEN** 用户解除页面当前动画引用
- **THEN** 页面包装保存 null 且 document 保持不变
- **AND** 原动画文件仍由 Asset Provider 保留
