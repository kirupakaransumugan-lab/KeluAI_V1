// A photo or screenshot attached to a tutor message. Phone photos are 3-12 MB, so they are
// shrunk here before sending: a full copy for the model (long side 1600 px, enough to read
// handwriting) and a small thumbnail kept in the chat history (localStorage holds ~5 MB).

export const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_INPUT_BYTES = 15 * 1024 * 1024;
const FULL_SIDE = 1600;
const THUMB_SIDE = 360;

export interface Attachment {
  full: string;      // data URL sent with the message (never stored)
  thumb: string;     // data URL shown in the bubble and kept with the chat
  name: string;
}

export class AttachError extends Error {
  constructor(public code: "bad_image" | "image_too_large") {
    super(code);
  }
}

async function decode(file: File): Promise<CanvasImageSource & { width: number; height: number }> {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });   // honours EXIF rotation
    } catch {
      /* fall through: older Safari can't decode some files this way */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function render(src: CanvasImageSource & { width: number; height: number }, side: number, quality: number): string {
  const scale = Math.min(1, side / Math.max(src.width, src.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(src.width * scale));
  canvas.height = Math.max(1, Math.round(src.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new AttachError("bad_image");
  ctx.fillStyle = "#fff";                              // transparent PNGs: white paper, not black
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

export async function prepareImage(file: File): Promise<Attachment> {
  if (!ACCEPTED.includes(file.type)) throw new AttachError("bad_image");
  if (file.size > MAX_INPUT_BYTES) throw new AttachError("image_too_large");
  let img;
  try {
    img = await decode(file);
  } catch {
    throw new AttachError("bad_image");
  }
  return { full: render(img, FULL_SIDE, 0.85), thumb: render(img, THUMB_SIDE, 0.7), name: file.name || "image" };
}

/** The first image in a paste or drop, if any. */
export function imageFrom(items: DataTransferItemList | null | undefined): File | null {
  for (const it of Array.from(items ?? [])) {
    if (it.kind === "file" && it.type.startsWith("image/")) return it.getAsFile();
  }
  return null;
}
