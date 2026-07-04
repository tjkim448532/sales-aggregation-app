import ExcelJS from "exceljs";
import { type V3RevenueResponse } from "./api";
import rateCodesData from "@/data/rate_codes.json";

// Replicate segment matrix calculation logic
interface SegmentMatrixRow {
  metric: string;
  [key: string]: any;
}

function calculateSegmentMatrix(segmentBreakdown: any[]): SegmentMatrixRow[] {
  const metrics = ["판매객실수(R/N)", "매출액", "객단가(ADR)", "가동률(OCC)"];
  const segments = ["분양회원", "자사채널", "MICE", "OTA", "법인", "제휴&기타", "기타"];
  const pyTypes = ["16PY", "35PY", "51PY"];

  const rows: SegmentMatrixRow[] = metrics.map(metric => ({ metric }));
  const getRow = (m: string) => rows.find(r => r.metric === m)!;

  const cellRN: { [key: string]: number } = {};
  const cellREV: { [key: string]: number } = {};
  const cellOCC: { [key: string]: number } = {};

  if (Array.isArray(segmentBreakdown)) {
    segmentBreakdown.forEach(item => {
      const segNameRaw = item.segment || item.segment_name || "";
      const segName = segments.find(s => s === segNameRaw) || "기타";

      let py = item.pyType || item.room_type || item.facility_name || "";
      if (py.includes("16")) py = "16PY";
      else if (py.includes("35")) py = "35PY";
      else if (py.includes("51")) py = "51PY";
      else py = "16PY";

      const rn = Number(item.roomsSold || item.room_nights || item.rooms_sold || 0);
      const rev = Number(item.revenue || item.today_actual || item.mtd_actual || 0);
      const occ = Number(item.occ || 0);

      const cellKey = `${segName}_${py}`;
      cellRN[cellKey] = (cellRN[cellKey] || 0) + rn;
      cellREV[cellKey] = (cellREV[cellKey] || 0) + rev;
      cellOCC[cellKey] = occ;
    });
  }

  segments.forEach(seg => {
    let segTotalRN = 0;
    let segTotalREV = 0;
    let segTotalWeightedOCCSum = 0;
    let segTotalOccCount = 0;

    pyTypes.forEach(py => {
      const cellKey = `${seg}_${py}`;
      const rn = cellRN[cellKey] || 0;
      const rev = cellREV[cellKey] || 0;
      const occ = cellOCC[cellKey] || 0;
      const adr = rn > 0 ? rev / rn : 0;

      getRow("판매객실수(R/N)")[cellKey] = rn;
      getRow("매출액")[cellKey] = rev;
      getRow("객단가(ADR)")[cellKey] = adr;
      getRow("가동률(OCC)")[cellKey] = occ;

      segTotalRN += rn;
      segTotalREV += rev;
      if (occ > 0) {
        segTotalWeightedOCCSum += occ * rn;
        segTotalOccCount += rn;
      }
    });

    const subtotalKey = `${seg}_소계`;
    getRow("판매객실수(R/N)")[subtotalKey] = segTotalRN;
    getRow("매출액")[subtotalKey] = segTotalREV;
    getRow("객단가(ADR)")[subtotalKey] = segTotalRN > 0 ? segTotalREV / segTotalRN : 0;
    getRow("가동률(OCC)")[subtotalKey] = segTotalOccCount > 0 ? segTotalWeightedOCCSum / segTotalOccCount : 0;
  });

  let grandTotalRN = 0;
  let grandTotalREV = 0;
  let grandTotalWeightedOCCSum = 0;
  let grandTotalOccCount = 0;

  pyTypes.forEach(py => {
    let pyTotalRN = 0;
    let pyTotalREV = 0;
    let pyTotalWeightedOCCSum = 0;
    let pyTotalOccCount = 0;

    segments.forEach(seg => {
      const cellKey = `${seg}_${py}`;
      const rn = cellRN[cellKey] || 0;
      const rev = cellREV[cellKey] || 0;
      const occ = cellOCC[cellKey] || 0;

      pyTotalRN += rn;
      pyTotalREV += rev;
      if (occ > 0) {
        pyTotalWeightedOCCSum += occ * rn;
        pyTotalOccCount += rn;
      }
    });

    const totalKey = `합계_${py}`;
    getRow("판매객실수(R/N)")[totalKey] = pyTotalRN;
    getRow("매출액")[totalKey] = pyTotalREV;
    getRow("객단가(ADR)")[totalKey] = pyTotalRN > 0 ? pyTotalREV / pyTotalRN : 0;
    getRow("가동률(OCC)")[totalKey] = pyTotalOccCount > 0 ? pyTotalWeightedOCCSum / pyTotalOccCount : 0;

    grandTotalRN += pyTotalRN;
    grandTotalREV += pyTotalREV;
    grandTotalWeightedOCCSum += pyTotalWeightedOCCSum;
    grandTotalOccCount += pyTotalOccCount;
  });

  const grandKey = "합계_총계";
  getRow("판매객실수(R/N)")[grandKey] = grandTotalRN;
  getRow("매출액")[grandKey] = grandTotalREV;
  getRow("객단가(ADR)")[grandKey] = grandTotalRN > 0 ? grandTotalREV / grandTotalRN : 0;
  getRow("가동률(OCC)")[grandKey] = grandTotalOccCount > 0 ? grandTotalWeightedOCCSum / grandTotalOccCount : 0;

  return rows;
}

