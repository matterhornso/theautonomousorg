import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdminSidebar } from "./_components/sidebar";
import { AdminTopbar } from "./_components/topbar";
import { ToastProvider } from "./_components/toast";
import { resolveTenant } from "./_lib/resolve-tenant";

export const metadata: Metadata = {
  title: "Admin · The Autonomous",
  description: "Operate every role agent for your workspace.",
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const tenant = await resolveTenant();

  return (
    <ToastProvider>
      <div className="min-h-[100dvh] flex bg-surface text-primary">
        <AdminSidebar
          firmName={tenant.firm.name}
          firmInitials={tenant.firm.initials}
          firmId={tenant.firm.id}
          userInitials={tenant.user.initials}
          userLabel={
            [tenant.user.firstName, tenant.user.lastName]
              .filter(Boolean)
              .join(" ") ||
            tenant.user.email ||
            "Signed in"
          }
          workspaceCount={tenant.companies.length}
        />
        <div className="flex-1 flex flex-col min-w-0">
          <AdminTopbar />
          <main className="flex-1 px-6 md:px-10 lg:px-14 py-10 max-w-[1400px] w-full mx-auto">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
