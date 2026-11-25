import { auth } from "@/auth"
import { getLocals } from "@/app/actions/scheduling"
import { requireSchedulingAccess } from "../access"
import { LocalsManagement } from "./LocalsManagement"

export default async function AdminLocalsPage() {
  const session = await auth()
  await requireSchedulingAccess(session)

  const locals = await getLocals({ todos: true })

  return (
    <div className="space-y-6">
      <LocalsManagement initialLocals={locals} />
    </div>
  )
}
