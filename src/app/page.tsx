"use client"

import { useState, useMemo, useEffect } from "react"
import { format, subDays } from "date-fns"
import { Download, Search, RefreshCw, AlertCircle, Target, Info } from "lucide-react"
import { AgGridReact } from "ag-grid-react"
import { ColDef, ColGroupDef, ModuleRegistry, AllCommunityModule } from "ag-grid-community"
import "ag-grid-community/styles/ag-grid.css"
import "ag-grid-community/styles/ag-theme-alpine.css"
import { fetchDailyRevenue, type V3RevenueResponse, type V3ChannelBreakdownItem, type V3RateCodeBreakdownItem, fetchTargets } from "@/lib/api"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import DateRangePicker from "@/components/DateRangePicker"
import rateCodesData from "@/data/rate_codes.json"
import Link from "next/link"
import { exportDashboardToExcel } from "@/lib/excelExport"

ModuleRegistry.registerModules([AllCommunityModule])

interface SegmentMatrixRow {
  metric: string;
  [key: string]: any;
}

// Helper to transform flat segmentBreakdown to pivoted matrix rows
function buildSegmentMatrix(segmentBreakdown: any[], diffDays: number, capacities: { [key: string]: number }): SegmentMatrixRow[] {
  const metrics = ["판매객실수(R/N)", "매출액", "객단가(ADR)", "가동률(OCC)"]
  const segments = ["분양회원", "자사채널", "MICE", "OTA", "법인", "제휴&기타", "기타"]
  const pyTypes = ["16PY", "35PY", "51PY", "기타"]

  const cap16 = capacities["16PY"] || 90
  const cap35 = capacities["35PY"] || 90
  const totalCapacity = cap16 + cap35

  // Initialize rows
  const rows: SegmentMatrixRow[] = metrics.map(metric => ({ metric }))

  const getRow = (m: string) => rows.find(r => r.metric === m)!

  const cellRN: { [key: string]: number } = {}
  const cellREV: { [key: string]: number } = {}

  // 1. Loop through raw breakdown data to sum up roomsSold and revenue
  if (Array.isArray(segmentBreakdown)) {
    segmentBreakdown.forEach(item => {
      const segNameRaw = item.segment || item.segment_name || ""
      const segName = segments.find(s => s === segNameRaw) || "기타"

      // Normalize pyType
      let py = item.pyType || item.room_type || item.facility_name || ""
      if (py.includes("16")) py = "16PY"
      else if (py.includes("35")) py = "35PY"
      else if (py.includes("51")) py = "51PY"
      else py = "기타" // Unmapped types go to 기타 (ETC)

      const rn = Number(item.roomsSold || item.room_nights || item.rooms_sold || 0)
      const rev = Number(item.revenue || item.today_actual || item.mtd_actual || 0)

      const cellKey = `${segName}_${py}`
      cellRN[cellKey] = (cellRN[cellKey] || 0) + rn
      cellREV[cellKey] = (cellREV[cellKey] || 0) + rev
    })
  }

  // Populate segment cells and calculate subtotals
  segments.forEach(seg => {
    let segTotalRN = 0
    let segTotalREV = 0

    // Sum over ALL keys in cellRN/cellREV to avoid any leak
    Object.keys(cellRN).forEach(key => {
      if (key.startsWith(`${seg}_`)) {
        segTotalRN += cellRN[key]
      }
    })
    Object.keys(cellREV).forEach(key => {
      if (key.startsWith(`${seg}_`)) {
        segTotalREV += cellREV[key]
      }
    })

    const rn16 = cellRN[`${seg}_16PY`] || 0
    const rn35 = cellRN[`${seg}_35PY`] || 0
    const rn51 = cellRN[`${seg}_51PY`] || 0

    pyTypes.forEach(py => {
      const cellKey = `${seg}_${py}`
      const rn = cellRN[cellKey] || 0
      const rev = cellREV[cellKey] || 0
      const adr = rn > 0 ? rev / rn : 0
      
      let occVal: any = 0
      if (py === "16PY") {
        occVal = cap16 > 0 ? ((rn16 + rn51) / (cap16 * diffDays)) * 100 : 0
      } else if (py === "35PY") {
        occVal = cap35 > 0 ? ((rn35 + rn51) / (cap35 * diffDays)) * 100 : 0
      } else if (py === "51PY" || py === "기타") {
        occVal = "-" // 51평 및 기타 객실 단독 가동률은 산출 불가(-) 처리
      }

      getRow("판매객실수(R/N)")[cellKey] = rn
      getRow("매출액")[cellKey] = rev
      getRow("객단가(ADR)")[cellKey] = adr
      getRow("가동률(OCC)")[cellKey] = occVal
    })

    const subtotalKey = `${seg}_소계`
    getRow("판매객실수(R/N)")[subtotalKey] = segTotalRN
    getRow("매출액")[subtotalKey] = segTotalREV
    getRow("객단가(ADR)")[subtotalKey] = segTotalRN > 0 ? segTotalREV / segTotalRN : 0
    
    // Subtotal OCC: { 16PY + 35PY + (51PY * 2) } / (totalCapacity * diffDays) * 100
    getRow("가동률(OCC)")[subtotalKey] = totalCapacity > 0 ? ((rn16 + rn35 + (rn51 * 2)) / (totalCapacity * diffDays)) * 100 : 0
  })

  // Calculate overall totals (합계) for each pyType
  let grandTotalRN = 0
  let grandTotalREV = 0

  pyTypes.forEach(py => {
    let pyTotalRN = 0
    let pyTotalREV = 0

    segments.forEach(seg => {
      const cellKey = `${seg}_${py}`
      const rn = cellRN[cellKey] || 0
      const rev = cellREV[cellKey] || 0

      pyTotalRN += rn
      pyTotalREV += rev
    })

    const totalKey = `합계_${py}`
    getRow("판매객실수(R/N)")[totalKey] = pyTotalRN
    getRow("매출액")[totalKey] = pyTotalREV
    getRow("객단가(ADR)")[totalKey] = pyTotalRN > 0 ? pyTotalREV / pyTotalRN : 0
    
    let pyOccVal: any = 0
    if (py === "16PY") {
      const totalRN51 = segments.reduce((sum, seg) => sum + (cellRN[`${seg}_51PY`] || 0), 0)
      pyOccVal = cap16 > 0 ? ((pyTotalRN + totalRN51) / (cap16 * diffDays)) * 100 : 0
    } else if (py === "35PY") {
      const totalRN51 = segments.reduce((sum, seg) => sum + (cellRN[`${seg}_51PY`] || 0), 0)
      pyOccVal = cap35 > 0 ? ((pyTotalRN + totalRN51) / (cap35 * diffDays)) * 100 : 0
    } else if (py === "51PY" || py === "기타") {
      pyOccVal = "-"
    }
    getRow("가동률(OCC)")[totalKey] = pyOccVal

    grandTotalRN += pyTotalRN
    grandTotalREV += pyTotalREV
  })

  const totalRN16 = segments.reduce((sum, seg) => sum + (cellRN[`${seg}_16PY`] || 0), 0)
  const totalRN35 = segments.reduce((sum, seg) => sum + (cellRN[`${seg}_35PY`] || 0), 0)
  const totalRN51 = segments.reduce((sum, seg) => sum + (cellRN[`${seg}_51PY`] || 0), 0)

  const grandKey = "합계_총계"
  getRow("판매객실수(R/N)")[grandKey] = grandTotalRN
  getRow("매출액")[grandKey] = grandTotalREV
  getRow("객단가(ADR)")[grandKey] = grandTotalRN > 0 ? grandTotalREV / grandTotalRN : 0
  getRow("가동률(OCC)")[grandKey] = totalCapacity > 0 ? ((totalRN16 + totalRN35 + (totalRN51 * 2)) / (totalCapacity * diffDays)) * 100 : 0

  return rows;
}

