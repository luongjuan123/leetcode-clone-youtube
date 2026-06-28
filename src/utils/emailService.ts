import { getAdminFirestore } from "@/firebase/firebaseAdmin";
import nodemailer from "nodemailer";
import { logNotificationSent } from "./notificationService";

export interface QueueItem {
	id: string;
	toEmail: string;
	toUid: string;
	category: string;
	eventType: string;
	subject: string;
	emailHtml: string;
	status: "pending" | "processing" | "sent" | "failed";
	retryCount: number;
	nextRetryAt: number;
	createdAt: number;
	eventId: string;
	metadata?: any;
}

export class EmailService {
	private static transporter: nodemailer.Transporter | null = null;
	private static mailFrom: string = "";

	/**
	 * Configures SMTP transporter or fallback to Ethereal account
	 */
	public static async getTransporter(): Promise<{ transporter: nodemailer.Transporter | null; mailFrom: string }> {
		if (this.transporter) {
			return { transporter: this.transporter, mailFrom: this.mailFrom };
		}

		const smtpHost = process.env.SMTP_HOST;
		const smtpPort = parseInt(process.env.SMTP_PORT || "587");
		const smtpUser = process.env.SMTP_USER;
		const smtpPass = process.env.SMTP_PASS;
		const smtpFrom = process.env.SMTP_FROM || '"BeastCode System" <system@beastcode.codes>';

		if (smtpHost && smtpUser && smtpPass) {
			this.transporter = nodemailer.createTransport({
				host: smtpHost,
				port: smtpPort,
				secure: smtpPort === 465,
				auth: { user: smtpUser, pass: smtpPass }
			});
			this.mailFrom = '"BeastCode" <bomemebo6996@gmail.com>';
		} else {
			// fallback: Create a dummy test SMTP account (Ethereal Email) with a 3-second timeout
			try {
				const testAccountPromise = nodemailer.createTestAccount();
				const timeoutPromise = new Promise<never>((_, reject) =>
					setTimeout(() => reject(new Error("Timeout establishing connection to Ethereal SMTP service")), 3000)
				);
				const testAccount = await Promise.race([testAccountPromise, timeoutPromise]);
				this.transporter = nodemailer.createTransport({
					host: "smtp.ethereal.email",
					port: 587,
					secure: false,
					auth: {
						user: testAccount.user,
						pass: testAccount.pass
					}
				});
				this.mailFrom = `"BeastCode Test Account" <${testAccount.user}>`;
				console.log(`[EmailService] Configured Ethereal SMTP with user: ${testAccount.user}`);
			} catch (etherealErr: any) {
				console.warn("[EmailService Warn] Ethereal SMTP setup failed or timed out:", etherealErr.message);
				this.transporter = null;
				this.mailFrom = '"BeastCode Local Failsafe" <failsafe@beastcode.codes>';
			}
		}

		return { transporter: this.transporter, mailFrom: this.mailFrom };
	}

