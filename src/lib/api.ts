export interface V3GridDataItem {
  depth1: string;
  depth2: string;
  depth3: string;
  salesAmount: number;
  quantity: number;
}

export interface V3ChartDataItem {
  name: string;
  value: number;
}

// New V3 Normalized Spec
export interface V3ReportBreakdownItem {
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
  
  // Keep these as optional for rateCodes, etc. where it might still send raw quantities
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

export type V3ChannelBreakdownItem = V3ReportBreakdownItem;
export type V3RateCodeBreakdownItem = V3ReportBreakdownItem;

export interface V3RevenueResponse {
  startDate: string;
  endDate: string;
  date: string;
  
  // V5 properties (with ETL injected fields)
  roomSummary?: { totalRoomRevenue: number; totalRoomsSold: number; mtd_actual?: number; ytd_actual?: number; today_ly?: number; };
  golfSummary?: { totalGolfRevenue: number; mtd_actual?: number; ytd_actual?: number; today_ly?: number; };
  ticketSummary?: { totalTicketRevenue: number; mtd_actual?: number; ytd_actual?: number; today_ly?: number; };
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

  gridData: V3GridDataItem[];
  chartData: V3ChartDataItem[];
  dailyReportBreakdown: V3ReportBreakdownItem[];
  segmentBreakdown: V3ReportBreakdownItem[];
  channelBreakdown: V3ReportBreakdownItem[];
  rateCodeBreakdown: V3ReportBreakdownItem[];
  roomTypeBreakdown?: V3ReportBreakdownItem[];
  roomMarketBreakdown?: V3ReportBreakdownItem[];
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

export const fetchDailyRevenue = async (startDate: string, endDate: string): Promise<V3RevenueResponse | null> => {
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

  const json = await response.json();

  // V5 API가 기간 검색 시 배열을 반환하는 경우 처리 (정규화 레이어)
  if (Array.isArray(json) && json.length > 0) {
    // 가장 안전한 방식: 누적 데이터(MTD/YTD) 보호를 위해 마지막 날짜(endDate) 데이터를 기준으로 하되,
    // 기간 내 일일 실적(today_actual, totalRoomRevenue 등)을 합산하여 단일 객체로 만듭니다.
    let aggregatedData: any = null;
    
    for (const item of json) {
      if (!item || !item.success || !item.data) continue;
      const data = item.data;
      
      if (!aggregatedData) {
        aggregatedData = JSON.parse(JSON.stringify(data));
        continue;
      }
      
      // 일일 매출 합산
      if (data.today && aggregatedData.today) {
        aggregatedData.today.actual += (data.today.actual || 0);
        aggregatedData.today.ly_actual += (data.today.ly_actual || 0);
      }
      
      // 각 Summary 일일 매출 합산 및 누적 지표는 마지막 날짜로 덮어쓰기
      const summaries = ['roomSummary', 'golfSummary', 'ticketSummary', 'fnbSummary'];
      for (const sum of summaries) {
        if (data[sum] && aggregatedData[sum]) {
           const revKey = sum === 'roomSummary' ? 'totalRoomRevenue' 
                        : sum === 'golfSummary' ? 'totalGolfRevenue' 
                        : sum === 'ticketSummary' ? 'totalTicketRevenue' 
                        : 'totalFnbRevenue';
                        
           aggregatedData[sum][revKey] += (data[sum][revKey] || 0);
           if (sum === 'roomSummary') {
             aggregatedData[sum].totalRoomsSold += (data[sum].totalRoomsSold || 0);
           }
           aggregatedData[sum].mtd_actual = data[sum].mtd_actual;
           aggregatedData[sum].ytd_actual = data[sum].ytd_actual;
        }
      }
      
      if (data.mtd) aggregatedData.mtd = data.mtd;
      if (data.ytd) aggregatedData.ytd = data.ytd;
      
      aggregatedData.endDate = data.date;
      aggregatedData.date = data.date;
    }
    
    return aggregatedData as V3RevenueResponse;
  }

  // V5 returns { success: true, data: { ... } }
  if (json && json.success && json.data) {
    return json.data as V3RevenueResponse;
  }
  
  return json as V3RevenueResponse;
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
  
  const promises = days.map(day => {
    const formattedDate = format(day, 'yyyy-MM-dd');
    return fetchDailyRevenue(formattedDate, formattedDate);
  });

  const results = await Promise.all(promises);
  
  return results.map((res, idx) => {
    return {
      date: format(days[idx], 'yyyy-MM-dd'),
      totalSales: res?.roomSummary?.totalRoomRevenue || res?.today_actual || 0,
      totalRooms: res?.roomSummary?.totalRoomsSold || 0,
    };
  });
};

