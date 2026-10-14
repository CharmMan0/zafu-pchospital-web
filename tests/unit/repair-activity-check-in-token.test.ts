import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "mysql://x:x@127.0.0.1:3306/x";
process.env.AUTH_SECRET ??= "test-auth-secret-for-activity-check-in-token";
process.env.INVITE_CODE_PEPPER ??= "pepper";
process.env.PII_AUDIT_PEPPER ??= "pii";

import {
  issueCheckInToken,
  verifyCheckInToken,
} from "../../src/features/repair-activities/check-in-token";
import { AppError } from "../../src/lib/api/errors";
import { resetServerEnvForTests } from "../../src/lib/env";

resetServerEnvForTests();

test("checkInToken 签发后可按活动验签，跨活动 / 过期 / 篡改 / 畸形均拒绝", () => {
  resetServerEnvForTests();
  const expiresAt = new Date("2026-10-20T16:00:00.000Z");
  const token = issueCheckInToken("reg-1", "act-1", expiresAt);
  assert.equal(verifyCheckInToken(token, "act-1", expiresAt).registrationId, "reg-1");

  // 跨活动：载荷里的活动 ID 与路径不符。
  assert.throws(
    () => verifyCheckInToken(token, "act-2", expiresAt),
    (error) => error instanceof AppError && error.code === "ACTIVITY_EDIT_TOKEN_INVALID",
  );
  // 过期：exp 之后不可用；exp 边界上仍可用。
  assert.throws(
    () => verifyCheckInToken(token, "act-1", new Date(expiresAt.getTime() + 1)),
    (error) => error instanceof AppError && error.code === "ACTIVITY_EDIT_TOKEN_INVALID",
  );
  assert.doesNotThrow(() => verifyCheckInToken(token, "act-1", expiresAt));
  // 篡改签名。
  const [body, sig] = token.split(".");
  const tampered = `${body}.${sig === "AAAA" ? "BBBB" : "AAAA"}`;
  assert.throws(
    () => verifyCheckInToken(tampered, "act-1", expiresAt),
    (error) => error instanceof AppError && error.code === "ACTIVITY_EDIT_TOKEN_INVALID",
  );
  // 篡改载荷（换一个报名 ID 后签名不变）。
  const forgedBody = Buffer.from(JSON.stringify({ v: 1, r: "reg-2", a: "act-1", exp: expiresAt.getTime() }), "utf8").toString("base64url");
  assert.throws(
    () => verifyCheckInToken(`${forgedBody}.${sig}`, "act-1", expiresAt),
    (error) => error instanceof AppError && error.code === "ACTIVITY_EDIT_TOKEN_INVALID",
  );
  // 畸形输入。
  for (const malformed of ["", "no-dots", "a.", ".b", "a.b.c"]) {
    assert.throws(
      () => verifyCheckInToken(malformed, "act-1", expiresAt),
      (error) => error instanceof AppError && error.code === "ACTIVITY_EDIT_TOKEN_INVALID",
    );
  }
});

test("checkInToken 载荷用短键且不含隐私字段", () => {
  resetServerEnvForTests();
  const token = issueCheckInToken("reg-1", "act-1", new Date("2026-10-20T16:00:00.000Z"));
  const body = token.split(".")[0];
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Record<string, unknown>;
  assert.deepEqual(Object.keys(payload).sort(), ["a", "exp", "r", "v"]);
});
