# 原型预览管理端运行时注入设计

## 问题

客户端当前会给所有开发态原型预览注入 `quick-edit.js` 和 `dev-template-bootstrap.js`。局域网二维码打开的是普通客户端原型页面，不需要管理端编辑能力，却因此额外依赖管理服务端口和模块图。

## 设计

只使用一个现有的显式 URL 契约：请求参数 `agentToolbar=host`。

- 参数值严格等于 `host` 时，视为 Make 管理端 iframe，注入 `quick-edit.js` 和 `dev-template-bootstrap.js`。
- 未携带该参数或值不是 `host` 时，视为普通原型预览，不注入管理端运行时。
- 不根据 Referer、客户端 IP、端口、Host 或是否为局域网请求做推断。
- 不增加代理、回退别名或旧参数兼容逻辑。

原型自身的 Vite client、React refresh、样式和 preview loader 保持不变。

## 验证

- 普通 `/prototypes/<id>` 页面不包含两条管理端脚本。
- 带 `?agentToolbar=host` 的管理端 iframe 页面仍包含两条管理端脚本。
- 局域网 Host 和授权 cookie 不会改变上述判定。
- 运行客户端预览路由测试，并用局域网 URL 做浏览器加载验证。
