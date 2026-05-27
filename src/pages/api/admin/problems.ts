import { NextApiRequest, NextApiResponse } from "next";
import { auth, firestore } from "@/firebase/firebase";
import { collection, addDoc, doc, updateDoc, deleteDoc } from "firebase/firestore";
import * as admin from "firebase-admin";

// Initialize admin SDK if not already done
let adminApp: admin.app.App;
try {
adminApp = admin.initializeApp();
} catch (error) {
adminApp = admin.app();
}

const verifyAdmin = async (token: string): Promise<boolean> => {
try {
const decodedToken = await adminApp.auth().verifyIdToken(token);
return decodedToken.admin === true;
} catch (error) {
console.error("Error verifying admin token:", error);
return false;
}
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
const authHeader = req.headers.authorization;

if (!authHeader?.startsWith("Bearer ")) {
return res.status(401).json({ error: "Unauthorized" });
}

const token = authHeader.split("Bearer ")[1];
const isAdmin = await verifyAdmin(token);

if (!isAdmin) {
return res.status(403).json({ error: "Forbidden - Admin access required" });
}

if (req.method === "POST") {
try {
const { title, difficulty, category, description, examples, constraints, order, starterCode, videoId, link } = req.body;

if (!title || !difficulty || !category) {
return res.status(400).json({ error: "Missing required fields" });
}

const problemId = title.toLowerCase().replace(/\s+/g, "-");

const newProblem = {
id: problemId,
title,
difficulty,
category,
likes: 0,
dislikes: 0,
order: order || 1,
videoId: videoId || null,
link: link || null,
};

await addDoc(collection(firestore, "problems"), newProblem);

return res.status(201).json({ success: true, data: newProblem });
} catch (error) {
console.error("Error creating problem:", error);
return res.status(500).json({ error: "Failed to create problem" });
}
}

if (req.method === "PUT") {
try {
const { id, ...updateData } = req.body;

if (!id) {
return res.status(400).json({ error: "Problem ID is required" });
}

const problemRef = doc(firestore, "problems", id);
await updateDoc(problemRef, updateData);

return res.status(200).json({ success: true, message: "Problem updated" });
} catch (error) {
console.error("Error updating problem:", error);
return res.status(500).json({ error: "Failed to update problem" });
}
}

if (req.method === "DELETE") {
try {
const { id } = req.body;

if (!id) {
return res.status(400).json({ error: "Problem ID is required" });
}

const problemRef = doc(firestore, "problems", id);
await deleteDoc(problemRef);

return res.status(200).json({ success: true, message: "Problem deleted" });
} catch (error) {
console.error("Error deleting problem:", error);
return res.status(500).json({ error: "Failed to delete problem" });
}
}

return res.status(405).json({ error: "Method not allowed" });
}
