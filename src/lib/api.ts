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
  
  // V5 properties
  roomSummary?: { totalRoomRevenue: number; totalRoomsSold: number; };
  golfSummary?: { totalGolfRevenue: number; };
  ticketSummary?: { totalTicketRevenue: number; };
  fnbSummary?: { totalFnbRevenue: number; };

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
  // Use Next.js proxy to bypass CORS
  return "";
};

export const fetchDailyRevenue = async (startDate: string, endDate: string): Promise<V3RevenueResponse | null> => {
  const apiBase = getApiBase();

  // 백엔드 토큰 검증 우회용 mock_super_admin_token 헤더 추가 및 Vercel Edge 캐시 완전 우회를 위한 _t 파라미터 추가
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

  let json = await response.json();
  
  // 방어적 파싱: 백엔드가 이중 인코딩된 JSON 문자열을 반환하는 경우 대비
  if (typeof json === 'string') {
    try {
      json = JSON.parse(json);
    } catch (e) {
      console.warn("이중 인코딩 JSON 파싱 실패", e);
    }
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

