import Link from "next/link"

export default function AdminHomePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-foreground">Admin</h1>
      <p className="text-sm text-muted-foreground">Área privada de administración.</p>
      <Link className="text-sm font-semibold text-primary underline" href="/admin/produccion">
        Ir a Producción
      </Link>
    </div>
  )
}
