import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), find: vi.fn(), update: vi.fn(), updateMany: vi.fn(), compare: vi.fn(), hash: vi.fn(),
}));
vi.mock("@/lib/auth/guards", () => ({ requireAuth: mocks.auth }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { user: {
  findUnique: mocks.find, update: mocks.update, updateMany: mocks.updateMany,
} } }));
vi.mock("bcryptjs", () => ({ compare: mocks.compare, hash: mocks.hash }));
import { PATCH } from "@/app/api/users/me/password/route";

const request = () => new NextRequest("http://localhost/api/users/me/password", {
  method: "PATCH", body: JSON.stringify({ currentPassword: "before-test", newPassword: " After Test " }),
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ session: { user: { id: "student-test" } }, error: null });
  mocks.find.mockResolvedValue({ id: "student-test", passwordHash: "old-encoded" });
  mocks.compare.mockResolvedValue(true);
  mocks.hash.mockResolvedValue("new-encoded");
  mocks.update.mockResolvedValue({ id: "student-test" });
  mocks.updateMany.mockResolvedValue({ count: 1 });
});

it("does not report success when another session has already replaced the verified password", async () => {
  mocks.updateMany.mockResolvedValue({ count: 0 });
  const response = await PATCH(request());
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ success: false, error: { code: "PASSWORD_CHANGED" } });
});

it("only replaces the password that this request verified and preserves submitted characters", async () => {
  const response = await PATCH(request());
  expect(response.status).toBe(200);
  expect(mocks.updateMany).toHaveBeenCalledWith({ where: { id: "student-test", passwordHash: "old-encoded" }, data: { passwordHash: "new-encoded" } });
  expect(mocks.hash).toHaveBeenCalledWith(" After Test ", 12);
  expect(mocks.update).not.toHaveBeenCalled();
});

it("never writes when the current password is wrong", async () => {
  mocks.compare.mockResolvedValue(false);
  expect((await PATCH(request())).status).toBe(400);
  expect(mocks.updateMany).not.toHaveBeenCalled();
  expect(mocks.update).not.toHaveBeenCalled();
});
