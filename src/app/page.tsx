"use client"

import { useState, useMemo, useEffect } from "react"
import { format, subDays } from "date-fns"
import { Download, Search, RefreshCw } from "lucide-react"
import { AgGridReact } from "ag-grid-react"
import { ColDef, ModuleRegistry, ClientSideRowModelModule } from "ag-grid-community"
import "ag-grid-community/styles/ag-grid.css"
import "ag-grid-community/styles/ag-theme-alpine.css"
import { fetchDailyRevenue, type DailyRevenueData } from "@/lib/mockData"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"

ModuleRegistry.registerModules([ClientSideRowModelModule])

export default function DashboardPage() {
  const [startDate, setStartDate] = useState<string>(format(subDays(new Date(), 1), "yyyy-MM-dd"))
  const [endDate, setEndDate] = useState<string>(format(new Date(), "yyyy-MM-dd"))
  const [data, setData] = useState<DailyRevenueData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [gridApi, setGridApi] = useState<any>(null)

  const loadData = async () => {
    setIsLoading(true)
    try {
      const result = await fetchDailyRevenue(startDate, endDate)
      setData(result)
    } catch (error) {
      console.error("Failed to fetch data:", error)
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

  // Column Definitions
  const colDefs = useMemo<ColDef<DailyRevenueData>[]>(() => [
    { field: "date", headerName: "일자", filter: true, sortable: true, width: 120 },
    { field: "segment", headerName: "유형(SEG)", filter: true, sortable: true, width: 130 },
    { field: "pyType", headerName: "평형(PY)", filter: true, sortable: true, width: 100 },
    { field: "groupName", headerName: "그룹명", filter: true, sortable: true, width: 140 },
    { field: "marketChannel", headerName: "판매채널", filter: true, sortable: true, width: 120 },
    { field: "agencyName", headerName: "에이전시", filter: true, sortable: true, width: 140 },
    { field: "metrics.rn", headerName: "객실수(R/N)", filter: "agNumberColumnFilter", sortable: true, width: 110, valueFormatter: (p) => p.value.toLocaleString() },
    { field: "metrics.rev", headerName: "매출(Rev)", filter: "agNumberColumnFilter", sortable: true, width: 130, valueFormatter: (p) => `₩${p.value.toLocaleString()}` },
    { field: "metrics.occ", headerName: "가동률(OCC)", filter: "agNumberColumnFilter", sortable: true, width: 110, valueFormatter: (p) => `${(p.value * 100).toFixed(1)}%` },
    { field: "metrics.adr", headerName: "객실단가(ADR)", filter: "agNumberColumnFilter", sortable: true, width: 130, valueFormatter: (p) => `₩${p.value.toLocaleString()}` },
    { field: "notes", headerName: "비고", filter: true, flex: 1, minWidth: 150 },
  ], [])

  // Chart Data preparation
  const chartData = useMemo(() => {
    const summary = data.reduce((acc: any, curr) => {
      const seg = curr.segment
      if (!acc[seg]) acc[seg] = { name: seg, revenue: 0, rn: 0 }
      acc[seg].revenue += curr.metrics.rev
      acc[seg].rn += curr.metrics.rn
      return acc
    }, {})
    return Object.values(summary)
  }, [data])

  return (
    <div className="space-y-6 flex flex-col h-full">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-900/50 p-5 rounded-xl border border-gray-800 backdrop-blur-md">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">유형별 매출 현황</h1>
          <p className="text-sm text-gray-400 mt-1">지정된 기간 동안의 세그먼트별 매출 실적을 집계합니다.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2 bg-gray-950 px-3 py-2 rounded-lg border border-gray-800">
            <span className="text-sm text-gray-400">기간</span>
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-sm text-gray-200 outline-none"
            />
            <span className="text-gray-500">~</span>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-sm text-gray-200 outline-none"
            />
          </div>
          
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

      {/* Chart Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-gray-900/50 p-5 rounded-xl border border-gray-800 h-80">
          <h3 className="text-sm font-medium text-gray-400 mb-4">세그먼트별 매출 현황 (Revenue)</h3>
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
        
        <div className="bg-gray-900/50 p-5 rounded-xl border border-gray-800 h-80 flex flex-col justify-center items-center text-center">
          <div className="p-4 rounded-full bg-indigo-900/30 mb-4">
            <Search className="text-indigo-400 w-8 h-8" />
          </div>
          <h3 className="text-lg font-medium text-gray-200 mb-2">Total Revenue</h3>
          <p className="text-3xl font-bold text-white mb-1">
            ₩{data.reduce((acc, curr) => acc + curr.metrics.rev, 0).toLocaleString()}
          </p>
          <p className="text-sm text-gray-400">Total R/N: {data.reduce((acc, curr) => acc + curr.metrics.rn, 0).toLocaleString()}</p>
        </div>
      </div>

      {/* Data Grid Section */}
      <div className="flex-1 min-h-[400px] bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden ag-theme-alpine-dark">
        <AgGridReact
          rowData={data}
          columnDefs={colDefs}
          defaultColDef={{ resizable: true }}
          onGridReady={(params) => setGridApi(params.api)}
          animateRows={true}
          rowSelection="multiple"
          suppressRowClickSelection={true}
          className="h-full w-full"
        />
      </div>
    </div>
  )
}
