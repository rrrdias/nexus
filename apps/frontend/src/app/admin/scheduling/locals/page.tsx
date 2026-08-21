import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getLocals } from "@/app/actions/scheduling"
import { LocalsManagement } from "./LocalsManagement"

export default async function AdminLocalsPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const locals = await getLocals({ todos: true })

  return (
    <div className="space-y-6">
      <LocalsManagement initialLocals={locals} />
    </div>
  )
}
