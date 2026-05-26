import React, { useState } from 'react';
import { Button, Modal, Table, message, Space } from 'antd';
import { ImportOutlined } from '@ant-design/icons';
import Papa from 'papaparse';
import { FileDropzone } from '@/components/ui/file-dropzone';
import { decodeCsvBytes } from '../utils/csvEncoding';

interface CSVImportProps {
    fileName: string;
    tableName: string;
    onImportComplete: () => void;
}

export default function CSVImport({ fileName, tableName, onImportComplete }: CSVImportProps) {
    const [visible, setVisible] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [csvText, setCsvText] = useState<string | null>(null);
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [previewColumns, setPreviewColumns] = useState<any[]>([]);
    const [importing, setImporting] = useState(false);
    const [messageApi, contextHolder] = message.useMessage();

    const resetImportState = () => {
        setFile(null);
        setCsvText(null);
        setPreviewData([]);
        setPreviewColumns([]);
    };

    const handleOpenDialog = () => {
        setVisible(true);
        resetImportState();
    };

    const handleCancel = () => {
        setVisible(false);
        resetImportState();
    };

    const readCsvText = async (selectedFile: File) => {
        const buffer = await selectedFile.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        return decodeCsvBytes(bytes).text;
    };

    const parseCsvText = (text: string, onComplete: (results: Papa.ParseResult<any>) => void, onError: (error: Error) => void) => {
        Papa.parse(text, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            complete: onComplete,
            error: onError
        });
    };

    const handleFileSelect = async (selectedFiles: File[]) => {
        const selectedFile = selectedFiles[0];
        if (!selectedFile) return;

        if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
            messageApi.error('仅支持上传 CSV 文件');
            return;
        }

        setFile(selectedFile);
        setCsvText(null);
        setPreviewData([]);
        setPreviewColumns([]);

        try {
            const text = await readCsvText(selectedFile);
            setCsvText(text);

            // Parse CSV for preview
            parseCsvText(
                text,
                (results) => {
                    if (results.errors.length > 0) {
                        messageApi.error('CSV解析失败: ' + results.errors[0].message);
                        return;
                    }

                    // Limit preview to first 10 rows
                    const previewRows = results.data.slice(0, 10);
                    setPreviewData(previewRows);

                    // Generate columns from first row
                    if (results.data.length > 0) {
                        const firstRow = results.data[0] as any;
                        const cols = Object.keys(firstRow).map(key => ({
                            title: key,
                            dataIndex: key,
                            key: key,
                            ellipsis: true,
                            render: (value: any) => {
                                if (value === null || value === undefined) {
                                    return <span style={{ color: '#ccc' }}>-</span>;
                                }
                                if (typeof value === 'object') {
                                    return JSON.stringify(value);
                                }
                                return String(value);
                            }
                        }));
                        setPreviewColumns(cols);
                    }
                },
                (error) => {
                    messageApi.error('CSV解析失败: ' + error.message);
                }
            );
        } catch (error: any) {
            messageApi.error(error?.message || 'CSV读取失败');
        }

    };

    const handleConfirmImport = async () => {
        if (!file) {
            messageApi.error('请先选择CSV文件');
            return;
        }

        setImporting(true);
        const hide = messageApi.loading('正在导入数据...', 0);

        try {
            const text = csvText ?? await readCsvText(file);

            // Parse CSV file
            parseCsvText(
                text,
                async (results) => {
                    try {
                        if (results.errors.length > 0) {
                            throw new Error('CSV解析失败: ' + results.errors[0].message);
                        }

                        // Convert data back to CSV string for backend
                        const csvString = Papa.unparse(results.data, {
                            quotes: true,
                            header: true
                        });

                        // Send to backend
                        const response = await fetch(`/api/data/${encodeURIComponent(fileName)}/import`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                csvData: csvString
                            }),
                        });

                        if (!response.ok) {
                            const errorData = await response.json();
                            throw new Error(errorData.error || '导入失败');
                        }

                        const result = await response.json();
                        messageApi.success(`导入成功！共导入 ${result.recordCount} 条记录`);

                        setVisible(false);
                        resetImportState();
                        onImportComplete();
                    } catch (error: any) {
                        messageApi.error(error.message || '导入失败');
                    } finally {
                        hide();
                        setImporting(false);
                    }
                },
                (error) => {
                    messageApi.error('CSV解析失败: ' + error.message);
                    hide();
                    setImporting(false);
                }
            );
        } catch (error: any) {
            messageApi.error(error.message || '导入失败');
            hide();
            setImporting(false);
        }
    };

    return (
        <>
            {contextHolder}
            <Button
                icon={<ImportOutlined />}
                onClick={handleOpenDialog}
                size="small"
            >
                导入CSV
            </Button>

            <Modal
                title={`导入CSV到 "${tableName}"`}
                open={visible}
                onCancel={handleCancel}
                onOk={handleConfirmImport}
                okText="确认导入"
                cancelText="取消"
                width={800}
                confirmLoading={importing}
                okButtonProps={{ disabled: !file }}
            >
                <Space direction="vertical" style={{ width: '100%' }} size="large">
                    <div>
                        <FileDropzone
                            accept=".csv"
                            multiple={false}
                            disabled={importing}
                            title="点击上传或拖拽 CSV 文件到此区域"
                            description="支持单个 CSV 文件，上传后会先解析并展示前 10 行预览。"
                            browseLabel="选择 CSV 文件"
                            selectedFiles={file ? [file] : []}
                            onFilesSelected={handleFileSelect}
                            onClear={resetImportState}
                        />
                    </div>

                    {file && (
                        <>
                            <div style={{
                                padding: '12px',
                                background: '#fff7e6',
                                border: '1px solid #ffd591',
                                borderRadius: '4px',
                                marginBottom: 16
                            }}>
                                <strong>⚠️ 导入模式：覆盖模式</strong>
                                <div style={{ fontSize: '12px', color: '#666', marginTop: 4 }}>
                                    导入将完全替换表中所有现有数据，请确保已备份重要数据
                                </div>
                            </div>

                            <div>
                                <div style={{ marginBottom: 8 }}>
                                    <strong>数据预览（前10行）：</strong>
                                </div>
                                <Table
                                    columns={previewColumns}
                                    dataSource={previewData}
                                    pagination={false}
                                    scroll={{ x: 'max-content' }}
                                    size="small"
                                    bordered
                                    rowKey={(_, index) => index?.toString() || '0'}
                                />
                                {previewData.length === 10 && (
                                    <div style={{ marginTop: 8, color: '#666', fontSize: '12px' }}>
                                        仅显示前10行，实际将导入所有数据
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </Space>
            </Modal>
        </>
    );
}
