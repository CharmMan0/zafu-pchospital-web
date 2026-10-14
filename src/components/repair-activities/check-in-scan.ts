/**
 * 扫码签到的客户端解析工具（issue #126）。
 * 只解码自家令牌的 JSON 载荷取活动 ID（不验签 —— 验签在服务端），
 * 以及对扫码文本提取令牌的宽松匹配。
 */

/** 从扫码文本提取签到令牌：完整链接 `https://pczafu.cn/checkin/<token>` 或裸 `/checkin/<token>`。 */
export function tokenFromScanText(text: string): string | null {
  const match = text.match(/\/checkin\/([A-Za-z0-9._~-]+)/);
  return match?.[1] ?? null;
}

/** 从签到令牌载荷中取出活动 ID；格式非法返回 null（交给服务端错误提示兜底）。 */
export function activityIdFromCheckInToken(token: string): string | null {
  const body = token.split(".")[0];
  if (!body) return null;
  try {
    const base64 = body.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as { a?: unknown };
    return typeof payload.a === "string" && payload.a ? payload.a : null;
  } catch {
    return null;
  }
}
