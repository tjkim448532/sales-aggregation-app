import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import Link from "next/link"
import { LayoutDashboard, Target } from "lucide-react"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "실적집계 대시보드",
  description: "호텔 수익 관리 및 목표 집계 대시보드",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko" className="dark">
      <body className={`${inter.className} bg-gray-950 text-gray-100 antialiased h-screen flex overflow-hidden`}>
        {/* Sidebar */}
        <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
          <div className="h-16 flex items-center px-6 border-b border-gray-800">
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
              Revenue Analytics
            </h1>
          </div>
          <nav className="flex-1 p-4 space-y-2">
            <Link href="/" className="flex items-center gap-3 px-4 py-3 rounded-lg bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600/20 transition-colors">
              <LayoutDashboard size={20} />
              <span className="font-medium">대시보드 (DAILY)</span>
            </Link>
            <Link href="/targets" className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-gray-200 transition-colors">
              <Target size={20} />
              <span className="font-medium">영업장 목표 관리</span>
            </Link>
          </nav>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-black/20">
          <header className="h-16 flex items-center px-8 border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm">
            <h2 className="text-lg font-medium text-gray-200">실적집계 시스템</h2>
          </header>
          <main className="flex-1 overflow-auto p-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
