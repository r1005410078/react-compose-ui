/** 插入 shadow model、但不出现在用户源码中的文本片段。 @public */
export interface ComposeVirtualTextInsertion {
  /** UTF-16 源码 offset，取值范围为 `0..source.length`。 */
  readonly offset: number
  /** 在该 offset 前插入的隐藏文本。 */
  readonly text: string
}

/** 为脚本资源启用隐藏类型分析的宿主配置。 @public */
export interface ComposeScriptIntelligenceProfile {
  /** Profile 的稳定标识，用于隔离 Monaco session 与额外类型声明。 */
  readonly id: string
  /** shadow model 使用的 Language Service；当前仅支持纯 JavaScript。 */
  readonly language: 'javascript'
  /**
   * 注入 JavaScript Language Service 的全局 `.d.ts` 内容。
   *
   * @remarks
   * 声明不属于 shadow source，更不会写入资源 Provider。
   */
  readonly typeDeclarations?: string
  /** 根据当前可见源码计算隐藏插入；返回值必须按 offset 严格递增。 */
  createVirtualInsertions(
    source: string,
  ): readonly ComposeVirtualTextInsertion[]
  /** 返回直接基于可见源码的非阻断提示；offset 同样使用 UTF-16。 */
  getSourceDiagnostics?(source: string): readonly {
    readonly offset: number
    readonly length: number
    readonly message: string
    readonly severity: 'hint' | 'info' | 'warning' | 'error'
  }[]
}
