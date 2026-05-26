import React, { useState } from 'react';
import { Button, message } from 'antd';
import { ExportOutlined } from '@ant-design/icons';

interface CSVExportProps {
    fileName: string;
    tableName?: string; // Optional since it's not used in the component
}

export default function CSVExport({ fileName }: CSVExportProps) {
    const [exporting, setExporting] = useState(false);
    const [messageApi, contextHolder] = message.useMessage();

    const handleExport = async () => {
        setExporting(true);
        const hide = messageApi.loading('正在导出数据...', 0);

        try {
            // Call backend export API
            const response = await fetch(`/api/data/${encodeURIComponent(fileName)}/export`);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '导出失败');
            }

            // Get CSV content
            const csvContent = await response.text();

            // Create blob and trigger download
            const blob = new Blob(['\ufeff', csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${fileName}_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            messageApi.success('导出成功');
        } catch (error: any) {
            messageApi.error(error.message || '导出失败');
        } finally {
            hide();
            setExporting(false);
        }
    };

    return (
        <>
            {contextHolder}
            <Button
                icon={<ExportOutlined />}
                onClick={handleExport}
                loading={exporting}
                size="small"
            >
                导出CSV
            </Button>
        </>
    );
}
