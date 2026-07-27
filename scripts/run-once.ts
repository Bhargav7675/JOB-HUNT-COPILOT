import "dotenv/config";
import { prisma } from "../src/lib/db";
import { runJobHuntPipeline } from "../src/lib/agent/pipeline";

async function main() {
  const profile = await prisma.profile.findFirst({ orderBy: { createdAt: "asc" } });
  if (!profile) {
    console.error("No profile found. Complete onboarding in the app first.");
    process.exit(1);
  }
  console.log(`Running Job Hunt Copilot for ${profile.fullName}…`);
  const result = await runJobHuntPipeline({ profileId: profile.id, trigger: "overnight" });
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
