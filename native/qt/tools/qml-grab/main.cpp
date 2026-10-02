// qml-grab：加载一份 .qml，等首帧真正交换之后截取窗口并写出 PNG。
//
// 用法：qml-grab <input.qml> <output.png> [--delay-ms N] [--timeout-ms N] [--font 文件]...
//
// 截图时机：等 QQuickWindow::frameSwapped 之后再 grabWindow，而不是 show() 之后立刻抓——
// 后者抓到的可能是还没渲染的首帧，症状是偶发的全黑或全透明 PNG。`--delay-ms` 给由定时器
// 驱动内容的夹具（页面脚本）留出时间，在首帧之后再等这么久。
//
// `--font` 把字体文件注册进应用字体库：导出的 QML 只写字族名（字体不随产物打包），对照夹具的
// 字体由这里提供，与预览一侧加载的是同一个文件。
//
// 渲染平台不在这里强制：验收环境由调用方用环境变量固定（见 native/qt/scripts/grab.sh），
// 这里只负责「首帧之后截图」这一件事。
#include <QCommandLineParser>
#include <QFileInfo>
#include <QFontDatabase>
#include <QGuiApplication>
#include <QImage>
#include <QQmlEngine>
#include <QQuickItem>
#include <QQuickView>
#include <QTimer>
#include <QUrl>

#include <cstdio>

namespace {

enum ExitCode {
  Ok = 0,
  LoadFailed = 1,
  Timeout = 2,
  WriteFailed = 3,
  UsageError = 4,
};

void printErrors(const QList<QQmlError> &errors) {
  for (const QQmlError &error : errors) {
    std::fprintf(stderr, "%s\n", qPrintable(error.toString()));
  }
}

}  // namespace

int main(int argc, char *argv[]) {
  QGuiApplication app(argc, argv);
  QCoreApplication::setApplicationName(QStringLiteral("qml-grab"));

  QCommandLineParser parser;
  parser.setApplicationDescription(QStringLiteral("加载 QML 并在首帧之后截图为 PNG"));
  parser.addHelpOption();
  parser.addPositionalArgument(QStringLiteral("input"), QStringLiteral("要加载的 .qml 文件"));
  parser.addPositionalArgument(QStringLiteral("output"), QStringLiteral("输出的 .png 文件"));
  QCommandLineOption delayOption(QStringLiteral("delay-ms"),
                                 QStringLiteral("首帧之后再等待的毫秒数"),
                                 QStringLiteral("ms"), QStringLiteral("0"));
  QCommandLineOption timeoutOption(QStringLiteral("timeout-ms"),
                                   QStringLiteral("等待首帧的超时毫秒数"),
                                   QStringLiteral("ms"), QStringLiteral("10000"));
  QCommandLineOption fontOption(QStringLiteral("font"),
                                QStringLiteral("加载前注册的字体文件，可重复"),
                                QStringLiteral("file"));
  parser.addOption(delayOption);
  parser.addOption(timeoutOption);
  parser.addOption(fontOption);
  parser.process(app);

  const QStringList positional = parser.positionalArguments();
  if (positional.size() != 2) {
    std::fprintf(stderr, "用法：qml-grab <input.qml> <output.png> [--delay-ms N] [--timeout-ms N] [--font 文件]...\n");
    return UsageError;
  }
  bool delayOk = false;
  bool timeoutOk = false;
  const int delayMs = parser.value(delayOption).toInt(&delayOk);
  const int timeoutMs = parser.value(timeoutOption).toInt(&timeoutOk);
  if (!delayOk || delayMs < 0 || !timeoutOk || timeoutMs <= 0) {
    std::fprintf(stderr, "--delay-ms 必须是非负整数，--timeout-ms 必须是正整数\n");
    return UsageError;
  }

  for (const QString &font : parser.values(fontOption)) {
    if (QFontDatabase::addApplicationFont(font) < 0) {
      std::fprintf(stderr, "无法加载字体 %s\n", qPrintable(font));
      return UsageError;
    }
  }

  const QString inputPath = QFileInfo(positional.at(0)).absoluteFilePath();
  const QString outputPath = positional.at(1);

  QQuickView view;
  // 窗口尺寸跟随根对象：夹具的根 Item 就是场景，尺寸由它声明。
  view.setResizeMode(QQuickView::SizeViewToRootObject);
  view.setSource(QUrl::fromLocalFile(inputPath));
  if (view.status() == QQuickView::Error) {
    // 加载期的错误 QQuickView 已经经 qWarning 打过一遍（带出错行与插入符），这里只负责退出码。
    return LoadFailed;
  }
  // 运行期的 QML 警告（绑定错误、类型错误）照样打出来，但不判失败：它们不阻止出图。
  QObject::connect(view.engine(), &QQmlEngine::warnings, [](const QList<QQmlError> &warnings) {
    printErrors(warnings);
  });
  QQuickItem *root = view.rootObject();
  if (root == nullptr || root->width() <= 0 || root->height() <= 0) {
    std::fprintf(stderr, "%s：根对象必须是宽高都大于 0 的 Item\n", qPrintable(inputPath));
    return LoadFailed;
  }

  int exitCode = Ok;
  bool grabbed = false;
  auto grab = [&]() {
    if (grabbed) return;
    grabbed = true;
    QImage image = view.grabWindow();
    const QSize logical(qRound(root->width()), qRound(root->height()));
    if (image.size() != logical) {
      // 高 DPI 屏上 grabWindow 给的是物理像素。缩回逻辑尺寸只供人工查看——验收环境的
      // devicePixelRatio 固定为 1，那里不会走到这一支。
      std::fprintf(stderr, "提示：devicePixelRatio=%.2f，截图已缩放到逻辑尺寸 %dx%d，仅供人工查看\n",
                   image.devicePixelRatio(), logical.width(), logical.height());
      image = image.scaled(logical, Qt::IgnoreAspectRatio, Qt::SmoothTransformation);
    }
    if (!image.save(outputPath, "PNG")) {
      std::fprintf(stderr, "无法写出 %s\n", qPrintable(outputPath));
      exitCode = WriteFailed;
    }
    app.exit(exitCode);
  };

  QObject::connect(&view, &QQuickWindow::frameSwapped, &app, [&]() {
    QTimer::singleShot(delayMs, &app, grab);
  }, Qt::SingleShotConnection);
  QTimer::singleShot(timeoutMs, &app, [&]() {
    if (grabbed) return;
    std::fprintf(stderr, "%s：%d ms 内没有渲染出首帧\n", qPrintable(inputPath), timeoutMs);
    exitCode = Timeout;
    app.exit(exitCode);
  });

  view.show();
  const int loopResult = app.exec();
  return exitCode != Ok ? exitCode : loopResult;
}
