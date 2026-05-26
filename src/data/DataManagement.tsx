import React, { useState, useEffect } from 'react';
import { Layout, Menu, Spin, message, Button, Modal, Input, Empty } from 'antd';
import {
    DatabaseOutlined,
    PlusOutlined,
    DeleteOutlined,
    ReloadOutlined
} from '@ant-design/icons';
import DataTable from './components/DataTable';

const { Sider, Content } = Layout;

interface TableInfo {
    fileName: string;
    tableName: string;
}

interface DataManagementProps {
    // No props needed - standalone component
}

export default function DataManagement({}: DataManagementProps) {
    const [loading, setLoading] = useState(true);
    const [tables, setTables] = useState<TableInfo[]>([]);
    const [selectedTable, setSelectedTable] = useState<string | null>(null);
    const [messageApi, contextHolder] = message.useMessage();
    const [modal, modalContextHolder] = Modal.useModal();
    const [createTableVisible, setCreateTableVisible] = useState(false);
    const [newTableName, setNewTableName] = useState('');

    useEffect(() => {
        loadTables();
    }, []);

    const loadTables = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/data/tables');
            if (!response.ok) {
                throw new Error('Failed to fetch tables');
            }
            const data = await response.json();
            // Backend returns array directly, not wrapped in {tables: [...]}
            setTables(Array.isArray(data) ? data : []);

            // Auto-select first table if available
            if (Array.isArray(data) && data.length > 0 && !selectedTable) {
                setSelectedTable(data[0].fileName);
            }
        } catch (error: any) {
            messageApi.error('加载表列表失败: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleTableSelect = (fileName: string) => {
        setSelectedTable(fileName);
    };

    const handleCreateTable = () => {
        setCreateTableVisible(true);
        setNewTableName('');
    };

    const handleCreateTableSubmit = async () => {
        if (!newTableName.trim()) {
            messageApi.error('请输入表名');
            return;
        }

        const hide = messageApi.loading('正在创建表...', 0);
        try {
            const response = await fetch('/api/data/tables', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    tableName: newTableName.trim()
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || '创建表失败');
            }

            messageApi.success('表创建成功');
            setCreateTableVisible(false);
            loadTables();
        } catch (error: any) {
            messageApi.error(error.message || '创建表失败');
        } finally {
            hide();
        }
    };

    const handleDeleteTable = (fileName: string, tableName: string) => {
        modal.confirm({
            title: `确定要删除表 "${tableName}" 吗？`,
            content: '删除后无法恢复，请谨慎操作。',
            okText: '确认删除',
            okType: 'danger',
            cancelText: '取消',
            async onOk() {
                const hide = messageApi.loading('正在删除...', 0);
                try {
                    const response = await fetch(`/api/data/tables/${encodeURIComponent(fileName)}`, {
                        method: 'DELETE',
                    });

                    if (!response.ok) {
                        const data = await response.json();
                        throw new Error(data.error || '删除失败');
                    }

                    messageApi.success('删除成功');
                    if (selectedTable === fileName) {
                        setSelectedTable(null);
                    }
                    loadTables();
                } catch (error: any) {
                    messageApi.error(error.message || '删除失败');
                } finally {
                    hide();
                }
            }
        });
    };

    const menuItems = tables.map(table => ({
        key: table.fileName,
        label: (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{table.tableName}</span>
                <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTable(table.fileName, table.tableName);
                    }}
                />
            </div>
        ),
        icon: <DatabaseOutlined />
    }));

    return (
        <Layout style={{ height: 'calc(100vh - 48px)', background: '#fff' }}>
            {contextHolder}
            {modalContextHolder}

            {/* Sidebar - Table List */}
            <Sider
                width={240}
                style={{
                    background: '#fff',
                    borderRight: '1px solid #f0f0f0',
                    overflow: 'hidden',
                }}
            >
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '16px', borderBottom: '1px solid #f0f0f0' }}>
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={handleCreateTable}
                            block
                        >
                            新建表
                        </Button>
                        <Button
                            icon={<ReloadOutlined />}
                            onClick={loadTables}
                            block
                            style={{ marginTop: 8 }}
                        >
                            刷新
                        </Button>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        {loading ? (
                            <div style={{ textAlign: 'center', padding: '40px 0' }}>
                                <Spin tip="加载中..." />
                            </div>
                        ) : tables.length === 0 ? (
                            <Empty
                                description="暂无数据表"
                                style={{ marginTop: 40 }}
                            />
                        ) : (
                            <Menu
                                mode="inline"
                                selectedKeys={selectedTable ? [selectedTable] : []}
                                items={menuItems}
                                onClick={({ key }) => handleTableSelect(key)}
                                style={{ borderRight: 0 }}
                            />
                        )}
                    </div>
                </div>
            </Sider>

            {/* Main Content Area */}
            <Content style={{ padding: '24px', overflow: 'auto' }}>
                {!selectedTable ? (
                    <Empty
                        description="请选择一个数据表"
                        style={{ marginTop: 100 }}
                    />
                ) : (
                    <DataTable
                        fileName={selectedTable}
                        tableName={tables.find(t => t.fileName === selectedTable)?.tableName || selectedTable}
                        onRefresh={loadTables}
                    />
                )}
            </Content>

            {/* Create Table Modal */}
            <Modal
                title="新建数据表"
                open={createTableVisible}
                onOk={handleCreateTableSubmit}
                onCancel={() => setCreateTableVisible(false)}
                okText="创建"
                cancelText="取消"
            >
                <div>
                    <label style={{ display: 'block', marginBottom: 8 }}>
                        数据表名称:
                    </label>
                    <Input
                        placeholder="例如: 用户表, 产品列表"
                        value={newTableName}
                        onChange={(e) => setNewTableName(e.target.value)}
                        autoFocus
                    />
                    <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
                        支持中文、英文、数字等，文件名将自动生成
                    </div>
                </div>
            </Modal>
        </Layout>
    );
}
