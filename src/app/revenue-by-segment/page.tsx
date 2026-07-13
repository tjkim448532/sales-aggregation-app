"use client"

import { useState, useEffect, useMemo } from "react"
import { Calendar, Download, RefreshCw, ArrowLeft, BarChart3 } from "lucide-react"
import Link from "next/link"
import { fetchRevenueBySegment, SegmentRevenueItem } from "@/lib/api"

const SEGMENTS = ["합계", "분양회원", "자사채널", "MICE", "OTA", "휴양소", "직원&직원초청", "기타"]
const ROOM_TYPES = ["16PY", "35PY", "51PY", "소계"]

const METRIC_GROUPS = [
  { key: "roomsSold", label1: "R/N", label2: null },
  { key: "revenue", label1: "REVENUE", label2: null },
  { key: "occ", label1: "OCC", label2: null },
  { key: "adr", label1: "ADR", label2: null },
  { key: "revenueShare", label1: "매출점유율", label2: null },
  { key: "targetPeriod", label1: "조회기간", label2: "목표액" },
  { key: "actualPeriod", label1: "조회기간", label2: "실적" },
  { key: "achieveRatePeriod", label1: "조회기간", label2: "달성률" },
  { key: "targetMtd", label1: "월누계", label2: "목표액" },
  { key: "actualMtd", label1: "월누계", label2: "실적" },
  { key: "achieveRateMtd", label1: "월누계", label2: "달성률" },
  { key: "targetYtd", label1: "연누계", label2: "목표액" },
  { key: "actualYtd", label1: "연누계", label2: "실적" },
  { key: "achieveRateYtd", label1: "연누계", label2: "달성률" },
  { key: "pyRevenue", label1: "전년매출", label2: null },
  { key: "yoyGrowth", label1: "전년대비 신장률(%)", label2: null }
]

const FORMATS: Record<string, string> = {
  roomsSold: "number",
  revenue: "currency",
  occ: "percent",
  adr: "currency",
  revenueShare: "percent",
  targetPeriod: "currency",
  actualPeriod: "currency",
  achieveRatePeriod: "percent",
  targetMtd: "currency",
  actualMtd: "currency",
  achieveRateMtd: "percent",
  targetYtd: "currency",
  actualYtd: "currency",
  achieveRateYtd: "percent",
  pyRevenue: "currency",
  yoyGrowth: "percent"
}

