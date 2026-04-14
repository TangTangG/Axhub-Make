/**
 * @name 警情热力图
 * @mode axure
 *
 * 参考资料：
 * - spec.md
 * - /skills/axure-export-workflow/SKILL.md
 * - /rules/axure-api-guide.md
 */

import './style.css';

import React, { forwardRef, useCallback, useImperativeHandle, useState } from 'react';
import { Select, DatePicker, Button, Input, Tag, message, Modal, Table, Tabs, Tooltip } from 'antd';
import { 
    Map, 
    Layers, 
    ZoomIn, 
    ZoomOut, 
    Locate, 
    Download, 
    Filter, 
    BarChart3, 
    TrendingUp, 
    TrendingDown,
    AlertTriangle,
    Car,
    Calendar,
    Tag as TagIcon,
    Building,
    Users,
    Search,
    Settings,
    Star,
    StarOff,
    Save,
    Eye,
    FileText,
    ChevronRight,
    MapPin,
    Info
} from 'lucide-react';
import type {
    Action,
    AxureHandle,
    AxureProps,
    ConfigItem,
    DataDesc,
    EventItem,
    KeyDesc,
} from '../../common/axure-types';

const { RangePicker } = DatePicker;

type DisplayMode = 'heatmap' | 'point';
type RankType = 'intersection' | 'road';
type MapCenter = { lat: number; lng: number };
type SavedArea = { id: string; name: string };
type QueryConditions = {
    level: string | undefined;
    type: string | undefined;
    timeRange: any;
    period: string[] | undefined;
    tags: string[];
    unit: string | undefined;
    squad: string | undefined;
    keyword: string;
};

const DEFAULT_MAP_CENTER: MapCenter = { lat: 39.9042, lng: 116.4074 };

const DEFAULT_QUERY_CONDITIONS: QueryConditions = {
    level: undefined,
    type: undefined,
    timeRange: null,
    period: undefined,
    tags: [],
    unit: undefined,
    squad: undefined,
    keyword: '',
};

const EVENT_LIST: EventItem[] = [
    { name: 'onQuery', desc: '点击查询按钮时触发，返回当前查询条件', payload: 'JSON string' },
    { name: 'onMapClick', desc: '点击地图点位时触发，返回点位信息', payload: 'JSON string' },
    { name: 'onAreaSelect', desc: '选择或保存自定义区域时触发，返回区域信息', payload: 'JSON string' },
    { name: 'onRankClick', desc: '点击排行项查看报表时触发，返回排行信息', payload: 'JSON string' },
    { name: 'onExport', desc: '点击导出按钮时触发，返回导出类型', payload: 'string' },
];

const ACTION_LIST: Action[] = [
    { name: 'setQueryConditions', desc: '设置查询条件', params: 'JSON string' },
    { name: 'setMapCenter', desc: '设置地图中心点', params: 'JSON string {"lat":number,"lng":number}' },
    { name: 'setMapZoom', desc: '设置地图缩放级别', params: 'number string' },
    { name: 'toggleDisplayMode', desc: '切换展示模式', params: '"heatmap" | "point"' },
    { name: 'highlightArea', desc: '高亮显示指定区域', params: 'string' },
    { name: 'exportData', desc: '触发导出逻辑', params: 'string' },
];

const VAR_LIST: KeyDesc[] = [
    { name: 'display_mode', desc: '当前展示模式（heatmap / point）' },
    { name: 'query_conditions', desc: '当前查询条件对象' },
    { name: 'map_center', desc: '当前地图中心点' },
    { name: 'map_zoom', desc: '当前地图缩放级别' },
    { name: 'selected_area', desc: '当前选中的自定义区域' },
    { name: 'saved_areas', desc: '已保存的区域列表' },
    { name: 'rank_type', desc: '当前排行维度（road / intersection）' },
    { name: 'selected_rank', desc: '当前报表弹窗对应的排行名称' },
    { name: 'report_visible', desc: '统计报表弹窗是否打开' },
];

const CONFIG_LIST: ConfigItem[] = [
    { type: 'inputNumber', attributeId: 'defaultZoom', displayName: '默认缩放级别', info: '默认地图缩放级别', initialValue: 12 },
    { type: 'inputNumber', attributeId: 'heatmapRadius', displayName: '热力图半径', info: '热力图半径', initialValue: 25 },
    { type: 'inputNumber', attributeId: 'heatmapOpacity', displayName: '热力图透明度', info: '热力图透明度', initialValue: 0.8 },
    { type: 'inputNumber', attributeId: 'clusterDistance', displayName: '聚合距离', info: '聚合距离（像素）', initialValue: 50 },
];

