import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyCors, DEFAULT_APP_URL } from "./_emailHelper";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  return res.status(200).json({ status: "ok", domain: DEFAULT_APP_URL });
}
