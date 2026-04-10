export function Header() {
  return (
    <header className="bg-wise-navy text-white">
      <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-2xl font-bold">
            <span className="text-wise-green">KYB Portal</span>
          </div>
          <div className="h-6 w-px bg-wise-green/30" />
          <span className="text-xs text-wise-green/80 font-medium tracking-wide uppercase">
            Business Onboarding
          </span>
        </div>
      </div>
    </header>
  );
}
