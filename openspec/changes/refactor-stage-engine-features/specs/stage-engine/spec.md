## ADDED Requirements

### Requirement: 源码目录对应包的职责描述

`stage-engine` 的功能目录 MUST 与该包在架构边界中声明的职责一一对应——坐标与吸附、场景索引与
命中、手势规划、空间命令、手势状态机。目录 MUST NOT 按技术类型划分。

新增职责时 MUST 同步更新架构边界描述，两者 MUST NOT 各自演化。

#### Scenario: 读边界描述即可定位代码

- **WHEN** 需要修改吸附规则
- **THEN** 从「坐标、吸附」这一职责直接定位到 `geometry/`，无需全局搜索

### Requirement: 文件名不得与其目录同名

模块文件名 MUST 在目录之外携带信息，MUST NOT 与所在目录重名——`geometry/geometry.ts` 这样的
命名等于没有命名。

#### Scenario: 命令目录下的结构命令

- **WHEN** 层级顺序与编组命令住在 `commands/`
- **THEN** 文件名说明它是哪一类命令，而不是重复目录名

### Requirement: 功能目录经由自身入口对外

每个功能目录 MUST 有自己的 `index.ts`。目录之间以及包公共入口对目录的引用 MUST 走该入口，
MUST NOT 深层引用实现文件。

包公共入口 MUST 逐符号列出导出而非 `export *`，并按目录分块——它是对外契约，不能随内部文件
的增删自动变化。

#### Scenario: 新增内部模块不改变公共 API

- **WHEN** 某个功能目录内新增一个实现文件并从目录入口导出
- **THEN** 包的公共 API 不变，除非公共入口显式列出新符号
