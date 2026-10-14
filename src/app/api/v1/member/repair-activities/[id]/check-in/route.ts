import {
  bodyCheckInIssueTypeUpdates,
  bodyCheckInTokens,
  bodyRegistrationIds,
} from "@/features/repair-activities/repair-activity-http";
import { repairActivityStaffService } from "@/features/repair-activities/repair-activity-staff-service";
import { AppError } from "@/lib/api/errors";
import { apiFailure, apiSuccess } from "@/lib/api/response";
import { getRequestId } from "@/lib/api/request-id";
import { assertSameOrigin, authenticateRequest } from "@/lib/auth/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request.headers);
  try {
    assertSameOrigin(request);
    const { actor } = await authenticateRequest(request, requestId);
    const id = (await params).id;
    if (!id) throw new AppError("VALIDATION_FAILED", "活动 ID 无效");
    const body = (await request.json()) as Record<string, unknown>;
    // 扫码签到（issue #126）：tokens 路径只要求 activity:staff（成员兜底），
    // registrationIds 路径维持仅管理员（issue #108）；两者互斥。
    if (body.tokens !== undefined) {
      if (body.registrationIds !== undefined) {
        throw new AppError("VALIDATION_FAILED", "tokens 与 registrationIds 只能二选一");
      }
      return apiSuccess(
        await repairActivityStaffService.checkInByTokens(id, bodyCheckInTokens(body), actor),
        requestId,
      );
    }
    const registrationIds = bodyRegistrationIds(body);
    return apiSuccess(
      await repairActivityStaffService.checkIn(
        id,
        registrationIds,
        actor,
        bodyCheckInIssueTypeUpdates(body, registrationIds),
      ),
      requestId,
    );
  } catch (error) {
    return apiFailure(error, requestId);
  }
}
