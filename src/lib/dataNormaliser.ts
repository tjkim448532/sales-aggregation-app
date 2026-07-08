import { V3ReportBreakdownItem } from "./api";

export function cleanShopName(name?: string): string {
  if (!name) return "알수없음";
  return name
    .replace(/\s+/g, "")
    .replace(/-Posting/gi, "")
    .replace(/\(\d{4}\)/g, "");
}

export function mergeBreakdownData(data: V3ReportBreakdownItem[]): V3ReportBreakdownItem[] {
  if (!data || !Array.isArray(data)) return [];

  const map = new Map<string, V3ReportBreakdownItem>();

  for (const item of data) {
    const rawItem = item as any;
    const rawName = rawItem.shop_name || rawItem.facility_name || rawItem.name || rawItem.channel_name || rawItem.room_type || "";
    const cleanName = cleanShopName(rawName);

    if (!map.has(cleanName)) {
      const cloned = { ...item } as any;
      if (cloned.shop_name) cloned.shop_name = cleanName;
      if (cloned.facility_name) cloned.facility_name = cleanName;
      if (cloned.name) cloned.name = cleanName;
      if (cloned.channel_name) cloned.channel_name = cleanName;
      if (cloned.room_type) cloned.room_type = cleanName;
      map.set(cleanName, cloned);
    } else {
      const existing = map.get(cleanName)! as any;
      const fieldsToSum = [
        "today_actual", "vat", "gross", "today_ly",
        "mtd_actual", "mtd_ly", "ytd_actual", "ytd_ly",
        "qty", "visitors", "roomsSold", "revenue"
      ];
      for (const field of fieldsToSum) {
        if (rawItem[field] !== undefined || existing[field] !== undefined) {
          existing[field] = (Number(existing[field]) || 0) + (Number(rawItem[field]) || 0);
        }
      }
    }
  }

  return Array.from(map.values());
}

export interface HierarchicalRow extends V3ReportBreakdownItem {
  isGroup?: boolean;
  isFooter?: boolean;
  isChild?: boolean;
  expanded?: boolean;
  categoryLabel?: string;
}

export function buildHierarchicalRows(
  data: V3ReportBreakdownItem[],
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
