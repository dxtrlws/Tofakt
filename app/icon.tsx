import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
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
          width: 20,
          height: 20,
          borderRadius: 4,
          background: "#4CC7B6",
        }}
      />
    </div>,
    { ...size },
  );
}
