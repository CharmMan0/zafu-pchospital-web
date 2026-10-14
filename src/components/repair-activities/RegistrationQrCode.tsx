"use client";

import { useEffect, useRef } from "react";
import QRCode from "qrcode";

import { siteConfig } from "@/config/site";

/** 预约二维码内容（issue #126）：签到落地链接，令牌由服务端 HMAC 签发。 */
export function checkInQrValue(token: string): string {
  return `${siteConfig.url}/checkin/${token}`;
}

/**
 * 预约二维码（issue #126）：报名成功与手机号查询时实时渲染，不落盘、不存服务器。
 * canvas 取色不走语义令牌 —— 二维码需要固定高对比度才能被扫识别，与站点主题无关。
 */
export function RegistrationQrCode({ token, size = 200 }: { token: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    QRCode.toCanvas(canvas, checkInQrValue(token), {
      width: size,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#000000", light: "#ffffff" },
    }).catch(() => {
      // 渲染失败时保留空 canvas，外层提示性文案已引导用户用手机号现场查询兜底。
    });
  }, [token, size]);

  return (
    <span className="activity-qr">
      <canvas ref={canvasRef} role="img" aria-label="活动签到二维码" />
    </span>
  );
}
