import { Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";

export default function MarketingLayout() {
  const location = useLocation();

  useEffect(() => {
    if (location.hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname, location.search, location.hash]);

  return (
    <div className="min-h-screen bg-[#0B0F17] text-zinc-50">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-[520px] bg-[radial-gradient(1000px_circle_at_20%_0%,rgba(124,58,237,0.35),transparent_55%),radial-gradient(900px_circle_at_80%_10%,rgba(99,102,241,0.25),transparent_55%)]" />
      <div className="relative">
        <SiteHeader />
        <main className="min-h-[70vh]">
          <Outlet />
        </main>
        <SiteFooter />
      </div>
    </div>
  );
}
