## ADDED Requirements

### Requirement: 动画文件格式

`@compose-ui/animation` MUST 提供 Compose Animation 文件协议：文件只包含动画清单与
变量绑定（id、名称、时长、播放模式、bindings），MUST NOT 包含关键帧轨道——轨道仍存放
在被动画 Entity 的 `Animation` Component 上。包 MUST 导出文件后缀与 media type 常量、
按名称后缀识别动画文件的谓词、issue 式解析入口、序列化入口与默认文件构造器；解析 MUST
拒绝未知版本、非法形状与非法清单并报告结构化 issue，序列化与解析 MUST 可无损往返。
动画文件是静态权威：宿主打开页面时把清单水合进 `ComposeDocument.animations` 会话镜像，
保存时把镜像变化回写文件；本协议保持无 React、无 DOM，仅依赖 core。

#### Scenario: 序列化与解析往返

- **WHEN** 宿主用清单与绑定构造动画文件并序列化后再解析
- **THEN** 解析结果与原始清单逐字段相等且没有 issue

#### Scenario: 拒绝非法动画文件

- **WHEN** 解析入口收到未知版本、缺失清单或清单字段非法的内容
- **THEN** 返回结构化 issue 而不抛出异常，也不产生部分解析结果

#### Scenario: 按名称识别动画文件

- **WHEN** 宿主用文件名谓词过滤资源目录
- **THEN** 只有携带动画文件后缀的条目被识别为动画文件，无需 Provider 理解 media type