export async function exportDashboardToExcel(
  apiResponse: V3RevenueResponse | null,
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

  const kpiHeaders = ["지표", "금일 실적 (TODAY)", "금일 전년 동기", "당월 누적 (MTD)", "당월 전년 동기 (MTD LY)", "연간 누적 (YTD)", "연간 전년 동기 (YTD LY)"];
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

  const occupiedItem: any = apiResponse.dailyReportBreakdown?.find(x => x.name === "Occupied Rooms") || {};
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

  // Calculate actual MTD values
  const actualRn = Number(occupiedItem.mtd_actual || 0);
  const actualRev = Number(apiResponse.mtd?.actual || 0);
  
  // Calculate average OCC
  const parts = endDate.split("-");
  const year = parseInt(parts[0]);
  const month = parseInt(parts[1]);
  const daysInMonth = new Date(year, month, 0).getDate();
  const actualOcc = daysInMonth > 0 ? (actualRn / (214 * daysInMonth)) : 0; // ratio format in Excel

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
    const colIdx = 2 + idx * 4;
    worksheet.mergeCells(currRow, colIdx, currRow, colIdx + 3);
    const cell = groupHeaderRow.getCell(colIdx);
    cell.value = seg;
    cell.font = fontTableHeader;
    cell.fill = seg === "합계" ? fillIndigoHeader : fillTealHeader;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    
    for (let c = colIdx; c < colIdx + 4; c++) {
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
    const colIdx = 2 + idx * 4;
    const isTotal = seg === "합계";
    
    pyHeaderRow.getCell(colIdx).value = "16PY";
    pyHeaderRow.getCell(colIdx + 1).value = "35PY";
    pyHeaderRow.getCell(colIdx + 2).value = "51PY";
    pyHeaderRow.getCell(colIdx + 3).value = isTotal ? "총계" : "소계";

    for (let c = colIdx; c < colIdx + 4; c++) {
      const cell = pyHeaderRow.getCell(c);
      cell.font = fontTableSubHeader;
      cell.fill = fillSubtotal;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = borderThin;
    }
  });
  currRow += 1;

  // Re-calculate the pivoted matrix rows
  const matrixRows = calculateSegmentMatrix(apiResponse.segmentBreakdown || []);
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
      const colIdx = 2 + sIdx * 4;
      const isTotal = seg === "합계";
      const keySuffix = isTotal ? "" : "_소계";

      const val16 = row[`${isTotal ? "합계" : seg}_16PY`] || 0;
      const val35 = row[`${isTotal ? "합계" : seg}_35PY`] || 0;
      const val51 = row[`${isTotal ? "합계" : seg}_51PY`] || 0;
      const valSum = row[`${isTotal ? "합계" : seg}${isTotal ? "_총계" : "_소계"}`] || 0;

      r.getCell(colIdx).value = isOcc ? val16 / 100 : val16;
      r.getCell(colIdx + 1).value = isOcc ? val35 / 100 : val35;
      r.getCell(colIdx + 2).value = isOcc ? val51 / 100 : val51;
      r.getCell(colIdx + 3).value = isOcc ? valSum / 100 : valSum;

      for (let c = colIdx; c < colIdx + 4; c++) {
        const cell = r.getCell(c);
        cell.font = (c === colIdx + 3) ? fontBold : fontRegular;
        cell.border = borderThin;
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        
        // Formatter
        if (isOcc) {
          cell.numFmt = '0.0%';
        } else {
          cell.numFmt = '#,##0';
        }

        // Fills
        if (isTotal) {
          cell.fill = fillTotal;
        } else if (c === colIdx + 3) {
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
      ch.channel_name,
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
      rcMap[item.rateCode] = {
        roomsSold: Number(item.roomsSold || 0),
        revenue: Number(item.revenue || 0)
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
