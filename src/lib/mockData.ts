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

export const mockDailyRevenue: DailyRevenueData[] = [
  {
    date: '2026-03-01',
    segment: '분양회원',
    pyType: '16PY',
    groupName: '회원관리그룹',
    agencyName: '본사',
    marketChannel: '다이렉트',
    notes: '기본 회원권',
    metrics: { rn: 15, rev: 1500000, occ: 0.85, adr: 100000 }
  },
  {
    date: '2026-03-01',
    segment: 'OTA',
    pyType: '35PY',
    groupName: '온라인영업부',
    agencyName: '야놀자',
    marketChannel: '온라인',
    notes: '프로모션 적용',
    metrics: { rn: 10, rev: 2500000, occ: 0.90, adr: 250000 }
  },
  {
    date: '2026-03-02',
    segment: 'MICE',
    pyType: '51PY',
    groupName: 'B2B영업부',
    agencyName: '하나투어',
    marketChannel: '여행사',
    notes: '단체 워크샵',
    metrics: { rn: 20, rev: 8000000, occ: 1.0, adr: 400000 }
  },
  {
    date: '2026-03-02',
    segment: '자사채널',
    pyType: '16PY',
    groupName: '디지털마케팅',
    agencyName: '공식홈페이지',
    marketChannel: '웹',
    notes: '얼리버드 할인',
    metrics: { rn: 5, rev: 450000, occ: 0.60, adr: 90000 }
  }
];

export const fetchDailyRevenue = async (startDate: string, endDate: string): Promise<DailyRevenueData[]> => {
  // Simulate network delay
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(mockDailyRevenue.filter(d => d.date >= startDate && d.date <= endDate));
    }, 500);
  });
};
