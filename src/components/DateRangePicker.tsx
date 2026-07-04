"use client"

import { useState, useRef, useEffect } from "react"
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  isWithinInterval, 
  parseISO,
  subDays,
  startOfYear,
  endOfYear
} from "date-fns"
import { ko } from "date-fns/locale"
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface DateRangePickerProps {
  startDate: string
  endDate: string
  onChange: (start: string, end: string) => void
}

export default function DateRangePicker({ startDate, endDate, onChange }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(new Date(startDate))
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null)
  
  const containerRef = useRef<HTMLDivElement>(null)

  const parsedStart = parseISO(startDate)
  const parsedEnd = parseISO(endDate)

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleDateClick = (date: Date) => {
    // If no start date or both are already selected, start a new selection
    if (isSameDay(parsedStart, parsedEnd)) {
      if (date < parsedStart) {
        onChange(format(date, "yyyy-MM-dd"), endDate)
      } else {
        onChange(startDate, format(date, "yyyy-MM-dd"))
      }
    } else {
      // Reset to single date selection on click
      onChange(format(date, "yyyy-MM-dd"), format(date, "yyyy-MM-dd"))
    }
  }

  const handleMouseEnter = (date: Date) => {
    if (isSameDay(parsedStart, parsedEnd)) {
      setHoveredDate(date)
    }
  }

  // Generate calendar days
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(monthStart)
  const startDateCalendar = startOfWeek(monthStart)
  const endDateCalendar = endOfWeek(monthEnd)

  const days = eachDayOfInterval({
    start: startDateCalendar,
    end: endDateCalendar
  })

  const quickSelect = (type: string) => {
    const today = new Date()
    let start = today
    let end = today

    switch (type) {
      case "today":
        break
      case "yesterday":
        start = subDays(today, 1)
        end = subDays(today, 1)
        break
      case "last7":
        start = subDays(today, 6)
        break
      case "last30":
        start = subDays(today, 29)
        break
      case "thisMonth":
        start = startOfMonth(today)
        end = endOfMonth(today)
        break
      case "lastMonth":
        const lm = subMonths(today, 1)
        start = startOfMonth(lm)
        end = endOfMonth(lm)
        break
    }

    onChange(format(start, "yyyy-MM-dd"), format(end, "yyyy-MM-dd"))
    setCurrentMonth(start)
    setIsOpen(false)
  }

  const isSelectedRange = (date: Date) => {
    return isWithinInterval(date, { start: parsedStart, end: parsedEnd })
  }

  const isRangeHovered = (date: Date) => {
    if (!hoveredDate || !isSameDay(parsedStart, parsedEnd)) return false
    
    const rangeStart = parsedStart < hoveredDate ? parsedStart : hoveredDate
    const rangeEnd = parsedStart < hoveredDate ? hoveredDate : parsedStart
    
    return isWithinInterval(date, { start: rangeStart, end: rangeEnd })
  }

  return (
    <div className="relative" ref={containerRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-gray-950 px-4 py-2 rounded-lg border border-gray-800 text-sm text-gray-200 hover:border-gray-700 hover:text-white transition-all shadow-inner"
      >
        <CalendarIcon size={16} className="text-indigo-400" />
        <span className="font-medium">
          {format(parsedStart, "yyyy. MM. dd")} ~ {format(parsedEnd, "yyyy. MM. dd")}
        </span>
      </button>

      {/* Dropdown Calendar */}
      {isOpen && (
        <div className="absolute right-0 mt-2 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl z-50 flex overflow-hidden backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Quick presets (Left sidebar) */}
          <div className="w-40 border-r border-gray-800 bg-gray-950/50 p-3 flex flex-col gap-1 text-xs">
            <span className="font-semibold text-gray-500 px-2 py-1 mb-1">빠른 선택</span>
            <button onClick={() => quickSelect("today")} className="text-left px-2 py-1.5 rounded hover:bg-gray-800 text-gray-300 transition-colors">오늘</button>
            <button onClick={() => quickSelect("yesterday")} className="text-left px-2 py-1.5 rounded hover:bg-gray-800 text-gray-300 transition-colors">어제</button>
            <button onClick={() => quickSelect("last7")} className="text-left px-2 py-1.5 rounded hover:bg-gray-800 text-gray-300 transition-colors">최근 7일</button>
            <button onClick={() => quickSelect("last30")} className="text-left px-2 py-1.5 rounded hover:bg-gray-800 text-gray-300 transition-colors">최근 30일</button>
            <button onClick={() => quickSelect("thisMonth")} className="text-left px-2 py-1.5 rounded hover:bg-gray-800 text-gray-300 transition-colors">이번 달</button>
            <button onClick={() => quickSelect("lastMonth")} className="text-left px-2 py-1.5 rounded hover:bg-gray-800 text-gray-300 transition-colors">지난 달</button>
          </div>

          {/* Calendar Body */}
          <div className="p-4 w-72">
            {/* Calendar Header */}
            <div className="flex justify-between items-center mb-4">
              <button 
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="p-1 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="font-semibold text-sm text-gray-200">
                {format(currentMonth, "yyyy년 M월", { locale: ko })}
              </span>
              <button 
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="p-1 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Days of week */}
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-gray-500 mb-2">
              {["일", "월", "화", "수", "목", "금", "토"].map(day => (
                <div key={day} className="h-6 flex items-center justify-center">{day}</div>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1 text-xs">
              {days.map((day, idx) => {
                const isSelected = isSelectedRange(day)
                const isHovered = isRangeHovered(day)
                const isCurrentMonth = isSameMonth(day, currentMonth)
                const isStart = isSameDay(day, parsedStart)
                const isEnd = isSameDay(day, parsedEnd)

                return (
                  <button
                    key={idx}
                    onClick={() => handleDateClick(day)}
                    onMouseEnter={() => handleMouseEnter(day)}
                    className={cn(
                      "h-8 w-8 rounded-lg flex items-center justify-center font-medium transition-all relative",
                      !isCurrentMonth && "text-gray-600",
                      isCurrentMonth && !isSelected && !isHovered && "text-gray-300 hover:bg-gray-800",
                      (isSelected || isHovered) && "bg-indigo-600/20 text-indigo-300",
                      (isStart || isEnd) && "bg-indigo-600 text-white font-bold rounded-lg shadow-lg shadow-indigo-600/30 hover:bg-indigo-700",
                    )}
                  >
                    {format(day, "d")}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
