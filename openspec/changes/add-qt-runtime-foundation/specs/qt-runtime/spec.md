## ADDED Requirements

### Requirement: Qt 工具链的单一版本来源

仓库 MUST 在 `native/qt/qt-version.json` 一处声明 Qt 版本与所需模块，本机安装脚本与 CI MUST 读取
同一份声明安装，且安装产物 MUST 落在被 Git 忽略的目录中。

#### Scenario: 本机一条命令安装

- **WHEN** 开发者在仓库根目录运行 Qt 安装脚本
- **THEN** 脚本按 `qt-version.json` 安装指定版本与模块到 `native/qt/.qt/`
- **AND** 重复运行时检测到已安装的同一版本即跳过下载

#### Scenario: 版本升级只改一处

- **WHEN** 维护者修改 `qt-version.json` 中的版本号
- **THEN** 本机安装脚本与 CI 都安装新版本，不需要修改任何其他文件

### Requirement: Qt 目录与 JS 构建隔离

`native/qt/` MUST NOT 成为 Bun workspace 成员或 Turbo 任务，任何 `@compose-ui/*` 包 MUST NOT
依赖它；它与 JS 侧之间只通过文件（`.qml` 与 PNG）交换。

#### Scenario: 未安装 Qt 时 JS 验证照常通过

- **WHEN** 在没有安装 Qt 的机器上运行 `bun run lint`、`typecheck`、`test`、`build`
- **THEN** 所有命令照常通过，不尝试查找或构建 Qt

### Requirement: 无头 QML 截图

`qml-grab` 工具 MUST 在无显示环境下加载一份 `.qml`，在首帧真正交换之后截取窗口并写出 PNG；
加载错误 MUST 以非零退出码报告并输出 QML 引擎的错误信息。

#### Scenario: 截取一份合法 QML

- **WHEN** 以一份根对象为固定尺寸 `Item` 的 `.qml` 与输出路径调用 `qml-grab`
- **THEN** 输出一张与根对象尺寸相同的 PNG
- **AND** 截图发生在首帧交换之后，不会得到未渲染的空白帧

#### Scenario: QML 含语法错误

- **WHEN** 输入的 `.qml` 无法被引擎加载
- **THEN** 工具以非零退出码结束并输出引擎报告的文件、行号与错误信息
- **AND** 不写出任何 PNG

### Requirement: Preview 与 QML 的像素对比

仓库 MUST 提供对比脚本：对同一份夹具，比较 `ComposePreview` 的截图与 `qml-grab` 的截图，
在声明的容差内判定一致，并在不一致时输出差异图。容差 MUST 只在对比脚本中定义一处。

#### Scenario: 一致的两张图

- **WHEN** 两张截图尺寸相同且差异像素比例不超过容差
- **THEN** 脚本以零退出码结束

#### Scenario: 尺寸不同

- **WHEN** 两张截图尺寸不同
- **THEN** 脚本直接判定失败并报告两边尺寸，不进行逐像素比较

#### Scenario: 超出容差

- **WHEN** 差异像素比例超过容差
- **THEN** 脚本以非零退出码结束，报告差异比例并写出标红差异区域的 PNG

### Requirement: CI 中的 Qt 验收链路

CI MUST 包含一个独立的 Qt job：安装（并缓存）声明版本的 Qt、构建 `qml-grab`、截取对照夹具，
并与同一工作流中现截的 Preview 截图做对比。验收用的渲染后端 MUST 固定。

#### Scenario: 对照夹具通过

- **WHEN** CI 运行 Qt job
- **THEN** 每份对照夹具的 Preview 截图与 QML 截图都在容差内一致
- **AND** 失败时上传两边截图与差异图作为 artifact

#### Scenario: Qt 安装命中缓存

- **WHEN** `qt-version.json` 未变化且缓存存在
- **THEN** Qt job 不重新下载 Qt
