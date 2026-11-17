import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { AcademicGradesClient } from "./AcademicGradesClient"

export default async function AcademicGradesPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  return (
    <div className="space-y-6">
      <AcademicGradesClient />
    </div>
  )
}
