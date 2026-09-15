## MODIFIED Requirements

### Requirement: Stage 复制剪切粘贴

Stage MUST 为当前画布选区提供复制、剪切和粘贴。复制 MUST 把规范化顶层 Entity 写入会话剪贴板且
不修改文档；剪切 MUST 只纳入未锁定来源，并在成功粘贴移动后清空剪贴板。

**粘贴落在指针处。**指针在图面上时，`Cmd/Ctrl+V` MUST 以指针的世界坐标为锚点：整组副本保持
相对位置，整组的世界包围盒中心落到锚点（再过网格吸附），父级取指针下的容器（与拖放落点同一
条判据；剪切时排除来源自己），指针不在任何容器里时落进激活场景。右键菜单的粘贴 MUST 以
**打开菜单那一下**的位置为锚点。指针不在图面上时粘贴 MUST 退回建议落点：可容纳子项的未锁定
容器追加子项，叶节点插到自身之后，空白画布落到激活场景。

Stage MUST NOT 读写系统剪贴板。未注入 `services.clipboard` 的独立 Stage 使用内建内存剪贴板；
宿主提供 `onShortcutAction` 并返回 `true` 时 MUST 停止内建处理，且 Stage MUST 随 `edit.paste`
把同一份落点交给宿主（`detail.pasteTarget`），宿主接管粘贴 MUST 与内建实现落在同一处。
可编辑输入或画布内文字编辑中 MUST NOT 拦截平台复制/剪切/粘贴。

#### Scenario: 键盘粘贴落在指针处

- **WHEN** 用户复制一个对象，把指针挪到图面上另一处并按下 Primary+V
- **THEN** 副本的包围盒中心落在指针处（与网格吸附至多差半步），尺寸与来源一致
- **AND** 来源一个字节不动，副本被选中，撤销一步副本消失

#### Scenario: 右键粘贴落在打开菜单的地方

- **WHEN** 用户复制一个对象后在图面上另一处右键并选择粘贴
- **THEN** 副本的包围盒中心落在右键的位置

#### Scenario: 指针不在图面上时退回建议落点

- **WHEN** 用户复制一个对象，指针离开图面后按下 Primary+V
- **THEN** 副本落在来源旁边（同父级错开），与没有锚点时逐字相同

#### Scenario: 从画布菜单复制并粘贴

- **WHEN** 用户右键可见节点并执行复制，再在空白画布执行粘贴
- **THEN** Stage 提交一次复制事务，新节点位于根级并被选中
- **AND** 再次粘贴仍可生成另一组副本

#### Scenario: 剪切后粘贴清空剪贴板

- **WHEN** 用户剪切有效选择并粘贴到建议落点
- **THEN** 来源被移动到新位置且剪贴板被清空
- **AND** 再次粘贴不产生事务

#### Scenario: 使用平台主修饰键

- **WHEN** Stage 聚焦且用户按下默认 Primary+C / Primary+X / Primary+V
- **THEN** Stage 分别执行复制、剪切和粘贴
- **AND** 右键菜单在 macOS 显示 ⌘C/⌘X/⌘V，其他平台显示 Ctrl+C/Ctrl+X/Ctrl+V
- **AND** 裸 `C` 仍切换容器绘制工具

#### Scenario: 可编辑目标保留系统剪贴板

- **WHEN** 焦点位于 input、textarea 或画布内文字编辑
- **THEN** Primary+C/X/V 不执行 Entity 复制、剪切或粘贴

#### Scenario: 宿主经 services 提供共享剪贴板

- **WHEN** 宿主通过 `services.clipboard` 注入共享快照并执行复制
- **THEN** 写入经 `services.onClipboardChange` 通知宿主
- **AND** 粘贴可用性与聚合前的平铺 `clipboard` 行为一致
