## ADDED Requirements

### Requirement: 底部 Asset Browser 工作区

Editor MUST 在既有 bottom Edge Group 中新增 inactive 的“资源 / Assets”标签，Transaction Log
继续作为默认活动标签。`ComposeEditorProps` MUST 新增 `assetBrowserProps` 与
`assetBrowserPanel`；显式 panel 优先于 props，二者缺失时显示可访问占位。Editor MUST NOT
转导 Asset Browser 公共 API。

#### Scenario: 打开默认资源面板

- **WHEN** 宿主提供 assetBrowserProps 并打开底部资源标签
- **THEN** 标签显示 `@compose-ui/asset-browser` 的左树右资源界面
- **AND** Canvas、其他 Edge Group 和既有面板保持挂载及原尺寸

#### Scenario: 覆盖或省略资源内容

- **WHEN** 宿主提供 assetBrowserPanel，包括显式 null
- **THEN** 资源标签使用该值完整覆盖默认 AssetBrowser
- **WHEN** 宿主未提供 panel 或 props
- **THEN** 资源标签显示本地化、可访问的资源占位

#### Scenario: 保持底部默认活动标签

- **WHEN** Editor 首次初始化 bottom Edge Group
- **THEN** 该组包含 Transaction Log、Command 和 Assets
- **AND** Transaction Log 保持活动，Assets 初始 inactive
