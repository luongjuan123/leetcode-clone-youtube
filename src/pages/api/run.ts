import { withApiErrorHandler } from "@/utils/apiErrorHandler";
import type { NextApiRequest, NextApiResponse } from "next";
import { exec, spawn, execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { getAdminFirestore } from "@/firebase/firebaseAdmin";
import { getEffectiveLimits, ExecutionProfileSettings } from "@/utils/executionProfiles";

function checkLocalCommand(cmd: string): boolean {
	try {
		execSync(`which ${cmd}`, { stdio: "ignore" });
		return true;
	} catch {
		return false;
	}
}

async function runWithJudge0(
	sourceCode: string,
	language: SupportedLanguage,
	stdin: string,
	limits: ExecutionProfileSettings
): Promise<{ stdout: string; stderr: string; code: number | null; timedOut: boolean; memoryLimitExceeded?: boolean; outputLimitExceeded?: boolean; compileError?: boolean }> {
	const langMap: Record<SupportedLanguage, number> = {
		javascript: 102,
		python: 31, // Python for ML (3.12.5) with NumPy
		cpp: 105,
		java: 91,
		c: 103
	};

	try {
		const host = language === "python" 
			? "https://extra-ce.judge0.com"
			: "https://ce.judge0.com";

		const endpoint = `${host}/submissions`;

		let res = await fetch(endpoint, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				language_id: langMap[language],
				source_code: sourceCode,
				stdin: stdin,
				cpu_time_limit: limits.timeoutMs / 1000,
				memory_limit: limits.memoryLimitMb * 1024
			})
		});

		if (res.status === 422) {
			// Fallback: Retry without limits if the public instance rejected our custom limits
			res = await fetch(endpoint, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					language_id: langMap[language],
					source_code: sourceCode,
					stdin: stdin
				})
			});
		}

		if (!res.ok) {
			const errBody = await res.text().catch(() => "");
			return { stdout: "", stderr: `Judge0 returned status ${res.status}: ${errBody}`, code: -1, timedOut: false };
		}

		const submitData = await res.json();
		const token = submitData.token;
		if (!token) {
			return { stdout: "", stderr: `Judge0 returned status ${res.status} but no token`, code: -1, timedOut: false };
		}

		// Poll status
		let data: any = null;
		let statusId = 1;
		const maxPolls = 60; // Up to 30 seconds with 500ms intervals
		let polls = 0;

		while (polls < maxPolls) {
			await new Promise((resolve) => setTimeout(resolve, 500));
			polls++;

			const pollRes = await fetch(`${host}/submissions/${token}`);
			if (!pollRes.ok) {
				const errBody = await pollRes.text().catch(() => "");
				return { stdout: "", stderr: `Judge0 status check failed (status ${pollRes.status}): ${errBody}`, code: -1, timedOut: false };
			}

			data = await pollRes.json();
			statusId = data.status?.id;

			// statusId 1: In Queue, statusId 2: Processing
			if (statusId === 1 || statusId === 2) {
				continue;
			}

			// Finished processing
			break;
		}

		if (!data || statusId === 1 || statusId === 2) {
			return { stdout: "", stderr: `Execution timed out waiting for Judge0 status update.`, code: -1, timedOut: true };
		}

		if (statusId === 6) {
			return {
				stdout: "",
				stderr: data.compile_output || data.stderr || "Compilation Error",
				code: 1,
				timedOut: false,
				compileError: true
			};
		}

		if (statusId === 5) {
			return {
				stdout: "",
				stderr: "Time Limit Exceeded",
				code: -1,
				timedOut: true
			};
		}

		if (statusId === 12) {
			return {
				stdout: "",
				stderr: "Memory Limit Exceeded",
				code: -1,
				timedOut: false,
				memoryLimitExceeded: true
			};
		}

		if (statusId === 7) {
			return {
				stdout: "",
				stderr: "Output Limit Exceeded",
				code: -1,
				timedOut: false,
				outputLimitExceeded: true
			};
		}

		const stdout = data.stdout || "";
		const stderr = data.stderr || "";
		const code = (statusId === 3 || statusId === 4) ? 0 : (statusId || -1);

		return {
			stdout,
			stderr,
			code,
			timedOut: false
		};
	} catch (err: any) {
		console.error("Judge0 API execution error:", err);
		return { stdout: "", stderr: `Remote execution fallback error: ${err.message}`, code: -1, timedOut: false };
	}
}

