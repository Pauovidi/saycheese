import { ProductionPanel } from "@/src/components/admin/production-panel"
import { Toaster } from "@/components/ui/sonner"

export default function ProduccionPage() {
  return (
    <>
      <h1 className="mb-6 text-xl font-bold text-foreground">
        {"Producción"}
      </h1>
      <ProductionPanel />
      <Toaster position="bottom-center" />
    </>
  )
}
