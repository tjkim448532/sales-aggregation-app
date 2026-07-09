import { DashboardBreakdownItem, DashboardRevenueResponse } from "./api";

export function cleanShopName(name?: string): string {
  if (!name) return "알수없음";
  return name
    .replace(/\s+/g, "")
    .replace(/-Posting/gi, "")
    .replace(/\(\d{4}\)/g, "");
}

export function aggregateDateRangeData(jsonArray: any[]): DashboardRevenueResponse | null {
  if (!Array.isArray(jsonArray) || jsonArray.length === 0) return null;
  
  let aggregatedData: any = null;
  
  for (const item of jsonArray) {
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
         aggregatedData[sum].today_ly = (aggregatedData[sum].today_ly || 0) + (data[sum].today_ly || 0);
         aggregatedData[sum].mtd_actual = data[sum].mtd_actual;
         aggregatedData[sum].ytd_actual = data[sum].ytd_actual;
      }
    }
    
    if (data.mtd) aggregatedData.mtd = data.mtd;
    if (data.ytd) aggregatedData.ytd = data.ytd;
    
    // 기간 조회 시 breakdown 데이터는 원본 배열들을 모두 concat 합니다.
    // page.tsx의 mergeBreakdownData가 나중에 합산(sum) 처리를 해줍니다.
    if (data.dailyReportBreakdown) {
      aggregatedData.dailyReportBreakdown = (aggregatedData.dailyReportBreakdown || []).concat(data.dailyReportBreakdown);
    }
    if (data.segmentBreakdown) {
      aggregatedData.segmentBreakdown = (aggregatedData.segmentBreakdown || []).concat(data.segmentBreakdown);
    }
    if (data.channelBreakdown) {
      aggregatedData.channelBreakdown = (aggregatedData.channelBreakdown || []).concat(data.channelBreakdown);
    }
    if (data.rateCodeBreakdown) {
      aggregatedData.rateCodeBreakdown = (aggregatedData.rateCodeBreakdown || []).concat(data.rateCodeBreakdown);
    }
    if (data.roomMarketBreakdown) {
      aggregatedData.roomMarketBreakdown = (aggregatedData.roomMarketBreakdown || []).concat(data.roomMarketBreakdown);
    }
    if (data.golfFacilityBreakdown) {
      aggregatedData.golfFacilityBreakdown = (aggregatedData.golfFacilityBreakdown || []).concat(data.golfFacilityBreakdown);
    }
    if (data.ticketFacilityBreakdown) {
      aggregatedData.ticketFacilityBreakdown = (aggregatedData.ticketFacilityBreakdown || []).concat(data.ticketFacilityBreakdown);
    }
    if (data.fnbFacilityBreakdown) {
      aggregatedData.fnbFacilityBreakdown = (aggregatedData.fnbFacilityBreakdown || []).concat(data.fnbFacilityBreakdown);
    }
    
    aggregatedData.endDate = data.date;
    aggregatedData.date = data.date;
  }
  
  return aggregatedData as DashboardRevenueResponse;
}

