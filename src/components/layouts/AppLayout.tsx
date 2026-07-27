import { Outlet } from 'react-router-dom';
import { AppSidebar } from '@/components/app-sidebar';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { AuthErrorBoundaryWithReset } from '@/components/auth/AuthErrorBoundary';

export function AppLayout() {
  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <AuthErrorBoundaryWithReset>
              <Outlet />
            </AuthErrorBoundaryWithReset>
          </div>
          <SiteFooter />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
