"use client"

import { useState, useMemo, useEffect } from "react"
import { RefreshCw, AlertCircle } from "lucide-react"
import { AgGridReact } from "ag-grid-react"
import { ColDef, RowClassParams, ModuleRegistry, AllCommunityModule } from "ag-grid-community"
import "ag-grid-community/styles/ag-grid.css"
import "ag-grid-community/styles/ag-theme-alpine.css"
import { fetchDailyRevenue, fetchMatrixWeekly, type DashboardRevenueResponse, type MatrixWeeklyItem } from "@/lib/api"
import { PieChart, Pie, Cell, Legend, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

ModuleRegistry.registerModules([AllCommunityModule])

export default function DashboardPage() {
  const [targetDate, setTargetDate] = useState<string>("2026-07-09")
  const [apiResponse, setApiResponse] = useState<DashboardRevenueResponse | null>(null)
  const [matrixData, setMatrixData] = useState<MatrixWeeklyItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>("")
  const [activeTab, setActiveTab] = useState("전체")

  const loadData = async () => {
    setIsLoading(true)
    setError("")
    try {
      const [revResult, matrixResult] = await Promise.all([
        fetchDailyRevenue(targetDate),
        fetchMatrixWeekly(targetDate)
      ]);
      setApiResponse(revResult)
      setMatrixData(matrixResult || [])
    } catch (err: any) {
      console.error("Failed to fetch data:", err)
      setError(err.message || "데이터를 불러오는 중 오류가 발생했습니다.")
      setApiResponse(null)
      setMatrixData([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [targetDate])

  // ==========================================
  // SSOT 원칙 적용: 임의의 연산/합산을 일절 하지 않음
  // ==========================================
  const summary = apiResponse?.summary || {
    totalRevenue: 0,
    totalRooms: 0,
    totalRoomCap: 0,
    totalGolfTeams: 0,
    mtdRevenue: 0,
    ytdRevenue: 0,
    todayLyRevenue: 0,
    totalGuests: 0
  }

  // 1. 차트 데이터 가공 (단순 매핑)
  const pieChartData = useMemo(() => {
    if (!apiResponse?.salesByCategory) return []
    return apiResponse.salesByCategory.map(item => ({
      name: item.category,
      value: item.sales
    }))
  }, [apiResponse])

  const PIE_COLORS = ['#4f46e5', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6', '#f97316'];

  const lineChartData = useMemo(() => {
    if (!apiResponse?.dailyTrends) return []
    return apiResponse.dailyTrends.map(item => ({
      date: item.date,
      revenue: Math.round(item.revenue / 10000) // 만원 단위 표출
    }))
  }, [apiResponse])

  // 2. 동적 탭 및 그리드 데이터 (camelCase 준수)
  const availableTabs = useMemo(() => {
    const tabs = new Set<string>(["전체"])
    if (apiResponse?.salesByFacility) {
      apiResponse.salesByFacility.forEach(item => tabs.add(item.categoryCode))
    }
    return Array.from(tabs)
  }, [apiResponse])

  const filteredFacilityData = useMemo(() => {
    if (!apiResponse?.salesByFacility) return []
    if (activeTab === "전체") return apiResponse.salesByFacility
    return apiResponse.salesByFacility.filter(item => item.categoryCode === activeTab)
  }, [apiResponse, activeTab])

  const facilityColDefs = useMemo<ColDef<any>[]>(() => [
    { headerName: "대분류", field: "categoryCode", width: 120, cellStyle: { textAlign: 'center', fontWeight: 'bold' } as any },
    { headerName: "영업장 (소분류)", field: "subGroupName", width: 200 },
    { 
      headerName: "매출액", 
      field: "totalSales", 
      width: 150, 
      cellStyle: { textAlign: 'right', color: '#10B981', fontWeight: 600 } as any,
      valueFormatter: (p) => `${Number(p.value || 0).toLocaleString()}원`
    },
    { headerName: "수량 (Qty)", field: "qty", width: 100, cellStyle: { textAlign: 'right' } as any },
    { headerName: "방문객", field: "visitors", width: 100, cellStyle: { textAlign: 'right' } as any }
  ], [])

  // 3. 요일비교 매트릭스 그리드 설정
  const matrixColDefs = useMemo<ColDef<MatrixWeeklyItem>[]>(() => [
    { headerName: "카테고리", field: "categoryName", width: 120 },
    { headerName: "본부/팀", field: "teamName", width: 130 },
    { headerName: "파트", field: "partName", width: 120 },
    { headerName: "영업장", field: "shopName", width: 180 },
    { 
      headerName: "당일 매출", 
      field: "todayActual", 
      width: 140, 
      cellStyle: { textAlign: 'right', fontWeight: 600 } as any,
      valueFormatter: (p) => p.value != null ? `${Number(p.value).toLocaleString()}원` : '-'
    },
    { 
      headerName: "전년 동기", 
      field: "todayLy", 
      width: 140, 
      cellStyle: { textAlign: 'right' } as any,
      valueFormatter: (p) => p.value != null ? `${Number(p.value).toLocaleString()}원` : '-'
    }
  ], [])

  // 소계/합계 행 스타일링 (AgGrid)
  const getRowStyle = (params: RowClassParams<MatrixWeeklyItem>): any => {
    if (params.data?.isGrandTotal) {
      return { background: '#1e3a8a', color: '#fff', fontWeight: 'bold' }; // 진한 파란색
    }
    if (params.data?.isSubtotal) {
      return { background: '#374151', fontWeight: 'bold' }; // 회색
    }
    return undefined;
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans p-6">
      {/* HEADER */}
      <header className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-900 p-5 rounded-2xl border border-gray-800 shadow-xl">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <span className="text-indigo-500">통합 데이터센터 V5 (v3.0)</span> 대시보드
          </h1>
          <p className="text-gray-400 text-sm mt-1">SSOT (Single Source of Truth) 원칙 적용 렌더링</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-gray-800 p-2 rounded-lg border border-gray-700">
            <label className="text-sm text-gray-300 font-semibold pl-2">기준 일자:</label>
            <input 
              type="date" 
              className="bg-gray-900 border border-gray-600 rounded px-3 py-1 text-white outline-none focus:border-indigo-500"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </div>

          <button 
            onClick={loadData}
            disabled={isLoading}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            조회
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-6 bg-red-900/30 border border-red-500/50 p-4 rounded-xl flex items-center gap-3 text-red-200">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{error}</p>
        </div>
      )}

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div className="bg-gray-900 p-5 rounded-2xl border border-gray-800 flex flex-col justify-center">
          <p className="text-sm font-semibold text-gray-400 mb-1">당일 총 매출</p>
          <div className="text-2xl font-black text-indigo-400">
            {summary.totalRevenue.toLocaleString()} <span className="text-sm font-medium text-gray-500">원</span>
          </div>
          {summary.ytdRevenue ? (
            <p className="text-xs text-gray-500 mt-2">YTD: {summary.ytdRevenue.toLocaleString()}원</p>
          ) : null}
        </div>
        <div className="bg-gray-900 p-5 rounded-2xl border border-gray-800 flex flex-col justify-center">
          <p className="text-sm font-semibold text-gray-400 mb-1">판매 객실 수</p>
          <div className="text-2xl font-black text-pink-400">
            {summary.totalRooms.toLocaleString()} <span className="text-sm font-medium text-gray-500">실</span>
          </div>
        </div>
        <div className="bg-gray-900 p-5 rounded-2xl border border-gray-800 flex flex-col justify-center">
          <p className="text-sm font-semibold text-gray-400 mb-1">투숙 인원</p>
          <div className="text-2xl font-black text-emerald-400">
            {summary.totalRoomCap.toLocaleString()} <span className="text-sm font-medium text-gray-500">명</span>
          </div>
        </div>
        <div className="bg-gray-900 p-5 rounded-2xl border border-gray-800 flex flex-col justify-center">
          <p className="text-sm font-semibold text-gray-400 mb-1">골프 팀 수</p>
          <div className="text-2xl font-black text-amber-400">
            {summary.totalGolfTeams.toLocaleString()} <span className="text-sm font-medium text-gray-500">팀</span>
          </div>
        </div>
        <div className="bg-gray-900 p-5 rounded-2xl border border-gray-800 flex flex-col justify-center">
          <p className="text-sm font-semibold text-gray-400 mb-1">총 방문객 수</p>
          <div className="text-2xl font-black text-cyan-400">
            {(summary.totalGuests || 0).toLocaleString()} <span className="text-sm font-medium text-gray-500">명</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* CHART 1: Pie Chart (Category Sales) */}
        <div className="lg:col-span-1 bg-gray-900 p-5 rounded-2xl border border-gray-800 h-[350px]">
          <h2 className="text-lg font-bold text-gray-200 mb-4">사업부별 매출 비중</h2>
          <ResponsiveContainer width="100%" height="85%">
            <PieChart>
              <Pie
                data={pieChartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
                stroke="none"
              >
                {pieChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: any) => [`${Number(value).toLocaleString()}원`, "매출액"]}
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                itemStyle={{ color: '#fff' }}
              />
              <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '12px' }}/>
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* CHART 2: Line Chart (Daily Trends) */}
        <div className="lg:col-span-2 bg-gray-900 p-5 rounded-2xl border border-gray-800 h-[350px]">
          <h2 className="text-lg font-bold text-gray-200 mb-4">주간 매출 트렌드 (단위: 만원)</h2>
          <ResponsiveContainer width="100%" height="85%">
            <LineChart data={lineChartData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
              <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} tickMargin={10} />
              <YAxis stroke="#9ca3af" fontSize={12} tickFormatter={(val) => val.toLocaleString()} />
              <Tooltip 
                formatter={(value: any) => [`${Number(value).toLocaleString()}만원`, "매출"]}
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                itemStyle={{ color: '#fff' }}
              />
              <Line 
                type="monotone" 
                dataKey="revenue" 
                stroke="#6366f1" 
                strokeWidth={3}
                dot={{ r: 4, fill: "#6366f1", strokeWidth: 2 }}
                activeDot={{ r: 6 }} 
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* MATRIX WEEKLY TABLE (NEW) */}
      <div className="bg-gray-900 p-5 rounded-2xl border border-gray-800 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4">
          <div>
            <h2 className="text-lg font-bold text-gray-200">요일비교 매트릭스</h2>
            <p className="text-xs text-gray-500 mt-1">백엔드 정렬 순서 및 소계(Subtotal) 처리 강제 렌더링 (자체 계산 없음)</p>
          </div>
        </div>

        <div className="h-[450px] bg-gray-950/50 rounded-xl border border-gray-800 overflow-hidden ag-theme-alpine-dark">
          <AgGridReact
            theme="legacy"
            rowData={matrixData}
            columnDefs={matrixColDefs}
            getRowStyle={getRowStyle}
            // 프론트엔드의 커스텀 정렬을 막기 위해 sortable 해제
            defaultColDef={{ resizable: true, sortable: false }}
            animateRows={false} // 순서가 고정이므로 애니메이션 불필요
            rowHeight={42}
            headerHeight={44}
            className="h-full w-full"
          />
        </div>
      </div>

      {/* FACILITY TABLE (Dynamic Tabs) */}
      <div className="bg-gray-900 p-5 rounded-2xl border border-gray-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4">
          <h2 className="text-lg font-bold text-gray-200">영업장별 세부 매출</h2>
          
          <div className="flex gap-2 overflow-x-auto pb-1">
            {availableTabs.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-full text-sm font-bold transition-colors whitespace-nowrap ${
                  activeTab === tab
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="h-[400px] bg-gray-950/50 rounded-xl border border-gray-800 overflow-hidden ag-theme-alpine-dark">
          <AgGridReact
            theme="legacy"
            rowData={filteredFacilityData}
            columnDefs={facilityColDefs}
            defaultColDef={{ resizable: true, sortable: true }}
            animateRows={true}
            rowHeight={42}
            headerHeight={44}
            className="h-full w-full"
          />
        </div>
      </div>
    </div>
  )
}
