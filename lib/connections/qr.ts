import QRCode from "qrcode";

export async function qrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    margin: 1,
    width: 168,
    color: { dark: "#03141c", light: "#f5f7f8" },
  });
}
