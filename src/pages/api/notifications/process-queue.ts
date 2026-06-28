import { withApiErrorHandler } from "@/utils/apiErrorHandler";
import type { NextApiRequest, NextApiResponse } from "next";
import { EmailService } from "@/utils/emailService";

async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method !== "POST" && req.method !== "GET") {
		return res.status(405).json({ success: false, message: "Method Not Allowed" });
	}

	try {
		const result = await EmailService.processQueue();
		return res.status(200).json({
			success: true,
			processedCount: result.processedCount,
			totalDurationMs: result.durationMs,
			details: result.details
		});
	} catch (error: any) {
		console.error("[Email Queue Processor Crash]:", error);
		return res.status(500).json({ success: false, message: error.message || "Queue processing error" });
	}
}

export default withApiErrorHandler(handler);
