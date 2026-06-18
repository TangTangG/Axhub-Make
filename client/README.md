# Axhub Make Client

Axhub Make Client 是 Axhub Make 的官方项目客户端，用来承载可运行的原型、主题和项目资料。这里的「原型」不是传统线框图，而是接近生产级页面的真实前端实现，可在本地预览、迭代、导出并接入管理端。

## What It Provides

- 可运行的 React 原型页面
- 可复用的主题与设计规范
- 项目资料、素材和文档资源
- 面向 Axhub Make 管理端的预览、设计决策与导出入口

## Prototype Definition

`src/prototypes/` 下的原型默认按正式产品界面处理：需要真实内容、完整视觉层级、可运行交互和接近生产环境的体验。只有明确要求低保真、线框图、占位图或草稿时，才按传统 prototype/wireframe 的方式表达。

## Project Resources

```text
src/prototypes/   原型页面
src/themes/       主题与设计规范
src/resources/    项目资料、文档和素材
```

Axhub Make Client 适合把想法、业务流程、界面方案和设计系统沉淀成一个可持续演进的本地项目。
其中「设计决策」是管理端理解页面意图、生成多方案和沉淀设计取舍的主要入口；实现层仍可能沿用 propertyPanel/tweak 等内部命名。

## Local Runtime Data

ACP 助手会把每个原型自己的对话缓存写入 `src/prototypes/<prototype-id>/.spec/acp/`。这个目录只用于本机侧边栏运行态，不应提交到 Git，也不应进入导出或发布产物。