async function runBatchWithJudge0(
	sourceCode: string,
	language: SupportedLanguage,
	stdins: string[],
	limits: ExecutionProfileSettings,
	onStatusUpdate?: (stage: string, progress?: { current: number; total: number }) => void
): Promise<{ stdout: string; stderr: string; code: number | null; timedOut: boolean; memoryLimitExceeded?: boolean; outputLimitExceeded?: boolean; compileError?: boolean }[]> {
	const langMap: Record<SupportedLanguage, number> = {
		javascript: 102,
		python: 31, // Python for ML (3.12.5) with NumPy
		cpp: 105,
		java: 91,
		c: 103
	};

	try {
		const host = language === "python" 
			? "https://extra-ce.judge0.com"
			: "https://ce.judge0.com";

		const endpoint = `${host}/submissions/batch`;
		const CHUNK_SIZE = 20;

		// Chunk stdins for submissions
		const chunks: string[][] = [];
		for (let i = 0; i < stdins.length; i += CHUNK_SIZE) {
			chunks.push(stdins.slice(i, i + CHUNK_SIZE));
		}

		const submitChunk = async (chunk: string[], useLimits: boolean): Promise<string[]> => {
			const submissions = chunk.map(stdin => ({
				language_id: langMap[language],
				source_code: sourceCode,
				stdin: stdin,
				...(useLimits ? {
					cpu_time_limit: limits.timeoutMs / 1000,
					memory_limit: limits.memoryLimitMb * 1024
				} : {})
			}));

			const res = await fetch(endpoint, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ submissions })
			});

			if (!res.ok) {
				const errBody = await res.text().catch(() => "");
				throw { status: res.status, message: errBody };
			}

			const submitData = await res.json();
			if (!Array.isArray(submitData) || submitData.length === 0) {
				throw new Error(`Invalid batch response format from Judge0`);
			}

			return submitData.map((s: any) => s.token);
		};

		// Submit all chunks in parallel
		const tokenChunks = await Promise.all(
			chunks.map(chunk => {
				return (async () => {
					try {
						return await submitChunk(chunk, true);
					} catch (err: any) {
						if (err && err.status === 422) {
							// Fallback: retry this chunk without limits
							return await submitChunk(chunk, false);
						}
						throw new Error(err?.message || `Judge0 batch submission failed (status ${err?.status})`);
					}
				})();
			})
		);

		const allTokens = tokenChunks.flat();

		// Chunk tokens for polling
		const tokenChunksForPolling: string[][] = [];
		for (let i = 0; i < allTokens.length; i += CHUNK_SIZE) {
			tokenChunksForPolling.push(allTokens.slice(i, i + CHUNK_SIZE));
		}

		// Poll status
		let dataSubmissions: any[] = [];
		const maxPolls = 60; // Up to 30 seconds with 500ms intervals
		let polls = 0;

		while (polls < maxPolls) {
			await new Promise((resolve) => setTimeout(resolve, 500));
			polls++;

			// Poll all token chunks in parallel
			const pollResults = await Promise.all(
				tokenChunksForPolling.map(async (tokenChunk) => {
					const tokensStr = tokenChunk.join(",");
					const pollRes = await fetch(`${host}/submissions/batch?tokens=${tokensStr}&fields=status,stdout,stderr,compile_output,time,memory`);
					if (!pollRes.ok) {
						const errBody = await pollRes.text().catch(() => "");
						throw new Error(`Judge0 batch status check failed (status ${pollRes.status}): ${errBody}`);
					}
					const resJson = await pollRes.json();
					return resJson.submissions || [];
				})
			);

			dataSubmissions = pollResults.flat();
			
			const finishedCount = dataSubmissions.filter((s: any) => s.status?.id > 2).length;
			onStatusUpdate?.("running", { current: finishedCount, total: allTokens.length });

			// Check if all submissions have finished (status.id > 2)
			const allFinished = dataSubmissions.every((s: any) => s.status?.id > 2);
			if (allFinished) {
				break;
			}
		}

		// Check if we retrieved the correct number of submissions
		if (dataSubmissions.length !== allTokens.length) {
			throw new Error(`Execution timed out waiting for all Judge0 status updates.`);
		}

		return dataSubmissions.map((sub: any) => {
			const statusId = sub.status?.id;
			if (statusId === 6) {
				return {
					stdout: "",
					stderr: sub.compile_output || sub.stderr || "Compilation Error",
					code: 1,
					timedOut: false,
					compileError: true
				};
			}

			if (statusId === 5) {
				return {
					stdout: "",
					stderr: "Time Limit Exceeded",
					code: -1,
					timedOut: true
				};
			}

			if (statusId === 12) {
				return {
					stdout: "",
					stderr: "Memory Limit Exceeded",
					code: -1,
					timedOut: false,
					memoryLimitExceeded: true
				};
			}

			if (statusId === 7) {
				return {
					stdout: "",
					stderr: "Output Limit Exceeded",
					code: -1,
					timedOut: false,
					outputLimitExceeded: true
				};
			}

			const stdout = sub.stdout || "";
			const stderr = sub.stderr || "";
			const code = (statusId === 3 || statusId === 4) ? 0 : (statusId || -1);

			return {
				stdout,
				stderr,
				code,
				timedOut: false,
				time: parseFloat(sub.time) || 0,
				memory: parseFloat(sub.memory) || 0
			};
		});

	} catch (err: any) {
		console.error("Judge0 API batch execution error:", err);
		throw err;
	}
}

