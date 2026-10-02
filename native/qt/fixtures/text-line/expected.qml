// 底座阶段的手写对照：add-qml-export 落地后由导出器产物取代。
import QtQuick

Rectangle {
    width: 320
    height: 200
    color: "#0f172a"

    FontLoader {
        id: dejaVuSans
        source: "../fonts/DejaVuSans.ttf"
    }

    // CSS 的 line-height 把多出来的行距上下各分一半（半行距），Qt 的 FixedHeight 全放在下面；
    // 补一个 topPadding 才与预览的基线对齐。
    FontMetrics {
        id: labelMetrics
        font.family: dejaVuSans.font.family
        font.pixelSize: 28
    }

    Text {
        x: 24
        y: 40
        width: 272
        height: 40
        text: "Hello Qt 123"
        color: "#f8fafc"
        font.family: dejaVuSans.font.family
        font.pixelSize: 28
        lineHeightMode: Text.FixedHeight
        lineHeight: 40
        wrapMode: Text.NoWrap
        topPadding: (40 - labelMetrics.height) / 2
    }
}
