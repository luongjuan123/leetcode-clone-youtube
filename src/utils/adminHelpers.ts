import { DBProblem, Problem, Example } from "@/utils/types/problem";

export const createFirestoreProblemFromForm = (formData: {
title: string;
difficulty: string;
category: string;
description: string;
examples: Example[];
constraints: string;
order: number;
starterCode: string;
videoId?: string;
link?: string;
}): DBProblem => {
return {
id: formData.title.toLowerCase().replace(/\s+/g, "-") + "-" + Date.now(),
title: formData.title,
difficulty: formData.difficulty,
category: formData.category,
likes: 0,
dislikes: 0,
order: formData.order,
videoId: formData.videoId,
link: formData.link,
};
};

export const validateProblemForm = (data: any): { valid: boolean; errors: string[] } => {
const errors: string[] = [];

if (!data.title || data.title.trim().length === 0) {
errors.push("Title is required");
}

if (!data.difficulty || !["Easy", "Medium", "Hard"].includes(data.difficulty)) {
errors.push("Valid difficulty is required");
}

if (!data.category || data.category.trim().length === 0) {
errors.push("Category is required");
}

if (!data.description || data.description.trim().length === 0) {
errors.push("Problem description is required");
}

if (!Array.isArray(data.examples) || data.examples.length === 0) {
errors.push("At least one example is required");
}

if (typeof data.order !== "number" || data.order < 1) {
errors.push("Valid order number is required");
}

return {
valid: errors.length === 0,
errors,
};
};
