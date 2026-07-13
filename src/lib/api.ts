export interface DashboardSummary {
  totalRevenue: number;
  totalRooms: number;
  totalRoomCap: number;
  totalGolfTeams: number;
  totalGuests?: number;
  mtdRevenue?: number;
  ytdRevenue?: number;
  todayLyRevenue?: number;
}

export interface DashboardCategorySales {
  category_code: string;
  category_name: string;
  totalSales: number;
}

export interface DashboardFacilitySales {
  category_code: string;
  sub_group_name: string;
  total_sales: number;
  total_visitors?: number;
}

export interface DashboardDailyTrend {
  date: string;
  revenue: number;
}

export interface DashboardRevenueResponse {
  targetDate: string;
  summary: DashboardSummary;
  salesByCategory: DashboardCategorySales[];
  salesByFacility: DashboardFacilitySales[];
  dailyTrends: DashboardDailyTrend[];
  roomSummaryByType?: { roomType: string; roomsSold: number; totalSales: number; capacity: number }[];
  salesByChannel?: { channelName: string; roomsSold: number; totalSales: number }[];
  dailyTrendsByCategory?: { date: string; category: string; revenue: number }[];
  advancedRoomStats?: { dayOfWeekOccupancy: any; mixPercentage: any };
  weather?: {
    condition?: string;
    tempMax?: number;
    tempMin?: number;
  };
}

export interface MatrixWeeklyItem {
  isSubtotal: boolean;
  isGrandTotal?: boolean;
  subtotalType?: "part" | "team" | "category" | "grand_total";
  categoryCode: string;
  categoryName: string;
  teamName: string;
  partName: string;
  shopName: string;
  todayActual: number;
  todayLy?: number;
  todayGrowth?: number;
  mtdActual?: number;
  ytdActual?: number;
}

export interface Targets {
  targetRn: number;
  targetRev: number;
  targetOcc: number;
}

const getApiBase = () => {
  return "";
};

export const fetchDailyRevenue = async (date: string): Promise<DashboardRevenueResponse | null> => {
  const apiBase = getApiBase();

  const response = await fetch(`${apiBase}/api/v5/dashboard/revenue-summary?date=${date}&_t=${Date.now()}`, {
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
  
  if (json && json.status === "SUCCESS" && json.data) {
    return json.data as DashboardRevenueResponse;
  }
  
  return json as DashboardRevenueResponse;
};

export const fetchMatrixWeekly = async (date: string): Promise<MatrixWeeklyItem[]> => {
  const apiBase = getApiBase();

  const response = await fetch(`${apiBase}/api/v5/dashboard/matrix-weekly?date=${date}&_t=${Date.now()}`, {
    cache: "no-store",
    headers: {
      "Authorization": "Bearer mock_super_admin_token"
    }
  });

  if (!response.ok) {
    throw new Error(`백엔드 매트릭스 API 오류 (${response.status})`);
  }

  const json = await response.json();
  
  if (json && (json.status === "SUCCESS" || json.success === true) && json.data) {
    return json.data as MatrixWeeklyItem[];
  }
  
  // Fallback to array if direct return
  if (Array.isArray(json)) {
    return json;
  }
  
  return [];
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

export interface RoomBudgetPayload {
  targetYearMonth: string;
  budgets: {
    segmentName: string;
    roomType: string;
    targetRevenue: number;
    targetRoomsSold: number;
  }[];
}

export const saveRoomBudgets = async (payload: RoomBudgetPayload): Promise<any> => {
  const apiBase = getApiBase();
  const response = await fetch(`${apiBase}/api/v5/admin/budget/room`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': 'Bearer belleforet-m2m-secret'
    },
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) {
    let errorDetail = response.statusText;
    try {
      const errJson = await response.json();
      if (errJson && errJson.error) {
        errorDetail = errJson.error;
      }
    } catch (e) {}
    throw new Error(`목표액 일괄 저장 실패 (${response.status}): ${errorDetail}`);
  }

  return await response.json();
};