export default function DashboardPage() {
  const [startDate, setStartDate] = useState<string>("2026-06-01")
  const [endDate, setEndDate] = useState<string>("2026-06-30")
  const [apiResponse, setApiResponse] = useState<V3RevenueResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>("")
  const [matrixGridApi, setMatrixGridApi] = useState<any>(null)
  
  const [targetConfig, setTargetConfig] = useState<any>({ targetRn: 0, targetRev: 0, targetOcc: 0 })

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

  useEffect(() => {
    const loadTargetConfig = async () => {
      try {
        const parts = endDate.split("-")
        const year = parseInt(parts[0])
        const month = parseInt(parts[1])
        const data = await fetchTargets(year, month)
        if (data) {
          setTargetConfig(data)
        }
      } catch (e) {
        console.error("Failed to fetch targets:", e)
      }
    }
    loadTargetConfig()
  }, [endDate])

  const diffDays = useMemo(() => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const diffTime = Math.abs(end.getTime() - start.getTime())
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
  }, [startDate, endDate])

  const dynamicCapacities = useMemo(() => {
    const caps = { "16PY": 90, "35PY": 90, "51PY": 0 }
    if (apiResponse && Array.isArray(apiResponse.roomTypeBreakdown)) {
      apiResponse.roomTypeBreakdown.forEach((item: any) => {
        const name = item.room_type || item.facility_name || ""
        const cap = Number(item.capacity || item.total_capacity || 0)
        if (name.includes("16")) {
          caps["16PY"] = cap
        } else if (name.includes("35")) {
          caps["35PY"] = cap
        } else if (name.includes("51")) {
          caps["51PY"] = cap
        }
      })
    }
    return caps
  }, [apiResponse])

  const periodRoomsSold = useMemo(() => {
    let sold16 = 0
    let sold35 = 0
    let sold51 = 0

    if (apiResponse && Array.isArray(apiResponse.segmentBreakdown)) {
      apiResponse.segmentBreakdown.forEach(item => {
        let py = item.pyType || item.room_type || item.facility_name || ""
        const rn = Number(item.roomsSold || item.room_nights || item.rooms_sold || 0)
        
        if (py.includes("16")) sold16 += rn
        else if (py.includes("35")) sold35 += rn
        else if (py.includes("51")) sold51 += rn
      })
    }

    return { sold16, sold35, sold51 }
  }, [apiResponse])

  const actualRn = useMemo(() => {
    // 51평 예약건은 물리적 객실 2개를 소모하므로 가중치(*2)를 더합니다.
    return periodRoomsSold.sold16 + periodRoomsSold.sold35 + (periodRoomsSold.sold51 * 2)
  }, [periodRoomsSold])

  const actualRev = useMemo(() => {
    return apiResponse?.mtd?.actual || 0
  }, [apiResponse])

  const actualOcc = useMemo(() => {
    const cap16 = dynamicCapacities["16PY"] || 90
    const cap35 = dynamicCapacities["35PY"] || 90
    const totalCap = cap16 + cap35

    if (totalCap === 0) return 0
    return (actualRn / (totalCap * diffDays)) * 100
  }, [actualRn, dynamicCapacities, diffDays])

  const exportToExcel = async () => {
    try {
      await exportDashboardToExcel(apiResponse, startDate, endDate, targetConfig)
    } catch (e) {
      console.error("Excel export error:", e)
      alert("엑셀 다운로드 중 오류가 발생했습니다.")
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
    const pyTypes = ["16PY", "35PY", "51PY", "기타"]

    const cols: (ColDef | ColGroupDef)[] = [
      { 
        field: "metric", 
        headerName: "지표", 
        pinned: "left", 
        width: 140,
        wrapText: true,
        autoHeight: true,
        cellStyle: { fontWeight: 'bold', textAlign: 'center', borderRight: '2px solid #d1d5db', whiteSpace: 'normal', lineHeight: '1.4' }
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
          field: "합계_기타", 
          headerName: "기타", 
          width: 110,
          valueFormatter: (p) => formatMatrixVal(p.value, p.data?.metric || "")
        },
        { 
          field: "합계_총계", 
          headerName: "총계", 
          width: 130,
          cellStyle: { fontWeight: 'bold', borderRight: '3px solid #374151', textAlign: 'center' },
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
            field: `${seg}_기타`, 
            headerName: "기타", 
            width: 110,
            valueFormatter: (p) => formatMatrixVal(p.value, p.data?.metric || "")
          },
          { 
            field: `${seg}_소계`, 
            headerName: "소계", 
            width: 120,
            cellStyle: { fontWeight: 'bold', borderRight: '2px solid #9ca3af', textAlign: 'center' },
            valueFormatter: (p) => formatMatrixVal(p.value, p.data?.metric || "")
          }
        ]
      })
    })

    return cols
  }, [])

  // Channel Detail Column Definitions

  const channelColDefs = useMemo<ColDef<V3ChannelBreakdownItem>[]>(() => [
    { field: "channel_name", headerName: "채널명", filter: true, sortable: true, width: 220, cellStyle: { textAlign: 'left' } },
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
    return buildSegmentMatrix(apiResponse?.segmentBreakdown || [], diffDays, dynamicCapacities)
  }, [apiResponse, diffDays, dynamicCapacities])

  const chartData = useMemo(() => {
    if (!apiResponse || !apiResponse.channelBreakdown) return []
    return apiResponse.channelBreakdown.map(item => ({
      name: item.channel_name,
      revenue: Math.round(Number(item.today_actual || 0) / 1000)
    }))
  }, [apiResponse])

  const rateCodeMap = useMemo(() => {
    const map: { [key: string]: { roomsSold: number; revenue: number } } = {}
    if (apiResponse && Array.isArray(apiResponse.rateCodeBreakdown)) {
      apiResponse.rateCodeBreakdown.forEach((item: V3RateCodeBreakdownItem) => {
        const code = item.rateCode
        map[code] = {
          roomsSold: Number(item.roomsSold || 0),
          revenue: Number(item.revenue || 0)
        }
      })
    }
    return map
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
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">선택 기간 실제 매출</h4>
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

      {/* Target vs Actual (목표 대비 실적 현황) */}
      {targetConfig && (
        <div className="bg-gray-900/70 p-5 rounded-xl border border-gray-700/60 backdrop-blur-md space-y-4 shadow-lg">
          <div className="flex justify-between items-center border-b border-gray-800/80 pb-3">
            <div>
              <h3 className="text-sm font-bold text-gray-100 flex items-center gap-2">
                <Target size={16} className="text-indigo-400" />
                <span>당월 목표 대비 실적 분석 ({endDate.split("-")[0]}년 {parseInt(endDate.split("-")[1])}월 기준)</span>
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">설정된 목표치와 당월 누적 실적(MTD)을 비교합니다.</p>
            </div>
            <Link 
              href="/targets" 
              className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 transition-colors"
            >
              <span>목표 설정하러 가기</span>
              <span>&rarr;</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 1. 객실 판매량 (R/N) */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-gray-300">판매 객실 수 (R/N)</span>
                <span className="text-indigo-400 font-bold">
                  달성률 {targetConfig.targetRn > 0 ? ((actualRn / targetConfig.targetRn) * 100).toFixed(1) : 0}%
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-white">{actualRn.toLocaleString()}</span>
                <span className="text-xs text-gray-400">/ {targetConfig.targetRn.toLocaleString()} R/N</span>
              </div>
              <div className="w-full bg-gray-950 rounded-full h-2.5 overflow-hidden border border-gray-800">
                <div 
                  className="bg-indigo-500 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min(100, targetConfig.targetRn > 0 ? (actualRn / targetConfig.targetRn) * 100 : 0)}%` }}
                />
              </div>
            </div>

            {/* 2. 매출액 */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-gray-300">매출액 (Net)</span>
                <span className="text-emerald-400 font-bold">
                  달성률 {targetConfig.targetRev > 0 ? ((actualRev / targetConfig.targetRev) * 100).toFixed(1) : 0}%
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-white">₩{Math.round(actualRev / 1000).toLocaleString()}</span>
                <span className="text-xs text-gray-400">/ ₩{Math.round(targetConfig.targetRev / 1000).toLocaleString()} (천원)</span>
              </div>
              <div className="w-full bg-gray-950 rounded-full h-2.5 overflow-hidden border border-gray-800">
                <div 
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min(100, targetConfig.targetRev > 0 ? (actualRev / targetConfig.targetRev) * 100 : 0)}%` }}
                />
              </div>
            </div>

            {/* 3. 객실 가동률 (OCC) */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-gray-300">객실 가동률 (OCC)</span>
                <span className="text-amber-400 font-bold">
                  달성률 {targetConfig.targetOcc > 0 ? ((actualOcc / targetConfig.targetOcc) * 100).toFixed(1) : 0}%
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-white">{actualOcc.toFixed(1)}%</span>
                <span className="text-xs text-gray-400">/ {targetConfig.targetOcc}%</span>
              </div>
              <div className="w-full bg-gray-950 rounded-full h-2.5 overflow-hidden border border-gray-800">
                <div 
                  className="bg-amber-500 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min(100, targetConfig.targetOcc > 0 ? (actualOcc / targetConfig.targetOcc) * 100 : 0)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 객실 및 가동률 집계 기준 안내 가이드 */}
      <div className="bg-indigo-950/25 border border-indigo-900/50 p-4 rounded-xl backdrop-blur-sm grid grid-cols-1 md:grid-cols-4 gap-4 text-xs shadow-md">
        <div className="md:col-span-4 flex items-center gap-2 border-b border-indigo-900/30 pb-2 mb-1">
          <Info size={14} className="text-indigo-400" />
          <span className="font-bold text-gray-200">벨포레 리조트 객실 및 가동률(OCC) 집계 기준</span>
        </div>
        <div>
          <span className="font-semibold text-indigo-300 block mb-1">① 수용량 및 기타 객실</span>
          <p className="text-gray-400 leading-relaxed">
            - 총 물리 객실: <span className="text-white font-semibold">180실</span> (16평 90실, 35평 90실)<br />
            - <span className="text-white font-semibold">미매핑 객실</span>: 72평, 카라반 등은 <span className="text-indigo-300 font-semibold">기타</span> 열로 자동 흡수되어 합계 누락을 방지합니다.
          </p>
        </div>
        <div>
          <span className="font-semibold text-amber-300 block mb-1">② 51평형 (커넥팅룸) 특성</span>
          <p className="text-gray-400 leading-relaxed">
            - 물리적으로 <span className="text-white font-semibold">16평 1실 + 35평 1실</span> 결합<br />
            - 가동률: 단독 산출 불가 (<span className="text-white font-semibold">-</span> 처리)<br />
            - <span className="text-white font-semibold">ADR(객단가)</span>: 방 2개가 아닌 <span className="text-amber-300 font-semibold">순수 예약 1건</span> 기준으로 산출합니다.
          </p>
        </div>
        <div>
          <span className="font-semibold text-emerald-300 block mb-1">③ 16평/35평 실질 OCC</span>
          <p className="text-gray-400 leading-relaxed">
            - 51평 투숙 시 점유되는 각 평형 객실 포함<br />
            - 16평 OCC = <span className="text-white font-semibold">(16평 R/N + 51평 R/N) / 90실</span><br />
            - 35평 OCC = <span className="text-white font-semibold">(35평 R/N + 51평 R/N) / 90실</span>
          </p>
        </div>
        <div>
          <span className="font-semibold text-indigo-300 block mb-1">④ 전체 가동률 (Total OCC)</span>
          <p className="text-gray-400 leading-relaxed">
            - 51평 1건당 물리 객실 2개 환산 (<span className="text-indigo-300 font-semibold">가중치 &times;2</span>)<br />
            - Total OCC = <span className="text-white font-semibold">&#123;16평 + 35평 + (51평 &times; 2)&#125; / 180실</span>
          </p>
        </div>
      </div>

      {/* 1. 객실 세그먼트별 실적 (Room Segment & PY Matrix) */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-gray-200">1. 객실 세그먼트별 실적 (평형별 크로스탭) <span className="text-sm font-normal text-gray-400 ml-2">(R/N 제외)</span></h2>
        <div className="h-[295px] bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden ag-theme-alpine-dark">
          <AgGridReact
            rowData={matrixRowData}
            columnDefs={matrixColDefs}
            defaultColDef={{ 
              resizable: true, 
              wrapHeaderText: true, 
              autoHeaderHeight: true, 
              cellStyle: { textAlign: 'center' } 
            }}
            onGridReady={(params) => setMatrixGridApi(params.api)}
            animateRows={true}
            headerHeight={48}
            groupHeaderHeight={42}
            getRowStyle={() => undefined}
            className="h-full w-full"
          />
        </div>
      </div>

      {/* 2. 예약 채널별 객실 실적 */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-gray-200">2. 예약 채널별 객실 실적 (채널별 요약)</h2>
        <div className="h-[300px] bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden ag-theme-alpine-dark">
          <AgGridReact
            rowData={apiResponse?.channelBreakdown || []}
            columnDefs={channelColDefs}
            defaultColDef={{ 
              resizable: true, 
              wrapHeaderText: true, 
              autoHeaderHeight: true, 
              cellStyle: { textAlign: 'center' } 
            }}
            animateRows={true}
            rowHeight={40}
            headerHeight={42}
            getRowStyle={() => undefined}
            className="h-full w-full"
          />
        </div>
      </div>

      {/* 3. 요금코드 분류표 (Rate Code Classification Mapping) */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-gray-200">3. 요금코드별 실적 (분류표 정의)</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 xl:grid-cols-7 gap-4">
          {Object.entries(rateCodesData).map(([segmentName, codes]) => (
            <div key={segmentName} className="bg-gray-900/40 rounded-xl border border-gray-800 flex flex-col h-[450px]">
              {/* Header */}
              <div className="px-3 py-2.5 bg-gray-950/60 border-b border-gray-800 rounded-t-xl flex justify-between items-center shrink-0">
                <span className="font-semibold text-xs text-indigo-300 truncate" title={segmentName}>{segmentName}</span>
                <span className="text-[10px] bg-indigo-950/50 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-900/30">
                  {codes.length}개
                </span>
              </div>
              {/* Body */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5 text-xs custom-scrollbar">
                {codes.map((item, idx) => {
                  const stats = rateCodeMap[item.code] || { roomsSold: 0, revenue: 0 }
                  return (
                    <div key={idx} className="p-2 rounded bg-gray-950/30 hover:bg-gray-950/70 border border-gray-800/50 transition-all flex flex-col gap-1.5">
                      <div className="flex justify-between items-start gap-1">
                        <span className="text-gray-200 font-medium truncate" title={item.code}>{item.code}</span>
                        {item.type && (
                          <span className={`text-[9px] px-1 py-0.2 rounded shrink-0 font-medium ${
                            item.type === "고정" 
                              ? "bg-emerald-950/40 text-emerald-400 border border-emerald-900/20" 
                              : "bg-amber-950/40 text-amber-400 border border-amber-900/20"
                          }`}>
                            {item.type}
                          </span>
                        )}
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-gray-500 border-t border-gray-800/20 pt-1 mt-0.5">
                        <span>객실: <strong className="text-indigo-400">{stats.roomsSold}</strong></span>
                        <span>매출: <strong className="text-emerald-500">{Math.round(stats.revenue / 1000).toLocaleString()}</strong></span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chart Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-3 bg-gray-900/50 p-5 rounded-xl border border-gray-800 h-80">
          <h3 className="text-sm font-semibold text-gray-200 mb-4">예약 채널별 매출 현황 (Revenue by Channel)</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 0, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
              <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} />
              <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF' }} tickFormatter={(val) => val.toLocaleString()} />
              <Tooltip 
                cursor={{ fill: '#374151', opacity: 0.4 }}
                contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', color: '#F3F4F6' }}
                formatter={(value: any) => [`${Number(value).toLocaleString()} 천원`, '매출']}
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
