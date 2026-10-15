import AdminShell from "@/components/AdminShell";

// (dashboard) is a route group: the brackets keep it out of the URL, so the
// page inside is /home, not /dashboard/home. It exists only to give every
// signed-in screen this one shell without the login page inheriting it.
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}
