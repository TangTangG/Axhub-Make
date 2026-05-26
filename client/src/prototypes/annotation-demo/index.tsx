/**
 * @name 标注演示
 */

import React, { useMemo } from 'react';
import {
    ArrowLeft,
    ArrowRight,
    FileText,
    FolderTree,
    Link2,
    type LucideIcon,
    MessageSquareText,
    SlidersHorizontal,
    Sparkles,
} from 'lucide-react';
import {
    AnnotationViewer,
    type AnnotationDirectoryRouteNode,
    type AnnotationSourceDocument,
    type AnnotationViewerOptions,
    useProtoDevState,
} from '@axhub/annotation';
import { defineHashPageRoute, useHashPage } from '../../common/useHashPage';
import agentSkillAnnotationAsset from './assets/agent-skill-annotation.png';
import makeAnnotationAsset from './assets/make-annotation.png';
import annotationSourceDocument from './annotation-source.json';
import './style.css';

type ChapterId =
    | 'prototype-as-prd'
    | 'content-annotation'
    | 'state-annotation'
    | 'prototype-directory'
    | 'generate-annotation';

type Chapter = {
    id: ChapterId;
    title: string;
    eyebrow: string;
    summary: string;
    metrics: {
        wordCount: string;
        readingTime: string;
    };
    icon: LucideIcon;
};

type ComparisonRow = {
    dimension: string;
    prototypeOnly: string;
    traditional: string;
};

type ProtoState = {
    result_state?: 'success' | 'failure';
    list_state?: 'empty' | 'filled';
    metric_state?: 'low' | 'normal' | 'high';
};

type ResultState = Required<ProtoState>['result_state'];
type ListState = Required<ProtoState>['list_state'];
type MetricState = Required<ProtoState>['metric_state'];

const annotationRoute = defineHashPageRoute([
    { id: 'prototype-as-prd', title: '原型即 PRD' },
    { id: 'content-annotation', title: '内容标注' },
    { id: 'state-annotation', title: '状态标注' },
    { id: 'prototype-directory', title: '原型目录' },
    { id: 'generate-annotation', title: '生成标注' },
], { defaultPageId: 'prototype-as-prd' });

const chapters: Chapter[] = [
    {
        id: 'prototype-as-prd',
        title: '原型即 PRD',
        eyebrow: '01 · PRINCIPLE',
        summary: '我们的核心思想是把可运行原型作为需求主载体，用标注补充边界、原因和决策，让原型本身承担 PRD 的表达与交付价值。',
        metrics: { wordCount: '约 860 字', readingTime: '约 3 分钟' },
        icon: FileText,
    },
    {
        id: 'content-annotation',
        title: '内容标注',
        eyebrow: '02 · CONTENT',
        summary: '用四张预览卡片展示内容标注的基本阅读方式、颜色分类、侧边栏筛选和同一节点多标注能力。',
        metrics: { wordCount: '约 620 字', readingTime: '约 2 分钟' },
        icon: MessageSquareText,
    },
    {
        id: 'state-annotation',
        title: '状态标注',
        eyebrow: '03 · STATE',
        summary: '用三张演示卡片展示常见页面状态：结果页成功/失败、列表页空/有内容，以及指标卡偏低/正常/偏高。',
        metrics: { wordCount: '约 690 字', readingTime: '约 2 分钟' },
        icon: SlidersHorizontal,
    },
    {
        id: 'prototype-directory',
        title: '原型目录',
        eyebrow: '04 · DIRECTORY',
        summary: '原型目录主要承载三种入口：页面、文档和链接。右侧目录按钮打开后，可以在同一个面板里切换页面、阅读 PRD，并打开外部资料。',
        metrics: { wordCount: '约 360 字', readingTime: '约 1 分钟' },
        icon: FolderTree,
    },
    {
        id: 'generate-annotation',
        title: '生成标注',
        eyebrow: '05 · GENERATE',
        summary: '生成标注关注的是能力边界：可以生成内容说明、状态说明、目录资料和默认设置状态，再由人工继续校正。',
        metrics: { wordCount: '约 580 字', readingTime: '约 2 分钟' },
        icon: Sparkles,
    },
];

