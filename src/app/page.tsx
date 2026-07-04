"use client"

import { useState, useMemo, useEffect } from "react"
import { format, subDays } from "date-fns"
import { Download, Search, RefreshCw, AlertCircle } from "lucide-react"
import { AgGridReact } from "ag-grid-react"
import { ColDef, ColGroupDef, ModuleRegistry, AllCommunityModule } from "ag-grid-community"
import "ag-grid-community/styles/ag-grid.css"
import "ag-grid-community/styles/ag-theme-alpine.css"
import { fetchDailyRevenue, type V3RevenueResponse, type V3ReportBreakdownItem, type V3ChannelBreakdownItem } from "@/lib/api"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import DateRangePicker from "@/components/DateRangePicker"

ModuleRegistry.registerModules([AllCommunityModule])

interface SegmentMatrixRow {
  metric: string;
  [key: string]: any;
}

// Helper to transform flat segmentBreakdown to pivoted matrix rows
function buildSegmentMatrix(segmentBreakdown: any[]): SegmentMatrixRow[] {
  const metrics = ["판매객실수(R/N)", "매출액", "객단가(ADR)", "가동률(OCC)"]
  const segments = ["분양회원", "자사채널", "MICE", "OTA", "법인", "제휴&기타", "기타"]
  const pyTypes = ["16PY", "35PY", "51PY"]

  // Initialize rows
  const rows: SegmentMatrixRow[] = metrics.map(metric => ({ metric }))

  const getRow = (m: string) => rows.find(r => r.metric === m)!

  const cellRN: { [key: string]: number } = {}
  const cellREV: { [key: string]: number } = {}
  const cellOCC: { [key: string]: number } = {}

  // 1. Loop through raw breakdown data
  if (Array.isArray(segmentBreakdown)) {
    segmentBreakdown.forEach(item => {
      // Handle both new format (segment, pyType) and old format (segment_name, facility_name)
      const segNameRaw = item.segment || item.segment_name || ""
      const segName = segments.find(s => s === segNameRaw) || "기타"

      // Normalize pyType
      let py = item.pyType || item.room_type || item.facility_name || ""
      if (py.includes("16")) py = "16PY"
      else if (py.includes("35")) py = "35PY"
      else if (py.includes("51")) py = "51PY"
      else py = "16PY" // default fallback

      const rn = Number(item.roomsSold || item.room_nights || item.rooms_sold || 0)
      const rev = Number(item.revenue || item.today_actual || item.mtd_actual || 0)
      const occ = Number(item.occ || 0)

      const cellKey = `${segName}_${py}`
      cellRN[cellKey] = (cellRN[cellKey] || 0) + rn
      cellREV[cellKey] = (cellREV[cellKey] || 0) + rev
      cellOCC[cellKey] = occ
    })
  }

  // Populate segment cells and calculate subtotals
  segments.forEach(seg => {
    let segTotalRN = 0
    let segTotalREV = 0
    let segTotalWeightedOCCSum = 0
    let segTotalOccCount = 0

    pyTypes.forEach(py => {
      const cellKey = `${seg}_${py}`
      const rn = cellRN[cellKey] || 0
      const rev = cellREV[cellKey] || 0
      const occ = cellOCC[cellKey] || 0
      const adr = rn > 0 ? rev / rn : 0

      getRow("판매객실수(R/N)")[cellKey] = rn
      getRow("매출액")[cellKey] = rev
      getRow("객단가(ADR)")[cellKey] = adr
      getRow("가동률(OCC)")[cellKey] = occ

      segTotalRN += rn
      segTotalREV += rev
      if (occ > 0) {
        segTotalWeightedOCCSum += occ * rn
        segTotalOccCount += rn
      }
    })

    const subtotalKey = `${seg}_소계`
    getRow("판매객실수(R/N)")[subtotalKey] = segTotalRN
    getRow("매출액")[subtotalKey] = segTotalREV
    getRow("객단가(ADR)")[subtotalKey] = segTotalRN > 0 ? segTotalREV / segTotalRN : 0
    getRow("가동률(OCC)")[subtotalKey] = segTotalOccCount > 0 ? segTotalWeightedOCCSum / segTotalOccCount : 0
  })

  // Calculate overall totals (합계) for each pyType
  let grandTotalRN = 0
  let grandTotalREV = 0
  let grandTotalWeightedOCCSum = 0
  let grandTotalOccCount = 0

  pyTypes.forEach(py => {
    let pyTotalRN = 0
    let pyTotalREV = 0
    let pyTotalWeightedOCCSum = 0
    let pyTotalOccCount = 0

    segments.forEach(seg => {
      const cellKey = `${seg}_${py}`
      const rn = cellRN[cellKey] || 0
      const rev = cellREV[cellKey] || 0
      const occ = cellOCC[cellKey] || 0

      pyTotalRN += rn
      pyTotalREV += rev
      if (occ > 0) {
        pyTotalWeightedOCCSum += occ * rn
        pyTotalOccCount += rn
      }
    })

    const totalKey = `합계_${py}`
    getRow("판매객실수(R/N)")[totalKey] = pyTotalRN
    getRow("매출액")[totalKey] = pyTotalREV
    getRow("객단가(ADR)")[totalKey] = pyTotalRN > 0 ? pyTotalREV / pyTotalRN : 0
    getRow("가동률(OCC)")[totalKey] = pyTotalOccCount > 0 ? pyTotalWeightedOCCSum / pyTotalOccCount : 0

    grandTotalRN += pyTotalRN
    grandTotalREV += pyTotalREV
    grandTotalWeightedOCCSum += pyTotalWeightedOCCSum
    grandTotalOccCount += pyTotalOccCount
  })

  const grandKey = "합계_총계"
  getRow("판매객실수(R/N)")[grandKey] = grandTotalRN
  getRow("매출액")[grandKey] = grandTotalREV
  getRow("객단가(ADR)")[grandKey] = grandTotalRN > 0 ? grandTotalREV / grandTotalRN : 0
  getRow("가동률(OCC)")[grandKey] = grandTotalOccCount > 0 ? grandTotalWeightedOCCSum / grandTotalOccCount : 0

  return rows
}

