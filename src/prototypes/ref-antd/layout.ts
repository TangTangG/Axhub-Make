export type DashboardLayoutMode = 'mobile' | 'tablet' | 'desktop';

export type DashboardLayoutProfile = {
  mode: DashboardLayoutMode;
  showDesktopSider: boolean;
  showMobileNav: boolean;
  showMobileNavChrome: boolean;
  showOrderTable: boolean;
  showOrderCards: boolean;
  mobileDrawerClosable: boolean;
  mobileDrawerMaskClosable: boolean;
  metricSpan: 24 | 12 | 6;
  salesChartHeight: number;
  categoryChartHeight: number;
};

export function getDashboardLayoutProfile(width: number): DashboardLayoutProfile {
  if (width < 768) {
    return {
      mode: 'mobile',
      showDesktopSider: false,
      showMobileNav: true,
      showMobileNavChrome: false,
      showOrderTable: false,
      showOrderCards: true,
      mobileDrawerClosable: false,
      mobileDrawerMaskClosable: true,
      metricSpan: 24,
      salesChartHeight: 240,
      categoryChartHeight: 240,
    };
  }

  if (width < 1200) {
    return {
      mode: 'tablet',
      showDesktopSider: true,
      showMobileNav: false,
      showMobileNavChrome: false,
      showOrderTable: true,
      showOrderCards: false,
      mobileDrawerClosable: false,
      mobileDrawerMaskClosable: true,
      metricSpan: 12,
      salesChartHeight: 280,
      categoryChartHeight: 280,
    };
  }

  return {
    mode: 'desktop',
    showDesktopSider: true,
    showMobileNav: false,
    showMobileNavChrome: false,
    showOrderTable: true,
    showOrderCards: false,
    mobileDrawerClosable: false,
    mobileDrawerMaskClosable: true,
    metricSpan: 6,
    salesChartHeight: 320,
    categoryChartHeight: 320,
  };
}
