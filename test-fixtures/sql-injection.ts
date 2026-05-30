// test-fixtures/sql-injection.ts
// Expected: 1 Critical (security) — SQL injection via string concatenation
// Expected: 1 Warning (logic) — missing null check on query input

import { db } from "./db";

export async function getUserByName(req: any) {
  const name = req.query.name;

  // VULNERABILITY: user input concatenated into SQL query
  const query = "SELECT * FROM users WHERE name = '" + name + "'";

  const result = await db.query(query);
  return result;
}
