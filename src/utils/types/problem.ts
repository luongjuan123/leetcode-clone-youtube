export type Example = {
	id: number;
	inputText: string;
	outputText: string;
	explanation?: string;
	img?: string;
	isSample?: boolean;
	isAdditional?: boolean;
};

// local problem data
export type Problem = {
	id: string;
	title: string;
	problemStatement: string;
	examples: Example[];
	constraints: string;
	order: number;
	starterCode: string;
	handlerFunction: ((fn: any) => boolean) | string;
	starterFunctionName: string;
	inputFormat?: string;
	outputFormat?: string;
	tags?: string[];
	description?: string;
	language?: string;
	category?: string;
	difficulty?: string;
	points?: number;
	customChecker?: {
		type: string;
		epsilon?: number;
		scriptLanguage?: string;
		scriptCode?: string;
	};
	editorial?: {
		markdown?: string;
		videoUrl?: string;
	};
};

export type DBProblem = {
	id: string;
	title: string;
	category: string;
	difficulty: string;
	likes: number;
	dislikes: number;
	order: number;
	videoId?: string;
	link?: string;
};
