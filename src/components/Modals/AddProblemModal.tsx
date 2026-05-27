import { useState } from "react";
import { auth } from "@/firebase/firebase";
import { IoClose } from "react-icons/io5";
import { Example } from "@/utils/types/problem";

interface AddProblemModalProps {
isOpen: boolean;
onClose: () => void;
onSuccess: () => void;
}

const AddProblemModal: React.FC<AddProblemModalProps> = ({ isOpen, onClose, onSuccess }) => {
const [formData, setFormData] = useState({
title: "",
difficulty: "Medium",
category: "",
description: "",
examples: [] as Example[],
constraints: "",
order: 1,
videoId: "",
link: "",
});

const [currentExample, setCurrentExample] = useState({ inputText: "", outputText: "", explanation: "" });
const [loading, setLoading] = useState(false);
const [error, setError] = useState("");
const [success, setSuccess] = useState("");

const handleAddExample = () => {
if (currentExample.inputText && currentExample.outputText) {
setFormData((prev) => ({
...prev,
examples: [...prev.examples, { ...currentExample, id: prev.examples.length }],
}));
setCurrentExample({ inputText: "", outputText: "", explanation: "" });
}
};

const handleRemoveExample = (idx: number) => {
setFormData((prev) => ({
...prev,
examples: prev.examples.filter((_, i) => i !== idx),
}));
};

const handleSubmit = async (e: React.FormEvent) => {
e.preventDefault();
setError("");
setSuccess("");
setLoading(true);

try {
const user = auth.currentUser;
if (!user) {
setError("User not authenticated");
setLoading(false);
return;
}

const token = await user.getIdToken();

const response = await fetch("/api/admin/problems", {
method: "POST",
headers: {
"Content-Type": "application/json",
Authorization: `Bearer ${token}`,
},
body: JSON.stringify(formData),
});

const data = await response.json();

if (!response.ok) {
setError(data.error || "Failed to create problem");
setLoading(false);
return;
}

setSuccess("Problem created successfully!");
setFormData({
title: "",
difficulty: "Medium",
category: "",
description: "",
examples: [],
constraints: "",
order: 1,
videoId: "",
link: "",
});

setTimeout(() => {
onSuccess();
onClose();
}, 1500);
} catch (err: any) {
setError(err.message || "An error occurred");
} finally {
setLoading(false);
}
};

if (!isOpen) return null;

return (
<div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
<div className='bg-dark-layer-1 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto'>
<div className='flex justify-between items-center mb-4'>
<h2 className='text-2xl font-bold text-white'>Add New Problem</h2>
<button
onClick={onClose}
className='text-gray-400 hover:text-white'
>
<IoClose size={24} />
</button>
</div>

{error && <div className='bg-red-500 text-white p-3 rounded mb-4'>{error}</div>}
{success && <div className='bg-green-500 text-white p-3 rounded mb-4'>{success}</div>}

<form onSubmit={handleSubmit} className='space-y-4'>
<div className='grid grid-cols-2 gap-4'>
<input
type='text'
placeholder='Title'
className='bg-dark-layer-2 text-white p-2 rounded border border-gray-600 focus:border-brand-orange focus:outline-none'
value={formData.title}
onChange={(e) => setFormData({ ...formData, title: e.target.value })}
required
/>
<select
className='bg-dark-layer-2 text-white p-2 rounded border border-gray-600 focus:border-brand-orange focus:outline-none'
value={formData.difficulty}
onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
>
<option>Easy</option>
<option>Medium</option>
<option>Hard</option>
</select>
</div>

<div className='grid grid-cols-2 gap-4'>
<input
type='text'
placeholder='Category'
className='bg-dark-layer-2 text-white p-2 rounded border border-gray-600 focus:border-brand-orange focus:outline-none'
value={formData.category}
onChange={(e) => setFormData({ ...formData, category: e.target.value })}
required
/>
<input
type='number'
placeholder='Order'
className='bg-dark-layer-2 text-white p-2 rounded border border-gray-600 focus:border-brand-orange focus:outline-none'
value={formData.order}
onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) })}
/>
</div>

<textarea
placeholder='Problem Description'
className='bg-dark-layer-2 text-white p-2 rounded border border-gray-600 focus:border-brand-orange focus:outline-none w-full h-24'
value={formData.description}
onChange={(e) => setFormData({ ...formData, description: e.target.value })}
required
/>

<textarea
placeholder='Constraints'
className='bg-dark-layer-2 text-white p-2 rounded border border-gray-600 focus:border-brand-orange focus:outline-none w-full h-16'
value={formData.constraints}
onChange={(e) => setFormData({ ...formData, constraints: e.target.value })}
/>

<div className='border-t border-gray-600 pt-4'>
<h3 className='text-white font-semibold mb-2'>Examples</h3>
<div className='space-y-2 mb-3'>
{formData.examples.map((ex, idx) => (
<div key={idx} className='bg-dark-layer-2 p-2 rounded flex justify-between items-center'>
<span className='text-gray-300 text-sm'>
Input: {ex.inputText.substring(0, 20)}... → Output: {ex.outputText.substring(0, 20)}...
</span>
<button
type='button'
onClick={() => handleRemoveExample(idx)}
className='text-red-500 hover:text-red-700'
>
Remove
</button>
</div>
))}
</div>

<div className='space-y-2'>
<input
type='text'
placeholder='Example Input'
className='bg-dark-layer-2 text-white p-2 rounded border border-gray-600 focus:border-brand-orange focus:outline-none w-full'
value={currentExample.inputText}
onChange={(e) => setCurrentExample({ ...currentExample, inputText: e.target.value })}
/>
<input
type='text'
placeholder='Example Output'
className='bg-dark-layer-2 text-white p-2 rounded border border-gray-600 focus:border-brand-orange focus:outline-none w-full'
value={currentExample.outputText}
onChange={(e) => setCurrentExample({ ...currentExample, outputText: e.target.value })}
/>
<input
type='text'
placeholder='Explanation (optional)'
className='bg-dark-layer-2 text-white p-2 rounded border border-gray-600 focus:border-brand-orange focus:outline-none w-full'
value={currentExample.explanation}
onChange={(e) => setCurrentExample({ ...currentExample, explanation: e.target.value })}
/>
<button
type='button'
onClick={handleAddExample}
className='bg-brand-orange text-white px-3 py-1 rounded hover:bg-orange-600 w-full'
>
Add Example
</button>
</div>
</div>

<div className='grid grid-cols-2 gap-4'>
<input
type='text'
placeholder='YouTube Video ID (optional)'
className='bg-dark-layer-2 text-white p-2 rounded border border-gray-600 focus:border-brand-orange focus:outline-none'
value={formData.videoId}
onChange={(e) => setFormData({ ...formData, videoId: e.target.value })}
/>
<input
type='url'
placeholder='External Link (optional)'
className='bg-dark-layer-2 text-white p-2 rounded border border-gray-600 focus:border-brand-orange focus:outline-none'
value={formData.link}
onChange={(e) => setFormData({ ...formData, link: e.target.value })}
/>
</div>

<div className='flex gap-2 justify-end pt-4'>
<button
type='button'
onClick={onClose}
className='bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700'
disabled={loading}
>
Cancel
</button>
<button
type='submit'
className='bg-brand-orange text-white px-4 py-2 rounded hover:bg-orange-600 disabled:opacity-50'
disabled={loading}
>
{loading ? "Creating..." : "Create Problem"}
</button>
</div>
</form>
</div>
</div>
);
};

export default AddProblemModal;
