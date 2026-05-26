import React from 'react';
import { Layout, Button, Space, Segmented, Tooltip, Popover, QRCode, Typography, Dropdown, theme, message, Divider } from 'antd';
import {
    MenuFoldOutlined,
    MenuUnfoldOutlined,
    CopyOutlined,
    EyeOutlined,
    ReloadOutlined,
    ShareAltOutlined,
    DownloadOutlined,
    CodeOutlined,
    MenuOutlined,
    GlobalOutlined,
    GithubOutlined,
    InfoCircleOutlined,
    SunOutlined,
    MoonOutlined,
    ExportOutlined,
} from '@ant-design/icons';
import { Antigravity, Aws, Cursor, Microsoft, Qoder, Trae, Windsurf } from '@lobehub/icons';
import { ItemData, ViewMode } from '../../types';
import type { ExportAvailability } from '../../types/index-page.types';
import {
    getVisibleIDEOptions,
    IDEAvailabilityMap,
    MainIDE,
    MainIDEPreference,
    resolveVisibleIDEPreference,
} from '../../../common/ide';
import SettingsDialog from '../SettingsDialog';
import { hasExplicitLocalPath } from '../../utils/localPath';
import { apiService } from '../../services/api';

const { Header } = Layout;
const { useToken } = theme;

const FigmaIcon = (props: any) => (
    <span role="img" aria-label="figma" className="anticon anticon-figma" {...props}>
        <svg
            fill="currentColor"
            fillRule="evenodd"
            height="1em"
            width="1em"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            style={{ verticalAlign: 'middle' }}
        >
            <title>Figma</title>
            <path
                clipRule="evenodd"
                d="M6.082 8.241C4.83 7.441 4 6.057 4 4.483 4 2.007 6.05 0 8.578 0h7.844C18.95 0 21 2.007 21 4.483c0 1.574-.829 2.959-2.082 3.758C20.17 9.041 21 10.426 21 12c0 2.476-2.05 4.483-4.578 4.483h-.084A4.615 4.615 0 0113.24 15.3v4.176C13.24 21.98 11.145 24 8.599 24 6.076 24 4 21.998 4 19.517c0-1.574.829-2.959 2.082-3.758C4.829 14.959 4 13.574 4 12c0-1.574.829-2.959 2.082-3.759zM13.24 12c0 1.676 1.387 3.034 3.098 3.034h.084c1.711 0 3.099-1.358 3.099-3.034 0-1.676-1.388-3.034-3.1-3.034h-.083c-1.71 0-3.098 1.358-3.098 3.034zm-1.48-3.034H8.578C6.867 8.966 5.48 10.324 5.48 12c0 1.672 1.382 3.029 3.089 3.034H11.76V8.966zm-3.182 7.517h-.01c-1.707.005-3.089 1.362-3.089 3.034 0 1.67 1.403 3.034 3.12 3.034 1.74 0 3.161-1.381 3.161-3.075v-2.993H8.578zm3.182-8.966H8.578c-1.711 0-3.099-1.358-3.099-3.034 0-1.676 1.388-3.034 3.1-3.034h3.181v6.068zm4.662 0H13.24V1.45h3.182c1.711 0 3.099 1.358 3.099 3.034 0 1.676-1.388 3.034-3.1 3.034z"
            />
        </svg>
    </span>
);

