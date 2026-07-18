# Axhub Make FAQ

本文件用于提供 Axhub Make 常见问题参考。

## 安装项目或安装客户端时报错怎么办？

如果 Axhub Make 是由 AI 在沙箱环境中启动的，报错可能是沙箱进程权限不完整，导致脚本执行或文件读写受限。相比继续在同一沙箱中尝试修复，优先重新启动通常更快。

1. 停止当前 Make 服务端、客户端及其相关子进程。
2. 按照[启动指导](./start-axhub-make-with-ai.md)，引导用户双击安装阶段创建的桌面启动脚本，重新启动 Axhub Make。
3. 重试失败的安装操作。

如果仍然失败，再排查 Node.js、npm、网络、路径和其他权限问题。

## 发布或者导出到 Axure 失败怎么办？

先按“使用说明”完成 Axure 准备和字体配置，再按报错表现处理。

### 可编辑原型复制失败

Axhub Make 默认通过 `http://localhost:32767` 连接 Axure Bridge：可用性检查为 `GET /available`，复制数据为 `POST /copyaxvg`。需要打开 3743 及以上版本的 Axure。Axure 多开时端口可能不同；如果最初打开的实例被关闭，原端口可能失效。关闭所有 Axure 实例，只重新打开一个符合版本的 Axure 后再试。

### Windows 粘贴或编辑报错

通常与字体兼容有关。优先使用 [Axhub Chrome 扩展](https://axhub.im/chrome/) 代替复制，也可以升级 Axure。先确认字体已按“使用说明”正确配置。

### 动态原型复制后失败

复制组件并非所有用户都能稳定成功，Windows 用户尤其容易受到字体兼容影响：

- **无法复制：** 不要继续反复尝试复制，改用 [Runtime 元件库](https://axhub-work.feishu.cn/file/ZR2UboHQ9oBsQsx48lscSMpenue) 的下载封面方法。下载 Runtime 封面，回到 Axure，双击对应 Runtime 元件，用下载的封面替换原图片。
- **可以复制但不显示：** 通常是 Axure 客户端兼容问题。升级 Axure，或下载 SVG 替换对应内容；前提是字体已按“使用说明”正确配置。
