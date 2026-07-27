import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AgentChat } from "@/components/agent-chat";
import { requireUser } from "@/lib/auth";
import { hasLlmKey } from "@/lib/llm";
import { profileLlm } from "@/lib/profile-llm";

export const dynamic = "force-dynamic";

export default async function AgentPage() {
  const user = await requireUser();
  if (!user) redirect("/login");
  if (!user.profile) redirect("/onboarding");

  const llm = profileLlm(user.profile);
  const hasKey = hasLlmKey(llm);

  return (
    <AppShell
      title="AI agent"
      subtitle="Chat with your job-hunt copilot. It uses the same Claude/OpenAI key from Settings."
    >
      <AgentChat hasKey={hasKey} provider={user.profile.llmProvider || "auto"} />
    </AppShell>
  );
}
