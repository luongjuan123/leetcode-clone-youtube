import { withApiErrorHandler } from "@/utils/apiErrorHandler";
import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminFirestore } from "@/firebase/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { runCode } from "./run";

async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method !== "POST") {
		return res.status(405).json({ success: false, error: "Method not allowed" });
	}

	const {
		uid,
		username,
		problemId,
		problemTitle,
		userCode,
		language,
		contestId,
		submissionId
	} = req.body;

	if (!uid || !problemId || !userCode || !language) {
		return res.status(400).json({ success: false, error: "Missing required fields" });
	}

	try {
		const db = getAdminFirestore();

		// 1. Create or use pre-created submission document with status
		const submissionCollection = contestId ? "contest_submissions" : "submissions";
		let docRef: any;
		if (submissionId) {
			docRef = db.collection(submissionCollection).doc(submissionId);
			await docRef.set({
				uid,
				username: username || "User",
				problemId,
				problemTitle: problemTitle || "",
				code: userCode,
				language,
				status: "queued",
				verdict: "Pending",
				score: 0,
				timestamp: Date.now(),
				testResults: [],
				...(contestId ? { contestId } : {})
			}, { merge: true });
		} else {
			docRef = await db.collection(submissionCollection).add({
				uid,
				username: username || "User",
				problemId,
				problemTitle: problemTitle || "",
				code: userCode,
				language,
				status: "pending",
				verdict: "Pending",
				score: 0,
				timestamp: Date.now(),
				testResults: [],
				...(contestId ? { contestId } : {})
			});
		}

		// 2. Process the submission inline so serverless environments don't kill the thread
		try {
			// Fetch problem details for testcases
			const problemDoc = await db.collection("problems").doc(problemId).get();
			if (!problemDoc.exists) {
				console.error(`Problem ${problemId} not found in background execution.`);
				await docRef.update({
					status: "failed",
					verdict: "Problem Not Found",
					timestamp: Date.now()
				});
				return res.status(404).json({ success: false, error: "Problem not found" });
			}

			const problemData = problemDoc.data()!;
			const testcases = problemData.examples || [];
			
			// Determine points
			let points = problemData.points || 100;
			if (contestId) {
				const cpSnap = await db.collection("contest_problems").doc(`${contestId}_${problemId}`).get();
				if (cpSnap.exists) {
					points = cpSnap.data()!.points || 100;
				}
			}

			// Run code execution with progress updates
			const executionResult = await runCode(problemId, userCode, language, testcases, false, async (stage, progress) => {
				await docRef.update({
					status: stage,
					...(progress ? { progress } : {})
				}).catch((e: any) => console.error("Error updating progress:", e));
			});

			let score = 0;
			let status = "failed";
			let verdictStr = "";

			const pCount = executionResult.passedCount ?? 0;
			const tCount = executionResult.totalCount ?? testcases.length;
			const results = executionResult.testResults || [];

			if (executionResult.success) {
				status = "passed";
				score = points;
				verdictStr = "Accepted";
			} else {
				status = "failed";
				score = Math.round((pCount / (tCount || 1)) * points);
				verdictStr = executionResult.isCompileError ? "Compilation Error" : (executionResult.error || "Wrong Answer");
			}

			// Update submission document with final results
			await docRef.update({
				status,
				score,
				verdict: verdictStr,
				testResults: results,
				timestamp: Date.now(),
				runtime: executionResult.runtime || 0,
				memory: executionResult.memory || 0
			});

			// Update user/problem solve status
			if (executionResult.success) {
				// Get user doc to check if problem was already solved
				const userRef = db.collection("users").doc(uid);
				const userSnap = await userRef.get();
				const userData = userSnap.data() || {};
				const solvedList: string[] = userData.solvedProblems || [];

				if (!solvedList.includes(problemId)) {
					// Fetch problem difficulty
					const problemSnap = await db.collection("problems").doc(problemId).get();
					const difficulty = (problemSnap.data()?.difficulty || "Easy").toLowerCase();

					let points = 1;
					let diffField = "easyCount";
					if (difficulty === "medium") {
						points = 3;
						diffField = "mediumCount";
					} else if (difficulty === "hard") {
						points = 5;
						diffField = "hardCount";
					}

					// Update user solvedProblems, solve counts, score and XP
					await userRef.update({
						solvedProblems: FieldValue.arrayUnion(problemId),
						[diffField]: FieldValue.increment(1),
						score: FieldValue.increment(points),
						xp: FieldValue.increment(points * 10)
					}).catch(err => console.error("Error updating user stats:", err));
				}

				if (!contestId) {
					// Update global problem stats
					await db.collection("problems").doc(problemId).update({
						solved: FieldValue.increment(1),
						attempts: FieldValue.increment(1)
					}).catch(err => console.error("Error updating problem stats:", err));
				}
			} else {
				if (!contestId) {
					// Update global problem attempts stat
					await db.collection("problems").doc(problemId).update({
						attempts: FieldValue.increment(1)
					}).catch(err => console.error("Error updating problem attempts:", err));
				}
			}
		} catch (backgroundErr) {
			console.error("Error running submission execution:", backgroundErr);
			await docRef.update({
				status: "failed",
				verdict: "Internal Error",
				timestamp: Date.now()
			});
		}

		// 3. Return the response to the client
		res.status(200).json({ success: true, submissionId: docRef.id });

	} catch (err: any) {
		console.error("Submission trigger error:", err);
		return res.status(500).json({ success: false, error: err.message });
	}
}

export default withApiErrorHandler(handler);
