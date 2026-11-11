import { randomUUID } from "node:crypto";
export type RelationshipStatus = "PENDING_INVITE" | "CONNECTED" | "BLOCKED" | "ARCHIVED";
export function normalizePair(userAId: string, userBId: string) {
  if (userAId === userBId) throw new Error("不能与自己建立通信关系");
  const [a, b] = [userAId, userBId].sort();
  return { userAId: a, userBId: b };
}
export function canSendLetter(status: RelationshipStatus) { return status === "CONNECTED"; }
export function createConnectedRelationship(userAId: string, userBId: string, invitationId: string, now = new Date()) {
  return {
    id: randomUUID(), ...normalizePair(userAId, userBId), status: "CONNECTED" as RelationshipStatus,
    createdFromInvitationId: invitationId, createdAt: now.toISOString(), updatedAt: now.toISOString()
  };
}
