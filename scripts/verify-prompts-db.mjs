import fs from "fs";
import path from "path";

const promptsDBPath = path.resolve(process.cwd(), "resources", "prompts.db");

if (!fs.existsSync(promptsDBPath)) {
  console.error(`Missing prompts DB: ${promptsDBPath}`);
  console.error('Run `npm run db:prompts -- <csv-path>` before packaging.');
  process.exit(1);
}

const stat = fs.statSync(promptsDBPath);
if (!stat.isFile() || stat.size <= 0) {
  console.error(`Invalid prompts DB: ${promptsDBPath}`);
  process.exit(1);
}

console.log(`Verified prompts DB: ${promptsDBPath}`);
