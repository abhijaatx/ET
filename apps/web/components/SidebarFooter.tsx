"use client";

export function SidebarFooter() {
  return (
    <div className="px-4 text-xs text-et-meta flex flex-wrap gap-x-3 gap-y-1 opacity-70 pb-10">
      <span className="hover:underline cursor-pointer">Terms of Service</span>
      <span className="hover:underline cursor-pointer">Privacy Policy</span>
      <span className="hover:underline cursor-pointer">Cookie Policy</span>
      <span>© 2026 News Navigator Inc.</span>
    </div>
  );
}
