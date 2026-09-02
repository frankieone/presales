export function Header() {
  return (
    <header className="bg-white border-b border-imb-gray-200">
      <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img src="/imb-logo.png" alt="IMB Bank" className="h-8 w-auto" />
          <div className="h-6 w-px bg-imb-gray-200" />
          <span className="text-xs text-imb-green font-semibold tracking-wide uppercase">
            Business Onboarding
          </span>
        </div>
      </div>
      <div className="h-1 bg-imb-lime" />
    </header>
  );
}
