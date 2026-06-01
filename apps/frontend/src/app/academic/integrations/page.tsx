import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { IntegrationsDashboard } from "./IntegrationsDashboard"

export default async function IntegrationsPage() {
  const session = await auth()
  // @ts-ignore
  if (!session?.user) redirect("/login")

  return (
    <div className="space-y-6">
      <IntegrationsDashboard />
    </div>
  )
}