	/**
	 * Main queue processor. Fetches active items from emailQueue, delivers them,
	 * updates status, schedules retries, and logs statistics.
	 */
	public static async processQueue(): Promise<{ processedCount: number; durationMs: number; details: any[] }> {
		const startTime = Date.now();
		const db = getAdminFirestore();

		// Fetch pending and failed queue items (split queries to avoid composite index requirement)
		const [pendingSnap, failedSnap] = await Promise.all([
			db.collection("emailQueue")
				.where("status", "==", "pending")
				.get(),
			db.collection("emailQueue")
				.where("status", "==", "failed")
				.get()
		]);

		const now = Date.now();
		const allDocs = [...pendingSnap.docs, ...failedSnap.docs];

		const items: QueueItem[] = allDocs
			.map(doc => ({
				id: doc.id,
				...doc.data()
			}) as QueueItem)
			.filter(item => item.nextRetryAt <= now)
			.sort((a, b) => a.nextRetryAt - b.nextRetryAt)
			.slice(0, 10);

		if (items.length === 0) {
			return { processedCount: 0, durationMs: Date.now() - startTime, details: [] };
		}

		// Filter items to ensure they haven't exceeded retry limit (5 retries max)
		const activeItems = items.filter(item => item.retryCount < 5);

		if (activeItems.length === 0) {
			return { processedCount: 0, durationMs: Date.now() - startTime, details: [] };
		}

		const { transporter, mailFrom } = await this.getTransporter();
		const results: any[] = [];

		for (const item of activeItems) {
			const itemRef = db.collection("emailQueue").doc(item.id);
			
			// Mark item as processing to prevent race conditions
			await itemRef.update({ status: "processing" });

			const processStart = Date.now();
			let success = false;
			let errorMsg = "";
			let testPreviewUrl = "";

			if (transporter) {
				try {
					const info = await transporter.sendMail({
						from: mailFrom,
						to: item.toEmail,
						subject: item.subject,
						html: item.emailHtml
					});

					success = true;
					// Ethereal SMTP helper for local dev preview
					if (mailFrom.includes("ethereal.email")) {
						testPreviewUrl = nodemailer.getTestMessageUrl(info) || "";
					}
				} catch (sendErr: any) {
					errorMsg = sendErr.message || "Failed to send email via SMTP transporter.";
					console.error(`[EmailService Queue Failure] Failed to send to ${item.toEmail}:`, sendErr);
				}
			} else {
				errorMsg = "No SMTP transporter or test account available.";
			}

			// If SMTP fails, write to the classic 'mail' collection as a secondary failsafe trigger!
			if (!success) {
				try {
					await db.collection("mail").add({
						to: item.toEmail,
						message: {
							subject: item.subject,
							html: item.emailHtml
						},
						queuedAt: Date.now(),
						sourceQueueTaskId: item.id
					});
					console.log(`[EmailService Failsafe] Queued fallback document for user ${item.toEmail} in 'mail' collection.`);
				} catch (mailFsErr: any) {
					console.error("[EmailService Failsafe Error] Failed to write fallback mail document:", mailFsErr);
				}
			}

			const duration = Date.now() - processStart;

			if (success) {
				await itemRef.update({
					status: "sent",
					sentAt: Date.now(),
					deliveryDurationMs: duration,
					previewUrl: testPreviewUrl || null,
					error: null
				});

				// Log to duplicates / limits collection
				await logNotificationSent(item.toEmail, item.category, item.eventId);

				// Record stats transactionally
				const statsRef = db.collection("emailStats").doc("analytics");
				try {
					await db.runTransaction(async (transaction) => {
						const docSnap = await transaction.get(statsRef);
						if (!docSnap.exists) {
							transaction.set(statsRef, {
								sentCount: 1,
								failedCount: 0,
								totalDurationMs: duration,
								averageDurationMs: duration
							});
						} else {
							const data = docSnap.data() || {};
							const newSent = (data.sentCount || 0) + 1;
							const newTotalDuration = (data.totalDurationMs || 0) + duration;
							transaction.update(statsRef, {
								sentCount: newSent,
								totalDurationMs: newTotalDuration,
								averageDurationMs: Math.round(newTotalDuration / newSent)
							});
						}
					});
				} catch (statsErr) {
					console.warn("[EmailService Stats Warn] Failed to update analytics:", statsErr);
				}

				results.push({
					id: item.id,
					recipient: item.toEmail,
					status: "sent",
					previewUrl: testPreviewUrl || undefined
				});
			} else {
				const nextCount = item.retryCount + 1;
				// Exponential backoff: retry in 2^nextCount minutes
				const backoffMinutes = Math.pow(2, nextCount);
				const nextRetryAt = Date.now() + backoffMinutes * 60 * 1000;

				await itemRef.update({
					status: "failed",
					retryCount: nextCount,
					nextRetryAt,
					error: errorMsg
				});

				// Record failed stats transactionally
				const statsRef = db.collection("emailStats").doc("analytics");
				try {
					await db.runTransaction(async (transaction) => {
						const docSnap = await transaction.get(statsRef);
						if (!docSnap.exists) {
							transaction.set(statsRef, {
								sentCount: 0,
								failedCount: 1,
								totalDurationMs: 0,
								averageDurationMs: 0
							});
						} else {
							const data = docSnap.data() || {};
							transaction.update(statsRef, {
								failedCount: (data.failedCount || 0) + 1
							});
						}
					});
				} catch (statsErr) {
					console.warn("[EmailService Stats Warn] Failed to update analytics for failure:", statsErr);
				}

				results.push({
					id: item.id,
					recipient: item.toEmail,
					status: "failed",
					retryCount: nextCount,
					nextRetryAt: new Date(nextRetryAt).toLocaleString(),
					error: errorMsg
				});
			}
		}

		return {
			processedCount: activeItems.length,
			durationMs: Date.now() - startTime,
			details: results
		};
	}

	/**
	 * Sends an email directly and synchronously. Falls back to classic firestore 'mail' collection if SMTP is not ready.
	 */
	public static async sendDirectEmail(to: string, subject: string, html: string): Promise<boolean> {
		const { transporter, mailFrom } = await this.getTransporter();
		if (!transporter) {
			console.warn("[EmailService Direct Send Warn] No transporter available. Writing fallback document to 'mail' collection.");
			try {
				const db = getAdminFirestore();
				await db.collection("mail").add({
					to,
					message: {
						subject,
						html
					},
					queuedAt: Date.now()
				});
				return true;
			} catch (err) {
				console.error("[EmailService Direct Send Fallback Error] Failed to write fallback mail document:", err);
				return false;
			}
		}

		try {
			const info = await transporter.sendMail({
				from: mailFrom,
				to,
				subject,
				html
			});
			if (mailFrom.includes("ethereal.email")) {
				console.log(`[EmailService] Sent direct Ethereal test message preview: ${nodemailer.getTestMessageUrl(info)}`);
			} else {
				console.log(`[EmailService] Sent direct email successfully to: ${to}`);
			}
			return true;
		} catch (sendErr: any) {
			console.error(`[EmailService Direct Send Error] SMTP failed to send to ${to}. Retrying via 'mail' fallback collection:`, sendErr.message);
			try {
				const db = getAdminFirestore();
				await db.collection("mail").add({
					to,
					message: {
						subject,
						html
					},
					queuedAt: Date.now()
				});
				return true;
			} catch (fallbackErr) {
				console.error("[EmailService Direct Send Fallback Error] Failed to write fallback mail document after SMTP exception:", fallbackErr);
				return false;
			}
		}
	}
}