type SupportedLanguage = "javascript" | "python" | "cpp" | "java" | "c";

interface TestCaseResult {
	passed: boolean;
	input: string;
	expected: string;
	actual: string;
	error?: string;
}

interface RunResponse {
	success: boolean;
	isCompileError?: boolean;
	passedCount?: number;
	totalCount?: number;
	testResults?: TestCaseResult[];
	failedCaseIndex?: number;
	input?: string;
	expected?: string;
	actual?: string;
	error?: string;
	runtime?: number;
	memory?: number;
}

function runCommandWithStdin(
	command: string,
	args: string[],
	stdinData: string,
	limits: ExecutionProfileSettings
): Promise<{ stdout: string; stderr: string; code: number | null; timedOut: boolean; memoryLimitExceeded: boolean; outputLimitExceeded: boolean }> {
	return new Promise((resolve) => {
		const timeoutMs = limits.timeoutMs;
		const memoryLimitBytes = limits.memoryLimitMb * 1024 * 1024;
		const maxOutputSize = limits.maxOutputSizeChars;

		const child = spawn(command, args, { timeout: timeoutMs });

		let stdout = "";
		let stderr = "";
		let timedOut = false;
		let memoryLimitExceeded = false;
		let outputLimitExceeded = false;

		const timer = setTimeout(() => {
			timedOut = true;
			child.kill("SIGKILL");
		}, timeoutMs);

		// Memory limit checking via polling
		const memoryPollInterval = setInterval(() => {
			if (child.pid) {
				try {
					const statmPath = `/proc/${child.pid}/statm`;
					if (fs.existsSync(statmPath)) {
						const statm = fs.readFileSync(statmPath, "utf8");
						const parts = statm.split(/\s+/);
						const residentPages = parseInt(parts[1], 10);
						const rssBytes = residentPages * 4096;
						if (rssBytes > memoryLimitBytes) {
							memoryLimitExceeded = true;
							child.kill("SIGKILL");
						}
					}
				} catch (e) {
					// Process might have exited
				}
			}
		}, 50);

		child.stdout.on("data", (data) => {
			const chunk = data.toString();
			stdout += chunk;
			if (stdout.length > maxOutputSize) {
				outputLimitExceeded = true;
				child.kill("SIGKILL");
			}
		});

		child.stderr.on("data", (data) => {
			const chunk = data.toString();
			stderr += chunk;
			if (stdout.length + stderr.length > maxOutputSize) {
				outputLimitExceeded = true;
				child.kill("SIGKILL");
			}
		});

		const finish = (code: number | null) => {
			clearTimeout(timer);
			clearInterval(memoryPollInterval);
			resolve({ stdout, stderr, code, timedOut, memoryLimitExceeded, outputLimitExceeded });
		};

		child.on("error", (err) => {
			finish(-1);
		});

		child.on("close", (code) => {
			finish(code);
		});

		if (child.stdin) {
			child.stdin.write(stdinData);
			child.stdin.end();
		}
	});
}

function cleanOutput(str: string): string {
	return str
		.replace(/\r/g, "")
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line !== "")
		.join("\n")
		.trim();
}

