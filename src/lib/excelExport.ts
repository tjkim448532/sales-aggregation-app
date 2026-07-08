import ExcelJS from "exceljs";
import { type DashboardRevenueResponse } from "./api";
import rateCodesData from "@/data/rate_codes.json";

// Replicate segment matrix calculation logic
interface SegmentMatrixRow {
  metric: string;
  [key: string]: any;
}

function calculateSegmentMatrix(segmentBreakdown: any[], diffDays: number, capacities: { [key: string]: number }): SegmentMatrixRow[] {
  const metrics = ["판매객실수(R/N)", "매출액", "객단가(ADR)", "가동률(OCC)"];
  const segments = ["분양회원", "자사채널", "MICE", "OTA", "법인", "제휴&기타", "기타"];
  const pyTypes = ["16PY", "35PY", "51PY", "기타"];

  const cap16 = capacities["16PY"] || 90;
  const cap35 = capacities["35PY"] || 90;
  const totalCapacity = cap16 + cap35;

  const rows: SegmentMatrixRow[] = metrics.map(metric => ({ metric }));
  const getRow = (m: string) => rows.find(r => r.metric === m)!;

  const cellRN: { [key: string]: number } = {};
  const cellREV: { [key: string]: number } = {};

  if (Array.isArray(segmentBreakdown)) {
    segmentBreakdown.forEach(item => {
      const segNameRaw = item.segment || item.segment_name || "";
      const segName = segments.find(s => s === segNameRaw) || "기타";

      let py = item.pyType || item.room_type || item.shop_name || item.facility_name || "";
      if (py.includes("16")) py = "16PY";
      else if (py.includes("35")) py = "35PY";
      else if (py.includes("51")) py = "51PY";
      else py = "기타";
 
      const rn = Number(item.roomsSold || item.rooms_sold_weighted || item.room_nights || item.rooms_sold || 0);
      const rev = Number(item.today_actual || item.revenue || 0);

      const cellKey = `${segName}_${py}`;
      cellRN[cellKey] = (cellRN[cellKey] || 0) + rn;
      cellREV[cellKey] = (cellREV[cellKey] || 0) + rev;
    });
  }

  segments.forEach(seg => {
    let segTotalRN = 0;
    let segTotalREV = 0;

    Object.keys(cellRN).forEach(key => {
      if (key.startsWith(`${seg}_`)) {
        segTotalRN += cellRN[key];
      }
    });
    Object.keys(cellREV).forEach(key => {
      if (key.startsWith(`${seg}_`)) {
        segTotalREV += cellREV[key];
      }
    });

    const rn16 = cellRN[`${seg}_16PY`] || 0;
    const rn35 = cellRN[`${seg}_35PY`] || 0;
    const rn51 = cellRN[`${seg}_51PY`] || 0;

    pyTypes.forEach(py => {
      const cellKey = `${seg}_${py}`;
      const rn = cellRN[cellKey] || 0;
      const rev = cellREV[cellKey] || 0;
      
      let adr = rn > 0 ? rev / rn : 0;
      if (py === "51PY") {
        // 백엔드가 51평 예약건수(roomsSold)를 이미 2배로 주므로, ADR 산출 시 건수(rn/2) 기준 분모 사용
        adr = rn > 0 ? rev / (rn / 2) : 0;
      }
      
      let occVal: any = 0;
      if (py === "16PY") {
        // 51평 roomsSold는 이미 2배이므로 반(÷2)으로 나누어 더해줌
        occVal = cap16 > 0 ? (rn16 + (rn51 / 2)) / cap16 : 0;
      } else if (py === "35PY") {
        occVal = cap35 > 0 ? (rn35 + (rn51 / 2)) / cap35 : 0;
      } else if (py === "51PY" || py === "기타") {
        occVal = "-"; // 51평 및 기타 객실 단독 가동률은 산출 불가(-) 처리
      }

      getRow("판매객실수(R/N)")[cellKey] = rn;
      getRow("매출액")[cellKey] = rev;
      getRow("객단가(ADR)")[cellKey] = adr;
      getRow("가동률(OCC)")[cellKey] = occVal;
    });

    const subtotalKey = `${seg}_소계`;
    getRow("판매객실수(R/N)")[subtotalKey] = segTotalRN;
    getRow("매출액")[subtotalKey] = segTotalREV;
    getRow("객단가(ADR)")[subtotalKey] = segTotalRN > 0 ? segTotalREV / segTotalRN : 0;
    
    // Subtotal OCC: rn51은 이미 x2 배 부풀려져 있으므로 곱하지 않고 그대로 더함
    getRow("가동률(OCC)")[subtotalKey] = totalCapacity > 0 ? (rn16 + rn35 + rn51) / totalCapacity : 0;
  });

  let grandTotalRN = 0;
  let grandTotalREV = 0;

  pyTypes.forEach(py => {
    let pyTotalRN = 0;
    let pyTotalREV = 0;

    segments.forEach(seg => {
      const cellKey = `${seg}_${py}`;
      const rn = cellRN[cellKey] || 0;
      const rev = cellREV[cellKey] || 0;

      pyTotalRN += rn;
      pyTotalREV += rev;
    });

    const totalKey = `합계_${py}`;
    getRow("판매객실수(R/N)")[totalKey] = pyTotalRN;
    getRow("매출액")[totalKey] = pyTotalREV;
    
    let pyTotalAdr = pyTotalRN > 0 ? pyTotalREV / pyTotalRN : 0;
    if (py === "51PY") {
      pyTotalAdr = pyTotalRN > 0 ? pyTotalREV / (pyTotalRN / 2) : 0;
    }
    getRow("객단가(ADR)")[totalKey] = pyTotalAdr;
    
    let pyOccVal: any = 0;
    if (py === "16PY") {
      const totalRN51 = segments.reduce((sum, seg) => sum + (cellRN[`${seg}_51PY`] || 0), 0);
      pyOccVal = cap16 > 0 ? (pyTotalRN + (totalRN51 / 2)) / cap16 : 0;
    } else if (py === "35PY") {
      const totalRN51 = segments.reduce((sum, seg) => sum + (cellRN[`${seg}_51PY`] || 0), 0);
      pyOccVal = cap35 > 0 ? (pyTotalRN + (totalRN51 / 2)) / cap35 : 0;
    } else if (py === "51PY" || py === "기타") {
      pyOccVal = "-";
    }
    getRow("가동률(OCC)")[totalKey] = pyOccVal;

    grandTotalRN += pyTotalRN;
    grandTotalREV += pyTotalREV;
  });

  const totalRN16 = segments.reduce((sum, seg) => sum + (cellRN[`${seg}_16PY`] || 0), 0);
  const totalRN35 = segments.reduce((sum, seg) => sum + (cellRN[`${seg}_35PY`] || 0), 0);
  const totalRN51 = segments.reduce((sum, seg) => sum + (cellRN[`${seg}_51PY`] || 0), 0);

  const grandKey = "합계_총계";
  getRow("판매객실수(R/N)")[grandKey] = grandTotalRN;
  getRow("매출액")[grandKey] = grandTotalREV;
  getRow("객단가(ADR)")[grandKey] = grandTotalRN > 0 ? grandTotalREV / grandTotalRN : 0;
  getRow("가동률(OCC)")[grandKey] = totalCapacity > 0 ? (totalRN16 + totalRN35 + totalRN51) / totalCapacity : 0;

  return rows;
}

