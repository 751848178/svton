import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="flex min-w-0 flex-1">
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-auto p-4 md:p-6">
          <Breadcrumbs />
          {children}
        </main>
      </div>
    </div>
  );
}
