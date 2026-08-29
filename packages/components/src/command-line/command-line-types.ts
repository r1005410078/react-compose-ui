import type { ComposeCommandPrompt } from '@compose-ui/commands'
import type { ReactNode, RefObject } from 'react'

/**
 * 命令行右侧的一枚状态标记。
 *
 * @remarks
 * 正交、对象捕捉、选择集计数与坐标读数在两块画布上各不相同，因此本组件不认识其中任何一个，
 * 只按顺序渲染宿主给出的标记。`id` 同时用于 `data-testid` 后缀，因此必须稳定。
 *
 * @public
 */
export interface ComposeCommandLineStatus {
  /** 稳定标识；与 `testIdPrefix` 拼成 `data-testid`。 */
  readonly id: string
  /** 显示文本。 */
  readonly label: ReactNode
  /**
   * 是否高亮。
   *
   * @remarks
   * 「开/关」这类二态标记两种状态都要显示——只在开启时渲染会让用户无法确认它现在是关的。
   *
   * @defaultValue false
   */
  readonly active?: boolean
}

/** 命令行的文案；全部由调用方注入。 @public */
export interface ComposeCommandLineMessages {
  /** 没有活动命令时的提示，例如「命令：」。 */
  readonly ready: string
  /** 输入框的可访问名称。 */
  readonly inputLabel: string
  /** 输入框 placeholder。 */
  readonly placeholder: string
  /**
   * 关键字列表前的引导词，例如中文的「或」。
   *
   * @remarks
   * 渲染成 `指定下一点或 [闭合(C)/放弃(U)]:`。这个词必须可注入——写死中文会让英文界面出现
   * 一个中文连词，而它夹在提示与关键字之间，很难被注意到。
   */
  readonly keywordsPrefix: string
}

/** {@link ComposeCommandLine} 的属性。 @public */
export interface ComposeCommandLineProps {
  /** 命令进行中的当前提示；空闲时为 null。 */
  readonly prompt: ComposeCommandPrompt | null
  /** 上一次操作的反馈，例如「未知命令」；存在时取代提示显示。 */
  readonly notice?: string | null
  readonly messages: ComposeCommandLineMessages
  /** 右侧状态标记，按给出的顺序渲染。 */
  readonly status?: readonly ComposeCommandLineStatus[]
  /** 用户提交了一行文本：空闲时通常是命令名，命令进行中通常是关键字或坐标。 */
  readonly onSubmit: (text: string) => void
  /** 用户按下 Esc；两级语义由宿主判定，本组件只负责上报。 */
  readonly onCancel: () => void
  /**
   * 缓冲变化时上报当前完整文本。
   *
   * @remarks
   * 宿主据此把正在键入的内容渲染到别处（Stage 把它显示在光标旁的数值框里）。组件仍持有
   * 那一个缓冲，**不做成受控输入**——受控会让每一次按键都跨包往返一趟。
   */
  readonly onTextChange?: (text: string) => void
  /**
   * 接管 `Tab`：上报当前文本并清空缓冲，焦点不动。
   *
   * @remarks
   * 缺省时 `Tab` 走浏览器默认行为。`Tab` 是键盘用户的焦点导航键，**无条件劫持会把人困在
   * 输入框里**，因此接管与否由调用方按当前上下文决定，而不是本组件恒定接管。
   *
   * 本组件不认识数值字段、参数化或任何具体命令：它只知道「有人要接管 `Tab`」。
   */
  readonly onFieldAdvance?: (text: string) => void
  /** 指向输入框的 ref；宿主用它把键盘落点收回命令行。 */
  readonly inputRef?: RefObject<HTMLInputElement | null>
  /**
   * `data-testid` 前缀。
   *
   * @remarks
   * 由调用方给出，与 `canvas-kit` 的标尺同一条约定：两块画布各自的端到端用例按自己的前缀
   * 定位，共享组件不替它们决定命名。
   *
   * 提示与输入框的 testid 是 `<前缀>-command-prompt` / `<前缀>-command-input`，状态标记是
   * `<前缀>-<状态 id>`。
   *
   * @defaultValue `compose`
   */
  readonly testIdPrefix?: string
  /** 追加在根元素上的类名。 */
  readonly className?: string
}
