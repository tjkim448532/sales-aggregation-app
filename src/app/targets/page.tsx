"use client"

import { useState } from "react"
import { Target, Save, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react"
import { saveRoomBudgets, RoomBudgetPayload } from "@/lib/api"
import Link from "next/link"

const SEGMENTS = ["분양회원", "자사채널", "MICE", "OTA", "휴양소", "직원&직원초청", "기타"]
const ROOM_TYPES = ["16PY", "35PY", "51PY"]

type CellData = { targetRevenue: number | ""; targetRoomsSold: number | "" }
type GridState = Record<string, Record<string, CellData>>

const createEmptyGrid = (): GridState => {
  const grid: GridState = {}
  SEGMENTS.forEach(seg => {
    grid[seg] = {}
    ROOM_TYPES.forEach(rt => {
      grid[seg][rt] = { targetRevenue: "", targetRoomsSold: "" }
    })
  })
  return grid
}

export default function TargetsPage() {
  const [year, setYear] = useState<number>(new Date().getFullYear())
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1)
  const [gridData, setGridData] = useState<GridState>(createEmptyGrid())
  const [isSaving, setIsSaving] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")

  const handleCellChange = (segment: string, roomType: string, field: keyof CellData, value: string) => {
    const numValue = value === "" ? "" : Number(value.replace(/,/g, ""))
    setGridData(prev => ({
      ...prev,
      [segment]: {
        ...prev[segment],
        [roomType]: {
          ...prev[segment][roomType],
          [field]: numValue
        }
      }
    }))
  }

  const handleSave = async () => {
    setIsSaving(true)
    setErrorMsg("")
    setShowSuccess(false)
    try {
      const formattedMonth = month.toString().padStart(2, "0")
      const payload: RoomBudgetPayload = {
        targetYearMonth: `${year}-${formattedMonth}`,
        budgets: []
      }

      SEGMENTS.forEach(segmentName => {
        ROOM_TYPES.forEach(roomType => {
          const cell = gridData[segmentName][roomType]
          const targetRevenue = Number(cell.targetRevenue) || 0
          const targetRoomsSold = Number(cell.targetRoomsSold) || 0

          if (targetRevenue > 0 || targetRoomsSold > 0) {
            payload.budgets.push({
              segmentName,
              roomType,
              targetRevenue,
              targetRoomsSold
            })
          }
        })
      })

      if (payload.budgets.length === 0) {
        throw new Error("입력된 목표액 데이터가 없습니다.")
      }

      await saveRoomBudgets(payload)
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 3000)
    } catch (err: any) {
      console.error("Failed to save targets:", err)
      setErrorMsg(err.message || "목표 저장에 실패했습니다.")
    } finally {
      setIsSaving(false)
    }
  }

  // 계산 로직 (화면 편의용)
  const getRowTotals = (segment: string) => {
    let sumRev = 0
    let sumRn = 0
    ROOM_TYPES.forEach(rt => {
      sumRev += Number(gridData[segment][rt].targetRevenue) || 0
      sumRn += Number(gridData[segment][rt].targetRoomsSold) || 0
    })
    return { sumRev, sumRn }
  }

  const getColTotals = (roomType: string) => {
    let sumRev = 0
    let sumRn = 0
    SEGMENTS.forEach(seg => {
      sumRev += Number(gridData[seg][roomType].targetRevenue) || 0
      sumRn += Number(gridData[seg][roomType].targetRoomsSold) || 0
    })
    return { sumRev, sumRn }
  }

  let grandRev = 0
  let grandRn = 0
  SEGMENTS.forEach(seg => {
    ROOM_TYPES.forEach(rt => {
      grandRev += Number(gridData[seg][rt].targetRevenue) || 0
      grandRn += Number(gridData[seg][rt].targetRoomsSold) || 0
    })
  })

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

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-2xl">
        {/* Header section */}
        <div className="p-6 border-b border-gray-800 bg-gray-800/30 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-500/20 text-indigo-400 rounded-xl flex items-center justify-center border border-indigo-500/30 shadow-inner">
              <Target size={26} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">영업 목표액(Budget) 설정</h1>
              <p className="text-sm text-gray-400 mt-1">유형별 매출 현황 대시보드를 위한 세그먼트별 목표 실적을 기입합니다.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex bg-gray-950 p-1.5 rounded-lg border border-gray-800">
              <select 
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="bg-transparent text-gray-200 font-bold px-3 py-1 outline-none border-r border-gray-800 hover:text-indigo-400 transition-colors"
              >
                {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y} className="bg-gray-900">{y}년</option>)}
              </select>
              <select 
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="bg-transparent text-gray-200 font-bold px-3 py-1 outline-none hover:text-indigo-400 transition-colors"
              >
                {Array.from({length: 12}, (_, i) => i + 1).map(m => <option key={m} value={m} className="bg-gray-900">{m}월</option>)}
              </select>
            </div>

            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20"
            >
              {isSaving ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Save size={20} />
              )}
              목표액 일괄 저장
            </button>
          </div>
        </div>

        {/* Alerts */}
        <div className="p-4 px-6 flex flex-col gap-3">
          {showSuccess && (
            <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-3 rounded-lg animate-in fade-in slide-in-from-top-2">
              <CheckCircle2 size={18} />
              <p className="text-sm font-medium">목표 데이터가 성공적으로 백엔드 DB에 저장되었습니다.</p>
            </div>
          )}
          {errorMsg && (
            <div className="flex items-center gap-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-lg animate-in fade-in slide-in-from-top-2">
              <AlertCircle size={18} />
              <p className="text-sm font-medium">{errorMsg}</p>
            </div>
          )}
        </div>

        {/* Matrix Grid */}
        <div className="p-6 overflow-x-auto">
          <table className="w-full border-collapse min-w-[1000px]">
            <thead>
              <tr>
                <th className="bg-gray-950 border border-gray-800 p-3 text-sm font-bold text-gray-400 w-40 row-span-2 text-center" rowSpan={2}>
                  세그먼트 (SEG)
                </th>
                {ROOM_TYPES.map(rt => (
                  <th key={rt} colSpan={2} className="bg-gray-800 border border-gray-700 p-3 text-sm font-bold text-gray-200 text-center uppercase tracking-wider">
                    {rt}
                  </th>
                ))}
                <th colSpan={2} className="bg-indigo-950/50 border border-indigo-500/30 p-3 text-sm font-black text-indigo-300 text-center uppercase tracking-wider">
                  합계 (Total)
                </th>
              </tr>
              <tr>
                {ROOM_TYPES.map(rt => (
                  <th key={`sub-${rt}`} className="bg-gray-900 border border-gray-800 p-2 text-xs font-medium text-gray-400 text-center w-32">
                    <div className="flex justify-between px-2"><span>R/N</span><span>REVENUE</span></div>
                  </th>
                ))}
                <th className="bg-indigo-950/30 border border-indigo-500/20 p-2 text-xs font-medium text-indigo-400 text-center w-32">
                  <div className="flex justify-between px-2"><span>R/N</span><span>REVENUE</span></div>
                </th>
              </tr>
            </thead>
            <tbody>
              {SEGMENTS.map(seg => {
                const rowTotals = getRowTotals(seg)
                return (
                  <tr key={seg} className="hover:bg-gray-800/30 transition-colors">
                    <td className="bg-gray-950 border border-gray-800 p-3 text-sm font-bold text-gray-300 text-center">
                      {seg}
                    </td>
                    {ROOM_TYPES.map(rt => (
                      <td key={`${seg}-${rt}`} className="border border-gray-800 p-1.5 bg-gray-900/50 hover:bg-gray-800">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="0"
                            value={gridData[seg][rt].targetRoomsSold === "" ? "" : gridData[seg][rt].targetRoomsSold.toLocaleString()}
                            onChange={(e) => handleCellChange(seg, rt, "targetRoomsSold", e.target.value)}
                            className="w-1/3 bg-transparent border border-transparent hover:border-gray-700 focus:border-indigo-500 rounded px-2 py-1.5 text-right text-sm text-amber-200 outline-none transition-all placeholder:text-gray-700"
                          />
                          <div className="w-px bg-gray-800" />
                          <input
                            type="text"
                            placeholder="0"
                            value={gridData[seg][rt].targetRevenue === "" ? "" : gridData[seg][rt].targetRevenue.toLocaleString()}
                            onChange={(e) => handleCellChange(seg, rt, "targetRevenue", e.target.value)}
                            className="w-2/3 bg-transparent border border-transparent hover:border-gray-700 focus:border-indigo-500 rounded px-2 py-1.5 text-right text-sm text-emerald-400 font-semibold outline-none transition-all placeholder:text-gray-700"
                          />
                        </div>
                      </td>
                    ))}
                    {/* Row Totals */}
                    <td className="border border-indigo-500/20 bg-indigo-950/20 p-3">
                      <div className="flex justify-between items-center text-sm font-bold">
                        <span className="text-amber-400/80 w-1/3 text-right pr-2 border-r border-indigo-500/20">{rowTotals.sumRn.toLocaleString()}</span>
                        <span className="text-emerald-400/90 w-2/3 text-right pl-2">{rowTotals.sumRev.toLocaleString()}</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {/* Grand Totals */}
              <tr>
                <td className="bg-indigo-950/50 border border-indigo-500/30 p-3 text-sm font-black text-indigo-300 text-center">
                  총 합계
                </td>
                {ROOM_TYPES.map(rt => {
                  const colTotals = getColTotals(rt)
                  return (
                    <td key={`total-${rt}`} className="border border-indigo-500/30 bg-indigo-950/40 p-3">
                      <div className="flex justify-between items-center text-sm font-bold">
                        <span className="text-amber-400/80 w-1/3 text-right pr-2 border-r border-indigo-500/20">{colTotals.sumRn.toLocaleString()}</span>
                        <span className="text-emerald-400/90 w-2/3 text-right pl-2">{colTotals.sumRev.toLocaleString()}</span>
                      </div>
                    </td>
                  )
                })}
                <td className="border border-indigo-400 bg-indigo-900/60 p-3 shadow-[inset_0_0_20px_rgba(99,102,241,0.2)]">
                  <div className="flex justify-between items-center text-base font-black">
                    <span className="text-amber-300 w-1/3 text-right pr-2 border-r border-indigo-400/50">{grandRn.toLocaleString()}</span>
                    <span className="text-emerald-300 w-2/3 text-right pl-2">{grandRev.toLocaleString()}</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