const DATA_LIST: DataDesc[] = [
    {
        name: 'incidentData',
        desc: '警情点位数据',
        keys: [
            { name: 'incidentId', desc: '警情ID' },
            { name: 'lat', desc: '纬度' },
            { name: 'lng', desc: '经度' },
            { name: 'level', desc: '警情级别' },
            { name: 'type', desc: '警情类型' },
            { name: 'count', desc: '警情数量/热力值' },
        ],
    },
    {
        name: 'rankData',
        desc: '排行数据',
        keys: [
            { name: 'rank', desc: '排名' },
            { name: 'name', desc: '名称' },
            { name: 'incidentCount', desc: '警情数' },
            { name: 'trend', desc: '趋势值，正数上升，负数下降' },
        ],
    },
    {
        name: 'statisticsData',
        desc: '统计数据',
        keys: [
            { name: 'category', desc: '分类' },
            { name: 'count', desc: '数量' },
            { name: 'percentage', desc: '占比' },
            { name: 'weekOverWeek', desc: '环比上周' },
            { name: 'monthOverMonth', desc: '环比上月' },
            { name: 'yearOverYear', desc: '同比去年' },
        ],
    },
];

const mockIncidents = [
    { incidentId: '1', lat: 39.9042, lng: 116.4074, level: '一级', type: '交通事故', count: 45 },
    { incidentId: '2', lat: 39.9142, lng: 116.4174, level: '二级', type: '交通违法', count: 28 },
    { incidentId: '3', lat: 39.8942, lng: 116.3974, level: '三级', type: '交通拥堵', count: 32 },
    { incidentId: '4', lat: 39.9242, lng: 116.4274, level: '一级', type: '交通事故', count: 62 },
    { incidentId: '5', lat: 39.8842, lng: 116.3874, level: '二级', type: '交通违法', count: 24 },
    { incidentId: '6', lat: 39.9342, lng: 116.4374, level: '三级', type: '交通拥堵', count: 38 },
    { incidentId: '7', lat: 39.8742, lng: 116.3774, level: '一级', type: '交通事故', count: 78 },
    { incidentId: '8', lat: 39.9442, lng: 116.4474, level: '二级', type: '交通违法', count: 35 },
    { incidentId: '9', lat: 39.9092, lng: 116.4124, level: '一级', type: '交通事故', count: 55 },
    { incidentId: '10', lat: 39.8992, lng: 116.4024, level: '二级', type: '交通违法', count: 42 },
];

const mockRankData = [
    { rank: 1, name: '海沧大桥-02-厦门桥梁博物馆', incidentCount: 17, trend: 12 },
    { rank: 2, name: '厦禾路-05-56莲富大厦', incidentCount: 11, trend: -5 },
    { rank: 3, name: '厦禾路-04-01金山大厦', incidentCount: 10, trend: 8 },
    { rank: 4, name: '成功大道-06-68', incidentCount: 9, trend: -3 },
    { rank: 5, name: '环岛干道-20-24中石化加油站', incidentCount: 9, trend: 15 },
    { rank: 6, name: '环岛干道-00-46海滨新村', incidentCount: 8, trend: -8 },
    { rank: 7, name: '仙岳路-10-80', incidentCount: 7, trend: 6 },
    { rank: 8, name: '嘉禾路-09-67', incidentCount: 7, trend: -2 },
    { rank: 9, name: '厦禾路-04-56BRT火车站', incidentCount: 7, trend: 4 },
    { rank: 10, name: '环岛干道-000-68', incidentCount: 6, trend: -1 },
];

const mockViolationStats = [
    { category: '闯红灯', count: 45, percentage: 28.5, weekOverWeek: 12, monthOverMonth: -5, yearOverYear: 8 },
    { category: '违停', count: 38, percentage: 24.1, weekOverWeek: -8, monthOverMonth: 15, yearOverYear: -12 },
    { category: '逆行', count: 23, percentage: 14.6, weekOverWeek: 5, monthOverMonth: 3, yearOverYear: -6 },
    { category: '超速', count: 18, percentage: 11.4, weekOverWeek: -3, monthOverMonth: 8, yearOverYear: 15 },
    { category: '变道', count: 15, percentage: 9.5, weekOverWeek: 10, monthOverMonth: -2, yearOverYear: 5 },
    { category: '其他', count: 19, percentage: 12.0, weekOverWeek: 2, monthOverMonth: 4, yearOverYear: -3 },
];

