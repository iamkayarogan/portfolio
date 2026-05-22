import { redirect } from "next/navigation";
import { getCurrentSession, hasPasswordSet } from "@/lib/auth";
import SetupForm from "./SetupForm";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (hasPasswordSet()) {
    const session = await getCurrentSession();
    redirect(session ? "/" : "/login");
  }
  return <SetupForm />;
}
