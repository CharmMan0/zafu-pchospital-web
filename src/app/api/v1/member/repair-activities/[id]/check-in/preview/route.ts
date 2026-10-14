import { repairActivityStaffService } from "@/features/repair-activities/repair-activity-staff-service";
import { AppError } from "@/lib/api/errors";
import { apiFailure, apiSuccess } from "@/lib/api/response";
import { getRequestId } from "@/lib/api/request-id";
import { assertSameOrigin, authenticateRequest } from "@/lib/auth/request";
import { bodyRequiredStringId } from "@/features/repair-activities/repair-activity-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 扫码签到前的确认预览（issue #126）：把令牌解析成脱敏报名视图供核对。 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request.headers);
  try {
    assertSameOrigin(request);
    const { actor } = await authenticateRequest(request, requestId);
    const id = (await params).id;
    if (!id) throw new AppError("VALIDATION_FAILED", "活动 ID 无效");
    const body = (await request.json()) as Record<string, unknown>;
    return apiSuccess(
      await repairActivityStaffService.previewCheckInToken(
        id,
        bodyRequiredStringId(body, "token"),
        actor,
      ),
      requestId,
    );
  } catch (error) {
    return apiFailure(error, requestId);
  }
}
