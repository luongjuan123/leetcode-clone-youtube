import Topbar from "@/components/Topbar/Topbar";
import Workspace from "@/components/Workspace/Workspace";
import useHasMounted from "@/hooks/useHasMounted";
import { Problem } from "@/utils/types/problem";
import React from "react";
import { problems as staticProblems } from "@/utils/problems";
import { getAdminFirestore } from "@/firebase/firebaseAdmin";
import { SubmissionProvider } from "@/context/SubmissionContext";
import ErrorDisplay from "@/components/UI/ErrorDisplay";

type ProblemPageProps = {
	problem: Problem | null;
	errorType?: string;
};

const ProblemPage: React.FC<ProblemPageProps> = ({ problem, errorType }) => {
	const hasMounted = useHasMounted();

	if (!hasMounted) return null;

	if (errorType === "problem_not_found" || !problem) {
		return <ErrorDisplay type="problem_not_found" />;
	}

	return (
		<div>
			<Topbar problemPage />
			<SubmissionProvider problemId={problem.id}>
				<Workspace problem={problem} />
			</SubmissionProvider>
		</div>
	);
};
export default ProblemPage;

// fetch the local data
//  SSG
// getStaticPaths => it create the dynamic routes
export async function getStaticPaths() {
	return {
		paths: [],
		fallback: "blocking",
	};
}

export async function getStaticProps({ params }: { params: { pid: string } }) {
	const { pid } = params;
	let problem: any = null;

	try {
		const db = getAdminFirestore();
		const docSnap = await db.collection("problems").doc(pid).get();
		if (docSnap.exists) {
			const data = docSnap.data();
			if (data) {
				const dbTags = data.tags && Array.isArray(data.tags) && data.tags.length > 0
					? data.tags
					: (data.category ? [data.category] : ["Array"]);
				problem = {
					id: docSnap.id,
					title: data.title || "",
					problemStatement: data.problemStatement || "",
					examples: data.examples || [],
					constraints: data.constraints || "",
					starterCode: data.starterCode || "",
					handlerFunction: data.handlerFunction || "",
					starterFunctionName: data.starterFunctionName || "",
					inputFormat: data.inputFormat || "",
					outputFormat: data.outputFormat || "",
					tags: dbTags,
					description: data.description || "",
					language: data.language || "English",
					difficulty: data.difficulty || "Medium",
					points: data.points || data.maxScore || 100,
					order: Number(data.order) || 0,
					category: data.category || "",
					customChecker: data.customChecker || null,
					editorial: data.editorial || null,
				};
			}
		}
	} catch (error) {
		console.error("Error fetching problem from Firestore in getStaticProps:", error);
	}

	// Fallback to static problems for seamless local testing
	if (!problem && staticProblems[pid]) {
		const staticProb = staticProblems[pid];
		const dbTags = staticProb.tags && Array.isArray(staticProb.tags) && staticProb.tags.length > 0
			? staticProb.tags
			: ((staticProb as any).category ? [(staticProb as any).category] : ["Array"]);
		problem = {
			id: pid,
			title: staticProb.title || "",
			problemStatement: staticProb.problemStatement || "",
			examples: staticProb.examples || [],
			constraints: staticProb.constraints || "",
			starterCode: staticProb.starterCode || "",
			handlerFunction: typeof staticProb.handlerFunction === "function" ? staticProb.handlerFunction.toString() : staticProb.handlerFunction,
			starterFunctionName: staticProb.starterFunctionName || "",
			inputFormat: staticProb.inputFormat || "",
			outputFormat: staticProb.outputFormat || "",
			tags: dbTags,
			description: staticProb.description || "",
			language: staticProb.language || "English",
			difficulty: staticProb.difficulty || "Medium",
			points: staticProb.points || 100,
			order: (staticProb as any).order || 0,
			category: (staticProb as any).category || "",
			customChecker: (staticProb as any).customChecker || null,
			editorial: (staticProb as any).editorial || null,
		};
	}

	if (!problem) {
		return {
			props: {
				problem: null,
				errorType: "problem_not_found"
			},
			revalidate: 1,
		};
	}

	return {
		props: {
			problem,
		},
		revalidate: 1,
	};
}
