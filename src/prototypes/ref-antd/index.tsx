/**
 * @name Antd 电商后台
 * @mode axure
 *
 * 参考资料：
 * - /skills/axure-export-workflow/SKILL.md
 * - /rules/development-guide.md
 * - /rules/axure-api-guide.md
 * - /docs/设计规范.UIGuidelines.md
 * - /src/themes/antd-new/designToken.json (Ant Design 主题)
 * - /skills/default-resource-recommendations/SKILL.md (Ant Design 组件库)
 */

import './style.css';
import React, { useState, useCallback, useImperativeHandle, forwardRef, useEffect, useRef, useMemo } from 'react';
import * as echarts from 'echarts';
import {
  Layout,
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Button,
  Space,
  List,
  Typography,
  DatePicker,
  theme,
  Drawer,
  Menu
} from 'antd';
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  ShoppingOutlined,
  UserOutlined,
  ShoppingCartOutlined,
  ReloadOutlined,
  DownloadOutlined,
  MenuOutlined,
  DashboardOutlined,
  SettingOutlined
} from '@ant-design/icons';

import type {
  KeyDesc,
  DataDesc,
  ConfigItem,
  Action,
  EventItem,
  AxureProps,
  AxureHandle
} from '../../common/axure-types';

import SideMenu from '../../components/side-menu';
import { getDashboardLayoutProfile } from './layout';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

// --- Chart Components ---

const SalesTrendChart = ({ height, compact }: { height: number; compact: boolean }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    
    chartInstance.current = echarts.init(chartRef.current);
    
    const option = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'line' }
      },
      grid: {
        left: '20', // Reduced padding
        right: '20',
        bottom: '10',
        top: '30',
        containLabel: true,
        borderWidth: 0
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: '#94a3b8',
          fontSize: compact ? 11 : 12
        }
      },
      yAxis: {
        type: 'value',
        splitLine: {
          lineStyle: { type: 'dashed', color: '#f1f5f9' }
        },
        axisLabel: {
          color: '#94a3b8',
          fontSize: compact ? 11 : 12
        }
      },
      series: [
        {
          name: '销售额',
          type: 'line',
          smooth: true,
          showSymbol: false,
          data: [12000, 13200, 10100, 13400, 9000, 23000, 21000],
          itemStyle: { color: '#3b82f6' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(59, 130, 246, 0.2)' },
              { offset: 1, color: 'rgba(59, 130, 246, 0)' }
            ])
          },
          lineStyle: { width: 3 }
        },
        {
          name: '到访用户',
          type: 'line',
          smooth: true,
          showSymbol: false,
          data: [2200, 1820, 1910, 2340, 2900, 3300, 3100],
          itemStyle: { color: '#10b981' },
          lineStyle: { width: 3 }
        }
      ]
    };

    chartInstance.current.setOption(option);

    // Use ResizeObserver for robust responsiveness
    const resizeObserver = new ResizeObserver(() => {
      chartInstance.current?.resize();
    });
    
    resizeObserver.observe(chartRef.current);

    return () => {
      resizeObserver.disconnect();
      chartInstance.current?.dispose();
    };
  }, [compact]);

  return <div ref={chartRef} className="chart-container" style={{ height }} />;
};

const CategoryPieChart = ({ height, compact }: { height: number; compact: boolean }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    
    chartInstance.current = echarts.init(chartRef.current);
    
    const option = {
      tooltip: {
        trigger: 'item'
      },
      legend: {
        bottom: '0%',
        left: 'center',
        icon: 'circle',
        itemWidth: compact ? 8 : 10,
        itemHeight: compact ? 8 : 10,
        itemGap: compact ? 12 : 18,
        textStyle: {
          fontSize: compact ? 11 : 12
        }
      },
      series: [
        {
          name: '销售占比',
          type: 'pie',
          radius: compact ? ['44%', '66%'] : ['40%', '70%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 10,
            borderColor: '#fff',
            borderWidth: 2
          },
          label: {
            show: false,
            position: 'center'
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 16,
              fontWeight: 'bold'
            }
          },
          labelLine: {
            show: false
          },
          data: [
            { value: 1048, name: '电子产品', itemStyle: { color: '#3b82f6' } },
            { value: 735, name: '服装', itemStyle: { color: '#6366f1' } },
            { value: 580, name: '家居', itemStyle: { color: '#8b5cf6' } },
            { value: 484, name: '美妆', itemStyle: { color: '#ec4899' } },
            { value: 300, name: '其他', itemStyle: { color: '#cbd5e1' } }
          ]
        }
      ]
    };

    chartInstance.current.setOption(option);

    // Use ResizeObserver for robust responsiveness
    const resizeObserver = new ResizeObserver(() => {
      chartInstance.current?.resize();
    });
    
    resizeObserver.observe(chartRef.current);

    return () => {
      resizeObserver.disconnect();
      chartInstance.current?.dispose();
    };
  }, [compact]);

  return <div ref={chartRef} className="chart-container" style={{ height }} />;
};

