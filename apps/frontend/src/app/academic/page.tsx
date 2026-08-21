import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { AcademicDashboard } from "./AcademicDashboard"

export default async function AcademicPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  return (
    <div className="space-y-6">
      <AcademicDashboard />
    </div>
  )
}