export default function RevenueBySegmentPage() {
  // Default to yesterday
  const getYesterday = () => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    return d.toISOString().split("T")[0]
  }

  const [startDate, setStartDate] = useState(getYesterday())
  const [endDate, setEndDate] = useState(getYesterday())
  const [data, setData] = useState<SegmentRevenueItem[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const loadData = async () => {
    setIsLoading(true)
    try {
      const res = await fetchRevenueBySegment(startDate, endDate)
      setData(res)
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Create a lookup dictionary: dict[segment][roomType] = SegmentRevenueItem
  const lookup = useMemo(() => {
    const map: Record<string, Record<string, SegmentRevenueItem>> = {}
    
    // Initialize empty maps
    SEGMENTS.forEach(seg => {
      map[seg] = {}
    })

    data.forEach(item => {
      if (item.isGrandTotal || item.segment === "총계" || item.segment === "합계") {
        map["합계"]["합계"] = item
      } else {
        if (!map[item.segment]) map[item.segment] = {}
        // Fallback for subtotal labeling
        const rType = item.isSubtotal ? "소계" : item.roomType
        map[item.segment][rType] = item
      }
    })
    return map
  }, [data])

  const formatValue = (val: number | undefined | null, format: string) => {
    if (val === undefined || val === null || isNaN(val)) return "-"
    if (format === "number") return Math.round(val).toLocaleString()
    if (format === "currency") return Math.round(val).toLocaleString()
    if (format === "percent") return val.toFixed(1) + "%"
    return val.toString()
  }

  const handleExport = () => {
    alert("엑셀 다운로드 기능은 준비 중입니다.")
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans p-6 pb-20">
      {/* Navigation */}
      <div className="flex justify-between items-center mb-6">
        <Link 
          href="/" 
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors"
        >
          <ArrowLeft size={16} />
          <span>대시보드로 돌아가기</span>
        </Link>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[calc(100vh-120px)]">
        {/* Header section */}
        <div className="p-6 border-b border-gray-800 bg-gray-800/30 flex flex-col md:flex-row md:items-center justify-between gap-6 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-500/20 text-indigo-400 rounded-xl flex items-center justify-center border border-indigo-500/30 shadow-inner">
              <BarChart3 size={26} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">유형별 매출 현황</h1>
              <p className="text-sm text-gray-400 mt-1">세그먼트 및 객실타입별 매출 상세 매트릭스</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center bg-gray-950 p-1.5 rounded-lg border border-gray-800">
              <Calendar size={16} className="text-gray-500 ml-3 mr-2" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-sm text-gray-200 outline-none px-2 py-1"
              />
              <span className="text-gray-600 px-2">~</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-sm text-gray-200 outline-none px-2 py-1"
              />
            </div>
            
            <button 
              onClick={loadData}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-lg transition-all disabled:opacity-50"
            >
              <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
              조회
            </button>
            <button 
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-lg transition-all"
            >
              <Download size={16} />
              엑셀
            </button>
          </div>
        </div>

        {/* Matrix Grid (Scrollable Body) */}
        <div className="flex-1 overflow-auto p-6 flex flex-col gap-8">
          
          {/* SUMMARY TABLE (Top section matching Excel) */}
          <div className="w-64 border border-gray-800 rounded-lg overflow-hidden bg-gray-900 shadow-md">
            <div className="bg-gray-800 p-2 font-bold text-center text-gray-200 border-b border-gray-700">SUMMARY</div>
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-gray-800/50">
                  <td className="p-2 font-semibold text-gray-400 bg-gray-950/50 w-24">R/N</td>
                  <td className="p-2 text-right text-amber-300 font-bold">{formatValue(lookup["합계"]?.["합계"]?.roomsSold, "number")} 실</td>
                </tr>
                <tr className="border-b border-gray-800/50">
                  <td className="p-2 font-semibold text-gray-400 bg-gray-950/50">REVENUE</td>
                  <td className="p-2 text-right text-emerald-400 font-bold">{formatValue(lookup["합계"]?.["합계"]?.revenue, "currency")} 원</td>
                </tr>
                <tr className="border-b border-gray-800/50">
                  <td className="p-2 font-semibold text-gray-400 bg-gray-950/50">ADR</td>
                  <td className="p-2 text-right text-gray-200 font-bold">{formatValue(lookup["합계"]?.["합계"]?.adr, "currency")} 원</td>
                </tr>
                <tr>
                  <td className="p-2 font-semibold text-gray-400 bg-gray-950/50">OCC</td>
                  <td className="p-2 text-right text-indigo-300 font-bold">{formatValue(lookup["합계"]?.["합계"]?.occ, "percent")}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <table className="w-max border-collapse">
            <thead className="sticky top-0 z-10">
              <tr>
                <th colSpan={2} className="bg-gray-950 border border-gray-800 p-3 text-sm font-bold text-gray-400 min-w-[160px] sticky left-0 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]" rowSpan={2}>
                  SEG
                </th>
                <th className="bg-indigo-950/50 border border-indigo-500/30 p-3 text-sm font-black text-indigo-300 min-w-[120px]" rowSpan={2}>
                  합계
                </th>
                {SEGMENTS.slice(1).map(seg => (
                  <th key={seg} colSpan={4} className="bg-gray-800 border border-gray-700 p-3 text-sm font-bold text-gray-200 text-center tracking-wider">
                    {seg}
                  </th>
                ))}
              </tr>
              <tr>
                {SEGMENTS.slice(1).map(seg => (
                  ROOM_TYPES.map(rt => (
                    <th key={`${seg}-${rt}`} className={`border p-2 text-xs font-medium text-center min-w-[100px] ${rt === "소계" ? "bg-gray-700 border-gray-600 text-amber-300 font-bold" : "bg-gray-900 border-gray-800 text-gray-400"}`}>
                      {rt}
                    </th>
                  ))
                ))}
              </tr>
            </thead>
            <tbody>
              {METRIC_GROUPS.map((metric, rowIdx) => {
                const isGroupHeader = ["targetPeriod", "targetMtd", "targetYtd"].includes(metric.key);
                const format = FORMATS[metric.key];
                
                // Determine row spans for grouped labels (조회기간, 월누계, 연누계)
                let renderLabel1 = true;
                let rowSpan1 = 1;
                
                if (metric.label2) {
                  // It's part of a group (목표액, 실적, 달성률)
                  if (metric.label2 === "목표액") {
                    rowSpan1 = 3; // "조회기간", "월누계", "연누계" take 3 rows
                  } else {
                    renderLabel1 = false;
                  }
                }

                return (
                  <tr key={metric.key} className="hover:bg-gray-800/30 transition-colors group">
                    {/* Y-axis Labels */}
                    {renderLabel1 && (
                      <td 
                        rowSpan={rowSpan1} 
                        colSpan={metric.label2 ? 1 : 2}
                        className={`bg-gray-950 border border-gray-800 p-2 text-sm font-bold sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)] text-center align-middle ${metric.label2 ? 'text-indigo-300 w-24' : 'text-gray-300'}`}
                      >
                        {metric.label1}
                      </td>
                    )}
                    {metric.label2 && (
                      <td className="bg-gray-900 border border-gray-800 p-2 text-sm font-medium sticky left-[96px] z-10 text-gray-400 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)] text-center w-20">
                        {metric.label2}
                      </td>
                    )}
                    
                    {/* 합계 Column */}
                    <td className="bg-indigo-950/20 border border-indigo-500/20 p-2.5 text-sm font-bold text-right text-emerald-300 group-hover:bg-indigo-900/40 transition-colors">
                      {formatValue(lookup["합계"]?.["합계"]?.[metric.key as keyof SegmentRevenueItem] as number, format)}
                    </td>

                    {/* 나머지 세그먼트들 */}
                    {SEGMENTS.slice(1).map(seg => (
                      ROOM_TYPES.map(rt => {
                        const cellData = lookup[seg]?.[rt]
                        const val = cellData ? cellData[metric.key as keyof SegmentRevenueItem] as number : undefined
                        const isSubtotal = rt === "소계"
                        
                        return (
                          <td 
                            key={`${seg}-${rt}-${metric.key}`} 
                            className={`border p-2.5 text-sm text-right font-medium transition-colors ${
                              isSubtotal 
                                ? "bg-gray-800/50 border-gray-700 text-amber-200/90 group-hover:bg-gray-700/50" 
                                : "bg-gray-900/30 border-gray-800 text-gray-300 group-hover:bg-gray-800/50"
                            }`}
                          >
                            {formatValue(val, format)}
                          </td>
                        )
                      })
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
