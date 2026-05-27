import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getLocals } from "@/app/actions/scheduling"
import { SlotsManagement } from "./SlotsManagement"

export default async function AdminSlotsPage() {
  const session = await auth()
  // @ts-ignore
  if (!session?.user) redirect("/login")

  // Fetch only active locals to allow creating slots for active campus centers
  const locals = await getLocals()

  return (
    <div className="space-y-6">
      <SlotsManagement locals={locals} />
    </div>
  )
}
