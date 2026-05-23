import { redirect } from "next/navigation";
import { getCurrentSession, hasPasswordSet } from "@/lib/auth";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (!hasPasswordSet()) {
    redirect("/setup");
  }
  const session = await getCurrentSession();
  if (session) redirect("/");
  return <LoginForm />;
}
