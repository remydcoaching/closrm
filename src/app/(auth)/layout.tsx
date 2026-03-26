export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A] px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">
            Clos<span className="text-[#E53E3E]">RM</span>
          </h1>
          <p className="text-[#A0A0A0] mt-2 text-sm">CRM pour coachs indépendants</p>
        </div>
        {children}
      </div>
    </div>
  )
}
