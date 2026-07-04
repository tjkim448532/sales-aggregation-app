"use client"

import { useState } from "react"
import { Target, Save, CheckCircle2 } from "lucide-react"

export default function TargetsPage() {
  const [year, setYear] = useState<number>(new Date().getFullYear())
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1)
  const [isSaving, setIsSaving] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  const [targets, setTargets] = useState({
    targetRn: 500,
    targetRev: 50000000,
    targetOcc: 80, // percentage integer
  })

  const handleSave = () => {
    setIsSaving(true)
    // Simulate API call to POST /api/targets
    setTimeout(() => {
      setIsSaving(false)
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 3000)
    }, 800)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
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
    </div>
  )
}
