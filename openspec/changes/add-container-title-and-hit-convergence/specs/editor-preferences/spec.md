## MODIFIED Requirements

### Requirement: 可配置绘制与变换工具快捷键

Editor Preferences MUST 将 select、move、scale、rotate、pan、container、rectangle、line、arrow、circle 与 text
工具动作纳入同一份可配置 shortcut action map，并对同一 scope 使用现有冲突检测。默认触发键 MUST 与 toolbar
tooltip、shape menu 和设置面板显示的键位一致；输入与 IME 隔离规则保持不变。
`stage.drawContainerTool` 的默认键位 MUST 为 `F`，与 Frame/Artboard 的业界约定一致；被它让出的
视口动作 `stage.fitSelection` 默认键位 MUST 迁移到 `Shift+2`，`stage.fitContainer` 的 `Shift+F`
MUST 保持不变。旧偏好中的自定义键位 MUST NOT 因默认值变化被覆盖。

#### Scenario: 使用默认工具快捷键

- **WHEN** Stage 获得焦点且用户按下某一默认工具快捷键
- **THEN** controller 请求切换到对应工具且默认 toolbar 的 pressed 状态同步
- **AND** 该快捷键不会产生文档事务

#### Scenario: 默认键位下 F 切换容器工具

- **WHEN** 焦点不在文本输入且用户按下 `F`
- **THEN** Stage 工具切换为容器绘制工具
- **AND** `Shift+2` 触发缩放到选中，`Shift+F` 仍触发缩放到容器

#### Scenario: 拒绝工具快捷键冲突

- **WHEN** 用户在 Settings 中尝试把两个相同 scope 的工具动作绑定为同一按键组合
- **THEN** Preferences 返回现有稳定冲突标识并拒绝该绑定
- **AND** 已保存的其他快捷键保持不变
