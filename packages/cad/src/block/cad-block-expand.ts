import {
  getCadArc,
  getCadInsert,
  getCadLine,
  getCadPlacement,
  getCadPolyline,
  getCadText,
  getCadWire,
  type CadArc,
  type CadDocument,
  type CadInsert,
  type CadText,
} from '../document'
// 直接指向实现文件而不是 `../connection`：本文件被 `../block` 的入口再导出，走目录入口会在
// block ⇄ connection 之间形成一条只在打包顺序变化时才现形的循环。
import { resolveCadWireSegment } from '../connection/cad-wire-geometry'
import {
  arcCurve,
  cadPolylineSegments,
  flattenCadArc,
  segmentCurve,
  textGeometry,
  type CadArcShape,
  type CadGeometry,
  type CadTextShape,
} from '../geometry'
import { transformCadBlockPoint } from './cad-block-transform'

/**
 * 图纸上一个可见对象的几何，连同它归属哪个顶层 Entity。
 *
 * @remarks
 * `ownerId` 是**顶层**对象：块实例内的几何全部归属该实例。命中与框选的结果必须是实例而不是
 * 块内图元——块内图元不是图纸上的独立对象，选中它们会让「删除」失去明确目标。
 *
 * @public
 */
export interface CadVisibleGeometry {
  readonly ownerId: string
  readonly geometry: CadGeometry
}

/** 两轴比例的绝对值相等；负值是镜像，仍然保持圆是圆。 */
function isUniformScale(insert: CadInsert) {
  return Math.abs(Math.abs(insert.scale.x) - Math.abs(insert.scale.y)) < 1e-9
}

/**
 * 把块局部的圆弧变换到世界坐标。
 *
 * @remarks
 * 等比缩放（含镜像）保持圆是圆，因此仍产出精确圆弧；镜像必须**同时翻转起始角与扫掠方向**，
 * 否则镜像后的符号轮廓看着对而弧的走向是反的。
 *
 * 非等比缩放把圆变成椭圆，而本步不引入椭圆图元，此时返回 `null` 由调用方拍扁。按某一轴的
 * 比例硬算成圆是第三条路，但它会画出一个用户从未画过的形状，且没有任何提示。
 */
/**
 * 把块局部的文字变换到世界坐标。
 *
 * @remarks
 * 文字不是曲线，**非等比缩放时不拍扁**——把一串字拆成线段既不是那串字，也没人能读。此时按
 * `|scale.x|` 缩放字号：横向比例决定一行字占多宽，而那正是版面上唯一有意义的量。
 *
 * 镜像不翻转文字本身：镜像的符号里，标注仍然要正着读。
 */
function transformCadBlockText(text: CadText, insert: CadInsert): CadTextShape {
  const position = transformCadBlockPoint(text.position, insert)
  return {
    position: { x: position.x, y: position.y },
    content: text.content,
    height: text.height * Math.abs(insert.scale.x),
    rotation: text.rotation + insert.rotation,
    align: text.align,
  }
}

function transformCadBlockArc(arc: CadArc, insert: CadInsert): CadArcShape | null {
  if (!isUniformScale(insert)) return null
  const center = transformCadBlockPoint(arc.center, insert)
  const scale = Math.abs(insert.scale.x)
  // 镜像次数为奇数时角方向翻转：单轴镜像翻一次，两轴同时镜像等于旋转 180°，不翻。
  const mirrored = (insert.scale.x < 0) !== (insert.scale.y < 0)
  // 起始角要先按镜像轴折射，再叠加实例旋转。
  const reflected = insert.scale.x < 0 ? 180 - arc.startAngle : (insert.scale.y < 0 ? -arc.startAngle : arc.startAngle)
  return {
    center: { x: center.x, y: center.y },
    radius: arc.radius * scale,
    startAngle: reflected + insert.rotation,
    sweep: mirrored ? -arc.sweep : arc.sweep,
  }
}

