import { timingSafeEqual } from "node:crypto";

import { signTokenBody } from "@/features/repair-activities/edit-token";
import { AppError } from "@/lib/api/errors";

/**
 * 预约二维码里携带的签到令牌（issue #126）。
 *
 * 与 lookup 的短期 editToken 同款 HMAC-SHA256 自包含格式，但语义不同：
 * - 有效期覆盖整个签到窗口（报名截止 → 活动日结束 + 缓冲），由调用方按活动计算 exp；
 * - 载荷只用短键（v/r/a/exp），整条令牌越短，二维码图越稀疏、越好扫；
 * - 不含姓名等隐私 —— 扫码后由成员先调 preview 接口确认客户信息，再执行签到。
 *
 * 令牌不落库：验签 + 活动状态校验即可，满足「二维码实时生成、不存储在服务器上」。
 */
type CheckInTokenPayload = {
  v: 1;
  r: string;
  a: string;
  exp: number;
};

export function issueCheckInToken(
  registrationId: string,
  activityId: string,
  expiresAt: Date,
): string {
  const payload: CheckInTokenPayload = {
    v: 1,
    r: registrationId,
    a: activityId,
    exp: expiresAt.getTime(),
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${signTokenBody(body)}`;
}

/** 验签并核对活动归属；返回报名 ID。任何不对都按「无效或过期」拒绝，不细分原因。 */
export function verifyCheckInToken(
  token: string,
  expectedActivityId: string,
  now = new Date(),
): { registrationId: string } {
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new AppError("ACTIVITY_EDIT_TOKEN_INVALID", "签到二维码无效或已过期");
  }
  const [body, sig] = parts;
  const expectedSig = signTokenBody(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new AppError("ACTIVITY_EDIT_TOKEN_INVALID", "签到二维码无效或已过期");
  }
  let payload: CheckInTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as CheckInTokenPayload;
  } catch {
    throw new AppError("ACTIVITY_EDIT_TOKEN_INVALID", "签到二维码无效或已过期");
  }
  if (payload.v !== 1 || payload.a !== expectedActivityId || !payload.r) {
    throw new AppError("ACTIVITY_EDIT_TOKEN_INVALID", "签到二维码无效或已过期");
  }
  if (typeof payload.exp !== "number" || now.getTime() > payload.exp) {
    throw new AppError("ACTIVITY_EDIT_TOKEN_INVALID", "签到二维码无效或已过期");
  }
  return { registrationId: payload.r };
}
