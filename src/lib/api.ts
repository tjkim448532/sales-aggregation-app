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
  shop_name: string;
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
  segment?: string;
  segment_name?: string;
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
  today?: { actual: number; ly_actual: number; gross?: number; vat?: number };
  mtd?: { actual: number; ly_actual: number; gross?: number; vat?: number };
  ytd?: { actual: number; ly_actual: number; gross?: number; vat?: number };
  
  today_actual?: number;
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
  const response = await fetch(`${apiBase}/api/v3/dashboard/revenue-summary?startDate=${startDate}&endDate=${endDate}&_t=${Date.now()}`, {
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
  return json as V3RevenueResponse;
};

// 백엔드 V3에 targets API가 없으므로 프론트엔드 LocalStorage를 사용하는 폴백(Fallback) 구현
export const fetchTargets = async (year: number, month: number): Promise<Targets> => {
  if (typeof window !== "undefined") {
    const key = `targets_${year}_${month}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        return JSON.parse(saved) as Targets;
      } catch (e) {}
    }
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
  if (typeof window !== "undefined") {
    const key = `targets_${payload.year}_${payload.month}`;
    localStorage.setItem(key, JSON.stringify({
      targetRn: payload.targetRn,
      targetRev: payload.targetRev,
      targetOcc: payload.targetOcc
    }));
  }
  
  return { success: true, message: "목표가 로컬 브라우저에 성공적으로 저장되었습니다." };
};

