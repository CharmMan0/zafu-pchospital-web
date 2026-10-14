import type { Metadata } from "next";

import { QrCheckInPanel } from "@/components/repair-activities/QrCheckInPanel";
import { activityIdFromCheckInToken } from "@/components/repair-activities/check-in-scan";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/ui/Section";
import { repairActivityCheckInCopy as copy } from "@/config/repair-activities";

export const metadata: Metadata = {
  title: copy.pageTitle,
  // 临时动作页：不收录、不跟随，二维码图片本身才是对外载体。
  robots: { index: false, follow: false },
};

/**
 * 签到落地页（issue #126）：预约二维码的内容就是本页链接，
 * 微信 / 系统相机扫码后在此核对客户信息并确认签到。
 * 不在导航里，因此不用带编号的 PageHead。
 */
export default async function CheckInPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const activityId = activityIdFromCheckInToken(token);
  return (
    <Section labelledBy="checkin-title">
      <Container>
        <h1 id="checkin-title">{copy.pageTitle}</h1>
        <p className="lead">{copy.pageLead}</p>
        {activityId ? (
          <QrCheckInPanel activityId={activityId} token={token} />
        ) : (
          <p className="admin-status admin-status--error" role="alert">
            {copy.tokenInvalid}
          </p>
        )}
      </Container>
    </Section>
  );
}
