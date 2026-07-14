import { db } from "./server/db.ts";
import bcrypt from "bcrypt";

(async () => {
  const hashedPassword = await bcrypt.hash("test123", 10);
  await db.update(db.users).set({ passwordHash: hashedPassword }).where(db.eq(db.users.username, "maged"));
  console.log("Password reset for maged");
  process.exit(0);
})();
