import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyCors } from "./_emailHelper.js";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  return res.status(200).json({ success: true, logoUrl: "/system_logo.png" });
}
