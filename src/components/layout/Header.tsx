import { Menu } from 'lucide-react'
import { useSidebarStore } from '@/stores/common/useSidebarStore'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { NotificationMenu } from '@/components/layout/NotificationMenu'
import { UserMenu } from '@/components/layout/UserMenu'
import { DialogTrigger } from '@/components/ui/dialog'

export function Header({ isMobile = false, mobileMenuOpen = false }: { isMobile?: boolean; mobileMenuOpen?: boolean }) {
  const { isExpanded, toggleSidebar } = useSidebarStore() as {
    isExpanded: boolean
    toggleSidebar: () => void
  }

  return (
    <header className="bg-background/95 text-foreground supports-backdrop-filter:bg-background/60 border-border sticky top-0 z-10 border-b backdrop-blur">
      <div className="flex min-w-0 items-center justify-between px-4 py-4 sm:px-6">
        {/* Left side - Toggle và Title */}
        <div className="flex items-center gap-4">
          {isMobile ? (
            <DialogTrigger asChild>
              <Button id="admin-mobile-menu-trigger" variant="ghost" size="icon" aria-label="Mở menu quản trị" aria-expanded={mobileMenuOpen} aria-controls="admin-mobile-navigation">
                <Menu className="size-5" />
              </Button>
            </DialogTrigger>
          ) : <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                aria-label={isExpanded ? 'Thu gọn menu' : 'Mở rộng menu'}
                onClick={() => toggleSidebar()}
                className="hover:bg-muted relative h-8 w-8 p-0 shadow-sm"
              >
                <Menu className="text-foreground h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{isExpanded ? 'Thu gọn menu' : 'Mở rộng menu'}</p>
            </TooltipContent>
          </Tooltip>}
        </div>

        <div className="flex items-center gap-3">
          <NotificationMenu />
          <UserMenu />
        </div>
      </div>
    </header>
  )
}
