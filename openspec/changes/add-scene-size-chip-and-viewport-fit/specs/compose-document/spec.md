## ADDED Requirements

### Requirement: 场景常见尺寸预设

`@compose-ui/core` MUST 导出一组只读的场景常见尺寸预设，作为编辑器各入口共用的唯一事实
来源。每个预设 MUST 具备稳定 id、正有限 `size`，以及可选的公认通名（如 `Full HD`）。
core MUST 同时导出按尺寸反查预设的纯函数，尺寸不匹配任何预设时返回 `null`。

预设列表 MUST 与既有 Frame Inspector 呈现的六个桌面分辨率一致：1280×720、1366×768、
1440×900、1920×1080、2560×1440、3840×2160。消费方 MUST NOT 各自复制该列表。

预设 MUST NOT 参与文档校验或迁移：它只是新建与改尺寸时的快捷入口，任何正有限尺寸都是
合法的 `Frame.size`。

#### Scenario: 反查匹配的预设

- **WHEN** 以 `{ width: 1920, height: 1080 }` 反查预设
- **THEN** 返回该预设，其通名为 `Full HD`

#### Scenario: 自定义尺寸没有匹配预设

- **WHEN** 以 `{ width: 1000, height: 800 }` 反查预设
- **THEN** 返回 `null`

#### Scenario: 预设不改变文档校验

- **WHEN** 一个 Frame 的 `size` 是 `{ width: 1000, height: 800 }`
- **THEN** 文档校验通过，尺寸不匹配预设不产生任何 issue