const comparisonRows: ComparisonRow[] = [
    {
        dimension: '统一入口',
        prototypeOnly: '页面、标注和补充文档都围绕同一个原型入口展开。',
        traditional: '交付、评审和阅读分散在原型、PRD、截图和沟通记录里。',
    },
    {
        dimension: '生产效率',
        prototypeOnly: 'AI 生成原型时同步生成标注，后续改页面即可快速更新说明。',
        traditional: '页面做一遍，文档再写一遍，变更后还要额外维护同步。',
    },
    {
        dimension: '研发效率',
        prototypeOnly: '代码多数时候是更好的信息源，下游 AI Agent 能按真实实现理解效果。',
        traditional: '文字 PRD 需要再翻译成结构、状态和交互，容易产生理解偏差。',
    },
];

const capabilityItems = [
    {
        title: '任意元素标注',
        detail: '按钮、卡片、表格、标题和整块内容都可以作为解释节点。',
    },
    {
        title: '状态标注',
        detail: '成功、失败、空列表、指标高低等状态可以直接挂在节点上。',
    },
    {
        title: '原型目录内容',
        detail: '页面、文档和链接可以被整理成目录，评审时从一个入口打开。',
    },
    {
        title: '默认设置状态',
        detail: '可以记录进入页面时默认展示的状态，让演示保持稳定。',
    },
];

const directoryTypeCards = [
    {
        icon: FileText,
        title: '页面',
        body: '切换原型 route，进入真实页面上下文。',
    },
    {
        icon: MessageSquareText,
        title: '文档',
        body: '阅读 PRD、规则说明、验收清单等长内容。',
    },
    {
        icon: Link2,
        title: '链接',
        body: '打开设计来源、竞品参考或外部资料。',
    },
];

const resultStateMeta: Record<ResultState, {
    label: string;
    title: string;
    message: string;
    action: string;
}> = {
    success: {
        label: '成功',
        title: '提交成功',
        message: '需求标注已保存，评审成员可以继续查看页面上下文。',
        action: '查看详情',
    },
    failure: {
        label: '失败',
        title: '提交失败',
        message: '网络或权限状态异常，请检查后重新提交。',
        action: '重新提交',
    },
};

const listStateMeta: Record<ListState, {
    label: string;
    title: string;
    items: string[];
}> = {
    empty: {
        label: '空列表',
        title: '暂无数据',
        items: [],
    },
    filled: {
        label: '有内容',
        title: '标注任务',
        items: ['首页主按钮文案确认', '空状态插画替换', '指标卡阈值复核'],
    },
};

const metricStateMeta: Record<MetricState, {
    label: string;
    value: number;
    trend: string;
    tone: string;
}> = {
    low: {
        label: '偏低',
        value: 32,
        trend: '低于目标 18%',
        tone: 'is-low',
    },
    normal: {
        label: '正常',
        value: 68,
        trend: '接近目标区间',
        tone: 'is-normal',
    },
    high: {
        label: '偏高',
        value: 92,
        trend: '高于目标 12%',
        tone: 'is-high',
    },
};

function normalizeResultState(value: unknown): ResultState {
    return value === 'success' || value === 'failure' ? value : 'success';
}

function normalizeListState(value: unknown): ListState {
    return value === 'empty' || value === 'filled' ? value : 'empty';
}

function normalizeMetricState(value: unknown): MetricState {
    return value === 'low' || value === 'normal' || value === 'high' ? value : 'normal';
}

function ManuscriptSection({
    id,
    title,
    children,
}: {
    id?: string;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <section id={id} className="annotation-guide-manuscript">
            <h3 className="annotation-guide-section-title">{title}</h3>
            {children}
        </section>
    );
}

function ChapterHeader({ chapter }: { chapter: Chapter }) {
    return (
        <header className="annotation-guide-hero" data-annotation-id={chapter.id === 'prototype-as-prd' ? 'prototype-as-prd' : undefined}>
            <div className="annotation-guide-hero-copy">
                <p className="annotation-guide-eyebrow">{chapter.eyebrow}</p>
                <h2>{chapter.title}</h2>
                <p>{chapter.summary}</p>
            </div>
            <dl className="annotation-guide-hero-meta" aria-label="章节信息">
                <div>
                    <dt>字数</dt>
                    <dd>{chapter.metrics.wordCount}</dd>
                </div>
                <div>
                    <dt>阅读时长</dt>
                    <dd>{chapter.metrics.readingTime}</dd>
                </div>
            </dl>
        </header>
    );
}

