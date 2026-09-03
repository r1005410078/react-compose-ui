/** SVG 导入诊断的稳定机器码。 @public */
export type SvgDiagnosticCode =
  /** 元素类型没有对应图元，已跳过。 */
  | 'svg.unsupported-element'
  /** 元素含可执行内容（`<script>`、事件属性、外部引用），已丢弃。 */
  | 'svg.executable-content'
  /** 外观修饰无法表达（滤镜、蒙版、裁剪、图案），已忽略但**保留几何**。 */
  | 'svg.unsupported-paint-effect'
  /** 渐变填充降级成纯色。 */
  | 'svg.gradient-flattened'
  /** 虚线图案取了最接近的既有档位。 */
  | 'svg.dash-approximated'
  /** `<style>` 里的选择器不在支持的子集内，已跳过。 */
  | 'svg.unsupported-selector'
  /** 非等比缩放下线宽取了两轴比例的几何平均。 */
  | 'svg.stroke-width-averaged'
  /** `<tspan>` 的独立定位不支持，只取了它的文本。 */
  | 'svg.tspan-flattened'
  /** 位图尺寸无从得知，已跳过该元素。 */
  | 'svg.unknown-image-size'
  /** `<use>` 指向的元素不存在，已跳过。 */
  | 'svg.unresolved-use'
  /** 元素字段不完整或不是有限数值，已跳过。 */
  | 'svg.invalid-element'
  /** Registry 缺少该 Preset，元素已跳过。 */
  | 'svg.missing-preset'

/**
 * 一条导入诊断。
 *
 * @remarks
 * `count` 是**聚合**后的数量：一份设计稿有几十个带滤镜的图元很正常，逐条报告等于没有报告。
 * `subject` 给出被聚合的对象（元素名、属性名、选择器），因此界面可以呈现成「忽略了 12 个滤镜」。
 *
 * 形状与 `@compose-ui/dxf` 的诊断逐字相同，这是有意的：宿主把两种导入的诊断压成提示的那段
 * 代码因此不必分两支。两个包互不依赖，这处重复是包边界造成的。
 *
 * @public
 */
export interface SvgDiagnostic {
  readonly code: SvgDiagnosticCode
  /** 被聚合的对象：元素名、属性名或选择器。 */
  readonly subject: string
  readonly count: number
}

/**
 * 按 `code + subject` 聚合的诊断收集器。
 *
 * @internal
 */
export function createSvgDiagnosticCollector() {
  const counts = new Map<string, SvgDiagnostic>()
  return {
    add(code: SvgDiagnosticCode, subject: string) {
      const key = `${code} ${subject}`
      const existing = counts.get(key)
      counts.set(key, existing
        ? { ...existing, count: existing.count + 1 }
        : { code, subject, count: 1 })
    },
    /** 诊断顺序按首次出现，读起来与文件顺序一致。 */
    collect(): readonly SvgDiagnostic[] {
      return [...counts.values()]
    },
  }
}
