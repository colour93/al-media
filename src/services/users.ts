import { eq } from "drizzle-orm";
import { db } from "../db";
import { usersTable, type NewUser, type User } from "../entities/User";

export type UserRole = "owner" | "admin";

const ADMIN_ROLES: UserRole[] = ["owner", "admin"];

export function canAccessAdmin(role: UserRole): boolean {
  return ADMIN_ROLES.includes(role);
}

class UsersService {
  async findByOidcSub(sub: string): Promise<User | null> {
    return db.query.usersTable.findFirst({
      where: eq(usersTable.oidcSub, sub),
    });
  }

  async findById(id: number): Promise<User | null> {
    return db.query.usersTable.findFirst({
      where: eq(usersTable.id, id),
    });
  }

  async createOrUpdateFromOidc(
    sub: string,
    role: UserRole,
    props?: { email?: string; name?: string }
  ): Promise<User> {
    const existing = await this.findByOidcSub(sub);
    if (existing) {
      const [updated] = await db
        .update(usersTable)
        .set({
          email: props?.email ?? existing.email,
          name: props?.name ?? existing.name,
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, existing.id))
        .returning();
      return updated!;
    }
    const [created] = await db
      .insert(usersTable)
      .values({
        oidcSub: sub,
        email: props?.email ?? null,
        name: props?.name ?? null,
        role,
      } as NewUser)
      .returning();
    return created!;
  }

  async count(): Promise<number> {
    const r = await db.$count(usersTable);
    return r ?? 0;
  }
}

export const usersService = new UsersService();
