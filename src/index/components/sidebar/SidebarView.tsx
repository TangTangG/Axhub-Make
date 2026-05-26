import React, { useMemo, useState } from 'react';
import { Layout, Menu, Tabs, Input, Spin, FloatButton, Dropdown, Button, theme } from 'antd';
import { message } from 'antd';
import {
    AppstoreOutlined,
    FileTextOutlined,
    SearchOutlined,
    PlusOutlined,
    DownloadOutlined,
    RestOutlined,
    MoreOutlined,
    EditOutlined,
    HistoryOutlined,
    CopyOutlined,
    LinkOutlined,
} from '@ant-design/icons';
import { ItemData, TabType } from '../../types';
import { PromptClientPreference } from '../../types';
import { MainIDEPreference } from '../../../common/ide';
import VersionManager from '../VersionManager';
import { downloadExportHtmlArchive } from '../../domains/export/export.api';

const { Sider } = Layout;
const { useToken } = theme;

interface SidebarProps {
    collapsed: boolean;
    loading: boolean;
    activeTab: TabType;
    handleTabChange: (tab: TabType) => void;
    data: { components: ItemData[]; prototypes: ItemData[] };
    searchText: string;
    setSearchText: (text: string) => void;
    filteredItems: ItemData[];
    selectedItem: ItemData | null;
    handleMenuClick: (params: { key: string }) => void;
    handleDownloadItemSource: (item: ItemData) => void;
    handleRenameItem: (item: ItemData) => void;
    handleDuplicateItem: (item: ItemData) => void;
    handleDeleteItem: (item: ItemData) => void;
    handleCopyItemPath: (item: ItemData) => void;
    setCreateDialogVisible: (visible: boolean) => void;
    preferredPromptClient: PromptClientPreference;
    preferredIDE: MainIDEPreference;
}

