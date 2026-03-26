export default function LeadDetailPage({ params }: { params: { id: string } }) {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-2">Fiche lead</h1>
      <p className="text-[#A0A0A0] text-sm">ID : {params.id}</p>
    </div>
  )
}
