"use client"

import { useState, useMemo, useEffect } from "react"
import { format, subDays } from "date-fns"
import { Download, Search, RefreshCw, AlertCircle } from "lucide-react"
import { AgGridReact } from "ag-grid-react"
import { ColDef, ModuleRegistry, AllCommunityModule } from "ag-grid-community"
import "ag-grid-community/styles/ag-grid.css"
import "ag-grid-community/styles/ag-theme-alpine.css"
import { fetchDailyRevenue, type V3RevenueResponse, type V3ReportBreakdownItem } from "@/lib/api"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import DateRangePicker from "@/components/DateRangePicker"

ModuleRegistry.registerModules([AllCommunityModule])

export default function DashboardPage() {
  const [startDate, setStartDate] = useState<string>(format(subDays(new Date(), 1), "yyyy-MM-dd"))
  const [endDate, setEndDate] = useState<string>(format(new Date(), "yyyy-MM-dd"))
  const [apiResponse, setApiResponse] = useState<V3RevenueResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>("")
  const [gridApi, setGridApi] = useState<any>(null)

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

  // Helper to format values nicely based on name/category
  const formatVal = (val: any, name: string) => {
    if (val === undefined || val === null || val === "") return "-"
    const num = Number(val)
    if (isNaN(num)) return val

    // KPI(Occupied Rooms 등)는 ₩ 기호 제외하고 수량만 표기
    if (name === "Occupied Rooms" || name === "Rooms Sold") {
      return Math.round(num).toLocaleString()
    }

    // 그 외 재무 매출 지표는 ₩ 기호 표기
    return `₩${Math.round(num).toLocaleString()}`
  }

  // Column Definitions matching dailyReportBreakdown
  const colDefs = useMemo<ColDef<V3ReportBreakdownItem>[]>(() => [
    { field: "category", headerName: "분류", filter: true, sortable: true, width: 110 },
    { field: "name", headerName: "항목명", filter: true, sortable: true, width: 180 },
    { 
      field: "today_actual", 
      headerName: "금일 실적", 
      filter: "agNumberColumnFilter", 
      sortable: true, 
      width: 140, 
      valueFormatter: (p) => formatVal(p.value, p.data?.name || "") 
    },
    { 
      field: "today_ly", 
      headerName: "금일 전년", 
      filter: "agNumberColumnFilter", 
      sortable: true, 
      width: 140, 
      valueFormatter: (p) => formatVal(p.value, p.data?.name || "") 
    },
    { 
      field: "mtd_actual", 
      headerName: "당월 누적 (MTD)", 
      filter: "agNumberColumnFilter", 
      sortable: true, 
      width: 165, 
      valueFormatter: (p) => formatVal(p.value, p.data?.name || "") 
    },
    { 
      field: "mtd_ly", 
      headerName: "당월 전년 (MTD LY)", 
      filter: "agNumberColumnFilter", 
      sortable: true, 
      width: 165, 
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

  // Chart Data preparation
  const chartData = useMemo(() => {
    if (!apiResponse || !apiResponse.chartData) return []
    return apiResponse.chartData.map(item => ({
      name: item.name,
      revenue: item.value
    }))
  }, [apiResponse])

  return (
    <div className="space-y-6 flex flex-col h-full">
      {/* Header Actions */}
      <div className="relative z-30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-900/50 p-5 rounded-xl border border-gray-800 backdrop-blur-md">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">유형별 매출 현황</h1>
          <p className="text-sm text-gray-400 mt-1">지정된 기간 동안의 세그먼트별 매출 실적을 집계합니다.</p>
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

      {/* Data Grid Section */}
      <div className="flex-1 min-h-[500px] bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden ag-theme-alpine-dark">
        <AgGridReact
          rowData={apiResponse?.dailyReportBreakdown || []}
          columnDefs={colDefs}
          defaultColDef={{ resizable: true }}
          onGridReady={(params) => setGridApi(params.api)}
          animateRows={true}
          getRowStyle={(params) => {
            const name = params.data?.name || ""
            if (name.includes("Total") || name.includes("Grand")) {
              return { fontWeight: 'bold', backgroundColor: '#1e1b4b', color: '#f3f4f6' }
            }
            if (params.data?.category === "KPI") {
              return { backgroundColor: '#111827', color: '#818cf8', fontWeight: '500' }
            }
            return undefined
          }}
          className="h-full w-full"
        />
      </div>
    </div>
  )
}

// Simple ISO parser helper to avoid dependency issues
function parseISO(dateString: string): Date {
  const parts = dateString.split("-")
  return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
}