export async function exportDashboardToExcel(
  apiResponse: DashboardRevenueResponse | null,
  startDate: string,
  endDate: string,
  targetConfig: { targetRn: number; targetRev: number; targetOcc: number }
) {
  if (!apiResponse) return;

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("실적집계 리포트");

  // Show grid lines explicitly
  worksheet.views = [{ showGridLines: true }];

  // Global styles definitions
  const borderThin = {
    top: { style: 'thin' as const, color: { argb: 'FFE5E7EB' } },
    left: { style: 'thin' as const, color: { argb: 'FFE5E7EB' } },
    bottom: { style: 'thin' as const, color: { argb: 'FFE5E7EB' } },
    right: { style: 'thin' as const, color: { argb: 'FFE5E7EB' } }
  };
  
  const borderDoubleBottom = {
    top: { style: 'thin' as const, color: { argb: 'FFD1D5DB' } },
    left: { style: 'thin' as const, color: { argb: 'FFD1D5DB' } },
    bottom: { style: 'double' as const, color: { argb: 'FF9CA3AF' } },
    right: { style: 'thin' as const, color: { argb: 'FFD1D5DB' } }
  };

  const fontTitle = { name: '맑은 고딕', size: 16, bold: true, color: { argb: 'FF1E1B4B' } };
  const fontSectionHeader = { name: '맑은 고딕', size: 11, bold: true, color: { argb: 'FF312E81' } };
  const fontTableHeader = { name: '맑은 고딕', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
  const fontTableSubHeader = { name: '맑은 고딕', size: 9, bold: true, color: { argb: 'FF374151' } };
  const fontRowLabel = { name: '맑은 고딕', size: 9, bold: true };
  const fontRegular = { name: '맑은 고딕', size: 9 };
  const fontBold = { name: '맑은 고딕', size: 9, bold: true };

  const fillIndigoHeader = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF312E81' } };
  const fillTealHeader = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF0D9488' } };
  const fillAmberHeader = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFD97706' } };
  const fillSubtotal = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFF3F4F6' } };
  const fillTotal = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFE0F2FE' } };

  let currRow = 1;

  // 1. Title
  worksheet.mergeCells(currRow, 1, currRow, 7);
  const titleCell = worksheet.getCell(currRow, 1);
  titleCell.value = "벨포레 리조트 매출 실적 분석 대시보드";
  titleCell.font = fontTitle;
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  worksheet.getRow(currRow).height = 35;
  currRow += 1;

  // Date Range
  worksheet.mergeCells(currRow, 1, currRow, 7);
  const dateCell = worksheet.getCell(currRow, 1);
  dateCell.value = `조회 범위: ${startDate} ~ ${endDate} (데이터 일자: ${apiResponse.date || 'N/A'})`;
  dateCell.font = { name: '맑은 고딕', size: 9, italic: true, color: { argb: 'FF6B7280' } };
  dateCell.alignment = { vertical: 'middle', horizontal: 'left' };
  currRow += 2; // Leave space

  // 2. KPI Summary Table
  worksheet.getCell(currRow, 1).value = "▣ 주요 실적 요약 (KPI Summary)";
  worksheet.getCell(currRow, 1).font = fontSectionHeader;
  currRow += 1;

  const kpiHeaders = ["지표", "선택 기간 실적", "선택 기간 전년 동기", "당월 누적 (MTD)", "당월 전년 동기 (MTD LY)", "연간 누적 (YTD)", "연간 전년 동기 (YTD LY)"];
  const kpiHeaderRow = worksheet.getRow(currRow);
  kpiHeaderRow.values = kpiHeaders;
  kpiHeaderRow.height = 24;
  kpiHeaders.forEach((_, idx) => {
    const cell = kpiHeaderRow.getCell(idx + 1);
    cell.font = fontTableHeader;
    cell.fill = fillIndigoHeader;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = borderThin;
  });
  currRow += 1;

  const occupiedItem: any = apiResponse.dailyReportBreakdown?.find(x => x.shop_name === "Occupied Rooms") || {};
  const kpiRows = [
    {
      metric: "매출액 (Net / 원)",
      today: Number(apiResponse.today?.actual || 0),
      today_ly: Number(apiResponse.today?.ly_actual || 0),
      mtd: Number(apiResponse.mtd?.actual || 0),
      mtd_ly: Number(apiResponse.mtd?.ly_actual || 0),
      ytd: Number(apiResponse.ytd?.actual || 0),
      ytd_ly: Number(apiResponse.ytd?.ly_actual || 0),
      isRev: true
    },
    {
      metric: "판매 객실 수 (R/N)",
      today: Number(occupiedItem.today_actual || 0),
      today_ly: Number(occupiedItem.today_ly || 0),
      mtd: Number(occupiedItem.mtd_actual || 0),
      mtd_ly: Number(occupiedItem.mtd_ly || 0),
      ytd: Number(occupiedItem.ytd_actual || 0),
      ytd_ly: Number(occupiedItem.ytd_ly || 0),
      isRev: false
    }
  ];

  kpiRows.forEach(row => {
    const r = worksheet.getRow(currRow);
    r.values = [
      row.metric,
      row.today,
      row.today_ly,
      row.mtd,
      row.mtd_ly,
      row.ytd,
      row.ytd_ly
    ];
    r.height = 20;
    
    const labelCell = r.getCell(1);
    labelCell.font = fontRowLabel;
    labelCell.border = borderThin;
    labelCell.alignment = { vertical: 'middle', horizontal: 'left' };

    for (let i = 2; i <= 7; i++) {
      const cell = r.getCell(i);
      cell.font = fontRegular;
      cell.border = borderThin;
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
      cell.numFmt = '#,##0';
    }
    currRow += 1;
  });
  currRow += 2; // Leave space

  // 3. Target vs Actual Table
  worksheet.getCell(currRow, 1).value = "▣ 당월 목표 대비 실적 분석 (Target vs Actual)";
  worksheet.getCell(currRow, 1).font = fontSectionHeader;
  currRow += 1;

  const targetHeaders = ["지표", "설정 목표치", "당월 누적 실적 (MTD)", "달성률 (%)"];
  const targetHeaderRow = worksheet.getRow(currRow);
  targetHeaderRow.values = targetHeaders;
  targetHeaderRow.height = 24;
  targetHeaders.forEach((_, idx) => {
    const cell = targetHeaderRow.getCell(idx + 1);
    cell.font = fontTableHeader;
    cell.fill = fillAmberHeader;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = borderThin;
  });
  currRow += 1;

  // Calculate diffDays for OCC conversion
  const dStart = new Date(startDate);
  const dEnd = new Date(endDate);
  const diffTime = Math.abs(dEnd.getTime() - dStart.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

  // Re-calculate the rooms sold using periodRoomsSold helper (including 51PY x2 weight and ETC types)
  let sold16 = 0;
  let sold35 = 0;
  let sold51 = 0;
  let soldEtc = 0;
  if (apiResponse && Array.isArray(apiResponse.segmentBreakdown)) {
    apiResponse.segmentBreakdown.forEach(item => {
      let py = item.pyType || item.room_type || item.shop_name || item.facility_name || "";
      const rn = Number(item.roomsSold || item.rooms_sold_weighted || item.room_nights || item.rooms_sold || 0);
      if (py.includes("16")) sold16 += rn;
      else if (py.includes("35")) sold35 += rn;
      else if (py.includes("51")) sold51 += rn;
      else soldEtc += rn;
    });
  }

  // Extract dynamic capacities
  const capsForTarget: { [key: string]: number } = { "16PY": 90 * diffDays, "35PY": 90 * diffDays, "51PY": 0 };
  if (apiResponse && Array.isArray(apiResponse.roomTypeBreakdown)) {
    apiResponse.roomTypeBreakdown.forEach((item: any) => {
      const name = item.room_type || item.shop_name || item.facility_name || "";
      const cap = Number(item.capacity || item.total_capacity || 0);
      if (name.includes("16")) capsForTarget["16PY"] = cap;
      else if (name.includes("35")) capsForTarget["35PY"] = cap;
      else if (name.includes("51")) capsForTarget["51PY"] = cap;
    });
  }

  const cap16 = capsForTarget["16PY"] || 90 * diffDays;
  const cap35 = capsForTarget["35PY"] || 90 * diffDays;
  const totalCap = cap16 + cap35;

  const actualRn = sold16 + sold35 + (sold51 * 2) + soldEtc;
  
  let actualRev = 0;
  if (apiResponse && Array.isArray(apiResponse.dailyReportBreakdown)) {
    const roomTotalItem = apiResponse.dailyReportBreakdown.find(
      (x: any) => x.category_code === "ROOM" && (x.shop_name === "객실 Total" || x.shop_name === "ROOM")
    );
    if (roomTotalItem) {
      actualRev = Number(roomTotalItem.mtd_actual || 0);
    }
  }
  if (actualRev === 0) {
    actualRev = Number(apiResponse.mtd?.actual || 0);
  }

  const actualOcc = totalCap > 0 ? (actualRn / totalCap) : 0; // Fractional value for Excel formatting

  const targetRows = [
    {
      metric: "판매 객실 수 (R/N)",
      target: targetConfig.targetRn,
      actual: actualRn,
      rate: targetConfig.targetRn > 0 ? actualRn / targetConfig.targetRn : 0,
      format: '#,##0',
      isPct: false
    },
    {
      metric: "매출액 (Net / 원)",
      target: targetConfig.targetRev,
      actual: actualRev,
      rate: targetConfig.targetRev > 0 ? actualRev / targetConfig.targetRev : 0,
      format: '#,##0',
      isPct: false
    },
    {
      metric: "객실 가동률 (OCC)",
      target: targetConfig.targetOcc / 100, // input target is 80 (%), convert to 0.8
      actual: actualOcc,
      rate: targetConfig.targetOcc > 0 ? actualOcc / (targetConfig.targetOcc / 100) : 0,
      format: '0.0%',
      isPct: true
    }
  ];

  targetRows.forEach(row => {
    const r = worksheet.getRow(currRow);
    r.values = [
      row.metric,
      row.target,
      row.actual,
      row.rate
    ];
    r.height = 20;

    const labelCell = r.getCell(1);
    labelCell.font = fontRowLabel;
    labelCell.border = borderThin;
    labelCell.alignment = { vertical: 'middle', horizontal: 'left' };

    const targetCell = r.getCell(2);
    targetCell.font = fontRegular;
    targetCell.border = borderThin;
    targetCell.alignment = { vertical: 'middle', horizontal: 'right' };
    targetCell.numFmt = row.format;

    const actualCell = r.getCell(3);
    actualCell.font = fontRegular;
    actualCell.border = borderThin;
    actualCell.alignment = { vertical: 'middle', horizontal: 'right' };
    actualCell.numFmt = row.format;

    const rateCell = r.getCell(4);
    rateCell.font = fontBold;
    rateCell.border = borderThin;
    rateCell.alignment = { vertical: 'middle', horizontal: 'right' };
    rateCell.numFmt = '0.0%'; // Rate cell is formatted as percent
    
    // Highlight colors
    rateCell.font = {
      ...fontBold,
      color: { argb: row.rate >= 1.0 ? 'FF047857' : 'FFB91C1C' } // green if >= 100%, red if less
    };

    currRow += 1;
  });
  currRow += 2; // Leave space


  // 4. Table 1: 객실 세그먼트별 실적 (평형별 크로스탭)
  worksheet.getCell(currRow, 1).value = "▣ 1. 객실 세그먼트별 실적 (평형별 크로스탭)";
  worksheet.getCell(currRow, 1).font = fontSectionHeader;
  currRow += 1;

  // Header 1 (Group names)
  const groupHeaderRow = worksheet.getRow(currRow);
  groupHeaderRow.height = 24;
  groupHeaderRow.getCell(1).value = "지표";
  groupHeaderRow.getCell(1).font = fontTableHeader;
  groupHeaderRow.getCell(1).fill = fillIndigoHeader;
  groupHeaderRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
  groupHeaderRow.getCell(1).border = borderThin;

  const segmentsList = ["합계", "분양회원", "자사채널", "MICE", "OTA", "법인", "제휴&기타", "기타"];
  segmentsList.forEach((seg, idx) => {
    const colIdx = 2 + idx * 5;
    worksheet.mergeCells(currRow, colIdx, currRow, colIdx + 4);
    const cell = groupHeaderRow.getCell(colIdx);
    cell.value = seg;
    cell.font = fontTableHeader;
    cell.fill = seg === "합계" ? fillIndigoHeader : fillTealHeader;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    
    for (let c = colIdx; c < colIdx + 5; c++) {
      groupHeaderRow.getCell(c).border = borderThin;
    }
  });
  currRow += 1;

  // Header 2 (pyType details)
  const pyHeaderRow = worksheet.getRow(currRow);
  pyHeaderRow.height = 20;
  pyHeaderRow.getCell(1).value = "";
  pyHeaderRow.getCell(1).border = borderThin;

  segmentsList.forEach((seg, idx) => {
    const colIdx = 2 + idx * 5;
    const isTotal = seg === "합계";
    
    pyHeaderRow.getCell(colIdx).value = "16PY";
    pyHeaderRow.getCell(colIdx + 1).value = "35PY";
    pyHeaderRow.getCell(colIdx + 2).value = "51PY";
    pyHeaderRow.getCell(colIdx + 3).value = "기타";
    pyHeaderRow.getCell(colIdx + 4).value = isTotal ? "총계" : "소계";

    for (let c = colIdx; c < colIdx + 5; c++) {
      const cell = pyHeaderRow.getCell(c);
      cell.font = fontTableSubHeader;
      cell.fill = fillSubtotal;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = borderThin;
    }
  });
  currRow += 1;

  // Re-calculate the pivoted matrix rows using dynamic capacities
  const caps: { [key: string]: number } = { "16PY": 90 * diffDays, "35PY": 90 * diffDays, "51PY": 0 };
  if (apiResponse && Array.isArray(apiResponse.roomTypeBreakdown)) {
    apiResponse.roomTypeBreakdown.forEach((item: any) => {
      const name = item.room_type || item.shop_name || item.facility_name || "";
      const cap = Number(item.capacity || item.total_capacity || 0);
      if (name.includes("16")) {
        caps["16PY"] = cap;
      } else if (name.includes("35")) {
        caps["35PY"] = cap;
      } else if (name.includes("51")) {
        caps["51PY"] = cap;
      }
    });
  }

  const matrixRows = calculateSegmentMatrix(apiResponse.segmentBreakdown || [], diffDays, caps);
  matrixRows.forEach(row => {
    const r = worksheet.getRow(currRow);
    r.height = 22;
    const isOcc = row.metric.includes("가동률");
    
    // Label
    const lbl = r.getCell(1);
    lbl.value = row.metric;
    lbl.font = fontRowLabel;
    lbl.border = borderThin;
    lbl.alignment = { vertical: 'middle', horizontal: 'left' };

    segmentsList.forEach((seg, sIdx) => {
      const colIdx = 2 + sIdx * 5;
      const isTotal = seg === "합계";

      const getVal = (key: string) => {
        const val = row[key];
        return (val === undefined || val === null) ? 0 : val;
      };

      const val16 = getVal(`${isTotal ? "합계" : seg}_16PY`);
      const val35 = getVal(`${isTotal ? "합계" : seg}_35PY`);
      const val51 = getVal(`${isTotal ? "합계" : seg}_51PY`);
      const valEtc = getVal(`${isTotal ? "합계" : seg}_기타`);
      const valSum = getVal(`${isTotal ? "합계" : seg}${isTotal ? "_총계" : "_소계"}`);

      r.getCell(colIdx).value = val16;
      r.getCell(colIdx + 1).value = val35;
      r.getCell(colIdx + 2).value = val51;
      r.getCell(colIdx + 3).value = valEtc;
      r.getCell(colIdx + 4).value = valSum;

      for (let c = colIdx; c < colIdx + 5; c++) {
        const cell = r.getCell(c);
        cell.font = (c === colIdx + 4) ? fontBold : fontRegular;
        cell.border = borderThin;
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        
        // Formatter
        if (isOcc && typeof cell.value === "number") {
          cell.numFmt = '0.0%';
        } else if (!isOcc && typeof cell.value === "number") {
          cell.numFmt = '#,##0';
        }

        // Fills
        if (isTotal) {
          cell.fill = fillTotal;
        } else if (c === colIdx + 4) {
          cell.fill = fillSubtotal;
        }
      }
    });

    currRow += 1;
  });
  currRow += 2; // Leave space


  // 5. Table 2: 예약 채널별 객실 실적
  worksheet.getCell(currRow, 1).value = "▣ 2. 예약 채널별 객실 실적 (채널별 요약)";
  worksheet.getCell(currRow, 1).font = fontSectionHeader;
  currRow += 1;

  const chHeaders = ["채널명", "금일 실적 (TODAY)", "금일 전년 동기", "당월 누적 (MTD)", "당월 전년 동기 (MTD LY)", "연간 누적 (YTD)", "연간 전년 동기 (YTD LY)"];
  const chHeaderRow = worksheet.getRow(currRow);
  chHeaderRow.values = chHeaders;
  chHeaderRow.height = 24;
  chHeaders.forEach((_, idx) => {
    const cell = chHeaderRow.getCell(idx + 1);
    cell.font = fontTableHeader;
    cell.fill = fillTealHeader;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = borderThin;
  });
  currRow += 1;

  const channelsData = apiResponse.channelBreakdown || [];
  channelsData.forEach(ch => {
    const r = worksheet.getRow(currRow);
    r.values = [
      ch.shop_name || ch.facility_name,
      Number(ch.today_actual || 0),
      Number(ch.today_ly || 0),
      Number(ch.mtd_actual || 0),
      Number(ch.mtd_ly || 0),
      Number(ch.ytd_actual || 0),
      Number(ch.ytd_ly || 0)
    ];
    r.height = 20;

    const labelCell = r.getCell(1);
    labelCell.font = fontRegular;
    labelCell.border = borderThin;
    labelCell.alignment = { vertical: 'middle', horizontal: 'left' };

    for (let i = 2; i <= 7; i++) {
      const cell = r.getCell(i);
      cell.font = fontRegular;
      cell.border = borderThin;
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
      cell.numFmt = '#,##0';
    }
    currRow += 1;
  });
  currRow += 2; // Leave space


  // 6. Table 3: 요금코드별 실적 (분류표 매핑 현황)
  worksheet.getCell(currRow, 1).value = "▣ 3. 요금코드별 실적 (분류표 정의 기준)";
  worksheet.getCell(currRow, 1).font = fontSectionHeader;
  currRow += 1;

  const rcHeaders = ["세그먼트명", "요금코드", "유형", "판매 객실 수 (R/N)", "매출액 (원)"];
  const rcHeaderRow = worksheet.getRow(currRow);
  rcHeaderRow.values = rcHeaders;
  rcHeaderRow.height = 24;
  rcHeaders.forEach((_, idx) => {
    const cell = rcHeaderRow.getCell(idx + 1);
    cell.font = fontTableHeader;
    cell.fill = fillAmberHeader;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = borderThin;
  });
  currRow += 1;

  // Build rate code map from apiResponse.rateCodeBreakdown
  const rcMap: { [key: string]: { roomsSold: number; revenue: number } } = {};
  if (Array.isArray(apiResponse.rateCodeBreakdown)) {
    apiResponse.rateCodeBreakdown.forEach(item => {
      const code = item.rateCode || "UNKNOWN";
      rcMap[code] = {
        roomsSold: Number(item.roomsSold || item.rooms_sold_weighted || 0),
        revenue: Number(item.today_actual || item.revenue || 0)
      };
    });
  }

  // Loop through rateCodesData and write table
  Object.entries(rateCodesData).forEach(([segName, codes]) => {
    const startMergeRow = currRow;
    
    codes.forEach(c => {
      const r = worksheet.getRow(currRow);
      r.height = 20;

      const stats = rcMap[c.code] || { roomsSold: 0, revenue: 0 };
      r.values = [
        segName,
        c.code,
        c.type || "변동",
        stats.roomsSold,
        stats.revenue
      ];

      // Format individual cells
      for (let i = 1; i <= 5; i++) {
        const cell = r.getCell(i);
        cell.font = fontRegular;
        cell.border = borderThin;
        
        if (i === 1) cell.alignment = { vertical: 'middle', horizontal: 'center' };
        else if (i === 2) cell.alignment = { vertical: 'middle', horizontal: 'left' };
        else if (i === 3) cell.alignment = { vertical: 'middle', horizontal: 'center' };
        else {
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
          cell.numFmt = '#,##0';
        }
      }

      currRow += 1;
    });

    const endMergeRow = currRow - 1;
    if (endMergeRow >= startMergeRow) {
      worksheet.mergeCells(startMergeRow, 1, endMergeRow, 1);
      // Ensure border for merged segment column cell
      const mergeCell = worksheet.getCell(startMergeRow, 1);
      mergeCell.font = fontBold;
      mergeCell.alignment = { vertical: 'middle', horizontal: 'center' };
    }
  });

  // Adjust Column Widths dynamically
  worksheet.columns.forEach((col, colIdx) => {
    let maxLen = 10;
    col.eachCell!({ includeEmpty: false }, cell => {
      const rowNum = Number(cell.row);
      if (rowNum === 1 || rowNum === 2) return;
      const strVal = cell.value ? String(cell.value) : "";
      
      let charLen = 0;
      for (let i = 0; i < strVal.length; i++) {
        charLen += strVal.charCodeAt(i) > 128 ? 2.2 : 1;
      }
      if (charLen > maxLen) maxLen = charLen;
    });
    col.width = Math.min(45, maxLen + 3);
  });

  // Specifically widen Column 1
  worksheet.getColumn(1).width = 25;

  // Generate Excel File download trigger in browser
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `벨포레_실적분석_대시보드_${startDate}_${endDate}.xlsx`;
  anchor.click();
  window.URL.revokeObjectURL(url);
}
