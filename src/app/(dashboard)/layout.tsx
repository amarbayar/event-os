import { Sidebar } from "@/components/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      {/* pt-14 on mobile for top bar, pb-16 for bottom nav. lg: sidebar offset */}
      <main className="min-h-screen pt-14 pb-16 lg:pt-0 lg:pb-0 lg:ml-56 transition-all duration-200">
        <div className="mx-auto max-w-6xl px-4 py-4 lg:px-6 lg:py-6">{children}</div>
      </main>
    </div>
  );
}
