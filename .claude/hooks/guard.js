#!/usr/bin/env node
// Blocks a few dangerous shell commands before Claude runs them.
// Exit code 2 = block the command and show the message to Claude.
let data = "";
process.stdin.on("data", (c) => (data += c));
process.stdin.on("end", () => {
  let cmd = "";
  try {
    cmd = (JSON.parse(data).tool_input || {}).command || "";
  } catch {
    process.exit(0);
  }
  const rules = [
    [/rm\s+-rf?\s+(\/|~|\$HOME)/, "rm -rf on a root or home path"],
    [/git\s+push\b.*--force/, "force push"],
    [/git\s+reset\s+--hard/, "git reset --hard (commit or stash first)"],
    [/(cat|echo|printf).*ANTHROPIC_API_KEY.*>>?\s*\S*(\.ts|\.js|\.json|\.md)\b/, "writing the API key into a source file"],
  ];
  for (const [re, why] of rules) {
    if (re.test(cmd)) {
      console.error(`Blocked: ${why}. Ask the user before doing this.`);
      process.exit(2);
    }
  }
  process.exit(0);
});
