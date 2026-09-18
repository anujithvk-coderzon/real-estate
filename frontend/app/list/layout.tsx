import Sidebar from "@/components/layout/Sidebar";

// Every page under /list gets the sidebar; login, register and verify do not.
export default function ListLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <Sidebar />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