// --- Definitions ---

type DashboardMenuItem = {
  key: string;
  label: string;
  icon?: string;
  children?: DashboardMenuItem[];
};

const DASHBOARD_MENU_ITEMS: DashboardMenuItem[] = [
  { key: 'dashboard', label: '仪表盘', icon: 'dashboard' },
  {
    key: 'orders',
    label: '订单管理',
    icon: 'shop',
    children: [
      { key: 'orders_list', label: '订单列表' },
      { key: 'orders_refund', label: '退款管理' }
    ]
  },
  { key: 'users', label: '用户管理', icon: 'user' },
  { key: 'settings', label: '系统设置', icon: 'setting' }
];

function resolveMenuIcon(name?: string) {
  switch (name) {
    case 'dashboard':
      return <DashboardOutlined />;
    case 'shop':
      return <ShoppingOutlined />;
    case 'user':
      return <UserOutlined />;
    case 'setting':
      return <SettingOutlined />;
    default:
      return undefined;
  }
}

function mapMenuItems(items: DashboardMenuItem[]): any[] {
  return items.map((item) => ({
    key: item.key,
    label: item.label,
    icon: resolveMenuIcon(item.icon),
    children: Array.isArray(item.children) && item.children.length > 0 ? mapMenuItems(item.children) : undefined
  }));
}