export function mergeBreakdownData(data: DashboardBreakdownItem[]): DashboardBreakdownItem[] {
  if (!data || !Array.isArray(data)) return [];

  const map = new Map<string, DashboardBreakdownItem>();

  for (const item of data) {
    const rawItem = item as any;
    
    // Create a composite key to prevent squashing different channels of the same facility
    const rawFacility = rawItem.facility_name || rawItem.shop_name || rawItem.room_type || rawItem.name || "";
    const rawChannel = rawItem.channel_name || rawItem.segment_name || rawItem.segment || "";
    
    let cleanName = cleanShopName(rawFacility);
    if (rawChannel && rawChannel !== rawFacility) {
      cleanName += "_" + cleanShopName(rawChannel);
    }
    
    // Fallback if both were empty
    if (!cleanName) {
      const rawName = rawItem.shop_name || rawItem.facility_name || rawItem.name || rawItem.channel_name || rawItem.room_type || "";
      cleanName = cleanShopName(rawName);
    }

    if (!map.has(cleanName)) {
      const cloned = { ...item } as any;
      if (cloned.shop_name) cloned.shop_name = cleanShopName(cloned.shop_name);
      if (cloned.facility_name) cloned.facility_name = cleanShopName(cloned.facility_name);
      if (cloned.name) cloned.name = cleanShopName(cloned.name);
      if (cloned.channel_name) cloned.channel_name = cleanShopName(cloned.channel_name);
      if (cloned.room_type) cloned.room_type = cleanShopName(cloned.room_type);
      map.set(cleanName, cloned);
    } else {
      const existing = map.get(cleanName)! as any;
      const fieldsToSum = [
        "today_actual", "vat", "gross", "today_ly",
        "qty", "visitors", "roomsSold", "rooms_sold", "revenue"
      ];
      // Note: mtd_actual, ytd_actual 등 누적값은 단순히 합산하면 안 되므로 합산 배열에서 제외했습니다. (마지막 날짜 기준 유지)
      for (const field of fieldsToSum) {
        if (rawItem[field] !== undefined || existing[field] !== undefined) {
          existing[field] = (Number(existing[field]) || 0) + (Number(rawItem[field]) || 0);
        }
      }
      // 누적 데이터는 병합 과정에서 마지막 배열 원소(가장 최신)의 값을 덮어씁니다.
      const cumulativeFields = ["mtd_actual", "mtd_ly", "ytd_actual", "ytd_ly"];
      for (const field of cumulativeFields) {
        if (rawItem[field] !== undefined) {
          existing[field] = Number(rawItem[field]) || 0;
        }
      }
    }
  }

  return Array.from(map.values());
}

export interface HierarchicalRow extends DashboardBreakdownItem {
  isGroup?: boolean;
  isFooter?: boolean;
  isChild?: boolean;
  expanded?: boolean;
  categoryLabel?: string;
}

export function buildHierarchicalRows(
  data: DashboardBreakdownItem[],
  expandedCategories: Record<string, boolean>
): HierarchicalRow[] {
  const merged = mergeBreakdownData(data);
  const groups: Record<string, HierarchicalRow[]> = {};
  
  const categoryNames: Record<string, string> = {
    "ROOM": "객실",
    "GOLF": "골프장",
    "FNB": "식음",
    "FNB_TWOSOME": "투썸플레이스",
    "TICKET": "티켓",
    "LEISURE": "레저",
    "BANQUET": "연회장"
  };

  for (const item of merged) {
    let catCode = item.category_code || "OTHER";
    if (!categoryNames[catCode] && !categoryNames[item.category_name || ""]) {
      catCode = "OTHER"; 
    }

    if (!groups[catCode]) {
      groups[catCode] = [];
    }
    groups[catCode].push({ ...item, isChild: true } as HierarchicalRow);
  }

  const result: HierarchicalRow[] = [];
  const grandTotal: any = {
    isFooter: true,
    categoryLabel: "총계",
    today_actual: 0, today_ly: 0,
    mtd_actual: 0, mtd_ly: 0,
    ytd_actual: 0, ytd_ly: 0,
    category_code: "TOTAL",
    category_name: "TOTAL"
  };

  const fieldsToSum = [
    "today_actual", "vat", "gross", "today_ly",
    "mtd_actual", "mtd_ly", "ytd_actual", "ytd_ly"
  ];

  for (const [code, children] of Object.entries(groups)) {
    const parentRow: any = {
      isGroup: true,
      category_code: code,
      category_name: categoryNames[code] || "기타영업",
      categoryLabel: categoryNames[code] || "기타영업",
      expanded: !!expandedCategories[code],
      today_actual: 0, today_ly: 0,
      mtd_actual: 0, mtd_ly: 0,
      ytd_actual: 0, ytd_ly: 0
    };

    for (const child of children) {
      for (const field of fieldsToSum) {
        if ((child as any)[field] !== undefined) {
          parentRow[field] = (Number(parentRow[field]) || 0) + (Number((child as any)[field]) || 0);
        }
      }
    }

    result.push(parentRow as HierarchicalRow);
    
    if (parentRow.expanded) {
      result.push(...children);
    }

    for (const field of fieldsToSum) {
      if (parentRow[field] !== undefined) {
        grandTotal[field] = (Number(grandTotal[field]) || 0) + (Number(parentRow[field]) || 0);
      }
    }
  }

  result.push(grandTotal as HierarchicalRow);
  return result;
}
