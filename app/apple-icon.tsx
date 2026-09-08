import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#03141C",
      }}
    >
      <div
        style={{
          width: 108,
          height: 108,
          borderRadius: 22,
          background: "#4CC7B6",
        }}
      />
    </div>,
    { ...size },
  );
}