function PrototypeAsPrdView() {
    return (
        <>
            <ManuscriptSection title="我们的目的">
                <div className="annotation-guide-section-body">
                    <p>
                        现在 AI 生成的原型已经足够完整，能把界面结构、交互路径、状态变化和数据关系直接表达出来。对下游 Agent 来说，代码化原型就是最好的 PRD：它不是抽象描述，而是可运行、可检查、可继续修改的需求上下文。
                    </p>
                    <p>
                        所以我们以原型为主，用标注补充原因、边界、例外和决策记录，达到替代传统 PRD 的效果。
                    </p>
                </div>
            </ManuscriptSection>
            <ManuscriptSection title="对比">
                <div className="annotation-guide-section-body">
                    <table className="annotation-guide-comparison-table" data-annotation-id="prototype-as-prd-table">
                        <thead>
                            <tr>
                                <th scope="col">维度</th>
                <th scope="col">原型即 PRD</th>
                <th scope="col">原型 + PRD</th>
                            </tr>
                        </thead>
                        <tbody>
                            {comparisonRows.map((row) => (
                                <tr key={row.dimension}>
                                    <th scope="row">{row.dimension}</th>
                                    <td className="annotation-guide-comparison-prototype">{row.prototypeOnly}</td>
                                    <td>{row.traditional}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </ManuscriptSection>
        </>
    );
}

function ContentAnnotationDemoView() {
    return (
        <section className="annotation-guide-annotation-card-grid" aria-label="内容标注演示卡片">
            <article
                className="annotation-guide-annotation-card is-default"
                data-annotation-id="content-preview-node"
            >
                <div className="annotation-guide-annotation-card-head">
                    <span>01</span>
                    <i aria-hidden="true" />
                </div>
                <h3>点击预览节点</h3>
                <p>点击卡片旁的预览节点，可以在右侧标注面板查看关联的标注内容。</p>
                <div className="annotation-guide-markdown-preview" aria-label="Markdown 示例">
                    <h4>Markdown 示例</h4>
                    <ul>
                        <li>支持短列表和重点说明。</li>
                        <li>
                            可以记录 <code>行内代码</code> 或字段名。
                        </li>
                    </ul>
                    <blockquote>适合把补充说明固定在页面节点旁。</blockquote>
                </div>
            </article>

            <article
                className="annotation-guide-annotation-card is-secondary"
                data-annotation-id="content-category-node"
            >
                <div className="annotation-guide-annotation-card-head">
                    <span>02</span>
                    <i aria-hidden="true" />
                </div>
                <h3>多颜色标注</h3>
                <p>用不同颜色标注不同分类，例如内容说明、交互问题、视觉规则或待确认事项。</p>
                <div className="annotation-guide-category-strip" aria-label="颜色分类示例">
                    <span className="is-default">内容说明</span>
                    <span className="is-secondary">分类标注</span>
                </div>
            </article>

            <article
                className="annotation-guide-annotation-card is-tertiary"
                data-annotation-id="content-filter-node"
            >
                <div className="annotation-guide-annotation-card-head">
                    <span>03</span>
                    <i aria-hidden="true" />
                </div>
                <h3>侧边栏筛选颜色</h3>
                <p>通过侧边栏的标注按钮打开面板，控制标注显示，并按颜色筛选当前关注的节点。</p>
                <div className="annotation-guide-filter-preview" aria-label="标注筛选示例">
                    <span className="is-on">显示标注</span>
                    <span className="is-default" />
                    <span className="is-secondary" />
                    <span className="is-tertiary" />
                </div>
            </article>

            <article
                className="annotation-guide-annotation-card is-multi"
                data-annotation-id="content-multi-node"
            >
                <div className="annotation-guide-annotation-card-head">
                    <span>04</span>
                    <div className="annotation-guide-multi-markers" aria-hidden="true">
                        <i className="is-default" />
                        <i className="is-secondary" />
                        <i className="is-tertiary" />
                    </div>
                </div>
                <h3>一个节点多种标注</h3>
                <p>同一个预览节点可以同时挂载多条标注，用三种颜色表示不同关注点。</p>
                <div className="annotation-guide-node-stack" aria-label="一个节点多种标注示例">
                    <span className="is-default">内容</span>
                    <span className="is-secondary">分类</span>
                    <span className="is-tertiary">筛选</span>
                </div>
            </article>
        </section>
    );
}

function StateAnnotationDemoView() {
    const protoState = useProtoDevState<ProtoState>();
    const resultState = normalizeResultState(protoState.result_state);
    const listState = normalizeListState(protoState.list_state);
    const metricState = normalizeMetricState(protoState.metric_state);
    const resultData = resultStateMeta[resultState];
    const listData = listStateMeta[listState];
    const metricData = metricStateMeta[metricState];
    const isSuccess = resultState === 'success';
    const hasListItems = listData.items.length > 0;

    return (
        <section className="annotation-guide-state-demo-grid" aria-label="状态标注演示卡片">
            <article
                className={['annotation-guide-state-demo-card', isSuccess ? 'is-success' : 'is-failure'].join(' ')}
                data-annotation-id="state-result-card"
            >
                <div className="annotation-guide-state-demo-head">
                    <span>结果页</span>
                    <strong>{resultData.label}</strong>
                </div>
                <div className="annotation-guide-result-symbol" aria-hidden="true">
                    {isSuccess ? '✓' : '!'}
                </div>
                <h3>{resultData.title}</h3>
                <p className="annotation-guide-result-message">{resultData.message}</p>
                <button type="button">{resultData.action}</button>
            </article>

            <article className="annotation-guide-state-demo-card" data-annotation-id="state-list-card">
                <div className="annotation-guide-state-demo-head">
                    <span>列表页</span>
                    <strong>{listData.label}</strong>
                </div>
                <h3>{listData.title}</h3>
                {hasListItems ? (
                    <ul className="annotation-guide-state-list">
                        {listData.items.map((item) => (
                            <li key={item}>{item}</li>
                        ))}
                    </ul>
                ) : (
                    <div className="annotation-guide-empty-list">
                        <span aria-hidden="true" />
                        <p>当前筛选条件下还没有标注任务。</p>
                    </div>
                )}
            </article>

            <article
                className={['annotation-guide-state-demo-card', metricData.tone].join(' ')}
                data-annotation-id="state-metric-card"
            >
                <div className="annotation-guide-state-demo-head">
                    <span>指标卡</span>
                    <strong>{metricData.label}</strong>
                </div>
                <h3>转化率</h3>
                <div className="annotation-guide-metric-value">{metricData.value}%</div>
                <div className="annotation-guide-meter" aria-label="转化率进度">
                    <span style={{ width: `${metricData.value}%` }} />
                </div>
                <p className="annotation-guide-state-note">{metricData.trend}</p>
            </article>
        </section>
    );
}

function DirectoryGuideView({ chapter }: { chapter: Chapter }) {
    return (
        <section className="annotation-guide-directory-overview" data-annotation-id="directory-practice">
            <div className="annotation-guide-directory-copy">
                <p className="annotation-guide-eyebrow">{chapter.eyebrow}</p>
                <h2>{chapter.title}</h2>
                <p>{chapter.summary}</p>
                <div className="annotation-guide-directory-type-list" aria-label="目录入口类型">
                    {directoryTypeCards.map((item) => {
                        const Icon = item.icon;
                        return (
                            <article key={item.title}>
                                <span aria-hidden="true"><Icon size={20} /></span>
                                <div>
                                    <h3>{item.title}</h3>
                                    <p>{item.body}</p>
                                </div>
                            </article>
                        );
                    })}
                </div>
            </div>
            <div className="annotation-guide-directory-pointer" aria-hidden="true">
                <div>
                    <span>点击这里打开目录</span>
                    <strong>页面 / 文档 / 链接</strong>
                </div>
                <ArrowRight size={96} strokeWidth={1.4} />
            </div>
        </section>
    );
}

function GeneratePractice() {
    return (
        <>
            <ManuscriptSection id="generate-content" title="可以生成的内容">
                <div className="annotation-guide-generate-section-body" data-annotation-id="generate-practice">
                    <p>
                        生成标注先覆盖原型里最需要解释的内容，再交给人继续校正。它可以生成任意元素的说明、状态说明、原型目录里的页面/文档/外链，以及进入页面时默认展示的设置状态。
                    </p>
                    <div className="annotation-guide-generate-capability-grid">
                        {capabilityItems.map((item) => (
                            <article key={item.title}>
                                <h4>{item.title}</h4>
                                <p>{item.detail}</p>
                            </article>
                        ))}
                    </div>
                    <p className="annotation-guide-global-source-note">
                        对外统一读取时，运行时会输出 <code>window.__AXHUB_ANNOTATION_SOURCE__</code>，里面包含原型目录树和全部标注节点列表，方便宿主工具或 Agent 直接获取上下文。
                    </p>
                </div>
            </ManuscriptSection>
            <ManuscriptSection id="generate-methods" title="两种标注方式">
                <div className="annotation-guide-generate-section-body">
                    <p>
                        标注可以从人工批注开始，也可以让 Agent 先生成一版。两种方式生成的内容都保持可编辑，方便在评审前继续整理。
                    </p>
                    <div className="annotation-guide-method-grid">
                        <article>
                            <h4>内置批注编辑</h4>
                            <p>适合在页面评审时补充说明、修正文案和记录即时反馈。</p>
                            <div className="annotation-guide-method-placeholder">
                                <img src={makeAnnotationAsset} alt="Make 内置批注编辑界面" />
                            </div>
                        </article>
                        <article>
                            <h4>Agent 标注技能</h4>
                            <p>适合在 Agent 里直接使用默认已安装的标注技能，批量生成第一版标注。</p>
                            <div className="annotation-guide-method-placeholder">
                                <img src={agentSkillAnnotationAsset} alt="Agent 标注技能界面" />
                            </div>
                        </article>
                    </div>
                </div>
            </ManuscriptSection>
        </>
    );
}

function ChapterBody({ chapter }: { chapter: Chapter }) {
    if (chapter.id === 'content-annotation') return <ContentAnnotationDemoView />;
    if (chapter.id === 'state-annotation') return <StateAnnotationDemoView />;
    if (chapter.id === 'prototype-directory') return <DirectoryGuideView chapter={chapter} />;
    if (chapter.id === 'generate-annotation') return <GeneratePractice />;
    return <PrototypeAsPrdView />;
}

export default function AnnotationGuide() {
    const { page, setPage } = useHashPage(annotationRoute);
    const activeIndex = Math.max(chapters.findIndex((chapter) => chapter.id === page), 0);
    const activeChapter = chapters[activeIndex] || chapters[0];
    const previous = chapters[activeIndex - 1] || null;
    const next = chapters[activeIndex + 1] || null;

    const viewerOptions = useMemo<AnnotationViewerOptions>(() => ({
        currentPageId: activeChapter.id,
        toolbarEdge: 'right',
        showToolbar: true,
        showThemeToggle: true,
        showColorFilter: true,
        emptyWhenNoData: false,
        onDirectoryRoute: (node: AnnotationDirectoryRouteNode) => {
            if (typeof node.route === 'string' && chapters.some((chapter) => chapter.id === node.route)) {
                setPage(node.route);
            }
        },
    }), [activeChapter.id, setPage]);

    return (
        <main
            className={[
                'annotation-guide-shell',
                activeChapter.id === 'prototype-directory' ? 'is-directory-page' : '',
            ].filter(Boolean).join(' ')}
        >
            <aside className="annotation-guide-sidebar">
                <div className="annotation-guide-brand">
                    <p>AXHUB MAKE</p>
                    <h1>标注演示</h1>
                </div>
                <nav className="annotation-guide-nav" aria-label="标注演示章节">
                    {chapters.map((chapter, index) => {
                        const Icon = chapter.icon;
                        return (
                            <button
                                key={chapter.id}
                                type="button"
                                className={chapter.id === activeChapter.id ? 'is-active' : ''}
                                onClick={() => setPage(chapter.id)}
                            >
                                <Icon size={19} strokeWidth={1.9} />
                                <small>{String(index + 1).padStart(2, '0')}</small>
                                <span>{chapter.title}</span>
                            </button>
                        );
                    })}
                </nav>
                <div className="annotation-guide-chrome">
                    <span>STYLE B · SWISS INTERNATIONAL</span>
                    <span>IKB · #002FA7</span>
                </div>
            </aside>

            <section className="annotation-guide-scroll" aria-live="polite">
                <div className="annotation-guide-content-inner">
                    <article className="annotation-guide-document">
                        {activeChapter.id !== 'prototype-directory' ? <ChapterHeader chapter={activeChapter} /> : null}
                        <ChapterBody chapter={activeChapter} />
                    </article>
                    <footer className="annotation-guide-footer">
                        <button
                            type="button"
                            disabled={!previous}
                            onClick={() => previous && setPage(previous.id)}
                        >
                            <ArrowLeft size={17} />
                            上一页
                        </button>
                        <span aria-hidden="true" />
                        <button
                            type="button"
                            disabled={!next}
                            onClick={() => next && setPage(next.id)}
                        >
                            下一页
                            <ArrowRight size={17} />
                        </button>
                    </footer>
                </div>
            </section>

            <AnnotationViewer
                source={annotationSourceDocument as unknown as AnnotationSourceDocument}
                options={viewerOptions}
            />
        </main>
    );
}
