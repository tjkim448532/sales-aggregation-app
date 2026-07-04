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

import { format, subDays, parseISO, eachDayOfInterval } from 'date-fns';

const todayStr = format(new Date(), 'yyyy-MM-dd');
const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd');

export const mockDailyRevenue: DailyRevenueData[] = [
  {
    date: yesterdayStr,
    segment: '분양회원',
    pyType: '16PY',
    groupName: '회원관리그룹',
    agencyName: '본사',
    marketChannel: '다이렉트',
    notes: '기본 회원권',
    metrics: { rn: 15, rev: 1500000, occ: 0.85, adr: 100000 }
  },
  {
    date: yesterdayStr,
    segment: 'OTA',
    pyType: '35PY',
    groupName: '온라인영업부',
    agencyName: '야놀자',
    marketChannel: '온라인',
    notes: '프로모션 적용',
    metrics: { rn: 10, rev: 2500000, occ: 0.90, adr: 250000 }
  },
  {
    date: todayStr,
    segment: 'MICE',
    pyType: '51PY',
    groupName: 'B2B영업부',
    agencyName: '하나투어',
    marketChannel: '여행사',
    notes: '단체 워크샵',
    metrics: { rn: 20, rev: 8000000, occ: 1.0, adr: 400000 }
  },
  {
    date: todayStr,
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
  return new Promise((resolve) => {
    setTimeout(() => {
      try {
        const start = parseISO(startDate);
        const end = parseISO(endDate);
        
        // 최대 62일까지 대시보드 테스트용 데이터 동적 생성
        const days = eachDayOfInterval({ start, end }).slice(0, 62);
        const generatedData: DailyRevenueData[] = [];
        
        const segments = [
          { name: '분양회원', py: '16PY', group: '회원관리그룹', agency: '본사', channel: '다이렉트', rnBase: 12, revBase: 1200000 },
          { name: 'OTA', py: '35PY', group: '온라인영업부', agency: '야놀자', channel: '온라인', rnBase: 8, revBase: 2000000 },
          { name: 'MICE', py: '51PY', group: 'B2B영업부', agency: '하나투어', channel: '여행사', rnBase: 18, revBase: 7200000 },
          { name: '자사채널', py: '16PY', group: '디지털마케팅', agency: '공식홈페이지', channel: '웹', rnBase: 6, revBase: 540000 },
          { name: '휴양소', py: '35PY', group: '총무팀', agency: '자사휴양소', channel: '오프라인', rnBase: 10, revBase: 1500000 }
        ];

        days.forEach(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          
          segments.forEach((seg, idx) => {
            const hash = dateStr.split('-').reduce((acc, val) => acc + parseInt(val), 0) + idx;
            const factor = 0.8 + (hash % 5) * 0.1; // 0.8 ~ 1.2 사이의 무작위 변동폭
            
            const rn = Math.round(seg.rnBase * factor);
            const rev = Math.round(seg.revBase * factor);
            const adr = rn > 0 ? Math.round(rev / rn) : 0;
            const occ = parseFloat((0.5 + (hash % 6) * 0.08).toFixed(2));

            generatedData.push({
              date: dateStr,
              segment: seg.name,
              pyType: seg.py,
              groupName: seg.group,
              agencyName: seg.agency,
              marketChannel: seg.channel,
              notes: idx % 2 === 0 ? '정상 운영' : '패키지 프로모션',
              metrics: {
                rn,
                rev,
                occ,
                adr
              }
            });
          });
        });
        
        resolve(generatedData);
      } catch (e) {
        resolve([]);
      }
    }, 300);
  });
};