export default function DashboardPage() {
  const [startDate, setStartDate] = useState<string>("2026-06-01")
  const [endDate, setEndDate] = useState<string>("2026-06-30")
  const [apiResponse, setApiResponse] = useState<V3RevenueResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>("")
  const [gridApi, setGridApi] = useState<any>(null)
  const [matrixGridApi, setMatrixGridApi] = useState<any>(null)

  const loadData = async () => {
    setIsLoading(true)
    setError("")
    try {
      const result = await fetchDailyRevenue(startDate, endDate)
      setApiResponse(result)
    } catch (err: any) {
      console.error("Failed to fetch data:", err)
      setError(err.message || "데이터를 불러오는 중 오류가 발생했습니다.")
      setApiResponse(null)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [startDate, endDate])

  const exportToExcel = () => {
    if (gridApi) {
      gridApi.exportDataAsCsv({ fileName: `revenue_export_${startDate}_${endDate}.csv` })
    }
  }

  // Format values for the Facility Detail Grid
  const formatVal = (val: any, name: string) => {
    if (val === undefined || val === null || val === "") return "-"
    const num = Number(val)
    if (isNaN(num)) return val

    if (name === "Occupied Rooms" || name === "Rooms Sold") {
      return Math.round(num).toLocaleString()
    }
    
    // 1000단위 미만 절사 (천원 단위 표기, ₩ 기호 제거)
    const thousandVal = Math.round(num / 1000)
    return thousandVal.toLocaleString()
  }

  // Format values for the Matrix Grid
  const formatMatrixVal = (val: any, metric: string) => {
    if (val === undefined || val === null || val === "") return "-"
    const num = Number(val)
    if (isNaN(num)) return val

    if (metric === "판매객실수(R/N)") {
      return Math.round(num).toLocaleString()
    }
    if (metric === "매출액" || metric === "객단가(ADR)") {
      // 1000단위 미만 절사 (천원 단위 표기, ₩ 기호 제거)
      const thousandVal = Math.round(num / 1000)
      return thousandVal.toLocaleString()
    }
    if (metric === "가동률(OCC)") {
      // DB에서 이미 퍼센트값(예: 4.2 -> 4.2%)으로 리턴되므로 곱하기 100 없이 직접 소수점 포맷팅만 수행
      return `${num.toFixed(1)}%`
    }
    return val
  }

  // Segment PY Matrix Column Definitions
  const matrixColDefs = useMemo<(ColDef | ColGroupDef)[]>(() => {
    const segments = ["분양회원", "자사채널", "MICE", "OTA", "법인", "제휴&기타", "기타"]
    const pyTypes = ["16PY", "35PY", "51PY"]

    const cols: (ColDef | ColGroupDef)[] = [
      { 
        field: "metric", 
        headerName: "지표", 
        pinned: "left", 
        width: 120,
        cellStyle: { fontWeight: 'bold', textAlign: 'center', borderRight: '2px solid #d1d5db' }
      }
    ]

    // 합계 Group
    cols.push({
      headerName: "합계",
      children: [
        { 
          field: "합계_16PY", 
          headerName: "16PY", 
          width: 110,
          valueFormatter: (p) => formatMatrixVal(p.value, p.data?.metric || "")
        },
        { 
          field: "합계_35PY", 
          headerName: "35PY", 
          width: 110,
          valueFormatter: (p) => formatMatrixVal(p.value, p.data?.metric || "")
        },
        { 
          field: "합계_51PY", 
          headerName: "51PY", 
          width: 110,
          valueFormatter: (p) => formatMatrixVal(p.value, p.data?.metric || "")
        },
        { 
          field: "합계_총계", 
          headerName: "총계", 
          width: 130,
          cellStyle: { fontWeight: 'bold', borderRight: '3px solid #374151' },
          valueFormatter: (p) => formatMatrixVal(p.value, p.data?.metric || "")
        }
      ]
    })

    // Segments Group
    segments.forEach(seg => {
      cols.push({
        headerName: seg,
        children: [
          { 
            field: `${seg}_16PY`, 
            headerName: "16PY", 
            width: 110,
            valueFormatter: (p) => formatMatrixVal(p.value, p.data?.metric || "")
          },
          { 
            field: `${seg}_35PY`, 
            headerName: "35PY", 
            width: 110,
            valueFormatter: (p) => formatMatrixVal(p.value, p.data?.metric || "")
          },
          { 
            field: `${seg}_51PY`, 
            headerName: "51PY", 
            width: 110,
            valueFormatter: (p) => formatMatrixVal(p.value, p.data?.metric || "")
          },
          { 
            field: `${seg}_소계`, 
            headerName: "소계", 
            width: 120,
            cellStyle: { fontWeight: 'bold', borderRight: '2px solid #9ca3af' },
            valueFormatter: (p) => formatMatrixVal(p.value, p.data?.metric || "")
          }
        ]
      })
    })

    return cols
  }, [])

  // Facility Detail Column Definitions
  const colDefs = useMemo<ColDef<V3ReportBreakdownItem>[]>(() => [
    { field: "category", headerName: "분류", filter: true, sortable: true, width: 120 },
    { field: "name", headerName: "항목명", filter: true, sortable: true, width: 220 },
    { 
      field: "today_actual", 
      headerName: "금일 실적", 
      filter: "agNumberColumnFilter", 
      sortable: true, 
      width: 150, 
      valueFormatter: (p) => formatVal(p.value, p.data?.name || "") 
    },
    { 
      field: "today_ly", 
      headerName: "금일 전년", 
      filter: "agNumberColumnFilter", 
      sortable: true, 
      width: 150, 
      valueFormatter: (p) => formatVal(p.value, p.data?.name || "") 
    },
    { 
      field: "mtd_actual", 
      headerName: "당월 누적 (MTD)", 
      filter: "agNumberColumnFilter", 
      sortable: true, 
      width: 170, 
      valueFormatter: (p) => formatVal(p.value, p.data?.name || "") 
    },
    { 
      field: "mtd_ly", 
      headerName: "당월 전년 (MTD LY)", 
      filter: "agNumberColumnFilter", 
      sortable: true, 
      width: 170, 
      valueFormatter: (p) => formatVal(p.value, p.data?.name || "") 
    },
    { 
      field: "ytd_actual", 
      headerName: "연간 누적 (YTD)", 
      filter: "agNumberColumnFilter", 
      sortable: true, 
      width: 180, 
      valueFormatter: (p) => formatVal(p.value, p.data?.name || "") 
    },
    { 
      field: "ytd_ly", 
      headerName: "연간 전년 (YTD LY)", 
      filter: "agNumberColumnFilter", 
      sortable: true, 
      width: 180, 
      valueFormatter: (p) => formatVal(p.value, p.data?.name || "") 
    }
  ], [])

  const channelColDefs = useMemo<ColDef<V3ChannelBreakdownItem>[]>(() => [
    { field: "channel_name", headerName: "채널명", filter: true, sortable: true, width: 220 },
    { 
      field: "today_actual", 
      headerName: "금일 실적", 
      filter: "agNumberColumnFilter", 
      sortable: true, 
      width: 150, 
      valueFormatter: (p) => formatVal(p.value, "Revenue") 
    },
    { 
      field: "today_ly", 
      headerName: "금일 전년", 
      filter: "agNumberColumnFilter", 
      sortable: true, 
      width: 150, 
      valueFormatter: (p) => formatVal(p.value, "Revenue") 
    },
    { 
      field: "mtd_actual", 
      headerName: "당월 누적 (MTD)", 
      filter: "agNumberColumnFilter", 
      sortable: true, 
      width: 170, 
      valueFormatter: (p) => formatVal(p.value, "Revenue") 
    },
    { 
      field: "mtd_ly", 
      headerName: "당월 전년 (MTD LY)", 
      filter: "agNumberColumnFilter", 
      sortable: true, 
      width: 170, 
      valueFormatter: (p) => formatVal(p.value, "Revenue") 
    },
    { 
      field: "ytd_actual", 
      headerName: "연간 누적 (YTD)", 
      filter: "agNumberColumnFilter", 
      sortable: true, 
      width: 180, 
      valueFormatter: (p) => formatVal(p.value, "Revenue") 
    },
    { 
      field: "ytd_ly", 
      headerName: "연간 전년 (YTD LY)", 
      filter: "agNumberColumnFilter", 
      sortable: true, 
      width: 180, 
      valueFormatter: (p) => formatVal(p.value, "Revenue") 
    }
  ], [])

  const matrixRowData = useMemo(() => {
    return buildSegmentMatrix(apiResponse?.segmentBreakdown || [])
  }, [apiResponse])

  const chartData = useMemo(() => {
    if (!apiResponse || !apiResponse.chartData) return []
    return apiResponse.chartData.map(item => ({
      name: item.name,
      revenue: item.value
    }))
  }, [apiResponse])

  return (
    <div className="space-y-8 flex flex-col h-full">
      {/* Header Actions */}
      <div className="relative z-30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-900/50 p-5 rounded-xl border border-gray-800 backdrop-blur-md">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">유형별 매출 현황</h1>
          <p className="text-sm text-gray-400 mt-1">지정된 기간 동안의 세그먼트별 및 부서별 실적을 집계합니다.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <DateRangePicker 
            startDate={startDate} 
            endDate={endDate} 
            onChange={(start, end) => {
              setStartDate(start)
              setEndDate(end)
            }} 
          />
          
          <button 
            onClick={loadData}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
            <span>조회</span>
          </button>
          
          <button 
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg border border-gray-700 transition-colors"
          >
            <Download size={16} />
            <span>엑셀 다운로드</span>
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-3 bg-red-900/20 border border-red-800 p-4 rounded-xl text-red-400">
          <AlertCircle size={20} />
          <div>
            <p className="font-semibold">데이터 연동 실패</p>
            <p className="text-sm opacity-90">{error}</p>
          </div>
        </div>
      )}

      {/* KPI Dashboard Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-900/50 p-5 rounded-xl border border-gray-800 backdrop-blur-md">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">조회일 기준 실제 매출 (TODAY)</h4>
          <p className="text-2xl font-bold text-white mt-2">₩{(apiResponse?.today?.actual || 0).toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">전년 동기: ₩{(apiResponse?.today?.ly_actual || 0).toLocaleString()}</p>
        </div>
        <div className="bg-gray-900/50 p-5 rounded-xl border border-gray-800 backdrop-blur-md">
          <h4 className="text-xs font-semibold text-teal-400 uppercase tracking-wider">당월 누적 매출 (MTD)</h4>
          <p className="text-2xl font-bold text-white mt-2">₩{(apiResponse?.mtd?.actual || 0).toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">전년 동기: ₩{(apiResponse?.mtd?.ly_actual || 0).toLocaleString()}</p>
        </div>
        <div className="bg-gray-900/50 p-5 rounded-xl border border-gray-800 backdrop-blur-md">
          <h4 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">연간 누적 매출 (YTD)</h4>
          <p className="text-2xl font-bold text-white mt-2">₩{(apiResponse?.ytd?.actual || 0).toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">전년 동기: ₩{(apiResponse?.ytd?.ly_actual || 0).toLocaleString()}</p>
        </div>
        <div className="bg-gray-900/50 p-5 rounded-xl border border-gray-800 backdrop-blur-md flex flex-col justify-center">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">조회 범위 기준 데이터 일자</h4>
          <p className="text-lg font-bold text-indigo-300 mt-2">
            {apiResponse?.date ? format(parseISO(apiResponse.date), "yyyy년 MM월 dd일") : "날짜 지정 대기"}
          </p>
          <p className="text-xs text-gray-500 mt-1">조회기간: {startDate} ~ {endDate}</p>
        </div>
      </div>

      {/* 1. 객실 세그먼트별 실적 (Room Segment & PY Matrix) */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-200">1. 객실 세그먼트별 실적 (평형별 크로스탭) <span className="text-sm font-normal text-gray-400 ml-2">(금액 단위: 천원 / R/N 제외)</span></h2>
          <span className="text-xs text-indigo-400 bg-indigo-950/50 px-2 py-1 rounded border border-indigo-900/50">구글 시트 상단 기준</span>
        </div>
        <div className="h-[270px] bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden ag-theme-alpine-dark">
          <AgGridReact
            rowData={matrixRowData}
            columnDefs={matrixColDefs}
            defaultColDef={{ resizable: true }}
            onGridReady={(params) => setMatrixGridApi(params.api)}
            animateRows={true}
            rowHeight={45}
            headerHeight={45}
            groupHeaderHeight={42}
            getRowStyle={() => undefined}
            className="h-full w-full"
          />
        </div>
      </div>

      {/* 2. 예약 채널별 객실 실적 */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-200">2. 예약 채널별 객실 실적 (채널별 요약) <span className="text-sm font-normal text-gray-400 ml-2">(단위: 천원)</span></h2>
          <span className="text-xs text-teal-400 bg-teal-950/50 px-2 py-1 rounded border border-teal-900/50">구글 시트 중간 기준</span>
        </div>
        <div className="h-[300px] bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden ag-theme-alpine-dark">
          <AgGridReact
            rowData={apiResponse?.channelBreakdown || []}
            columnDefs={channelColDefs}
            defaultColDef={{ resizable: true }}
            animateRows={true}
            rowHeight={40}
            headerHeight={42}
            getRowStyle={() => undefined}
            className="h-full w-full"
          />
        </div>
      </div>

      {/* 3. 영업 부서별 매출 상세 (Departmental Revenue Breakdown) */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-200">3. 영업 부서별 매출 상세 (일매출보고서) <span className="text-sm font-normal text-gray-400 ml-2">(단위: 천원)</span></h2>
          <span className="text-xs text-teal-400 bg-teal-950/50 px-2 py-1 rounded border border-teal-900/50">구글 시트 하단 기준</span>
        </div>
        <div className="h-[520px] bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden ag-theme-alpine-dark">
          <AgGridReact
            rowData={apiResponse?.dailyReportBreakdown || []}
            columnDefs={colDefs}
            defaultColDef={{ resizable: true }}
            onGridReady={(params) => setGridApi(params.api)}
            animateRows={true}
            rowHeight={40}
            headerHeight={42}
            getRowStyle={(params) => {
              const name = params.data?.name || ""
              if (name.includes("Total") || name.includes("Grand")) {
                return { fontWeight: 'bold' } as any
              }
              return undefined
            }}
            className="h-full w-full"
          />
        </div>
      </div>

      {/* Chart Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-3 bg-gray-900/50 p-5 rounded-xl border border-gray-800 h-80">
          <h3 className="text-sm font-medium text-gray-400 mb-4">대분류별 매출 현황 (Revenue Summary)</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
              <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} />
              <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} tickFormatter={(val) => `₩${(val/10000).toLocaleString()}만`} />
              <Tooltip 
                cursor={{ fill: '#374151', opacity: 0.4 }}
                contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', color: '#F3F4F6' }}
                formatter={(value: any) => [`₩${Number(value).toLocaleString()}`, '매출']}
              />
              <Bar dataKey="revenue" fill="#4F46E5" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

function parseISO(dateString: string): Date {
  const parts = dateString.split("-")
  return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
}
