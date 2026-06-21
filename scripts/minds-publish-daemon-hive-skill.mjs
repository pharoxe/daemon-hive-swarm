import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createMindsClient } from "@animocabrands/minds-client-lib";

const root = process.cwd();
const promptPath = join(root, "minds", "daemon-hive-swarm-data-skill", "publish-prompts.md");
const builderApiKey = process.env.MINDS_BUILDER_API_KEY;

if (!builderApiKey) {
  throw new Error("Set MINDS_BUILDER_API_KEY before running this script.");
}

const client = createMindsClient({ builderApiKey });
const minds = await client.listMinds();
const mindId = minds[0]?.mindId;
if (!mindId) throw new Error("No Mind found for this Builder API key.");

await client.ensureConversation("daemon-hive-skill-publish", mindId);
const prompt = await readFile(promptPath, "utf8");
const before = await client.getLatestHistoryFingerprint("daemon-hive-skill-publish");
await client.sendMessage({
  alias: "daemon-hive-skill-publish",
  messageText: prompt,
});

const outcome = await client.waitForReply({
  alias: "daemon-hive-skill-publish",
  timeoutMs: 180_000,
  afterFingerprint: before,
  sentMessageText: prompt,
});

if (outcome.timedOut) {
  console.log("Prompt sent. The Mind did not reply before timeout; check Minds history.");
} else {
  console.log(outcome.reply.messageText);
}
