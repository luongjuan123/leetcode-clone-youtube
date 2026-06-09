import type { NextApiRequest, NextApiResponse } from "next";
import { exec, spawn, execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { getAdminFirestore } from "@/firebase/firebaseAdmin";

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
	stdin: string
): Promise<{ stdout: string; stderr: string; code: number | null; timedOut: boolean; compileError?: boolean }> {
	const langMap: Record<SupportedLanguage, number> = {
		javascript: 102,
		python: 92,
		cpp: 105,
		java: 91,
		c: 103
	};

	try {
		const res = await fetch("https://ce.judge0.com/submissions?wait=true", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				language_id: langMap[language],
				source_code: sourceCode,
				stdin: stdin
			})
		});

		if (!res.ok) {
			return { stdout: "", stderr: `Judge0 returned status ${res.status}`, code: -1, timedOut: false };
		}

		const data = await res.json();
		const statusId = data.status?.id;

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
}

function runCommandWithStdin(
	command: string,
	args: string[],
	stdinData: string,
	timeoutMs = 5000
): Promise<{ stdout: string; stderr: string; code: number | null; timedOut: boolean }> {
	return new Promise((resolve) => {
		const child = spawn(command, args, { timeout: timeoutMs });

		let stdout = "";
		let stderr = "";
		let timedOut = false;

		const timer = setTimeout(() => {
			timedOut = true;
			child.kill("SIGKILL");
		}, timeoutMs);

		child.stdout.on("data", (data) => {
			stdout += data.toString();
		});

		child.stderr.on("data", (data) => {
			stderr += data.toString();
		});

		child.on("error", (err) => {
			clearTimeout(timer);
			resolve({ stdout: "", stderr: `Execution failed: ${err.message}`, code: -1, timedOut: false });
		});

		child.on("close", (code) => {
			clearTimeout(timer);
			resolve({ stdout, stderr, code, timedOut });
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

export default async function handler(req: NextApiRequest, res: NextApiResponse<RunResponse>) {
	if (req.method !== "POST") {
		return res.status(405).json({ success: false, error: "Method not allowed" });
	}

	const { problemId, userCode, language, testcases, isCustomInput } = req.body;

	let customChecker: any = null;
	if (problemId) {
		try {
			const db = getAdminFirestore();
			const problemDoc = await db.collection("problems").doc(problemId).get();
			if (problemDoc.exists) {
				customChecker = problemDoc.data()?.customChecker;
			}
		} catch (dbErr) {
			console.error("Error fetching problem customChecker:", dbErr);
		}
	}

	if (!userCode || !language || !testcases || !Array.isArray(testcases)) {
		return res.status(400).json({ success: false, error: "Missing required fields" });
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
			const testResults: { passed: boolean; input: string; expected: string; actual: string; error?: string }[] = [];
			let firstFailure: { index: number; input: string; expected: string; actual: string } | null = null;

			for (let i = 0; i < testcases.length; i++) {
				const tc = testcases[i];
				const inputData = tc.inputText || "";
				const expectedOutput = cleanOutput(tc.outputText || "");

				const execution = await runWithJudge0(userCode, language, inputData);

				if (execution.compileError) {
					return res.status(200).json({
						success: false,
						isCompileError: true,
						error: execution.stderr
					});
				}

				if (execution.timedOut) {
					return res.status(200).json({
						success: false,
						failedCaseIndex: i + 1,
						input: inputData,
						expected: expectedOutput,
						actual: "Time Limit Exceeded",
						error: "Time Limit Exceeded (5000ms)"
					});
				}

				if (execution.code !== 0 && execution.code !== null) {
					return res.status(200).json({
						success: false,
						failedCaseIndex: i + 1,
						input: inputData,
						expected: expectedOutput,
						actual: execution.stdout,
						error: execution.stderr || `Runtime Error (exit code ${execution.code})`
					});
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
				return res.status(200).json({ success: true, passedCount, totalCount, testResults });
			} else {
				return res.status(200).json({
					success: false,
					passedCount,
					totalCount,
					testResults,
					failedCaseIndex: firstFailure?.index,
					input: firstFailure?.input,
					expected: firstFailure?.expected,
					actual: firstFailure?.actual,
					error: "Wrong Answer",
				});
			}
		} catch (err: any) {
			return res.status(500).json({
				success: false,
				error: `Remote execution fallback error: ${err.message}`
			});
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
			return res.status(400).json({ success: false, error: "Unsupported language" });
	}

	const filePath = path.join(tempDir, filename);

	try {
		fs.writeFileSync(filePath, userCode);

		// Handle Compilation if required
		if (isCompileRequired) {
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

				return res.status(200).json({
					success: false,
					isCompileError: true,
					error: compileResult.stderr.replace(new RegExp(tempDir, "g"), "temp")
				});
			}
		}

		// Run against each test case sequentially
		const testResults: { passed: boolean; input: string; expected: string; actual: string; error?: string }[] = [];
		let firstFailure: { index: number; input: string; expected: string; actual: string } | null = null;

		for (let i = 0; i < testcases.length; i++) {
			const tc = testcases[i];
			const inputData = tc.inputText || "";
			const expectedOutput = cleanOutput(tc.outputText || "");

			let runCmd = "";
			let runArgs: string[] = [];

			switch (language) {
				case "javascript":
					runCmd = "node";
					runArgs = [filePath];
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
					runArgs = ["-cp", javaSubdir, "Main"];
					break;
			}

			const execution = await runCommandWithStdin(runCmd, runArgs, inputData, 5000);

			if (execution.timedOut) {
				cleanupTempFiles(filePath, binaryPath, javaSubdir);
				return res.status(200).json({
					success: false,
					failedCaseIndex: i + 1,
					input: inputData,
					expected: expectedOutput,
					actual: "Time Limit Exceeded",
					error: "Time Limit Exceeded (5000ms)"
				});
			}

			if (execution.code !== 0 && execution.code !== null) {
				cleanupTempFiles(filePath, binaryPath, javaSubdir);
				return res.status(200).json({
					success: false,
					failedCaseIndex: i + 1,
					input: inputData,
					expected: expectedOutput,
					actual: execution.stdout,
					error: execution.stderr || `Runtime Error (exit code ${execution.code})`
				});
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

		cleanupTempFiles(filePath, binaryPath, javaSubdir);

		const passedCount = testResults.filter((r) => r.passed).length;
		const totalCount = testResults.length;
		const allPassed = passedCount === totalCount;

		if (allPassed) {
			return res.status(200).json({ success: true, passedCount, totalCount, testResults });
		} else {
			return res.status(200).json({
				success: false,
				passedCount,
				totalCount,
				testResults,
				failedCaseIndex: firstFailure?.index,
				input: firstFailure?.input,
				expected: firstFailure?.expected,
				actual: firstFailure?.actual,
				error: "Wrong Answer",
			});
		}

	} catch (err: any) {
		cleanupTempFiles(filePath, binaryPath, javaSubdir);
		return res.status(500).json({
			success: false,
			error: `Server execution error: ${err.message}`
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
