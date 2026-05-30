// test-fixtures/clean-code.ts
// Expected: 0 findings — clean, well-structured code

import { db } from "./db";

interface User {
  id: string;
  name: string;
  email: string;
}

export async function getUserById(id: string): Promise<User | null> {
  if (!id) {
    return null;
  }

  const result = await db.query("SELECT id, name, email FROM users WHERE id = ?", [id]);

  if (!result || result.length === 0) {
    return null;
  }

  return result[0] as User;
}

export async function updateUserEmail(id: string, email: string): Promise<boolean> {
  if (!id || !email) {
    throw new Error("id and email are required");
  }

  if (!email.includes("@")) {
    throw new Error("invalid email format");
  }

  await db.query("UPDATE users SET email = ? WHERE id = ?", [email, id]);
  return true;
}