const mockVehicleStats = [
    { category: '小型车', count: 68, percentage: 52.3, weekOverWeek: 8, monthOverMonth: 12, yearOverYear: -5 },
    { category: '大型车', count: 32, percentage: 24.6, weekOverWeek: -5, monthOverMonth: 3, yearOverYear: 10 },
    { category: '摩托车', count: 15, percentage: 11.5, weekOverWeek: 15, monthOverMonth: -8, yearOverYear: 20 },
    { category: '电动车', count: 10, percentage: 7.7, weekOverWeek: -2, monthOverMonth: 6, yearOverYear: -15 },
    { category: '其他', count: 5, percentage: 3.8, weekOverWeek: 3, monthOverMonth: 1, yearOverYear: 2 },
];

const Component = forwardRef<AxureHandle, AxureProps>(function IncidentHeatmap(props, ref) {
    const { config, onEvent } = props;

    const [displayMode, setDisplayMode] = useState<DisplayMode>('heatmap');
    const [mapCenter, setMapCenter] = useState<MapCenter>(DEFAULT_MAP_CENTER);
    const [mapZoom, setMapZoom] = useState(typeof config?.defaultZoom === 'number' ? config.defaultZoom : 12);
    const [rankType, setRankType] = useState<RankType>('intersection');
    const [reportVisible, setReportVisible] = useState(false);
    const [selectedRank, setSelectedRank] = useState<string | null>(null);
    const [savedAreas, setSavedAreas] = useState<SavedArea[]>([]);
    const [selectedArea, setSelectedArea] = useState<SavedArea | null>(null);
    const [areaModalVisible, setAreaModalVisible] = useState(false);
    const [newAreaName, setNewAreaName] = useState('');

    const [queryConditions, setQueryConditions] = useState<QueryConditions>(DEFAULT_QUERY_CONDITIONS);

    const emitEvent = useCallback((eventName: string, payload?: string) => {
        try {
            onEvent?.(eventName, payload);
        } catch (error) {
            console.warn('事件触发失败:', eventName, error);
        }
    }, [onEvent]);

    const serializePayload = useCallback((payload: unknown) => {
        try {
            return JSON.stringify(payload);
        } catch (error) {
            console.warn('事件数据序列化失败:', error);
            return undefined;
        }
    }, []);

    const parseJsonParams = useCallback(<T,>(params: string | undefined, fallback: T): T => {
        if (!params) {
            return fallback;
        }
        try {
            return JSON.parse(params) as T;
        } catch (error) {
            console.warn('动作参数解析失败:', params, error);
            return fallback;
        }
    }, []);

    useImperativeHandle(ref, () => ({
        getVar: (name: string) => {
            const vars: Record<string, unknown> = {
                display_mode: displayMode,
                displayMode,
                query_conditions: queryConditions,
                queryConditions,
                map_center: mapCenter,
                mapCenter,
                map_zoom: mapZoom,
                mapZoom,
                selected_area: selectedArea,
                selectedArea,
                saved_areas: savedAreas,
                savedAreas,
                rank_type: rankType,
                rankType,
                selected_rank: selectedRank,
                selectedRank,
                report_visible: reportVisible,
                reportVisible,
            };
            return vars[name];
        },
        fireAction: (actionName: string, params?: string) => {
            switch (actionName) {
                case 'setQueryConditions': {
                    const nextConditions = parseJsonParams<Partial<QueryConditions>>(params, queryConditions);
                    setQueryConditions({ ...DEFAULT_QUERY_CONDITIONS, ...nextConditions });
                    message.success('查询条件已设置');
                    break;
                }
                case 'setMapCenter': {
                    const nextCenter = parseJsonParams<MapCenter>(params, mapCenter);
                    setMapCenter(nextCenter);
                    message.success('地图中心点已设置');
                    break;
                }
                case 'setMapZoom': {
                    const nextZoom = Number(params);
                    if (Number.isFinite(nextZoom)) {
                        setMapZoom(nextZoom);
                    }
                    break;
                }
                case 'toggleDisplayMode':
                    setDisplayMode(params === 'point' ? 'point' : 'heatmap');
                    message.success(`已切换到${params === 'point' ? '点位图' : '热力图'}模式`);
                    break;
                case 'highlightArea': {
                    const matchedArea = savedAreas.find((item) => item.id === params) ?? null;
                    setSelectedArea(matchedArea ?? (params ? { id: params, name: params } : null));
                    message.success('区域已高亮');
                    break;
                }
                case 'exportData':
                    emitEvent('onExport', params);
                    message.success('数据导出中...');
                    break;
                default:
                    console.warn('未知动作:', actionName);
            }
        },
        eventList: EVENT_LIST,
        actionList: ACTION_LIST,
        varList: VAR_LIST,
        configList: CONFIG_LIST,
        dataList: DATA_LIST,
    }), [displayMode, emitEvent, mapCenter, mapZoom, parseJsonParams, queryConditions, rankType, reportVisible, savedAreas, selectedArea, selectedRank]);

    const handleQuery = () => {
        emitEvent('onQuery', serializePayload(queryConditions));
        message.success('查询成功');
    };

    const handleReset = () => {
        setQueryConditions(DEFAULT_QUERY_CONDITIONS);
        message.success('查询条件已重置');
    };

    const handleMapClick = (incident: typeof mockIncidents[number]) => {
        emitEvent('onMapClick', serializePayload({
            ...incident,
            displayMode,
        }));
    };

    const handleExport = (exportType: string, successMessage: string) => {
        emitEvent('onExport', exportType);
        message.success(successMessage);
    };

    const handleViewReport = (rankItem: typeof mockRankData[number]) => {
        setSelectedRank(rankItem.name);
        setReportVisible(true);
        emitEvent('onRankClick', serializePayload(rankItem));
    };

    const handleSaveArea = () => {
        if (!newAreaName.trim()) {
            message.warning('请输入区域名称');
            return;
        }
        const nextArea = { id: Date.now().toString(), name: newAreaName.trim() };
        setSavedAreas([...savedAreas, nextArea]);
        setSelectedArea(nextArea);
        setNewAreaName('');
        setAreaModalVisible(false);
        emitEvent('onAreaSelect', serializePayload(nextArea));
        message.success('区域保存成功');
    };

    const handleSavedAreaChange = (areaId: string) => {
        const nextArea = savedAreas.find((item) => item.id === areaId) ?? null;
        setSelectedArea(nextArea);
        if (nextArea) {
            emitEvent('onAreaSelect', serializePayload(nextArea));
        }
    };

    const renderHeatmap = () => {
        return (
            <svg viewBox="0 0 800 600" className="map-svg">
                <defs>
                    <radialGradient id="heatGrad1" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#EF4444" stopOpacity="0.9" />
                        <stop offset="40%" stopColor="#F59E0B" stopOpacity="0.7" />
                        <stop offset="70%" stopColor="#FBBF24" stopOpacity="0.5" />
                        <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
                    </radialGradient>
                    <radialGradient id="heatGrad2" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.8" />
                        <stop offset="50%" stopColor="#FBBF24" stopOpacity="0.5" />
                        <stop offset="100%" stopColor="#60A5FA" stopOpacity="0" />
                    </radialGradient>
                    <radialGradient id="heatGrad3" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#10B981" stopOpacity="0.7" />
                        <stop offset="50%" stopColor="#34D399" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#93C5FD" stopOpacity="0" />
                    </radialGradient>
                    <filter id="glow">
                        <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                        <feMerge>
                            <feMergeNode in="coloredBlur"/>
                            <feMergeNode in="SourceGraphic"/>
                        </feMerge>
                    </filter>
                </defs>
                <rect width="800" height="600" fill="#1a1a2e" />
                
                {[...Array(15)].map((_, i) => (
                    <line key={`h${i}`} x1="0" y1={i * 40} x2="800" y2={i * 40} stroke="#2a3a5e" strokeWidth="0.5" strokeDasharray="5,5" />
                ))}
                {[...Array(20)].map((_, i) => (
                    <line key={`v${i}`} x1={i * 40} y1="0" x2={i * 40} y2="600" stroke="#2a3a5e" strokeWidth="0.5" strokeDasharray="5,5" />
                ))}
                
                {mockIncidents.map((incident, index) => {
                    const x = 150 + (incident.lng - 116.3774) * 2500;
                    const y = 350 - (incident.lat - 39.8742) * 2500;
                    const radius = incident.count * 1.5 + 20;
                    const gradId = incident.level === '一级' ? 'heatGrad1' : incident.level === '二级' ? 'heatGrad2' : 'heatGrad3';
                    return (
                        <g key={incident.incidentId} onClick={() => handleMapClick(incident)}>
                            <circle cx={x} cy={y} r={radius} fill={`url(#${gradId})`} />
                        </g>
                    );
                })}
                
                {mockIncidents.map((incident, index) => {
                    const x = 150 + (incident.lng - 116.3774) * 2500;
                    const y = 350 - (incident.lat - 39.8742) * 2500;
                    const color = incident.level === '一级' ? '#EF4444' : incident.level === '二级' ? '#F59E0B' : '#10B981';
                    return (
                        <g key={`point-${incident.incidentId}`} onClick={() => handleMapClick(incident)}>
                            <circle cx={x} cy={y} r={12} fill={color} stroke="#fff" strokeWidth="2" filter="url(#glow)" />
                            <text x={x} y={y + 4} textAnchor="middle" fill="#fff" fontSize="10" fontWeight="bold">
                                {incident.count}
                            </text>
                        </g>
                    );
                })}
            </svg>
        );
    };

    const renderPoints = () => {
        return (
            <svg viewBox="0 0 800 600" className="map-svg">
                <rect width="800" height="600" fill="#1a1a2e" />
                {[...Array(15)].map((_, i) => (
                    <line key={`h${i}`} x1="0" y1={i * 40} x2="800" y2={i * 40} stroke="#2a3a5e" strokeWidth="0.5" />
                ))}
                {[...Array(20)].map((_, i) => (
                    <line key={`v${i}`} x1={i * 40} y1="0" x2={i * 40} y2="600" stroke="#2a3a5e" strokeWidth="0.5" />
                ))}
                {mockIncidents.map((incident, index) => {
                    const x = 150 + (incident.lng - 116.3774) * 2500;
                    const y = 350 - (incident.lat - 39.8742) * 2500;
                    const color = incident.level === '一级' ? '#EF4444' : incident.level === '二级' ? '#F59E0B' : '#10B981';
                    return (
                        <g key={incident.incidentId} onClick={() => handleMapClick(incident)}>
                            <circle cx={x} cy={y} r={14} fill={color} stroke="#fff" strokeWidth="2.5" />
                            <text x={x} y={y + 5} textAnchor="middle" fill="#fff" fontSize="11" fontWeight="bold">
                                {incident.count}
                            </text>
                        </g>
                    );
                })}
            </svg>
        );
    };

    const reportColumns = [
        { title: '分类', dataIndex: 'category', key: 'category', width: 120 },
        { title: '数量', dataIndex: 'count', key: 'count', width: 80 },
        { title: '占比', dataIndex: 'percentage', key: 'percentage', width: 80, render: (v: number) => `${v}%` },
        { 
            title: '环比上周', 
            dataIndex: 'weekOverWeek', 
            key: 'weekOverWeek', 
            width: 100,
            render: (v: number) => (
                <span style={{ color: v > 0 ? '#EF4444' : '#10B981' }}>
                    {v > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    {Math.abs(v)}%
                </span>
            )
        },
        { 
            title: '环比上月', 
            dataIndex: 'monthOverMonth', 
            key: 'monthOverMonth', 
            width: 100,
            render: (v: number) => (
                <span style={{ color: v > 0 ? '#EF4444' : '#10B981' }}>
                    {v > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    {Math.abs(v)}%
                </span>
            )
        },
        { 
            title: '同比去年', 
            dataIndex: 'yearOverYear', 
            key: 'yearOverYear', 
            width: 100,
            render: (v: number) => (
                <span style={{ color: v > 0 ? '#EF4444' : '#10B981' }}>
                    {v > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    {Math.abs(v)}%
                </span>
            )
        },
    ];

    return (
        <div className="incident-heatmap">
            <aside className="left-panel">
                <div className="panel-header">
                    <AlertTriangle size={20} style={{ color: '#60A5FA' }} />
                    <div className="panel-header-title">交通警情</div>
                </div>
                
                <div className="panel-section">
                    <div className="section-title">
                        <Filter size={14} />
                        <span>查询条件</span>
                    </div>
                    <div className="query-form">
                        <div className="form-item">
                            <label>警情级别</label>
                            <Select
                                placeholder="请选择"
                                value={queryConditions.level}
                                onChange={(v) => setQueryConditions({...queryConditions, level: v})}
                                options={[
                                    { label: '一级', value: '1' },
                                    { label: '二级', value: '2' },
                                    { label: '三级', value: '3' },
                                ]}
                            />
                        </div>
                        <div className="form-item">
                            <label>警情类型</label>
                            <Select
                                placeholder="请选择"
                                value={queryConditions.type}
                                onChange={(v) => setQueryConditions({...queryConditions, type: v})}
                                options={[
                                    { label: '交通事故', value: 'accident' },
                                    { label: '交通违法', value: 'violation' },
                                    { label: '交通拥堵', value: 'congestion' },
                                ]}
                            />
                        </div>
                        <div className="form-item">
                            <label>报警时间</label>
                            <RangePicker 
                                value={queryConditions.timeRange}
                                onChange={(dates) => setQueryConditions({...queryConditions, timeRange: dates as any})}
                            />
                        </div>
                        <div className="form-item">
                            <label>报警时间段</label>
                            <Select
                                mode="multiple"
                                placeholder="请选择"
                                value={queryConditions.period}
                                onChange={(v) => setQueryConditions({...queryConditions, period: v as any})}
                                options={[
                                    { label: '15分钟', value: '15min' },
                                    { label: '30分钟', value: '30min' },
                                    { label: '1小时', value: '1h' },
                                    { label: '今日', value: 'today' },
                                    { label: '本月', value: 'month' },
                                ]}
                            />
                        </div>
                        <div className="form-item">
                            <label>开始日期</label>
                            <RangePicker 
                                showTime
                                onChange={(dates) => setQueryConditions({...queryConditions, timeRange: dates as any})}
                            />
                        </div>
                        <div className="form-item">
                            <label>请选择警情标签</label>
                            <Select
                                mode="multiple"
                                placeholder="请选择"
                                value={queryConditions.tags}
                                onChange={(v) => setQueryConditions({...queryConditions, tags: v as any})}
                                options={[
                                    { label: '重点区域', value: 'key_area' },
                                    { label: '高发路段', value: 'high_risk' },
                                    { label: '学校周边', value: 'school' },
                                ]}
                            />
                        </div>
                        <div className="form-item">
                            <label>请选择责任单位</label>
                            <Select
                                placeholder="请选择"
                                value={queryConditions.unit}
                                onChange={(v) => setQueryConditions({...queryConditions, unit: v})}
                                options={[
                                    { label: '朝阳支队', value: 'chaoyang' },
                                    { label: '海淀支队', value: 'haidian' },
                                    { label: '西城支队', value: 'xicheng' },
                                ]}
                            />
                        </div>
                        <div className="form-item">
                            <label>请选择辖区中队</label>
                            <Select
                                placeholder="请选择"
                                value={queryConditions.squad}
                                onChange={(v) => setQueryConditions({...queryConditions, squad: v})}
                                options={[
                                    { label: '一中队', value: 'squad1' },
                                    { label: '二中队', value: 'squad2' },
                                    { label: '三中队', value: 'squad3' },
                                ]}
                            />
                        </div>
                        <div className="form-item">
                            <label>请输入警情信息</label>
                            <Input 
                                placeholder="请输入关键词"
                                value={queryConditions.keyword}
                                onChange={(e) => setQueryConditions({...queryConditions, keyword: e.target.value})}
                            />
                        </div>
                        <div className="form-actions">
                            <Button type="primary" onClick={handleQuery}>确定</Button>
                            <Button onClick={handleReset}>重置</Button>
                        </div>
                    </div>
                </div>

                <div className="panel-section">
                    <div className="section-title">
                        <BarChart3 size={14} />
                        <span>统计维度</span>
                    </div>
                    <div className="dimension-tabs">
                        <div className="dimension-tab active">全市</div>
                        <div className="dimension-tab">重点</div>
                        <div className="dimension-tab">热点</div>
                    </div>
                </div>

                <div className="panel-section">
                    <div className="section-title">
                        <Layers size={14} />
                        <span>显示方式</span>
                    </div>
                    <div className="mode-tabs">
                        <div 
                            className={`mode-tab ${displayMode === 'heatmap' ? 'active' : ''}`}
                            onClick={() => setDisplayMode('heatmap')}
                        >
                            热力图
                        </div>
                        <div 
                            className={`mode-tab ${displayMode === 'point' ? 'active' : ''}`}
                            onClick={() => setDisplayMode('point')}
                        >
                            点位
                        </div>
                    </div>
                </div>
            </aside>

            <main className="map-container">
                <div className="top-control-bar">
                    <div className="control-bar-item active">
                        <Settings size={14} />
                        聚合距离
                        <ChevronRight size={14} />
                    </div>
                    <div className="control-bar-item">
                        <Map size={14} />
                        热力图参数
                        <ChevronRight size={14} />
                    </div>
                    <div className="control-bar-item">
                        <MapPin size={14} />
                        地图
                        <ChevronRight size={14} />
                    </div>
                    <div className="control-bar-item">
                        <Search size={14} />
                        选择范围
                    </div>
                </div>

                <div className="map-view">
                    {displayMode === 'heatmap' ? renderHeatmap() : renderPoints()}
                </div>
                
                <div className="map-controls">
                    <div className="control-group">
                        <div className="control-label">聚合距离 <span>50px</span></div>
                        <input type="range" min="20" max="100" defaultValue="50" />
                    </div>
                    <div className="control-group">
                        <div className="control-label">热力半径 <span>25px</span></div>
                        <input type="range" min="10" max="50" defaultValue="25" />
                    </div>
                    <div className="control-group">
                        <div className="control-label">透明度 <span>80%</span></div>
                        <input type="range" min="0" max="100" defaultValue="80" />
                    </div>
                    <div className="control-actions">
                        <Button size="small" icon={<Save size={14} />} onClick={() => setAreaModalVisible(true)}>
                            保存区域
                        </Button>
                        <Select 
                            size="small" 
                            placeholder="选择已保存区域" 
                            style={{ width: 150 }}
                            value={selectedArea?.id}
                            onChange={handleSavedAreaChange}
                            options={savedAreas.map(a => ({ label: a.name, value: a.id }))}
                        />
                    </div>
                </div>

                <div className="map-toolbar">
                    <Tooltip title="放大">
                        <div className="toolbar-btn" onClick={() => setMapZoom(mapZoom + 1)}>
                            <ZoomIn size={18} />
                        </div>
                    </Tooltip>
                    <Tooltip title="缩小">
                        <div className="toolbar-btn" onClick={() => setMapZoom(mapZoom - 1)}>
                            <ZoomOut size={18} />
                        </div>
                    </Tooltip>
                    <Tooltip title="定位">
                        <div className="toolbar-btn">
                            <Locate size={18} />
                        </div>
                    </Tooltip>
                    <Tooltip title="图层">
                        <div className="toolbar-btn">
                            <Layers size={18} />
                        </div>
                    </Tooltip>
                </div>

                <div className="bottom-control-bar">
                    <div className="bottom-control-btn active">
                        <MapPin size={14} />
                        路口
                    </div>
                    <div className="bottom-control-btn">
                        <Car size={14} />
                        路段
                    </div>
                </div>

                <div className="legend-panel">
                    <div className="legend-title">热力图图例</div>
                    <div className="legend-items">
                        <div className="legend-item" style={{ background: 'linear-gradient(90deg, #3B82F6 0%, #60A5FA 100%)' }}></div>
                        <div className="legend-item" style={{ background: 'linear-gradient(90deg, #60A5FA 0%, #10B981 100%)' }}></div>
                        <div className="legend-item" style={{ background: 'linear-gradient(90deg, #10B981 0%, #FBBF24 100%)' }}></div>
                        <div className="legend-item" style={{ background: 'linear-gradient(90deg, #FBBF24 0%, #F59E0B 100%)' }}></div>
                        <div className="legend-item" style={{ background: 'linear-gradient(90deg, #F59E0B 0%, #EF4444 100%)' }}></div>
                    </div>
                </div>
            </main>

            <aside className="right-panel">
                <div className="rank-panel-header">
                    <div className="rank-panel-title">
                        <BarChart3 size={18} style={{ color: '#60A5FA' }} />
                        <div className="rank-panel-title-text">全市警情发生地排行</div>
                    </div>
                    <div className="rank-tabs">
                        <div 
                            className={`rank-tab ${rankType === 'road' ? 'active' : ''}`}
                            onClick={() => setRankType('road')}
                        >
                            路段
                        </div>
                        <div 
                            className={`rank-tab ${rankType === 'intersection' ? 'active' : ''}`}
                            onClick={() => setRankType('intersection')}
                        >
                            路口
                        </div>
                    </div>
                </div>

                <div className="rank-list">
                    {mockRankData.map((item) => (
                        <div key={item.rank} className="rank-item">
                            <div className="rank-number">{item.rank}</div>
                            <div className="rank-content">
                                <div className="rank-name">{item.name}</div>
                                <div className="rank-count">
                                    <span>警情数: {item.incidentCount}</span>
                                </div>
                            </div>
                            <Tooltip title="查看报表">
                                <Eye 
                                    size={14} 
                                    style={{ color: '#60A5FA', cursor: 'pointer' }}
                                    onClick={() => handleViewReport(item)}
                                />
                            </Tooltip>
                        </div>
                    ))}
                </div>

                <div className="report-actions">
                    <Button icon={<Download size={14} />} onClick={() => handleExport('incident_detail', '警情明细导出成功')}>
                        导出警情明细
                    </Button>
                    <Button icon={<Download size={14} />} onClick={() => handleExport('statistics_report', '统计报表导出成功')}>
                        导出统计报表
                    </Button>
                </div>
            </aside>

            <Modal
                title={`${selectedRank} - 统计报表`}
                open={reportVisible}
                onCancel={() => setReportVisible(false)}
                width={900}
                footer={[
                    <Button key="cancel" onClick={() => setReportVisible(false)}>关闭</Button>,
                    <Button
                        key="export"
                        type="primary"
                        icon={<Download size={14} />}
                        onClick={() => handleExport('report_modal', '统计报表导出成功')}
                    >
                        导出报表
                    </Button>,
                ]}
            >
                <Tabs
                    items={[
                        {
                            key: 'violation',
                            label: '违法行为统计',
                            children: (
                                <div>
                                    <div className="report-filter">
                                        <span>环比时间：</span>
                                        <Select defaultValue="week" size="small" style={{ width: 120 }}>
                                            <Select.Option value="week">上周</Select.Option>
                                            <Select.Option value="month">上月</Select.Option>
                                        </Select>
                                        <span style={{ marginLeft: 16 }}>同比时间：</span>
                                        <Select defaultValue="year" size="small" style={{ width: 120 }}>
                                            <Select.Option value="year">去年</Select.Option>
                                            <Select.Option value="custom">自定义</Select.Option>
                                        </Select>
                                    </div>
                                    <Table 
                                        dataSource={mockViolationStats} 
                                        columns={reportColumns} 
                                        pagination={false}
                                        size="small"
                                    />
                                </div>
                            ),
                        },
                        {
                            key: 'vehicle',
                            label: '车辆分类统计',
                            children: (
                                <div>
                                    <div className="report-filter">
                                        <span>环比时间：</span>
                                        <Select defaultValue="week" size="small" style={{ width: 120 }}>
                                            <Select.Option value="week">上周</Select.Option>
                                            <Select.Option value="month">上月</Select.Option>
                                        </Select>
                                        <span style={{ marginLeft: 16 }}>同比时间：</span>
                                        <Select defaultValue="year" size="small" style={{ width: 120 }}>
                                            <Select.Option value="year">去年</Select.Option>
                                            <Select.Option value="custom">自定义</Select.Option>
                                        </Select>
                                    </div>
                                    <Table 
                                        dataSource={mockVehicleStats} 
                                        columns={reportColumns} 
                                        pagination={false}
                                        size="small"
                                    />
                                </div>
                            ),
                        },
                    ]}
                />
            </Modal>

            <Modal
                title="保存自定义区域"
                open={areaModalVisible}
                onCancel={() => setAreaModalVisible(false)}
                onOk={handleSaveArea}
                okText="保存"
                cancelText="取消"
            >
                <div className="area-form">
                    <label>区域名称：</label>
                    <Input 
                        placeholder="请输入区域名称"
                        value={newAreaName}
                        onChange={(e) => setNewAreaName(e.target.value)}
                    />
                </div>
            </Modal>
        </div>
    );
});

Component.displayName = 'IncidentHeatmap';

export default Component;