interface AppHeaderProps {
    collapsed: boolean;
    setCollapsed: (collapsed: boolean) => void;
    selectedItem: ItemData | null;
    viewMode: ViewMode;
    setViewMode: (mode: ViewMode) => void;
    activeTab: string;
    selectedDeviceId: string;
    setSelectedDeviceId: (id: string) => void;
    deviceSegmentOptions: Array<{ value: string; icon: React.ReactNode }>;
    handleOpenWebEditor: () => void;
    handleExitWebEditor: () => void;
    handleRefreshElement: () => void;
    handleCopyLocalLink: () => void;
    handleCopyLANLink: () => void;
    getLANUrl: () => string;
    qrCodeVisible: boolean;
    setQrCodeVisible: (visible: boolean) => void;
    handleCopyToFigma: () => void;
    handleExportMake: () => void;
    setIsExportModalOpen: (open: boolean) => void;
    handleQuickCopyEditablePrototype?: () => void;
    handleQuickCopyRuntimeComponent?: () => void;
    handleOpenIdeFile: () => void | Promise<void>;
    handleOpenProjectInIDE: (ideOverride?: MainIDEPreference, targetPath?: string) => boolean | Promise<boolean>;
    onStartCurrentProjectServer?: () => void | Promise<void>;
    startServerLoading?: boolean;
    preferredIDE: MainIDEPreference;
    ideAvailability?: IDEAvailabilityMap;
    onPreferredIDEChange?: (ide: MainIDEPreference) => void;
    isDarkMode: boolean;
    setIsDarkMode: (dark: boolean) => void;
    quickEditAvailable: boolean;
    quickEditActive?: boolean;
    exportAvailability?: ExportAvailability;
    editorMode?: 'none' | 'quickEdit';
    lanAccessAllowed?: boolean;
    onSettingsSaved?: () => void;
}

