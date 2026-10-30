import { describe, expect, it } from "vitest";
import { buildInvitePreview, claimInviteState, DEFAULT_INVITE_TTL_MS, evaluateInviteAccess, generateInviteToken, hashPassphrase, verifyPassphrase, type InviteState } from "./invite";
const now = new Date("2026-10-30T00:00:00Z");
const pending: InviteState = { status: "PENDING", recipientHintName: "小林", expiresAt: new Date(now.getTime() + DEFAULT_INVITE_TTL_MS).toISOString() };
describe("收信邀请", () => {
  it("生成不重复的不可猜测链接", () => { const token = generateInviteToken(); expect(token).toMatch(/^[\w-]{43}$/); expect(generateInviteToken()).not.toBe(token); });
  it("到期瞬间即不能认领或读信", () => { expect(evaluateInviteAccess({ invitation: pending, now: new Date(pending.expiresAt!) })).toEqual({ ok: false, reason: "expired", canRevealContent: false }); });
  it.each([["CLAIMED", "claimed"], ["REJECTED", "rejected"], ["EXPIRED", "expired"]] as const)("%s 链接不再开放", (status, reason) => { expect(evaluateInviteAccess({ invitation: { ...pending, status }, now }).reason).toBe(reason); });
  it("口令加盐存储，错误或缺失口令不能读信", () => {
    const stored = hashPassphrase("见字如面");
    expect(stored).not.toContain("见字如面"); expect(hashPassphrase("见字如面")).not.toBe(stored);
    expect(verifyPassphrase("见字如面", stored)).toBe(true); expect(verifyPassphrase("错了", stored)).toBe(false);
    const invitation = { ...pending, passphraseHash: stored };
    expect(evaluateInviteAccess({ invitation, now, passphraseAttempt: "错了" }).canRevealContent).toBe(false);
    expect(evaluateInviteAccess({ invitation, now }).canRevealContent).toBe(false);
    expect(evaluateInviteAccess({ invitation, now, passphraseAttempt: "见字如面" }).canRevealContent).toBe(true);
    expect(claimInviteState(invitation, now, "错了", "accept").ok).toBe(false);
    const result = claimInviteState(invitation, now, "见字如面", "accept");
    expect(result).toEqual({ ok: true, status: "CLAIMED" });
    if (result.ok) expect(claimInviteState({ ...invitation, status: result.status }, now, "见字如面", "accept").ok).toBe(false);
    expect(claimInviteState(invitation, now, "见字如面", "block")).toEqual({ ok: true, status: "REJECTED" });
  });
  it("预览只包含邀请信息", () => { expect(buildInvitePreview({ invitation: pending, inviterName: "小陈" }).description).toContain("小陈 写给 小林"); });
});
