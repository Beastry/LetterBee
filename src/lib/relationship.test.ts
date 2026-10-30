import { expect, it } from "vitest";
import { canSendLetter, createConnectedRelationship, normalizePair } from "./relationship";
it("双方顺序不会生成两个关系", () => {
  expect(normalizePair("b", "a")).toEqual(normalizePair("a", "b"));
  expect(() => normalizePair("a", "a")).toThrow();
  expect(createConnectedRelationship("b", "a", "invite")).toMatchObject({ userAId: "a", userBId: "b", status: "CONNECTED", createdFromInvitationId: "invite" });
});
it("仅已通邮关系可继续寄信", () => {
  expect(canSendLetter("CONNECTED")).toBe(true);
  for (const status of ["BLOCKED", "ARCHIVED", "PENDING_INVITE"] as const) expect(canSendLetter(status)).toBe(false);
});
