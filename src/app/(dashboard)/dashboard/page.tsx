export default function DashboardPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-[#A0A0A0] text-sm mt-1">Vue d&apos;ensemble de votre activité</p>
      </div>

      {/* KPIs placeholder */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Nouveaux leads', value: '0', color: 'text-blue-400' },
          { label: 'Appels planifiés', value: '0', color: 'text-yellow-400' },
          { label: 'Deals closés', value: '0', color: 'text-green-400' },
          { label: 'Taux de closing', value: '0%', color: 'text-purple-400' },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="bg-[#141414] border border-[#262626] rounded-xl p-5"
          >
            <p className="text-[#A0A0A0] text-xs font-medium mb-2">{kpi.label}</p>
            <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Sections placeholder */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#141414] border border-[#262626] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Prochains appels</h2>
          <p className="text-[#A0A0A0] text-sm">Aucun appel planifié</p>
        </div>
        <div className="bg-[#141414] border border-[#262626] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Follow-ups en retard</h2>
          <p className="text-[#A0A0A0] text-sm">Aucun follow-up en retard</p>
        </div>
      </div>
    </div>
  )
}