export async function runCode(
	problemId: string,
	userCode: string,
	language: SupportedLanguage,
	testcases: any[],
	isCustomInput?: boolean,
	onStatusUpdate?: (stage: string, progress?: { current: number; total: number }) => void
): Promise<RunResponse> {
	let customChecker: any = null;
	let executionProfile: string | undefined = "normal";
	let customLimits: any = {};

	if (problemId) {
		try {
			const db = getAdminFirestore();
			const problemDoc = await db.collection("problems").doc(problemId).get();
			if (problemDoc.exists) {
				const data = problemDoc.data();
				customChecker = data?.customChecker;
				executionProfile = data?.executionProfile || "normal";
				customLimits = {
					timeoutMs: data?.customTimeoutMs,
					memoryLimitMb: data?.customMemoryLimitMb,
					maxOutputSizeChars: data?.customMaxOutputSizeChars,
					cpuCount: data?.customCpuCount,
					diskLimitMb: data?.customDiskLimitMb,
					processLimit: data?.customProcessLimit,
				};
			}
		} catch (dbErr) {
			console.error("Error fetching problem customChecker:", dbErr);
		}
	}

	const limits = getEffectiveLimits(executionProfile as any, customLimits);

	if (!userCode || !language || !testcases || !Array.isArray(testcases)) {
		return { success: false, error: "Missing required fields" };
	}

	let useRemote = false;
	if (language === "python" && !checkLocalCommand("python3")) {
		useRemote = true;
	} else if (language === "cpp" && !checkLocalCommand("g++")) {
		useRemote = true;
	} else if (language === "c" && !checkLocalCommand("gcc")) {
		useRemote = true;
	} else if (language === "java" && !checkLocalCommand("javac")) {
		useRemote = true;
	}

	if (useRemote) {
		try {
			onStatusUpdate?.("queued");
			const stdins = testcases.map(tc => tc.inputText || "");
			const executions = await runBatchWithJudge0(userCode, language, stdins, limits, onStatusUpdate);

			const testResults: { passed: boolean; input: string; expected: string; actual: string; error?: string }[] = [];
			let firstFailure: { index: number; input: string; expected: string; actual: string } | null = null;
			let maxRuntime = 0;
			let maxMemory = 0;

			onStatusUpdate?.("evaluating");
			for (let i = 0; i < testcases.length; i++) {
				const tc = testcases[i];
				const inputData = tc.inputText || "";
				const expectedOutput = cleanOutput(tc.outputText || "");
				const execution = executions[i];

				if (execution) {
					const runMs = ((execution as any).time || 0) * 1000;
					const memKb = ((execution as any).memory || 0);
					if (runMs > maxRuntime) maxRuntime = runMs;
					if (memKb > maxMemory) maxMemory = memKb;
				}

				if (!execution) {
					return {
						success: false,
						error: `Remote execution fallback error: execution result missing for testcase ${i + 1}`
					};
				}

				if (execution.compileError) {
					return {
						success: false,
						isCompileError: true,
						error: execution.stderr
					};
				}

				if (execution.timedOut) {
					return {
						success: false,
						failedCaseIndex: i + 1,
						input: inputData,
						expected: expectedOutput,
						actual: "Time Limit Exceeded",
						error: `Time Limit Exceeded (${limits.timeoutMs}ms)`
					};
				}

				if (execution.memoryLimitExceeded) {
					return {
						success: false,
						failedCaseIndex: i + 1,
						input: inputData,
						expected: expectedOutput,
						actual: "Memory Limit Exceeded",
						error: `Memory Limit Exceeded (${limits.memoryLimitMb}MB)`
					};
				}

				if (execution.outputLimitExceeded) {
					return {
						success: false,
						failedCaseIndex: i + 1,
						input: inputData,
						expected: expectedOutput,
						actual: "Output Limit Exceeded",
						error: `Output Limit Exceeded (${limits.maxOutputSizeChars} chars)`
					};
				}

				if (execution.code !== 0 && execution.code !== null) {
					return {
						success: false,
						failedCaseIndex: i + 1,
						input: inputData,
						expected: expectedOutput,
						actual: execution.stdout,
						error: execution.stderr || `Runtime Error (exit code ${execution.code})`
					};
				}

				const passed = isCustomInput ? true : checkVerdict(execution.stdout, tc.outputText || "", customChecker, inputData);

				testResults.push({
					passed,
					input: inputData,
					expected: expectedOutput,
					actual: execution.stdout.trim() || "",
				});

				if (!passed && firstFailure === null) {
					firstFailure = {
						index: i + 1,
						input: inputData,
						expected: expectedOutput,
						actual: execution.stdout.trim(),
					};
				}
			}

			const passedCount = testResults.filter((r) => r.passed).length;
			const totalCount = testResults.length;
			const allPassed = passedCount === totalCount;

			if (allPassed) {
				return { success: true, passedCount, totalCount, testResults, runtime: maxRuntime, memory: maxMemory };
			} else {
				return {
					success: false,
					passedCount,
					totalCount,
					testResults,
					failedCaseIndex: firstFailure?.index,
					input: firstFailure?.input,
					expected: firstFailure?.expected,
					actual: firstFailure?.actual,
					error: "Wrong Answer",
					runtime: maxRuntime,
					memory: maxMemory
				};
			}
		} catch (err: any) {
			return {
				success: false,
				error: `Remote execution fallback error: ${err.message}`
			};
		}
	}

	const tempDir = os.tmpdir();
	const uniqueId = Math.random().toString(36).substring(2, 10);

	let filename = "";
	let binaryPath = "";
	let javaSubdir = "";
	let isCompileRequired = false;
	let compileCommand = "";

	switch (language) {
		case "javascript":
			filename = `solution_${uniqueId}.js`;
			break;
		case "python":
			filename = `solution_${uniqueId}.py`;
			break;
		case "cpp":
			filename = `solution_${uniqueId}.cpp`;
			binaryPath = path.join(tempDir, `solution_${uniqueId}`);
			isCompileRequired = true;
			compileCommand = `g++ -O3 ${path.join(tempDir, filename)} -o ${binaryPath}`;
			break;
		case "c":
			filename = `solution_${uniqueId}.c`;
			binaryPath = path.join(tempDir, `solution_${uniqueId}`);
			isCompileRequired = true;
			compileCommand = `gcc -O3 ${path.join(tempDir, filename)} -o ${binaryPath}`;
			break;
		case "java":
			javaSubdir = path.join(tempDir, `java_${uniqueId}`);
			fs.mkdirSync(javaSubdir, { recursive: true });
			filename = path.join(`java_${uniqueId}`, "Main.java");
			isCompileRequired = true;
			compileCommand = `javac ${path.join(tempDir, filename)}`;
			break;
		default:
			return { success: false, error: "Unsupported language" };
	}

	const filePath = path.join(tempDir, filename);

	try {
		fs.writeFileSync(filePath, userCode);

		// Handle Compilation if required
		if (isCompileRequired) {
			onStatusUpdate?.("compiling");
			const compileResult = await new Promise<{ code: number | null; stderr: string }>((resolve) => {
				exec(compileCommand, (err, stdout, stderr) => {
					resolve({ code: err ? (err.code ?? 1) : 0, stderr: stderr || err?.message || "" });
				});
			});

			if (compileResult.code !== 0) {
				// Cleanup source files
				try {
					if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
					if (javaSubdir && fs.existsSync(javaSubdir)) {
						fs.rmSync(javaSubdir, { recursive: true, force: true });
					}
				} catch (cleanupErr) {
					console.error("Cleanup error:", cleanupErr);
				}

				return {
					success: false,
					isCompileError: true,
					error: compileResult.stderr.replace(new RegExp(tempDir, "g"), "temp")
				};
			}
		}

		// Run against each test case sequentially
		const testResults: { passed: boolean; input: string; expected: string; actual: string; error?: string }[] = [];
		let firstFailure: { index: number; input: string; expected: string; actual: string } | null = null;
		let maxRuntime = 0;
		let maxMemory = 0;

		for (let i = 0; i < testcases.length; i++) {
			onStatusUpdate?.("running", { current: i + 1, total: testcases.length });
			const tc = testcases[i];
			const inputData = tc.inputText || "";
			const expectedOutput = cleanOutput(tc.outputText || "");

			let runCmd = "";
			let runArgs: string[] = [];

			switch (language) {
				case "javascript":
					runCmd = "node";
					runArgs = [`--max-old-space-size=${limits.memoryLimitMb}`, filePath];
					break;
				case "python":
					runCmd = "python3";
					runArgs = [filePath];
					break;
				case "cpp":
				case "c":
					runCmd = binaryPath;
					runArgs = [];
					break;
				case "java":
					runCmd = "java";
					runArgs = [`-Xmx${limits.memoryLimitMb}m`, "-cp", javaSubdir, "Main"];
					break;
			}

			const localStartTime = Date.now();
			const execution = await runCommandWithStdin(runCmd, runArgs, inputData, limits);
			const localElapsed = Date.now() - localStartTime;
			if (localElapsed > maxRuntime) maxRuntime = localElapsed;
			const estimatedMemory = Math.round(limits.memoryLimitMb * 1024 * 0.12);
			if (estimatedMemory > maxMemory) maxMemory = estimatedMemory;

			if (execution.timedOut) {
				cleanupTempFiles(filePath, binaryPath, javaSubdir);
				return {
					success: false,
					failedCaseIndex: i + 1,
					input: inputData,
					expected: expectedOutput,
					actual: "Time Limit Exceeded",
					error: `Time Limit Exceeded (${limits.timeoutMs}ms)`
				};
			}

			if (execution.memoryLimitExceeded) {
				cleanupTempFiles(filePath, binaryPath, javaSubdir);
				return {
					success: false,
					failedCaseIndex: i + 1,
					input: inputData,
					expected: expectedOutput,
					actual: "Memory Limit Exceeded",
					error: `Memory Limit Exceeded (${limits.memoryLimitMb}MB)`
				};
			}

			if (execution.outputLimitExceeded) {
				cleanupTempFiles(filePath, binaryPath, javaSubdir);
				return {
					success: false,
					failedCaseIndex: i + 1,
					input: inputData,
					expected: expectedOutput,
					actual: "Output Limit Exceeded",
					error: `Output Limit Exceeded (${limits.maxOutputSizeChars} chars)`
				};
			}

			if (execution.code !== 0 && execution.code !== null) {
				cleanupTempFiles(filePath, binaryPath, javaSubdir);
				return {
					success: false,
					failedCaseIndex: i + 1,
					input: inputData,
					expected: expectedOutput,
					actual: execution.stdout,
					error: execution.stderr || `Runtime Error (exit code ${execution.code})`
				};
			}

			onStatusUpdate?.("evaluating");
			const passed = isCustomInput ? true : checkVerdict(execution.stdout, tc.outputText || "", customChecker, inputData);

			testResults.push({
				passed,
				input: inputData,
				expected: expectedOutput,
				actual: execution.stdout.trim() || "",
			});

			if (!passed && firstFailure === null) {
				firstFailure = {
					index: i + 1,
					input: inputData,
					expected: expectedOutput,
					actual: execution.stdout.trim(),
				};
			}
		}

		cleanupTempFiles(filePath, binaryPath, javaSubdir);

		const passedCount = testResults.filter((r) => r.passed).length;
		const totalCount = testResults.length;
		const allPassed = passedCount === totalCount;

		if (allPassed) {
			return { success: true, passedCount, totalCount, testResults, runtime: maxRuntime, memory: maxMemory };
		} else {
			return {
				success: false,
				passedCount,
				totalCount,
				testResults,
				failedCaseIndex: firstFailure?.index,
				input: firstFailure?.input,
				expected: firstFailure?.expected,
				actual: firstFailure?.actual,
				error: "Wrong Answer",
				runtime: maxRuntime,
				memory: maxMemory
			};
		}

	} catch (err: any) {
		cleanupTempFiles(filePath, binaryPath, javaSubdir);
		return {
			success: false,
			error: `Server execution error: ${err.message}`
		};
	}
}

