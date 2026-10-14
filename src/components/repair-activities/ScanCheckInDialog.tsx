"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

import { AdminModal } from "@/components/admin/AdminModal";
import { QrCheckInPanel } from "@/components/repair-activities/QrCheckInPanel";
import { tokenFromScanText } from "@/components/repair-activities/check-in-scan";
import { repairActivityCheckInCopy as copy } from "@/config/repair-activities";

type Props = {
  activityId: string;
  /** completed = 本次扫码已成功签到（调用方刷新看板）；false = 仅关闭。 */
  onClose: (completed: boolean) => void;
};

/**
 * 扫码签到弹窗（issue #126）：相机取景 + jsQR 逐帧解码 → 预览确认 → 签到入队。
 * 相机不可用时提示外链兜底 —— 预约二维码本身就是签到链接，微信/系统相机扫了同样能签。
 */
export function ScanCheckInDialog({ activityId, onClose }: Props) {
  const [token, setToken] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState("");
  const [scanError, setScanError] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (token) return;
    let cancelled = false;
    let raf = 0;
    const stopTracks = (stream: MediaStream) => stream.getTracks().forEach((t) => t.stop());

    (async () => {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
      } catch {
        if (!cancelled) setCameraError(copy.cameraUnavailable);
        return;
      }
      if (cancelled) {
        stopTracks(stream);
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play().catch(() => {});
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      const tick = () => {
        if (cancelled) return;
        if (ctx && video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA && video.videoWidth) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0);
          const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(image.data, image.width, image.height, {
            inversionAttempts: "dontInvert",
          });
          if (code?.data) {
            const parsed = tokenFromScanText(code.data.trim());
            if (parsed) {
              setToken(parsed);
              return;
            }
            // 识别成功但不是自家签到码：提示后继续取景，不中断扫描。
            setScanError(copy.scanInvalid);
          }
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      if (streamRef.current) stopTracks(streamRef.current);
      streamRef.current = null;
    };
  }, [token]);

  return (
    <AdminModal
      title={token ? copy.confirmTitle : copy.scanDialogTitle}
      onClose={() => onClose(false)}
    >
      {token ? (
        <QrCheckInPanel
          activityId={activityId}
          token={token}
          onSuccess={() => onClose(true)}
          onCancel={() => setToken(null)}
        />
      ) : (
        <div className="admin-section">
          <p className="muted">{copy.scanDialogHint}</p>
          {cameraError ? (
            <p className="admin-status admin-status--error" role="alert">
              {cameraError}
            </p>
          ) : (
            <>
              <video
                ref={videoRef}
                className="activity-scan__video"
                playsInline
                muted
                aria-label={copy.cameraStarting}
              />
              {scanError ? (
                <p className="admin-status admin-status--error" role="alert">
                  {scanError}
                </p>
              ) : null}
            </>
          )}
        </div>
      )}
    </AdminModal>
  );
}