function useViewportWidth() {
  const [width, setWidth] = useState<number>(() => {
    if (typeof window === 'undefined') {
      return 1440;
    }
    return window.innerWidth;
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleResize = () => {
      setWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return width;
}

const EVENT_LIST: EventItem[] = [
  { name: 'onOrderClick', desc: '点击订单时触发' },
  { name: 'onProductClick', desc: '点击商品时触发' }
];

const ACTION_LIST: Action[] = [
  { name: 'refreshData', desc: '刷新数据' }
];

const VAR_LIST: KeyDesc[] = [
  { name: 'selected_order', desc: '当前选中的订单' }
];

const CONFIG_LIST: ConfigItem[] = [
  { type: 'input', attributeId: 'title', displayName: '页面标题', info: '显示在页面顶部的标题', initialValue: '电商后台' }
];

const DATA_LIST: DataDesc[] = [
  {
    name: 'orders',
    desc: '最近订单',
    keys: [
      { name: 'id', desc: '订单号' },
      { name: 'customer', desc: '客户' },
      { name: 'amount', desc: '金额' },
      { name: 'status', desc: '状态' },
      { name: 'date', desc: '日期' }
    ]
  },
  {
    name: 'products',
    desc: '热销商品',
    keys: [
      { name: 'id', desc: '商品ID' },
      { name: 'name', desc: '商品名称' },
      { name: 'sales', desc: '销量' },
      { name: 'growth', desc: '增长率' }
    ]
  }
];

const Component = forwardRef<AxureHandle, AxureProps>(function EcommerceDashboard(innerProps, ref) {
  const dataSource = innerProps && innerProps.data ? innerProps.data : {};
  const configSource = innerProps && innerProps.config ? innerProps.config : {};
  const onEventHandler = typeof innerProps.onEvent === 'function' ? innerProps.onEvent : () => undefined;
  const viewportWidth = useViewportWidth();
  const layoutProfile = useMemo(() => getDashboardLayoutProfile(viewportWidth), [viewportWidth]);
  const menuItems = useMemo(() => mapMenuItems(DASHBOARD_MENU_ITEMS), []);

  const title = typeof configSource.title === 'string' && configSource.title ? configSource.title : '电商后台';
  
  const { token } = theme.useToken();

  const defaultOrders = [
    { id: 'ORD-2023001', customer: '张三', amount: 1299.00, status: 'completed', date: '2023-10-24' },
    { id: 'ORD-2023002', customer: '李四', amount: 899.50, status: 'processing', date: '2023-10-24' },
    { id: 'ORD-2023003', customer: '王五', amount: 2599.00, status: 'pending', date: '2023-10-23' },
    { id: 'ORD-2023004', customer: '赵六', amount: 128.00, status: 'rejected', date: '2023-10-23' },
    { id: 'ORD-2023005', customer: '孙七', amount: 599.00, status: 'completed', date: '2023-10-22' },
  ];

  const defaultProducts = [
    { id: 1, name: '无线降噪耳机 Pro', sales: 1234, growth: 12 },
    { id: 2, name: '智能运动手表 X', sales: 892, growth: -5 },
    { id: 3, name: '超薄机械键盘', sales: 645, growth: 8 },
    { id: 4, name: '4K 高清显示器', sales: 432, growth: 24 },
    { id: 5, name: '人体工学座椅', sales: 321, growth: 2 },
    { id: 6, name: '桌面收纳套装', sales: 298, growth: 15 },
    { id: 7, name: 'Type-C 扩展坞', sales: 256, growth: 3 },
  ];

  const orders = Array.isArray(dataSource.orders) ? dataSource.orders : defaultOrders;
  const products = Array.isArray(dataSource.products) ? dataSource.products : defaultProducts;

  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedMenuKey, setSelectedMenuKey] = useState('dashboard');

  const emitEvent = useCallback((eventName: string, payload?: any) => {
    try {
      onEventHandler(eventName, payload);
    } catch (error) {
      console.warn('onEvent 调用失败:', error);
    }
  }, [onEventHandler]);

  useImperativeHandle(ref, () => ({
    getVar: (name: string) => {
      const vars: Record<string, any> = { selected_order: selectedOrder };
      return vars[name];
    },
    fireAction: (name: string, params?: any) => {
      if (name === 'refreshData') {
        console.log('Refreshing data...');
      }
    },
    eventList: EVENT_LIST,
    actionList: ACTION_LIST,
    varList: VAR_LIST,
    configList: CONFIG_LIST,
    dataList: DATA_LIST
  }), [selectedOrder]);

  const getStatusTag = useCallback((status: string) => {
    switch (status) {
      case 'completed': return <Tag color="success" bordered={false}>已完成</Tag>;
      case 'processing': return <Tag color="processing" bordered={false}>处理中</Tag>;
      case 'pending': return <Tag color="warning" bordered={false}>待支付</Tag>;
      case 'rejected': return <Tag color="error" bordered={false}>已取消</Tag>;
      default: return <Tag bordered={false}>未知</Tag>;
    }
  }, []);

  const columns = [
    { title: '订单号', dataIndex: 'id', key: 'id', render: (text: string) => <Text strong>{text}</Text> },
    { title: '客户', dataIndex: 'customer', key: 'customer' },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      render: (val: number) => <Text>¥{val.toFixed(2)}</Text>
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => getStatusTag(status)
    },
    { title: '日期', dataIndex: 'date', key: 'date', className: 'text-gray-500' },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Button type="link" size="small" onClick={() => {
          setSelectedOrder(record);
          emitEvent('onOrderClick', { order: record });
        }}>
          详情
        </Button>
      )
    },
  ];

  const handleMenuSelect = useCallback((key: string) => {
    setSelectedMenuKey(key);
    setMobileMenuOpen(false);
  }, []);

  const handleMobileMenuClick = useCallback((info: any) => {
    const key = typeof info?.key === 'string' ? info.key : String(info?.key ?? '');
    if (!key) {
      return;
    }
    handleMenuSelect(key);
  }, [handleMenuSelect]);

  return (
    <Layout style={{ minHeight: '100dvh', background: '#f5f7fa' }}>
      {layoutProfile.showDesktopSider ? (
        <SideMenu
          title="电商后台"
          items={DASHBOARD_MENU_ITEMS}
          defaultSelectedKey={selectedMenuKey}
          defaultCollapsed={layoutProfile.mode === 'tablet'}
          onMenuSelect={handleMenuSelect}
        />
      ) : null}
      <Layout style={{ background: '#f5f7fa' }}>
        <Layout.Content className={`ecommerce-dashboard ecommerce-dashboard--${layoutProfile.mode}`}>
          {layoutProfile.showMobileNav ? (
            <>
              <Button
                type="text"
                icon={<MenuOutlined />}
                aria-label="打开导航菜单"
                className="dashboard-mobile-trigger"
                onClick={() => setMobileMenuOpen(true)}
              />

              <Drawer
                placement="left"
                width={280}
                open={mobileMenuOpen}
                onClose={() => setMobileMenuOpen(false)}
                className="dashboard-mobile-drawer"
                title={null}
                closable={layoutProfile.mobileDrawerClosable}
                maskClosable={layoutProfile.mobileDrawerMaskClosable}
                styles={{
                  header: { display: 'none' },
                  body: { padding: 12 }
                }}
              >
                <Menu
                  mode="inline"
                  items={menuItems}
                  selectedKeys={[selectedMenuKey]}
                  onClick={handleMobileMenuClick}
                  style={{ borderInlineEnd: 0 }}
                />
              </Drawer>
            </>
          ) : null}
          
          {/* Header Section */}
          <div className="dashboard-header">
            <div className="dashboard-header__intro">
              <Title level={layoutProfile.mode === 'mobile' ? 4 : 3} style={{ margin: 0, fontWeight: 600 }}>{title}</Title>
              <Text type="secondary" style={{ fontSize: 13 }}>欢迎回来，这里是今日的运营概况</Text>
            </div>
            <div className="dashboard-header__actions">
              <RangePicker className="dashboard-header__range" style={{ borderRadius: 6 }} />
              <Button type="primary" icon={<ReloadOutlined />} className="dashboard-header__action">刷新数据</Button>
              <Button icon={<DownloadOutlined />} className="dashboard-header__action">导出报表</Button>
            </div>
          </div>

          {/* Metrics Section */}
          <Row gutter={[20, 20]} className="metric-cards">
            <Col span={layoutProfile.metricSpan}>
              <Card bordered={false} bodyStyle={{ padding: '20px 24px' }} className="metric-card">
                <Statistic
                  title="总销售额"
                  value={126560}
                  precision={2}
                  valueStyle={{ color: '#1e293b', fontSize: 24, fontWeight: 'bold' }}
                  prefix={<span style={{ fontSize: 18, color: '#94a3b8', marginRight: 4 }}>¥</span>}
                />
                <div className="metric-footer">
                  <Space>
                    <Text type="secondary">周同比</Text>
                    <Text type="success" strong>+12%</Text>
                    <ArrowUpOutlined style={{ color: token.colorSuccess }} />
                  </Space>
                </div>
              </Card>
            </Col>
            <Col span={layoutProfile.metricSpan}>
              <Card bordered={false} bodyStyle={{ padding: '20px 24px' }} className="metric-card">
                <Statistic
                  title="到访用户"
                  value={8846}
                  valueStyle={{ color: '#1e293b', fontSize: 24, fontWeight: 'bold' }}
                  prefix={<UserOutlined style={{ fontSize: 18, color: '#3b82f6', marginRight: 8 }} />}
                />
                <div className="metric-footer">
                  <Space>
                    <Text type="secondary">日同比</Text>
                    <Text type="success" strong>+5%</Text>
                    <ArrowUpOutlined style={{ color: token.colorSuccess }} />
                  </Space>
                </div>
              </Card>
            </Col>
            <Col span={layoutProfile.metricSpan}>
              <Card bordered={false} bodyStyle={{ padding: '20px 24px' }} className="metric-card">
                <Statistic
                  title="支付订单"
                  value={1560}
                  valueStyle={{ color: '#1e293b', fontSize: 24, fontWeight: 'bold' }}
                  prefix={<ShoppingCartOutlined style={{ fontSize: 18, color: '#8b5cf6', marginRight: 8 }} />}
                />
                <div className="metric-footer">
                  <Space>
                    <Text type="secondary">周同比</Text>
                    <Text type="danger" strong>-8%</Text>
                    <ArrowDownOutlined style={{ color: token.colorError }} />
                  </Space>
                </div>
              </Card>
            </Col>
            <Col span={layoutProfile.metricSpan}>
              <Card bordered={false} bodyStyle={{ padding: '20px 24px' }} className="metric-card">
                <Statistic
                  title="转化率"
                  value={12.5}
                  precision={1}
                  valueStyle={{ color: '#1e293b', fontSize: 24, fontWeight: 'bold' }}
                  suffix="%"
                  prefix={<ShoppingOutlined style={{ fontSize: 18, color: '#ec4899', marginRight: 8 }} />}
                />
                <div className="metric-footer">
                  <Space>
                    <Text type="secondary">周同比</Text>
                    <Text type="success" strong>+2%</Text>
                    <ArrowUpOutlined style={{ color: token.colorSuccess }} />
                  </Space>
                </div>
              </Card>
            </Col>
          </Row>

          {/* Charts Section */}
          <Row gutter={[20, 20]} style={{ marginTop: 20 }}>
            <Col xs={24} lg={16}>
              <Card 
                title={<span style={{ fontWeight: 600 }}>销售趋势</span>} 
                bordered={false}
                extra={
                  <Space size={[8, 8]} wrap className="dashboard-card-extra">
                    <Tag color="blue" bordered={false}>本周</Tag>
                    <Tag bordered={false}>本月</Tag>
                    <Tag bordered={false}>全年</Tag>
                  </Space>
                }
                style={{ height: '100%' }}
                className="dashboard-card chart-card"
              >
                <SalesTrendChart
                  height={layoutProfile.salesChartHeight}
                  compact={layoutProfile.mode !== 'desktop'}
                />
              </Card>
            </Col>
            <Col xs={24} lg={8}>
              <Card
                title={<span style={{ fontWeight: 600 }}>销售品类占比</span>}
                bordered={false}
                style={{ height: '100%' }}
                className="dashboard-card chart-card"
              >
                <CategoryPieChart
                  height={layoutProfile.categoryChartHeight}
                  compact={layoutProfile.mode !== 'desktop'}
                />
              </Card>
            </Col>
          </Row>

          {/* Table Section */}
          <Row gutter={[20, 20]} style={{ marginTop: 20 }}>
            <Col xs={24} lg={16} style={{ display: 'flex' }}>
              <Card 
                title={<span style={{ fontWeight: 600 }}>最近订单</span>} 
                bordered={false}
                extra={<Button type="link">查看全部</Button>}
                style={{ width: '100%', display: 'flex', flexDirection: 'column' }}
                bodyStyle={{ flex: 1, padding: 24, overflow: 'hidden' }}
                className="dashboard-card orders-card"
              >
                {layoutProfile.showOrderTable ? (
                  <Table
                    columns={columns}
                    dataSource={orders}
                    rowKey="id"
                    pagination={false}
                    size="middle"
                    scroll={{ x: 680 }}
                  />
                ) : (
                  <div className="order-cards">
                    {orders.map((order: any) => (
                      <div key={order.id} className="order-card">
                        <div className="order-card__top">
                          <div>
                            <Text strong>{order.id}</Text>
                            <div className="order-card__meta">{order.customer}</div>
                          </div>
                          {getStatusTag(order.status)}
                        </div>
                        <div className="order-card__middle">
                          <Text type="secondary">下单日期 {order.date}</Text>
                          <Text className="order-card__amount">¥{Number(order.amount).toFixed(2)}</Text>
                        </div>
                        <Button
                          type="default"
                          block
                          onClick={() => {
                            setSelectedOrder(order);
                            emitEvent('onOrderClick', { order });
                          }}
                        >
                          查看详情
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </Col>
            <Col xs={24} lg={8} style={{ display: 'flex' }}>
              <Card 
                title={<span style={{ fontWeight: 600 }}>热销商品 Top 7</span>} 
                bordered={false}
                style={{ width: '100%', display: 'flex', flexDirection: 'column' }}
                bodyStyle={{ flex: 1, padding: '12px 24px' }}
                className="dashboard-card products-card"
              >
                <List
                  itemLayout="horizontal"
                  dataSource={products}
                  split={false}
                  renderItem={(item: any, index) => (
                    <List.Item
                      style={{ padding: '10px 0' }}
                      className="product-list__item"
                      onClick={() => emitEvent('onProductClick', { product: item })}
                    >
                      <List.Item.Meta
                        avatar={
                          <div style={{ 
                            width: 24, 
                            height: 24, 
                            borderRadius: '50%', 
                            background: index < 3 ? '#3b82f6' : '#f1f5f9',
                            color: index < 3 ? '#fff' : '#64748b',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 'bold',
                            fontSize: 12
                          }}>
                            {index + 1}
                          </div>
                        }
                        title={<Text style={{ fontSize: 14 }}>{item.name}</Text>}
                        description={
                          <div className="product-list__meta">
                            <Text type="secondary" style={{ fontSize: 12 }}>销量: {item.sales}</Text>
                            <Text type={item.growth > 0 ? 'success' : 'danger'} style={{ fontSize: 12 }}>
                              {item.growth > 0 ? '+' : ''}{item.growth}%
                            </Text>
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              </Card>
            </Col>
          </Row>
        </Layout.Content>
      </Layout>
    </Layout>
  );
});

export default Component;
