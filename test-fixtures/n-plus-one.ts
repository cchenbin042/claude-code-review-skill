// test-fixtures/n-plus-one.ts
// Expected: 1 Critical (performance) — N+1: DB query inside forEach loop

import { db } from "./db";

export async function getUserOrders(userIds: string[]) {
  const orders: any[] = [];

  // VULNERABILITY: DB query inside loop — N+1 pattern
  userIds.forEach(async (id) => {
    const order = await db.query("SELECT * FROM orders WHERE user_id = ?", [id]);
    orders.push(order);
  });

  return orders;
}
