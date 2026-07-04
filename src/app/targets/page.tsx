"use client"

import { useState, useEffect } from "react"
import { Target, Save, CheckCircle2, AlertCircle, Trash2, ArrowLeft } from "lucide-react"
import { fetchTargets, saveTargets } from "@/lib/api"
import Link from "next/link"

export default function TargetsPage() {
  const [year, setYear] = useState<number>(new Date().getFullYear())
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1)
  const [isSaving, setIsSaving] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")

  const [targets, setTargets] = useState({
    targetRn: 500,
    targetRev: 50000000,
    targetOcc: 80, // percentage integer
  })

  const [allTargets, setAllTargets] = useState<any[]>([])

  const loadAllTargets = () => {
    const list = []
    if (typeof window !== "undefined") {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith("targets_")) {
          const parts = key.split("_")
          if (parts.length === 3) {
            const y = parseInt(parts[1])
            const m = parseInt(parts[2])
            const val = localStorage.getItem(key)
            if (val) {
              try {
                const data = JSON.parse(val)
                list.push({
                  year: y,
                  month: m,
                  targetRn: data.targetRn ?? 0,
                  targetRev: data.targetRev ?? 0,
                  targetOcc: data.targetOcc ?? 0
                })
              } catch (e) {}
            }
          }
        }
      }
    }
    list.sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year
      return b.month - a.month
    })
    setAllTargets(list)
  }

  useEffect(() => {
    const loadTargets = async () => {
      try {
        setErrorMsg("")
        const data = await fetchTargets(year, month)
        if (data) {
          setTargets({
            targetRn: data.targetRn ?? 0,
            targetRev: data.targetRev ?? 0,
            targetOcc: data.targetOcc ?? 0,
          })
        }
      } catch (err: any) {
        console.error("Failed to load targets:", err)
      }
    }
    loadTargets()
  }, [year, month])

  useEffect(() => {
    loadAllTargets()
  }, [])

  const handleSave = async () => {
    setIsSaving(true)
    setErrorMsg("")
    try {
      await saveTargets({
        year,
        month,
        targetRn: targets.targetRn,
        targetRev: targets.targetRev,
        targetOcc: targets.targetOcc,
      })
      setShowSuccess(true)
      loadAllTargets()
      setTimeout(() => setShowSuccess(false), 3000)
    } catch (err: any) {
      console.error("Failed to save targets:", err)
      setErrorMsg("목표 저장에 실패했습니다. 백엔드 API 연결을 확인하세요.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = (y: number, m: number) => {
    if (confirm(`${y}년 ${m}월 목표 설정을 삭제하시겠습니까?`)) {
      if (typeof window !== "undefined") {
        localStorage.removeItem(`targets_${y}_${m}`)
        loadAllTargets()
      }
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Navigation */}
      <div className="flex justify-between items-center">
        <Link 
          href="/" 
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors"
        >
          <ArrowLeft size={16} />
          <span>대시보드로 돌아가기</span>
        </Link>
      </div>

      {/* Target Setting Input Form */}
      <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-800 backdrop-blur-md">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-indigo-600/20 rounded-lg">
            <Target className="text-indigo-400" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-100">영업장 목표 관리</h1>
            <p className="text-sm text-gray-400">월별/연도별 실적 목표치를 설정합니다.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">연도 (Year)</label>
            <select 
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-gray-200 outline-none focus:border-indigo-500"
            >
              {[2024, 2025, 2026, 2027].map(y => (
                <option key={y} value={y}>{y}년</option>
              ))}
            </select>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">월 (Month)</label>
            <select 
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-gray-200 outline-none focus:border-indigo-500"
            >
              {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{m}월</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-6 border-t border-gray-800 pt-6">
          <h3 className="text-lg font-medium text-gray-200 mb-4">{year}년 {month}월 목표 설정</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">목표 객실수 (Target R/N)</label>
              <input 
                type="number"
                value={targets.targetRn}
                onChange={(e) => setTargets({...targets, targetRn: Number(e.target.value)})}
                className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-gray-200 outline-none focus:border-indigo-500"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">목표 매출 (Target Rev)</label>
              <input 
                type="number"
                value={targets.targetRev}
                onChange={(e) => setTargets({...targets, targetRev: Number(e.target.value)})}
                className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-gray-200 outline-none focus:border-indigo-500"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">목표 가동률 (Target OCC %)</label>
              <input 
                type="number"
                value={targets.targetOcc}
                onChange={(e) => setTargets({...targets, targetOcc: Number(e.target.value)})}
                className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-gray-200 outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-end items-center gap-4">
          {errorMsg && (
            <div className="flex items-center gap-2 text-rose-400">
              <AlertCircle size={18} />
              <span className="text-sm">{errorMsg}</span>
            </div>
          )}
          {showSuccess && (
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 size={18} />
              <span className="text-sm">성공적으로 저장되었습니다.</span>
            </div>
          )}
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50"
          >
            <Save size={18} />
            <span>{isSaving ? '저장 중...' : '설정 저장'}</span>
          </button>
        </div>
      </div>

      {/* Target History List Section */}
      <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-800 backdrop-blur-md">
        <h3 className="text-lg font-bold text-gray-200 mb-4 flex items-center gap-2">
          <span>설정된 연월별 목표치 리스트</span>
          <span className="text-xs font-normal text-gray-400 bg-gray-950 px-2 py-0.5 rounded border border-gray-800">
            총 {allTargets.length}개
          </span>
        </h3>

        {allTargets.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-500 border border-dashed border-gray-800 rounded-lg">
            설정된 목표치가 없습니다. 위 폼에서 목표를 입력한 뒤 '설정 저장'을 클릭하세요.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-800">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-950/80 border-b border-gray-800">
                  <th className="px-4 py-3 text-xs font-bold text-gray-300 uppercase tracking-wider text-center">연월</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-300 uppercase tracking-wider text-center">목표 객실수 (R/N)</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-300 uppercase tracking-wider text-center">목표 매출액 (Net)</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-300 uppercase tracking-wider text-center">목표 가동률 (OCC)</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-300 uppercase tracking-wider text-center">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {allTargets.map((item) => (
                  <tr 
                    key={`${item.year}_${item.month}`} 
                    className="hover:bg-gray-950/30 transition-colors"
                  >
                    <td className="px-4 py-3.5 text-sm text-gray-200 font-semibold text-center">
                      {item.year}년 {item.month}월
                    </td>
                    <td className="px-4 py-3.5 text-sm text-gray-300 text-center">
                      {item.targetRn.toLocaleString()} R/N
                    </td>
                    <td className="px-4 py-3.5 text-sm text-emerald-400 font-medium text-center">
                      ₩{item.targetRev.toLocaleString()}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-amber-400 font-medium text-center">
                      {item.targetOcc}%
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <div className="flex justify-center items-center gap-3">
                        <button
                          onClick={() => {
                            setYear(item.year)
                            setMonth(item.month)
                            window.scrollTo({ top: 0, behavior: 'smooth' })
                          }}
                          className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleDelete(item.year, item.month)}
                          className="text-gray-500 hover:text-rose-400 transition-colors"
                          title="목표 삭제"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
