import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useAdmin } from "@/hooks/useAdmin";
import Topbar from "@/components/Topbar/Topbar";
import AddProblemModal from "@/components/Modals/AddProblemModal";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { firestore, auth } from "@/firebase/firebase";
import { DBProblem } from "@/utils/types/problem";

const AdminPage = () => {
const router = useRouter();
const { isAdmin, loading, user } = useAdmin();
const [problems, setProblems] = useState<(DBProblem & { docId: string })[]>([]);
const [showAddModal, setShowAddModal] = useState(false);
const [loadingProblems, setLoadingProblems] = useState(true);
const [error, setError] = useState("");

useEffect(() => {
if (!loading && !isAdmin) {
router.push("/");
}
}, [isAdmin, loading, router]);

useEffect(() => {
const fetchProblems = async () => {
try {
setLoadingProblems(true);
const querySnapshot = await getDocs(collection(firestore, "problems"));
const fetchedProblems = querySnapshot.docs.map((doc) => ({
...(doc.data() as DBProblem),
docId: doc.id,
}));
setProblems(fetchedProblems.sort((a, b) => a.order - b.order));
} catch (err) {
console.error("Error fetching problems:", err);
setError("Failed to load problems");
} finally {
setLoadingProblems(false);
}
};

if (isAdmin) {
fetchProblems();
}
}, [isAdmin]);

const handleDeleteProblem = async (docId: string) => {
if (!confirm("Are you sure you want to delete this problem?")) return;

try {
const token = await auth.currentUser?.getIdToken();
if (!token) return;

const response = await fetch("/api/admin/problems", {
method: "DELETE",
headers: {
"Content-Type": "application/json",
Authorization: `Bearer ${token}`,
},
body: JSON.stringify({ id: docId }),
});

if (!response.ok) {
setError("Failed to delete problem");
return;
}

setProblems((prev) => prev.filter((p) => p.docId !== docId));
} catch (err) {
console.error("Error deleting problem:", err);
setError("Error deleting problem");
}
};

const handleAddSuccess = () => {
const fetchProblems = async () => {
try {
const querySnapshot = await getDocs(collection(firestore, "problems"));
const fetchedProblems = querySnapshot.docs.map((doc) => ({
...(doc.data() as DBProblem),
docId: doc.id,
}));
setProblems(fetchedProblems.sort((a, b) => a.order - b.order));
} catch (err) {
console.error("Error refreshing problems:", err);
}
};
fetchProblems();
};

if (loading) {
return (
<div className='bg-dark-layer-2 min-h-screen'>
<Topbar />
<div className='flex items-center justify-center h-96'>
<p className='text-gray-400'>Loading...</p>
</div>
</div>
);
}

if (!isAdmin) {
return null;
}

return (
<div className='bg-dark-layer-2 min-h-screen'>
<Topbar />
<div className='max-w-7xl mx-auto px-6 py-10'>
<div className='flex justify-between items-center mb-8'>
<h1 className='text-3xl font-bold text-white'>Admin Dashboard</h1>
<button
onClick={() => setShowAddModal(true)}
className='bg-brand-orange text-white px-6 py-2 rounded-lg hover:bg-orange-600 transition'
>
+ Add Problem
</button>
</div>

{error && <div className='bg-red-500 text-white p-4 rounded mb-4'>{error}</div>}

{loadingProblems ? (
<div className='flex items-center justify-center h-96'>
<p className='text-gray-400'>Loading problems...</p>
</div>
) : (
<div className='overflow-x-auto'>
<table className='w-full text-left text-gray-300 border border-dark-fill-3'>
<thead className='bg-dark-layer-1 text-gray-200'>
<tr>
<th className='px-6 py-3 font-semibold'>Title</th>
<th className='px-6 py-3 font-semibold'>Difficulty</th>
<th className='px-6 py-3 font-semibold'>Category</th>
<th className='px-6 py-3 font-semibold'>Order</th>
<th className='px-6 py-3 font-semibold'>Likes</th>
<th className='px-6 py-3 font-semibold'>Actions</th>
</tr>
</thead>
<tbody>
{problems.map((problem) => (
<tr key={problem.docId} className='border-t border-dark-fill-3 hover:bg-dark-layer-1'>
<td className='px-6 py-4'>{problem.title}</td>
<td className='px-6 py-4'>
<span
className={`px-3 py-1 rounded ${
problem.difficulty === "Easy"
? "bg-green-900 text-green-200"
: problem.difficulty === "Medium"
? "bg-yellow-900 text-yellow-200"
: "bg-red-900 text-red-200"
}`}
>
{problem.difficulty}
</span>
</td>
<td className='px-6 py-4'>{problem.category}</td>
<td className='px-6 py-4'>{problem.order}</td>
<td className='px-6 py-4'>{problem.likes}</td>
<td className='px-6 py-4 space-x-2'>
<button
onClick={() => router.push(`/problems/${problem.id}`)}
className='text-blue-400 hover:text-blue-300'
>
View
</button>
<button
onClick={() => handleDeleteProblem(problem.docId)}
className='text-red-400 hover:text-red-300'
>
Delete
</button>
</td>
</tr>
))}
</tbody>
</table>
{problems.length === 0 && (
<div className='text-center py-10 text-gray-400'>
<p>No problems yet. Create your first one!</p>
</div>
)}
</div>
)}
</div>

<AddProblemModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} onSuccess={handleAddSuccess} />
</div>
);
};

export default AdminPage;
