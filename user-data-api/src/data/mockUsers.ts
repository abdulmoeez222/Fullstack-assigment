import type { User } from "../types/user";
import { config } from "../config";

const mockUsers = new Map<number, User>([
  [1, { id: 1, name: "John Doe", email: "john@example.com" }],
  [2, { id: 2, name: "Jane Smith", email: "jane@example.com" }],
  [3, { id: 3, name: "Alice Johnson", email: "alice@example.com" }],
]);

let nextId = 4;

/** Simulates a slow DB read. Resolves with the user, or null if not found. */
export function fetchUserFromDb(id: number): Promise<User | null> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(mockUsers.get(id) ?? null);
    }, config.simulatedDb.latencyMs);
  });
}

export function createUser(name: string, email: string): User {
  const user: User = { id: nextId++, name, email };
  mockUsers.set(user.id, user);
  return user;
}

export function userExistsSync(id: number): boolean {
  return mockUsers.has(id);
}
