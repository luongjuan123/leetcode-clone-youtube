import Topbar from "@/components/Topbar/Topbar";
import Workspace from "@/components/Workspace/Workspace";
import useHasMounted from "@/hooks/useHasMounted";
import { Problem } from "@/utils/types/problem";
import React from "react";
import { doc, getDoc } from "firebase/firestore";
import { firestore } from "@/firebase/firebase";

type ProblemPageProps = {
	problem: Problem;
};

const ProblemPage: React.FC<ProblemPageProps> = ({ problem }) => {
	const hasMounted = useHasMounted();

	if (!hasMounted) return null;

	return (
		<div>
			<Topbar problemPage />
			<Workspace problem={problem} />
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
		const docRef = doc(firestore, "problems", pid);
		const docSnap = await getDoc(docRef);
		if (docSnap.exists()) {
			const data = docSnap.data();
			problem = {
				id: docSnap.id,
				title: data.title || "",
				problemStatement: data.problemStatement || "",
				examples: data.examples || [],
				constraints: data.constraints || "",
				order: Number(data.order) || 0,
				starterCode: data.starterCode || "",
				handlerFunction: data.handlerFunction || "",
				starterFunctionName: data.starterFunctionName || "",
				inputFormat: data.inputFormat || "",
				outputFormat: data.outputFormat || "",
				tags: data.tags || [],
				description: data.description || "",
				language: data.language || "English",
				difficulty: data.difficulty || "Medium",
				category: data.category || "",
				points: data.points || data.maxScore || 100,
			};
		}
	} catch (error) {
		console.error("Error fetching problem from Firestore in getStaticProps:", error);
	}

	if (!problem) {
		return {
			notFound: true,
		};
	}

	return {
		props: {
			problem,
		},
		revalidate: 1,
	};
}
