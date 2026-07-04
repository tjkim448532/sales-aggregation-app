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

export interface V3ReportBreakdownItem {
  category: string;
  name: string;
  facility_name?: string;
  today_actual: string | number;
  today_ly: string | number;
  mtd_actual: string | number;
  mtd_ly: string | number;
  ytd_actual: string | number;
  ytd_ly: string | number;
}

export interface V3RevenueResponse {
  startDate: string;
  endDate: string;
  date: string;
  today: { actual: number; ly_actual: number };
  mtd: { actual: number; ly_actual: number };
  ytd: { actual: number; ly_actual: number };
  gridData: V3GridDataItem[];
  chartData: V3ChartDataItem[];
  dailyReportBreakdown: V3ReportBreakdownItem[];
  segmentBreakdown: any[];
}

export interface Targets {
  targetRn: number;
  targetRev: number;
  targetOcc: number;
}

const getApiBase = () => {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base) return "";
  return base.replace(/\/+$/, "");
};

export const fetchDailyRevenue = async (startDate: string, endDate: string): Promise<V3RevenueResponse | null> => {
  const apiBase = getApiBase();
  if (!apiBase) {
    console.warn("NEXT_PUBLIC_API_BASE_URL is not set.");
    return null;
  }

  // 백엔드 미들웨어 비활성화로 Authorization 헤더 제거
  const response = await fetch(`${apiBase}/api/v3/dashboard/revenue-summary?startDate=${startDate}&endDate=${endDate}`, {
    cache: "no-store",
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

