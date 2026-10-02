// 底座阶段的手写对照：add-qml-export 落地后由导出器产物取代。
import QtQuick
import QtQuick.Shapes

Rectangle {
    width: 320
    height: 200
    color: "#0f172a"

    Shape {
        x: 40
        y: 30
        width: 240
        height: 140
        preferredRendererType: Shape.CurveRenderer

        ShapePath {
            strokeColor: "#f97316"
            strokeWidth: 3
            fillColor: "transparent"
            capStyle: ShapePath.FlatCap
            startX: 0
            startY: 0
            PathLine { x: 240; y: 140 }
        }
    }
}
