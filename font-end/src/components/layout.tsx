import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from './ui/sidebar';
import { LayoutDashboard, Users, Workflow, BarChart3, FileText, Settings, Briefcase, Archive } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

const navigationItems: { path: string; label: string; icon: any }[] = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/pipeline', label: 'Pipeline', icon: Workflow },
  { path: '/candidates', label: 'Candidates', icon: Users },
  { path: '/archived-candidates', label: 'Archived Candidates', icon: Archive },
  { path: '/job-descriptions', label: 'Job Descriptions', icon: Briefcase },
  { path: '/analytics', label: 'Analytics', icon: BarChart3 },
  { path: '/notes', label: 'Notes', icon: FileText },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const active = navigationItems.find(i => i.path === location.pathname)?.label || 'Dashboard';
  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <Sidebar className="border-r border-border/40">
          <SidebarContent>
            <div className="p-6 border-b border-border/40">
              <h1 className="text-xl font-semibold text-emerald-600">TalentTrail</h1>
              <p className="text-sm text-muted-foreground">Recruitment Dashboard</p>
            </div>
            <SidebarGroup>
              <SidebarGroupLabel>Navigation</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navigationItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          className="w-full justify-start"
                        >
                          <Link to={item.path}>
                            <Icon className="w-4 h-4" />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
        <div className="flex-1 flex flex-col">
          <header className="border-b border-border/40 p-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <h2 className="capitalize text-lg font-medium">{active}</h2>
            </div>
          </header>
          <main className="flex-1 overflow-auto" data-scroll-container id="app-scroll-root">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}