export default function Sidebar({
    collapsed,
    loading,
    activeTab,
    handleTabChange,
    data,
    searchText,
    setSearchText,
    filteredItems,
    selectedItem,
    handleMenuClick,
    handleDownloadItemSource,
    handleRenameItem,
    handleDuplicateItem,
    handleDeleteItem,
    handleCopyItemPath,
    setCreateDialogVisible,
    preferredPromptClient,
    preferredIDE,
}: SidebarProps) {
    const { token } = useToken();

    const [versionDialogVisible, setVersionDialogVisible] = useState(false);
    const [currentVersionItem, setCurrentVersionItem] = useState<ItemData | null>(null);

    const handleVersionManagement = (item: ItemData) => {
        setCurrentVersionItem(item);
        setVersionDialogVisible(true);
    };

    const menuItems = useMemo(() => {
        return filteredItems.map(item => {
            const isSelected = selectedItem && selectedItem.name === item.name;
            const menuItemsList = [
                {
                    key: 'rename',
                    label: '重命名',
                    icon: <EditOutlined />
                },
                {
                    key: 'duplicate',
                    label: '创建副本',
                    icon: <CopyOutlined />
                },
                {
                    key: 'copy-path',
                    label: '复制路径',
                    icon: <LinkOutlined />
                },
                {
                    type: 'divider' as const
                },
                {
                    key: 'version-management',
                    label: '版本管理',
                    icon: <HistoryOutlined />
                },
                                {
                    key: 'download-source',
                    label: '导出 ZIP',
                    icon: <DownloadOutlined />
                },
                {
                    key: 'export-html',
                    label: '导出 HTML',
                    icon: <DownloadOutlined />
                },
                {
                    type: 'divider' as const
                },
                {
                    key: 'delete',
                    label: `删除${activeTab === 'components' ? '组件' : '原型'}`,
                    icon: <RestOutlined />,
                    danger: true
                }
            ];

            return {
                key: item.name,
                label: (
                    <div className={`menu-item-wrapper ${isSelected ? 'is-selected' : ''}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', flex: 1 }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.displayName}</span>
                        </div>
                        <Dropdown
                            trigger={['click']}
                            menu={{
                                items: menuItemsList,
                                onClick: ({ key }) => {
                                    if (key === 'download-source') {
                                        handleDownloadItemSource(item);
                                    } else if (key === 'export-html') {
                                        void (async () => {
                                            const itemLabel = item.displayName || item.name;
                                            const targetPath = `${activeTab}/${item.name}`;
                                            const toastKey = `export-html-${targetPath}`;
                                            message.loading({
                                                content: `正在导出「${itemLabel}」HTML，时间较长时请耐心等待...`,
                                                key: toastKey,
                                                duration: 0,
                                            });
                                            try {
                                                await downloadExportHtmlArchive(targetPath);
                                                message.success({
                                                    content: `「${itemLabel}」HTML 导出完成，已开始下载`,
                                                    key: toastKey,
                                                });
                                            } catch (error: any) {
                                                message.error({
                                                    content: error?.message || 'HTML 导出失败',
                                                    key: toastKey,
                                                });
                                            }
                                        })();
                                    } else if (key === 'rename') {
                                        handleRenameItem(item);
                                    } else if (key === 'duplicate') {
                                        handleDuplicateItem(item);
                                    } else if (key === 'copy-path') {
                                        handleCopyItemPath(item);
                                    } else if (key === 'version-management') {
                                        handleVersionManagement(item);
                                    } else if (key === 'delete') {
                                        handleDeleteItem(item);
                                    }
                                }
                            }}
                        >
                            <Button
                                type="text"
                                size="small"
                                className="more-btn"
                                icon={<MoreOutlined />}
                                onClick={(e) => {
                                    e.stopPropagation();
                                }}
                            />
                        </Dropdown>
                    </div>
                ),
                icon: activeTab === 'components' ? <AppstoreOutlined /> : <FileTextOutlined />
            };
        });
    }, [filteredItems, activeTab, selectedItem, handleDownloadItemSource, handleRenameItem, handleDeleteItem, handleCopyItemPath, handleDuplicateItem]);

    return (
        <Sider
            trigger={null}
            collapsible
            collapsed={collapsed}
            width={240}
            collapsedWidth={0}
            style={{
                background: token.colorBgContainer,
                borderRight: `1px solid ${token.colorBorder}`,
                overflow: 'hidden',
                height: 'calc(100vh - 48px)',
                position: 'sticky',
                top: 48
            }}
        >
            <div style={{ height: '100%', position: 'relative' }}>
                <div style={{ height: '100%', overflowY: 'auto' }}>
                    <div style={{ padding: '8px' }}>
                        {!collapsed && (
                            <>
                                <Tabs
                                    activeKey={activeTab}
                                    size="small"
                                    centered
                                    onChange={(key) => handleTabChange(key as TabType)}
                                    items={[
                                        {
                                            key: 'prototypes',
                                            label: `原型 (${data.prototypes.length})`,
                                            icon: <FileTextOutlined />
                                        },
                                        {
                                            key: 'components',
                                            label: `组件 (${data.components.length})`,
                                            icon: <AppstoreOutlined />
                                        }
                                    ]}
                                />
                                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                    <Input
                                        placeholder="搜索..."
                                        prefix={<SearchOutlined />}
                                        value={searchText}
                                        onChange={(e) => setSearchText(e.target.value)}
                                        allowClear
                                        style={{ flex: 1 }}
                                    />
                                </div>
                            </>
                        )}
                    </div>

                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '40px 0' }}>
                            <Spin tip="加载中..." />
                        </div>
                    ) : (
                        <>
                            <Menu
                                mode="inline"
                                selectedKeys={selectedItem ? [selectedItem.name] : []}
                                items={menuItems}
                                onClick={handleMenuClick}
                                style={{ borderRight: 0 }}
                            />
                            <div style={{ height: 80 }} />
                        </>
                    )}
                </div>
                {!collapsed && (
                    <FloatButton
                        icon={<PlusOutlined />}
                        type="primary"
                        style={{ position: 'absolute', left: 24, bottom: 24 }}
                        onClick={() => setCreateDialogVisible(true)}
                        tooltip={activeTab === 'components' ? '新建组件' : '新建原型'}
                    />
                )}
            </div>
            <VersionManager
                visible={versionDialogVisible}
                onCancel={() => setVersionDialogVisible(false)}
                item={currentVersionItem}
                activeTab={activeTab}
                preferredPromptClient={preferredPromptClient}
                preferredIDE={preferredIDE}
            />
        </Sider>
    );
}
