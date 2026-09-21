import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createEnv } from "../backend/env.ts";
import { seedNzTrip, type SeedExpense, type SeedMember } from "../backend/seed.ts";

async function main() {
  const root = resolve(import.meta.dirname, "..");
  const membersPath = resolve(root, "data/seed-members.json");
  if (!existsSync(membersPath)) {
    console.error(
      "请复制 scripts/seed-members.example.json 为 data/seed-members.json，填入四人用户名、初始密码和姓名后再运行 npm run seed。",
    );
    process.exit(1);
  }
  const members = JSON.parse(readFileSync(membersPath, "utf8")) as SeedMember[];
  const expensesPath = resolve(root, "data/seed-expenses.json");
  const expenses = existsSync(expensesPath)
    ? (JSON.parse(readFileSync(expensesPath, "utf8")) as SeedExpense[])
    : [];
  const env = await createEnv();
  const result = await seedNzTrip(env, {
    members,
    expenses,
    resetPasswords: process.argv.includes("--reset-passwords"),
    resetItinerary: process.argv.includes("--reset-itinerary"),
  });
  console.log(JSON.stringify(result, null, 2));
  if (result.itinerary === "kept") {
    console.log(
      "行程事项已保留（前端改过的活动不会被覆盖）。若要按 nz-itinerary.ts 重建，使用 npm run seed -- --reset-itinerary。",
    );
  }
  console.log(
    "不要把初始密码提交到 Git。成员登录后可在「我的」修改密码。已付机票或租车请用创建者账号打开账本预填。",
  );
}

void main();