/**
 * 求出图纸上全部可见几何。
 *
 * @remarks
 * 命中、框选、对象捕捉与渲染共用这一条遍历：四者对「什么算可见」必须给出同一个答案，各自
 * 实现会在块展开这类逻辑上分叉——点得中却捕不到是最难排查的一类不一致。
 *
 * 返回**几何联合**而不是把圆弧拍扁成线段：拍扁会迫使渲染要么画出可见的多边形，要么绕开这条
 * 遍历而与命中分叉，并且会让圆心与象限点消失。文字同理，而且它连「拍扁成什么」都没有答案。
 *
 * 块实例在这里被**展开**而不是当作不可分的整体：插完一个断路器之后要能从它的接线端点起笔画
 * 导线，看不见端点等于块只是一张贴图。
 *
 * 隐藏图层不参与。实例自身的图层决定整个实例的可见性——块内图元各自的图层只在块定义内部有
 * 意义，让它们能单独隐藏会使同一个块在不同插入处呈现不同，那不是块。
 *
 * @param document - 当前文档。
 * @returns 全部可见几何，顺序与 `rootIds` 一致。
 * @public
 */
export function collectCadVisibleGeometry(document: CadDocument): readonly CadVisibleGeometry[] {
  const visibleLayers = new Set(
    document.layers.filter(({ visible }) => visible).map(({ id }) => id),
  )
  const result: CadVisibleGeometry[] = []

  for (const id of document.rootIds) {
    const entity = document.entities[id]
    if (!entity) continue
    if (!visibleLayers.has(getCadPlacement(entity)?.layerId ?? '')) continue

    const line = getCadLine(entity)
    if (line) {
      result.push({ ownerId: id, geometry: segmentCurve(line) })
      continue
    }

    const arc = getCadArc(entity)
    if (arc) {
      result.push({ ownerId: id, geometry: arcCurve(arc) })
      continue
    }

    const text = getCadText(entity)
    if (text) {
      result.push({ ownerId: id, geometry: textGeometry(text) })
      continue
    }

    const polyline = getCadPolyline(entity)
    if (polyline) {
      // 展开成线段，全部共用同一个 ownerId——因此点中任意一段选中的都是整条。这不是「拍扁」：
      // 多段线本来就是一串线段，顶点仍是各段端点、各段仍有中点，一个特征点都没少。
      for (const segment of cadPolylineSegments(polyline.vertices, polyline.closed)) {
        result.push({ ownerId: id, geometry: segmentCurve(segment) })
      }
      continue
    }

    const wire = getCadWire(entity)
    if (wire) {
      const segment = resolveCadWireSegment(document, wire)
      if (segment) result.push({ ownerId: id, geometry: segmentCurve(segment) })
      continue
    }

    const insert = getCadInsert(entity)
    if (!insert) continue
    const block = document.blocks[insert.blockId]
    // 悬空引用已被文档校验拦下；能走到这里只可能是外部写入，静默跳过好过画出半个符号。
    if (!block) continue
    for (const memberId of block.rootIds) {
      const member = block.entities[memberId]
      if (!member) continue

      const memberText = getCadText(member)
      if (memberText) {
        result.push({ ownerId: id, geometry: textGeometry(transformCadBlockText(memberText, insert)) })
        continue
      }

      const memberPolyline = getCadPolyline(member)
      if (memberPolyline) {
        for (const segment of cadPolylineSegments(memberPolyline.vertices, memberPolyline.closed)) {
          result.push({
            ownerId: id,
            geometry: segmentCurve({
              start: transformCadBlockPoint(segment.start, insert),
              end: transformCadBlockPoint(segment.end, insert),
            }),
          })
        }
        continue
      }

      const memberLine = getCadLine(member)
      if (memberLine) {
        result.push({
          ownerId: id,
          geometry: segmentCurve({
            start: transformCadBlockPoint(memberLine.start, insert),
            end: transformCadBlockPoint(memberLine.end, insert),
          }),
        })
        continue
      }

      const memberArc = getCadArc(member)
      if (!memberArc) continue
      const transformed = transformCadBlockArc(memberArc, insert)
      if (transformed) {
        result.push({ ownerId: id, geometry: arcCurve(transformed) })
        continue
      }
      // 非等比缩放：圆变椭圆，本步没有椭圆图元，因此按局部弧拍扁后逐点变换。形状仍与椭圆
      // 一致，只是不再是解析弧。
      for (const segment of flattenCadArc(memberArc)) {
        result.push({
          ownerId: id,
          geometry: segmentCurve({
            start: transformCadBlockPoint(segment.start, insert),
            end: transformCadBlockPoint(segment.end, insert),
          }),
        })
      }
    }
  }
  return result
}
