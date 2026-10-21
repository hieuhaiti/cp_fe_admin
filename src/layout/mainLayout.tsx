import React, { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Header } from '@/components/layout/Header'
import { SideBar } from '@/components/layout/SideBar'
import { useSidebarStore } from '@/stores/common/useSidebarStore'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface MainLayoutProps {
  children?: React.ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  const { isExpanded } = useSidebarStore() as { isExpanded: boolean }
  const isMobile = useMediaQuery('(max-width: 767px)')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <Dialog open={isMobile && mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
    <div className="bg-background flex h-dvh w-full overflow-hidden text-sm">
      {/* Sidebar */}
      {!isMobile && <aside
        className={cn(
          'bg-card border-border fixed top-0 left-0 h-screen border-r transition-all duration-300 ease-in-out',
          isExpanded ? 'w-64' : 'w-16'
        )}
      >
        <SideBar />
      </aside>}

      {/* Main content area */}
      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col transition-all duration-300 ease-in-out',
          !isMobile && (isExpanded ? 'ml-64' : 'ml-16')
        )}
      >
        <Header isMobile={isMobile} mobileMenuOpen={mobileMenuOpen} />

        {/* Main content */}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col p-4">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children ?? <Outlet />}</div>
        </main>
      </div>
    </div>
    {isMobile && <DialogContent
      id="admin-mobile-navigation"
      className="top-0 left-0 flex h-dvh w-[min(20rem,calc(100%-2rem))] max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none p-0 data-[state=open]:slide-in-from-left-0 data-[state=closed]:slide-out-to-left-0 data-[state=open]:slide-in-from-top-0 data-[state=closed]:slide-out-to-top-0 sm:rounded-none"
    >
      <DialogTitle className="sr-only">Menu quản trị</DialogTitle>
      <DialogDescription className="sr-only">Chọn màn hình quản trị cần mở.</DialogDescription>
      <SideBar expanded onNavigate={() => setMobileMenuOpen(false)} />
    </DialogContent>}
    </Dialog>
  )
}

export default MainLayout
