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

  const response = await fetch(`${apiBase}/api/revenue/daily?startDate=${startDate}&endDate=${endDate}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch daily revenue: ${response.statusText}`);
  }

  const json = await response.json();
  return json.data as DailyRevenueData[];
};

export const fetchTargets = async (year: number, month: number): Promise<Targets> => {
  const apiBase = getApiBase();
  if (!apiBase) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is not set.");
  }

  const response = await fetch(`${apiBase}/api/targets?year=${year}&month=${month}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch targets: ${response.statusText}`);
  }

  return await response.json() as Targets;
};

export const saveTargets = async (payload: {
  year: number;
  month: number;
  targetRn: number;
  targetRev: number;
  targetOcc: number;
}): Promise<any> => {
  const apiBase = getApiBase();
  if (!apiBase) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is not set.");
  }

  const response = await fetch(`${apiBase}/api/targets`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to save targets: ${response.statusText}`);
  }

  return await response.json();
};
