export interface DailyRevenueData {
  date: string;
  segment: string;
  pyType: string;
  groupName: string;
  agencyName: string;
  marketChannel: string;
  notes: string;
  metrics: {
    rn: number;
    rev: number;
    occ: number;
    adr: number;
  };
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

export const fetchDailyRevenue = async (startDate: string, endDate: string): Promise<DailyRevenueData[]> => {
  const apiBase = getApiBase();
  if (!apiBase) {
    console.warn("NEXT_PUBLIC_API_BASE_URL is not set. Falling back to empty data.");
    return [];
  }

  // 백엔드 V3 API 경로로 변경
  const response = await fetch(`${apiBase}/api/v3/dashboard/revenue-summary?startDate=${startDate}&endDate=${endDate}`, {
    cache: "no-store",
    headers: {
      "Authorization": "Bearer mock_super_admin_token",
    }
  });

  if (!response.ok) {
    // 401 Unauthorized 에러 등의 세부 메시지 파싱
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
  return json.data as DailyRevenueData[];
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