async function handler(req: NextApiRequest, res: NextApiResponse<RunResponse>) {
	if (req.method !== "POST") {
		return res.status(405).json({ success: false, error: "Method not allowed" });
	}

	const { problemId, userCode, language, testcases, isCustomInput } = req.body;

	try {
		const result = await runCode(problemId, userCode, language, testcases, isCustomInput);
		return res.status(200).json(result);
	} catch (err: any) {
		return res.status(500).json({
			success: false,
			error: err.message || "An unexpected error occurred during execution."
		});
	}
}

function cleanupTempFiles(filePath: string, binaryPath: string, javaSubdir: string) {
	try {
		if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
		if (binaryPath && fs.existsSync(binaryPath)) fs.unlinkSync(binaryPath);
		if (javaSubdir && fs.existsSync(javaSubdir)) {
			fs.rmSync(javaSubdir, { recursive: true, force: true });
		}
	} catch (err) {
		console.error("Cleanup error:", err);
	}
}

function checkVerdict(
	actual: string,
	expected: string,
	customChecker: any,
	input: string
): boolean {
	if (!customChecker || !customChecker.type || customChecker.type === "exact") {
		return cleanOutput(actual) === cleanOutput(expected);
	}

	if (customChecker.type === "whitespace") {
		const normActual = actual.replace(/\s+/g, " ").trim().toLowerCase();
		const normExpected = expected.replace(/\s+/g, " ").trim().toLowerCase();
		return normActual === normExpected;
	}

	if (customChecker.type === "float_tolerance") {
		const epsilon = Number(customChecker.epsilon) || 1e-6;
		const actTokens = actual.trim().split(/\s+/);
		const expTokens = expected.trim().split(/\s+/);
		if (actTokens.length !== expTokens.length) return false;
		for (let i = 0; i < expTokens.length; i++) {
			const actVal = parseFloat(actTokens[i]);
			const expVal = parseFloat(expTokens[i]);
			if (isNaN(actVal) || isNaN(expVal)) {
				if (actTokens[i] !== expTokens[i]) return false;
			} else {
				const diff = Math.abs(actVal - expVal);
				if (diff > epsilon) {
					const relDiff = diff / Math.max(1e-9, Math.abs(expVal));
					if (relDiff > epsilon) {
						return false;
					}
				}
			}
		}
		return true;
	}

	if (customChecker.type === "special_judge") {
		try {
			const tempDir = os.tmpdir();
			const uniqueId = Math.random().toString(36).substring(2, 10);
			const inputPath = path.join(tempDir, `sj_input_${uniqueId}.txt`);
			const expectedPath = path.join(tempDir, `sj_expected_${uniqueId}.txt`);
			const actualPath = path.join(tempDir, `sj_actual_${uniqueId}.txt`);

			fs.writeFileSync(inputPath, input);
			fs.writeFileSync(expectedPath, expected);
			fs.writeFileSync(actualPath, actual);

			let runCmd = "";
			let runArgs: string[] = [];

			const scriptLang = customChecker.scriptLanguage || "python";
			if (scriptLang === "python") {
				const scriptPath = path.join(tempDir, `sj_script_${uniqueId}.py`);
				fs.writeFileSync(scriptPath, customChecker.scriptCode || "");
				runCmd = "python3";
				runArgs = [scriptPath, inputPath, expectedPath, actualPath];
			} else if (scriptLang === "cpp") {
				const scriptSourcePath = path.join(tempDir, `sj_script_${uniqueId}.cpp`);
				const scriptBinaryPath = path.join(tempDir, `sj_script_${uniqueId}`);
				fs.writeFileSync(scriptSourcePath, customChecker.scriptCode || "");
				
				execSync(`g++ -O3 ${scriptSourcePath} -o ${scriptBinaryPath}`);
				runCmd = scriptBinaryPath;
				runArgs = [inputPath, expectedPath, actualPath];
			}

			let passed = false;
			try {
				execSync(`${runCmd} ${runArgs.join(" ")}`, { stdio: "ignore", timeout: 5000 });
				passed = true;
			} catch {
				passed = false;
			}

			try {
				if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
				if (fs.existsSync(expectedPath)) fs.unlinkSync(expectedPath);
				if (fs.existsSync(actualPath)) fs.unlinkSync(actualPath);
				if (scriptLang === "python") {
					const pyPath = path.join(tempDir, `sj_script_${uniqueId}.py`);
					if (fs.existsSync(pyPath)) fs.unlinkSync(pyPath);
				} else if (scriptLang === "cpp") {
					const cppSrc = path.join(tempDir, `sj_script_${uniqueId}.cpp`);
					const cppBin = path.join(tempDir, `sj_script_${uniqueId}`);
					if (fs.existsSync(cppSrc)) fs.unlinkSync(cppSrc);
					if (fs.existsSync(cppBin)) fs.unlinkSync(cppBin);
				}
			} catch (err) {
				console.error("Cleanup error in special judge:", err);
			}

			return passed;
		} catch (err) {
			console.error("Special judge crash:", err);
			return false;
		}
	}

	return false;
}

export default withApiErrorHandler(handler);
