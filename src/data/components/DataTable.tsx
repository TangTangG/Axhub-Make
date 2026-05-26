import React, { useState, useEffect } from 'react';
import { Table, Button, Space, message, Popconfirm, Input, Form, InputNumber, Empty, Tooltip, theme } from 'antd';
import { DeleteOutlined, ReloadOutlined, EditOutlined, SaveOutlined, CloseOutlined } from '@ant-design/icons';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import CSVImport from './CSVImport';
import CSVExport from './CSVExport';

interface DataRecord {
    id: string | number;
    [key: string]: any;
}

interface DataTableProps {
    fileName: string;
    tableName: string;
    onRefresh?: () => void;
}

export default function DataTable({ fileName, tableName, onRefresh }: DataTableProps) {
    const { token } = theme.useToken();
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<DataRecord[]>([]);
    const [editingRecord, setEditingRecord] = useState<string | number | null>(null);
    const [editingData, setEditingData] = useState<DataRecord | null>(null);
    const [originalData, setOriginalData] = useState<DataRecord | null>(null); // Store original data for rollback
    const [pagination, setPagination] = useState<TablePaginationConfig>({
        current: 1,
        pageSize: 20,
        total: 0,
        showSizeChanger: true,
        showTotal: (total) => `共 ${total} 条记录`,
        size: 'small',
    });
    const [messageApi, contextHolder] = message.useMessage();
    const [form] = Form.useForm();

    useEffect(() => {
        loadData();
    }, [fileName]);

    const loadData = async () => {
        setLoading(true);
        try {
            const response = await fetch(`/api/data/${encodeURIComponent(fileName)}`);
            if (!response.ok) {
                throw new Error('Failed to fetch data');
            }
            const result = await response.json();
            setData(result);
            setPagination(prev => ({
                ...prev,
                total: result.length,
            }));
        } catch (error: any) {
            messageApi.error('加载数据失败: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string | number) => {
        const hide = messageApi.loading('正在删除...', 0);
        try {
            const response = await fetch(`/api/data/${encodeURIComponent(fileName)}/${encodeURIComponent(String(id))}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '删除失败');
            }

            messageApi.success('删除成功');
            loadData();
        } catch (error: any) {
            messageApi.error(error.message || '删除失败');
        } finally {
            hide();
        }
    };

    const handleEdit = (record: DataRecord) => {
        setEditingRecord(record.id);
        setEditingData({ ...record });
        setOriginalData({ ...record }); // Store original data for rollback
        form.setFieldsValue(record);
    };

    const handleCancelEdit = () => {
        // Rollback to original data
        if (originalData && editingRecord) {
            form.setFieldsValue(originalData);
        }
        setEditingRecord(null);
        setEditingData(null);
        setOriginalData(null);
        form.resetFields();
    };

    const validateField = (field: string, value: any): string | null => {
        // Basic validation rules
        if (field === 'id') {
            return 'ID字段不可编辑';
        }

        // Check for empty values in required fields
        if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
            return null; // Allow empty values for now
        }

        return null;
    };

    const handleSave = async () => {
        if (!editingRecord || !editingData) return;

        try {
            // Validate all fields
            const values = form.getFieldsValue();
            for (const [field, value] of Object.entries(values)) {
                const error = validateField(field, value);
                if (error) {
                    messageApi.error(error);
                    return;
                }
            }

            const hide = messageApi.loading('正在保存...', 0);

            try {
                // Prepare update data (exclude id field)
                const { id, ...updateData } = values;

                const response = await fetch(`/api/data/${encodeURIComponent(fileName)}/${encodeURIComponent(String(editingRecord))}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(updateData),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || '保存失败');
                }

                messageApi.success('保存成功');
                setEditingRecord(null);
                setEditingData(null);
                setOriginalData(null);
                form.resetFields();
                loadData();
            } catch (error: any) {
                // Rollback on error
                messageApi.error(error.message || '保存失败');

                if (originalData) {
                    // Restore original values in the form
                    form.setFieldsValue(originalData);
                    messageApi.info('已恢复到原始数据');
                }
            } finally {
                hide();
            }
        } catch (error: any) {
            messageApi.error('验证失败: ' + error.message);

            // Rollback on validation error
            if (originalData) {
                form.setFieldsValue(originalData);
                messageApi.info('已恢复到原始数据');
            }
        }
    };

    const handleTableChange = (newPagination: TablePaginationConfig) => {
        setPagination(newPagination);
    };

    const handleRefresh = () => {
        loadData();
        if (onRefresh) {
            onRefresh();
        }
    };

    const renderEditableCell = (value: any, record: DataRecord, field: string) => {
        const isEditing = editingRecord == record.id;

        if (!isEditing) {
            if (value === null || value === undefined) {
                return <span style={{ color: 'hsl(var(--muted-foreground))', opacity: 0.7 }}>-</span>;
            }
            if (typeof value === 'object') {
                return JSON.stringify(value);
            }
            return String(value);
        }

        // ID field is not editable
        if (field === 'id') {
            return (
                <Input
                    value={value}
                    disabled
                    size="small"
                    style={{ backgroundColor: 'hsl(var(--muted))' }}
                />
            );
        }

        // Determine input type based on value type
        const valueType = typeof value;

        if (valueType === 'number') {
            return (
                <Form.Item
                    name={field}
                    style={{ margin: 0 }}
                    rules={[
                        {
                            validator: (_, val) => {
                                const error = validateField(field, val);
                                if (error) {
                                    return Promise.reject(error);
                                }
                                return Promise.resolve();
                            }
                        }
                    ]}
                >
                    <InputNumber style={{ width: '100%' }} size="small" />
                </Form.Item>
            );
        }

        return (
            <Form.Item
                name={field}
                style={{ margin: 0 }}
                rules={[
                    {
                        validator: (_, val) => {
                            const error = validateField(field, val);
                            if (error) {
                                return Promise.reject(error);
                            }
                            return Promise.resolve();
                        }
                    }
                ]}
            >
                <Input size="small" />
            </Form.Item>
        );
    };

    // Generate columns dynamically based on data
    const generateColumns = (): ColumnsType<DataRecord> => {
        if (data.length === 0) {
            return [];
        }

        const keys = [...Object.keys(data[0])];
        const seenKeys = new Set(keys);

        data.slice(1).forEach(record => {
            Object.keys(record).forEach(key => {
                if (!seenKeys.has(key)) {
                    seenKeys.add(key);
                    keys.push(key);
                }
            });
        });

        const columns: ColumnsType<DataRecord> = keys.map(key => ({
            title: key,
            dataIndex: key,
            key: key,
            ellipsis: true,
            //width: key === 'id' ? 280 : undefined,
            render: (value: any, record: DataRecord) => renderEditableCell(value, record, key),
        }));

        // Add action column
        columns.push({
            title: '操作',
            key: 'action',
            fixed: 'right',
            width: 80,
            render: (_, record) => {
                const isEditing = editingRecord == record.id;

                if (isEditing) {
                    return (
                        <Space size="small">
                            <Tooltip title="保存">
                                <Button
                                    type="link"
                                    size="small"
                                    icon={<SaveOutlined />}
                                    onClick={handleSave}
                                />
                            </Tooltip>
                            <Tooltip title="取消">
                                <Button
                                    type="link"
                                    size="small"
                                    icon={<CloseOutlined />}
                                    onClick={handleCancelEdit}
                                />
                            </Tooltip>
                        </Space>
                    );
                }

                return (
                    <Space size="small">
                        <Tooltip title="编辑">
                            <Button
                                type="link"
                                size="small"
                                icon={<EditOutlined />}
                                onClick={() => handleEdit(record)}
                                disabled={editingRecord !== null}
                            />
                        </Tooltip>
                        <Popconfirm
                            title="确定要删除这条记录吗？"
                            onConfirm={() => handleDelete(record.id)}
                            okText="确定"
                            cancelText="取消"
                        >
                            <Tooltip title="删除">
                                <Button
                                    type="link"
                                    danger
                                    size="small"
                                    icon={<DeleteOutlined />}
                                    disabled={editingRecord !== null}
                                />
                            </Tooltip>
                        </Popconfirm>
                    </Space>
                );
            },
        });

        return columns;
    };

    const columns = generateColumns();

    return (
        <div className="ax-data-table" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            {contextHolder}
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>数据表: {tableName}</h3>
                <Space>
                    <CSVImport
                        fileName={fileName}
                        tableName={tableName}
                        onImportComplete={handleRefresh}
                    />
                    <CSVExport
                        fileName={fileName}
                        tableName={tableName}
                    />
                    <Button
                        icon={<ReloadOutlined />}
                        onClick={handleRefresh}
                        disabled={editingRecord !== null}
                        size="small"
                    >
                        刷新
                    </Button>
                </Space>
            </div>

            <Form form={form} component={false}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <Table
                        columns={columns}
                        dataSource={data}
                        rowKey={(record) => String(record.id)}
                        loading={loading}
                        pagination={pagination}
                        onChange={handleTableChange}
                        scroll={{ x: 'max-content', y: '100%' }}
                        bordered
                        size="small"
                        style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
                        className="full-height-table"
                        locale={{
                            emptyText: (
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    height: '100%',
                                    minHeight: '300px'
                                }}>
                                    <Empty
                                        description="暂无数据，请导入 CSV 或添加记录"
                                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                                    />
                                </div>
                            )
                        }}
                    />
                </div>
            </Form>
            <style>{`
                .full-height-table {
                    display: flex;
                    flex-direction: column;
                }
                .full-height-table .ant-spin-nested-loading {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }
                .full-height-table .ant-spin-container {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }
                .full-height-table .ant-table {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }
                .full-height-table .ant-table-container {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }
                .full-height-table .ant-table-content {
                    flex: 1;
                    overflow: auto !important;
                }
                .full-height-table .ant-table-body {
                    flex: 1;
                }
                .full-height-table .ant-table-placeholder {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .full-height-table .ant-table-pagination.ant-pagination {
                    margin: 8px 0 0 0 !important;
                }
                .ax-data-table .ant-btn:not(.ant-btn-primary):not(.ant-btn-link) {
                    border-color: ${token.colorBorder};
                    color: ${token.colorText};
                    background: ${token.colorBgContainer};
                }
                .ax-data-table .ant-btn:not(.ant-btn-primary):not(.ant-btn-link):hover {
                    border-color: ${token.colorPrimary};
                    color: ${token.colorPrimary};
                    background: ${token.colorPrimaryBg};
                }
                .ax-data-table .ant-btn-link {
                    border-color: transparent;
                    background: transparent;
                    color: ${token.colorTextSecondary};
                }
                .ax-data-table .ant-btn-link:hover {
                    background: ${token.colorPrimaryBg};
                    color: ${token.colorPrimary};
                }
                .ax-data-table .ant-btn-link.ant-btn-dangerous {
                    color: ${token.colorError};
                }
                .ax-data-table .ant-btn-link.ant-btn-dangerous:hover {
                    color: ${token.colorError};
                    background: ${token.colorErrorBg};
                }
                .ax-data-table .ant-btn:not(.ant-btn-primary):not(.ant-btn-link):disabled,
                .ax-data-table .ant-btn:not(.ant-btn-primary):not(.ant-btn-link)[disabled] {
                    border-color: ${token.colorBorder};
                    color: ${token.colorTextDisabled};
                    background: ${token.colorBgContainerDisabled};
                }
            `}</style>
        </div>
    );
}
