"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { repairActivityCheckInCopy as copy } from "@/config/repair-activities";
import type { StaffRegistrationView } from "@/features/repair-activities/repair-activity-staff-service";

type Phase =
  | { kind: "loading" }
  | { kind: "ready"; row: StaffRegistrationView }
  | { kind: "submitting"; row: StaffRegistrationView }
  | { kind: "done"; row: StaffRegistrationView }
  | { kind: "failed"; message: string; login: boolean };

/**
 * 扫码签到确认面板（issue #126）：preview → 核对 → 确认签到 → 完成。
 * 工作台扫码弹窗与 /checkin 落地页共用；令牌只定位记录，客户信息全部来自 preview 接口。
 */
export function QrCheckInPanel({
  activityId,
  token,
  onSuccess,
  onCancel,
}: {
  activityId: string;
  token: string;
  /** 签到已成功并点「完成」：调用方刷新数据。 */
  onSuccess?: () => void;
  /** 用户主动取消（未签到）。 */
  onCancel?: () => void;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(
          `/api/v1/member/repair-activities/${activityId}/check-in/preview`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
          },
        );
        const json = (await response.json()) as {
          success: boolean;
          data?: StaffRegistrationView;
          error?: { message?: string; code?: string };
        };
        if (cancelled) return;
        if (!json.success || !json.data) {
          const code = json.error?.code;
          if (code === "UNAUTHENTICATED") {
            setPhase({ kind: "failed", message: copy.loginRequired, login: true });
          } else {
            // FORBIDDEN / ACTIVITY_ATTENDANCE_REQUIRED / 令牌无效等：原样带出服务端文案。
            setPhase({
              kind: "failed",
              message: json.error?.message ?? copy.tokenInvalid,
              login: false,
            });
          }
          return;
        }
        setPhase({ kind: "ready", row: json.data });
      } catch {
        if (!cancelled) setPhase({ kind: "failed", message: copy.previewFailed, login: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activityId, token]);

  async function confirm(row: StaffRegistrationView) {
    setPhase({ kind: "submitting", row });
    setSubmitError("");
    try {
      const response = await fetch(`/api/v1/member/repair-activities/${activityId}/check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokens: [token] }),
      });
      const json = (await response.json()) as {
        success: boolean;
        error?: { message?: string };
      };
      if (!json.success) {
        setPhase({ kind: "ready", row });
        setSubmitError(json.error?.message ?? copy.checkInFailed);
        return;
      }
      setPhase({ kind: "done", row });
    } catch {
      setPhase({ kind: "ready", row });
      setSubmitError(copy.checkInFailed);
    }
  }

  if (phase.kind === "loading") {
    return (
      <p className="muted" role="status">
        {copy.previewLoading}
      </p>
    );
  }
  if (phase.kind === "failed") {
    return (
      <div className="admin-section">
        <p className="admin-status admin-status--error" role="alert">
          {phase.message}
        </p>
        {phase.login ? (
          <div className="signup__actions">
            <Button variant="solid" href="/login">
              {copy.goLogin}
            </Button>
          </div>
        ) : null}
        {onCancel ? (
          <div className="signup__actions">
            <Button variant="ghost" onClick={onCancel}>
              {copy.back}
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  const row = phase.row;
  const checkInable = row.status === "REGISTERED";
  return (
    <div className="admin-section">
      <p className="muted">{copy.confirmHint}</p>
      <p>
        <strong>{row.name}</strong> · {row.phoneMasked} · {row.issueTypeLabel}
        {row.deviceModel ? ` · ${row.deviceModel}` : ""}
      </p>
      {!checkInable ? (
        <p className="admin-status admin-status--error" role="alert">
          {copy.notCheckInable}
        </p>
      ) : null}
      {phase.kind === "done" ? (
        <p className="admin-status admin-status--success" role="status">
          {copy.checkInSuccess}
        </p>
      ) : null}
      {submitError ? (
        <p className="admin-status admin-status--error" role="alert">
          {submitError}
        </p>
      ) : null}
      <div className="signup__actions">
        {phase.kind === "done" ? (
          <Button variant="solid" onClick={onSuccess}>
            {copy.doneClose}
          </Button>
        ) : (
          <>
            {onCancel ? (
              <Button variant="ghost" onClick={onCancel}>
                {copy.cancel}
              </Button>
            ) : null}
            <Button
              variant="solid"
              disabled={phase.kind === "submitting" || !checkInable}
              onClick={() => void confirm(row)}
            >
              {phase.kind === "submitting" ? copy.confirmBusy : copy.confirm}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