export default function AppHeader({
    collapsed,
    setCollapsed,
    selectedItem,
    viewMode,
    setViewMode,
    activeTab,
    selectedDeviceId,
    setSelectedDeviceId,
    deviceSegmentOptions,
    handleOpenWebEditor,
    handleExitWebEditor,
    handleRefreshElement,
    handleCopyLocalLink,
    handleCopyLANLink,
    getLANUrl,
    qrCodeVisible,
    setQrCodeVisible,
    handleCopyToFigma,
    handleExportMake,
    setIsExportModalOpen,
    handleQuickCopyEditablePrototype = () => {},
    handleQuickCopyRuntimeComponent = () => {},
    handleOpenIdeFile,
    handleOpenProjectInIDE,
    onStartCurrentProjectServer,
    startServerLoading = false,
    preferredIDE,
    ideAvailability,
    onPreferredIDEChange,
    isDarkMode,
    setIsDarkMode,
    quickEditAvailable,
    quickEditActive = false,
    exportAvailability,
    editorMode = 'none',
    lanAccessAllowed = true,
    onSettingsSaved,
}: AppHeaderProps) {
    const [makeVersion, setMakeVersion] = React.useState<string | null>(null);
    const [isSettingsDialogOpen, setIsSettingsDialogOpen] = React.useState(false);
    const [openIdeLoading, setOpenIdeLoading] = React.useState(false);
    const { token } = useToken();

    const isQuickEditActive = quickEditActive || editorMode === 'quickEdit';
    const canOpenSelectedSource = hasExplicitLocalPath(selectedItem);
    const canOpenGenericFigmaExport = exportAvailability?.canOpenGenericFigmaExport ?? Boolean(selectedItem);
    const figmaDomDisabledReason = exportAvailability?.figmaDomDisabledReason || '';
    const canOpenGenericAxureExport = exportAvailability?.canOpenGenericAxureExport ?? Boolean(selectedItem);
    const axureSourceDisabledReason = exportAvailability?.axureSourceDisabledReason || '';
    const makeExportDisabledReason = exportAvailability?.makeExportDisabledReason || '';
    const showMakeExportEntry = activeTab === 'prototypes'
        && Boolean(selectedItem);
    const figmaMenuItems = [
        {
            key: 'copy-figma',
            icon: <CopyOutlined />,
            label: figmaDomDisabledReason ? `复制到 Figma（${figmaDomDisabledReason}）` : '复制到 Figma',
            disabled: Boolean(figmaDomDisabledReason),
        },
        ...(showMakeExportEntry ? [{
            key: 'export-make',
            icon: <DownloadOutlined />,
            label: makeExportDisabledReason ? `导出 Make（${makeExportDisabledReason}）` : '导出 Make',
            disabled: Boolean(makeExportDisabledReason),
        }] : []),
    ];

    React.useEffect(() => {
        let cancelled = false;

        fetch('/api/version')
            .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Request failed'))))
            .then((data) => {
                if (cancelled) return;
                const version = typeof data?.version === 'string' ? data.version : null;
                setMakeVersion(version);
            })
            .catch(() => {
                if (cancelled) return;
                setMakeVersion(null);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const visibleIDEOptions = getVisibleIDEOptions(ideAvailability);
    const activeOpenIDE = resolveVisibleIDEPreference(preferredIDE, ideAvailability) || visibleIDEOptions[0].value;
    const getIDEIcon = (ide: MainIDE) => {
        if (ide === 'cursor') return <Cursor size={16} color={token.colorText} />;
        if (ide === 'trae' || ide === 'trae_cn') return <Trae size={16} color={token.colorText} />;
        if (ide === 'windsurf') return <Windsurf size={16} color={token.colorText} />;
        if (ide === 'vscode') return <Microsoft size={16} color={token.colorText} />;
        if (ide === 'antigravity') return <Antigravity size={16} color={token.colorText} />;
        if (ide === 'kiro') return <Aws size={16} color={token.colorText} />;
        if (ide === 'qoder') return <Qoder size={16} color={token.colorText} />;
        return <AppstoreAddOutlined />;
    };

    const savePreferredIDE = async (ide: MainIDE) => {
        await apiService.saveServerPreferences({
            automation: {
                defaultIDE: ide,
            },
        });
        onPreferredIDEChange?.(ide);
    };

    const handleOpenWithIDE = async (ide: MainIDE) => {
        if (openIdeLoading) return;
        setOpenIdeLoading(true);

        try {
            const opened = await Promise.resolve(handleOpenProjectInIDE(ide));

            if (!opened) {
                return;
            }

            try {
                await savePreferredIDE(ide);
            } catch (error: any) {
                message.warning(error?.message || '保存主力 IDE 失败');
            }
        } finally {
            setOpenIdeLoading(false);
        }
    };

    const openInIDEMenuItems = [
        {
            type: 'group' as const,
            label: '在编辑器中打开',
            children: visibleIDEOptions.map((option) => ({
                key: option.value,
                label: option.label,
                icon: getIDEIcon(option.value),
            })),
        },
    ];

    const renderOpenProjectDropdown = (title: string) => (
        <Tooltip title={title}>
            <Dropdown.Button
                size="small"
                type="default"
                style={{ fontSize: 12 }}
                loading={openIdeLoading}
                menu={{
                    items: openInIDEMenuItems,
                    onClick: ({ key }) => {
                        void handleOpenWithIDE(key as MainIDE);
                    },
                }}
                onClick={() => {
                    void handleOpenWithIDE(activeOpenIDE);
                }}
            >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                    {getIDEIcon(activeOpenIDE)}
                    打开项目
                </span>
            </Dropdown.Button>
        </Tooltip>
    );

    const isFileProtocol = window.location.protocol === 'file:';
    const localUrl = isFileProtocol
        ? window.location.href
        : selectedItem?.clientUrl || selectedItem?.previewUrl || '';

    const openUrl = (url: string) => {
        if (!url) {
            message.warning('当前环境无法打开该链接');
            return;
        }
        window.open(url, '_blank');
    };

    const canUseLAN = lanAccessAllowed && !isFileProtocol;
    const lanUrl = canUseLAN ? getLANUrl() : '';
    const showLAN = Boolean(lanUrl);

    const sharePopoverContent = (
        <div style={{ width: 200, padding: '4px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showLAN ? 12 : 0 }}>
                <span style={{ fontSize: 13, color: token.colorTextSecondary }}>本地链接</span>
                <Space size={4}>
                    <Tooltip title="新窗口打开">
                        <Button
                            type="text"
                            size="small"
                            icon={<ExportOutlined />}
                            onClick={() => openUrl(localUrl)}
                        />
                    </Tooltip>
                    <Tooltip title="复制链接">
                        <Button
                            type="text"
                            size="small"
                            icon={<CopyOutlined />}
                            onClick={handleCopyLocalLink}
                        />
                    </Tooltip>
                </Space>
            </div>
            {showLAN && (
                <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 13, color: token.colorTextSecondary }}>局域网链接</span>
                        <Space size={4}>
                            <Tooltip title="新窗口打开">
                                <Button
                                    type="text"
                                    size="small"
                                    icon={<ExportOutlined />}
                                    onClick={() => openUrl(lanUrl)}
                                />
                            </Tooltip>
                            <Tooltip title="复制链接">
                                <Button
                                    type="text"
                                    size="small"
                                    icon={<CopyOutlined />}
                                    onClick={handleCopyLANLink}
                                />
                            </Tooltip>
                        </Space>
                    </div>
                    <Divider style={{ margin: '12px 0' }} />
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            局域网扫码访问
                        </Typography.Text>
                        <div style={{
                            padding: 8,
                            background: token.colorBgLayout,
                            borderRadius: token.borderRadiusLG,
                            border: `1px solid ${token.colorBorderSecondary}`
                        }}>
                            <QRCode value={lanUrl} size={140} bordered={false} />
                        </div>
                    </div>
                </>
            )}
        </div>
    );

    return (
        <Header
            hasSider
            style={{
                height: '48px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: token.colorBgContainer,
                padding: '0 16px',
                position: 'sticky',
                top: 0,
                zIndex: 1000,
                boxShadow: `0 2px 8px ${token.colorBorderSecondary}`,
            }}
        >
            {/* Left: Logo and Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', width: 224 }}>
                <Button
                    type="text"
                    icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                    onClick={() => setCollapsed(!collapsed)}
                    style={{
                        fontSize: '16px',
                        height: 40
                    }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px', fontWeight: 600, color: token.colorText }}>
                        Axhub <span style={{ color: 'hsl(var(--brand))' }}>Make</span>
                    </span>
                </div>
            </div>

            {/* Center: View Mode Switcher */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                {!isQuickEditActive && (
                    <Segmented
                        value={viewMode}
                        size="small"
                        style={{ fontSize: '12px' }}
                        onChange={(value: string | number) => setViewMode(value as ViewMode)}
                        options={[
                            { label: '原型', value: 'demo', icon: <EyeOutlined /> },
                        ]}
                    />
                )}
            </div>

            {/* Right: Theme Toggle and Help Menu */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {renderOpenProjectDropdown('打开项目')}
                <Dropdown
                                    menu={{
                        items: [
                            {
                                key: 'settings',
                                label: '项目设置',
                                icon: <GlobalOutlined />,
                                onClick: () => setIsSettingsDialogOpen(true),
                            },
                            ...(onStartCurrentProjectServer ? [{
                                key: 'start-server',
                                label: '启动客户端',
                                icon: <ReloadOutlined spin={startServerLoading} />,
                                disabled: startServerLoading,
                                onClick: () => { void onStartCurrentProjectServer(); },
                            }] : []),
                            {
                                key: 'theme',
                                label: isDarkMode ? '浅色模式' : '深色模式',
                                icon: isDarkMode ? <SunOutlined /> : <MoonOutlined />,
                                onClick: () => setIsDarkMode(!isDarkMode),
                            },
                            { type: 'divider' },
                            {
                                key: 'site',
                                label: 'Axhub 官网',
                                icon: <GlobalOutlined />,
                                onClick: () => window.open('https://axhub.im/', '_blank'),
                            },
                            {
                                key: 'github',
                                label: 'GitHub',
                                icon: <GithubOutlined />,
                                onClick: () => window.open('https://github.com/lintendo/Axhub-Make', '_blank'),
                            },
                            { type: 'divider' },
                            {
                                key: 'version',
                                label: 'Axhub Make',
                                icon: <InfoCircleOutlined />,
                                extra: <span style={{ fontSize: 12, color: token.colorTextSecondary }}>{makeVersion ? `v${makeVersion}` : '-'}</span>,
                            },
                        ]
                    }}
                    placement="bottomRight"
                >
                    <Button size="small" type="text" icon={<MenuOutlined />} />
                </Dropdown>
            </div>

            {/* Actions - Centered Absolutely */}
            {selectedItem && (
                <div style={{
                    position: 'absolute',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    alignItems: 'center'
                }}>
                    <Space size="small">
                        {isQuickEditActive ? (
                            <>
                                <Button
                                    type="text"
                                    size="small"
                                    className="ax-header-quick-edit-button"
                                    icon={<ReloadOutlined />}
                                    onClick={handleRefreshElement}
                                >
                                    刷新
                                </Button>
                                <Button
                                    type="text"
                                    size="small"
                                    className="ax-header-quick-edit-button"
                                    icon={<ReloadOutlined />}
                                    onClick={handleExitWebEditor}
                                >
                                    退出
                                </Button>
                            </>
                        ) : selectedItem && (
                            <>
                                {/* Device Selector */}
                                {activeTab === 'prototypes' && !isQuickEditActive && (
                                    <Segmented
                                        value={selectedDeviceId}
                                        size="small"
                                        shape="round"
                                        onChange={(value: string | number) => setSelectedDeviceId(value as string)}
                                        options={deviceSegmentOptions}
                                    />
                                )}

                                {canOpenSelectedSource ? (
                                    <Tooltip title="在编辑器中打开">
                                        <Button
                                            type="text"
                                            size="small"
                                            icon={<CodeOutlined />}
                                            onClick={handleOpenIdeFile}
                                        />
                                    </Tooltip>
                                ) : null}

                                <Tooltip title={isQuickEditActive ? '退出快速编辑' : '快速编辑'}>
                                    <Button
                                        type="text"
                                        size="small"
                                        disabled={!quickEditAvailable}
                                        icon={<ReloadOutlined />}
                                        onClick={() => {
                                            if (isQuickEditActive) {
                                                handleExitWebEditor();
                                                return;
                                            }
                                            handleOpenWebEditor();
                                        }}
                                    />
                                </Tooltip>

                                <Tooltip title="刷新">
                                    <Button
                                        type="text"
                                        size="small"
                                        icon={<ReloadOutlined />}
                                        onClick={handleRefreshElement}
                                    />
                                </Tooltip>

                                <Popover
                                    trigger="click"
                                    placement="bottomRight"
                                    open={qrCodeVisible}
                                    onOpenChange={setQrCodeVisible}
                                    content={sharePopoverContent}
                                >
                                    <Tooltip title="分享">
                                        <Button
                                            type="text"
                                            size="small"
                                            icon={<ShareAltOutlined />}
                                        />
                                    </Tooltip>
                                </Popover>

                                <Dropdown
                                    menu={{
                                        items: figmaMenuItems,
                                        onClick: ({ key }) => {
                                            if (key === 'copy-figma') {
                                                handleCopyToFigma();
                                                return;
                                            }
                                            if (key === 'export-make') {
                                                handleExportMake();
                                            }
                                        },
                                    }}
                                    disabled={!canOpenGenericFigmaExport}
                                >
                                    <Tooltip title="导出到 Figma">
                                        <Button
                                            type="text"
                                            size="small"
                                            icon={<FigmaIcon />}
                                            disabled={!canOpenGenericFigmaExport}
                                            onClick={(event) => event.preventDefault()}
                                        />
                                    </Tooltip>
                                </Dropdown>

                                <Dropdown.Button
                                    type="primary"
                                    size="small"
                                    style={{ fontSize: '12px' }}
                                    icon={<DownloadOutlined />}
                                    disabled={!canOpenGenericAxureExport}
                                    menu={{
                                        items: [
                                            { key: 'copy-editable-prototype', label: '复制可编辑原型', disabled: !canOpenGenericAxureExport },
                                            { key: 'copy-runtime-component', label: '复制 runtime 组件', disabled: Boolean(axureSourceDisabledReason) },
                                        ],
                                        onClick: ({ key }) => {
                                            if (key === 'copy-editable-prototype') {
                                                handleQuickCopyEditablePrototype();
                                                return;
                                            }
                                            if (key === 'copy-runtime-component') {
                                                handleQuickCopyRuntimeComponent();
                                            }
                                        },
                                    }}
                                    onClick={() => {
                                        setIsExportModalOpen(true);
                                    }}
                                >
                                    导出到 Axure
                                </Dropdown.Button>
                            </>
                        )}
                    </Space>
                </div>
            )}
            <SettingsDialog
                open={isSettingsDialogOpen}
                onClose={() => setIsSettingsDialogOpen(false)}
                onSaved={() => {
                    onSettingsSaved?.();
                }}
            />
        </Header>
    );
}
