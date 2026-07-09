export interface DashboardGridDataItem {
  depth1: string;
  depth2: string;
  depth3: string;
  salesAmount: number;
  quantity: number;
}

export interface DashboardChartDataItem {
  name: string;
  value: number;
}

export interface DashboardBreakdownItem {
  category_code: string;
  category_name: string;
  shop_name?: string;
  facility_name?: string;
  revenue?: number;
  today_actual: number;
  today_ly: number;
  mtd_actual: number;
  mtd_ly: number;
  ytd_actual: number;
  ytd_ly: number;
  
  // Additional quantities
  roomsSold?: number;
  rooms_sold?: number;
  rooms_sold_weighted?: number;
  room_nights?: number;
  visitors?: number;
  qty?: number;
  
  // RateCode/Segment fields
  rateCode?: string;
  rate_code?: string;
  segment?: string;
  segment_name?: string;
  channel_name?: string;
  room_type?: string;
  pyType?: string;
  capacity?: number;
  total_capacity?: number;
  period_capacity?: number;
}

export type DashboardChannelBreakdownItem = DashboardBreakdownItem;
export type DashboardRateCodeBreakdownItem = DashboardBreakdownItem;

export interface DashboardRevenueResponse {
  startDate: string;
  endDate: string;
  date: string;
  
  // V5 properties (with ETL injected fields)
  roomSummary?: { totalRoomRevenue: number; totalRoomsSold: number; mtd_actual?: number; ytd_actual?: number; today_ly?: number; };
  golfSummary?: { totalGolfRevenue: number; mtd_actual?: number; ytd_actual?: number; today_ly?: number; };
  ticketSummary?: { 
    totalTicketRevenue: number; 
    mtd_actual?: number; 
    ytd_actual?: number; 
    today_ly?: number; 
    productLevelMapping?: { ticketName?: string; groupName: string }[];
    facilityLevelMapping?: { facilityName?: string; groupName: string }[];
    facilityBreakdown?: any[];
  };
  fnbSummary?: { totalFnbRevenue: number; mtd_actual?: number; ytd_actual?: number; today_ly?: number; };

  today?: { actual: number; ly_actual: number; gross?: number; vat?: number };
  mtd?: { actual: number; ly_actual: number; gross?: number; vat?: number };
  ytd?: { actual: number; ly_actual: number; gross?: number; vat?: number };
  
  today_actual?: number;
  revenue?: number;
  today_ly?: number;
  mtd_actual?: number;
  mtd_ly?: number;
  ytd_actual?: number;
  ytd_ly?: number;

  gridData: DashboardGridDataItem[];
  chartData: DashboardChartDataItem[];
  dailyReportBreakdown: DashboardBreakdownItem[];
  segmentBreakdown: DashboardBreakdownItem[];
  channelBreakdown: DashboardBreakdownItem[];
  rateCodeBreakdown: DashboardBreakdownItem[];
  roomTypeBreakdown?: DashboardBreakdownItem[];
  roomMarketBreakdown?: DashboardBreakdownItem[];
}

export interface Targets {
  targetRn: number;
  targetRev: number;
  targetOcc: number;
}

const getApiBase = () => {
  // Vercel 환경에서는 next.config.ts의 rewrites를 통한 프록시를 사용하여 CORS를 우회합니다.
  return "";
};

import { aggregateDateRangeData } from './dataNormaliser';

export const fetchRevenueRange = async (startDate: string, endDate: string): Promise<any> => {
  const apiBase = getApiBase();

  const response = await fetch(`${apiBase}/api/v5/dashboard/revenue-summary?startDate=${startDate}&endDate=${endDate}&_t=${Date.now()}`, {
    cache: "no-store",
    headers: {
      "Authorization": "Bearer mock_super_admin_token"
    }
  });

  if (!response.ok) {
    let errorDetail = response.statusText;
    try {
      const errJson = await response.json();
      if (errJson && errJson.error) {
        errorDetail = errJson.error;
      }
    } catch (e) {}
    throw new Error(`백엔드 오류 (${response.status}): ${errorDetail}`);
  }

  return await response.json();
};

export const fetchDailyRevenue = async (startDate: string, endDate: string): Promise<DashboardRevenueResponse | null> => {
  const json = await fetchRevenueRange(startDate, endDate);

  // V5 API가 기간 검색 시 배열을 반환하는 경우 처리 (정규화 레이어)
  if (Array.isArray(json) && json.length > 0) {
    return aggregateDateRangeData(json) as DashboardRevenueResponse;
  }

  // V5 returns { success: true, data: { ... } }
  if (json && json.success && json.data) {
    return json.data as DashboardRevenueResponse;
  }
  
  return json as DashboardRevenueResponse;
};

export const fetchTargets = async (year: number, month: number): Promise<Targets> => {
  try {
    const res = await fetch(`/api/goals?year=${year}&month=${month}`);
    if (!res.ok) throw new Error('Failed to fetch goals');
    const json = await res.json();
    if (json.success && json.data) {
      return json.data as Targets;
    }
  } catch (e) {
    console.error('Failed to fetch targets from internal API:', e);
  }
  
  // 기본값 반환
  return {
    targetRn: 500,
    targetRev: 50000000,
    targetOcc: 80
  };
};

export const saveTargets = async (payload: {
  year: number;
  month: number;
  targetRn: number;
  targetRev: number;
  targetOcc: number;
}): Promise<any> => {
  const res = await fetch(`/api/goals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  
  if (!res.ok) {
    throw new Error('목표 저장에 실패했습니다.');
  }

  return await res.json();
};

import { eachDayOfInterval, parseISO, format } from 'date-fns';

export const fetchRevenueTrends = async (startDate: string, endDate: string) => {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  
  const days = eachDayOfInterval({ start, end });
  
  // V5 API 최적화: 날짜별로 수십 번 API를 호출하지 않고, 단 1번의 기간 조회로 전체 데이터를 가져옵니다.
  let jsonArray: any = [];
  try {
    const rawData = await fetchRevenueRange(startDate, endDate);
    if (Array.isArray(rawData)) {
      jsonArray = rawData;
    } else if (rawData && rawData.success && Array.isArray(rawData.data)) {
      jsonArray = rawData.data;
    } else if (rawData && rawData.data) {
      jsonArray = [rawData.data];
    }
  } catch (e) {
    console.error("Failed to fetch revenue trends:", e);
  }
  
  return days.map(day => {
    const formattedDate = format(day, 'yyyy-MM-dd');
    // 가져온 원본 배열에서 해당 날짜의 데이터를 찾습니다.
    const dayData = jsonArray.find((item: any) => {
       const target = item.data || item;
       return target.date === formattedDate;
    });
    
    const targetData = dayData ? (dayData.data || dayData) : null;
    
    return {
      date: formattedDate,
      totalSales: targetData?.roomSummary?.totalRoomRevenue || targetData?.today_actual || targetData?.today?.actual || 0,
      totalRooms: targetData?.roomSummary?.totalRoomsSold || 0,
    };
  });
};

