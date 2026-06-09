import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { firestore } from "@/firebase/firebase";
import Topbar from "@/components/Topbar/Topbar";
import TabsNavigation from "@/components/TabsNavigation/TabsNavigation";
import ThreadCard from "@/components/Threads/ThreadCard";
import { FaHashtag, FaArrowLeft, FaSpinner } from "react-icons/fa";
import Link from "next/link";

interface Thread {
	id: string;
	uid: string;
	displayName: string;
	avatarUrl?: string;
	content: string;
	createdAt: number;
	likes: string[];
	replies: any[];
}

export default function HashtagPage() {
	const router = useRouter();
	const { tag } = router.query;

	const [threads, setThreads] = useState<Thread[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (!tag) return;
		setLoading(true);

		// Array-contains query for matching hashtags
		const q = query(
			collection(firestore, "threads"),
			where("hashtags", "array-contains", (tag as string).toLowerCase())
		);

		const unsub = onSnapshot(
			q,
			(snap) => {
				const list: Thread[] = [];
				snap.forEach((docSnap) => {
					list.push({ id: docSnap.id, ...docSnap.data() } as Thread);
				});
				// Sort by date descending client-side
				list.sort((a, b) => b.createdAt - a.createdAt);
				setThreads(list);
				setLoading(false);
			},
			(err) => {
				console.error(err);
				setLoading(false);
			}
		);

		return () => unsub();
	}, [tag]);

	return (
		<main className='bg-dark-layer-2 min-h-screen pb-16 text-white'>
			<Topbar />
			<div className='max-w-2xl mx-auto px-4 mt-8'>
				<TabsNavigation />

				<div className='flex items-center gap-3 select-none py-4 border-b border-gray-805 mb-6 mt-4'>
					<button
						onClick={() => router.back()}
						className='p-2 bg-dark-fill-3/5 hover:bg-dark-fill-3 hover:text-white rounded-xl transition text-gray-400 shrink-0'
					>
						<FaArrowLeft size={11} />
					</button>
					<div className='flex items-center gap-2'>
						<div className='bg-brand-orange/15 p-2.5 rounded-xl text-brand-orange'>
							<FaHashtag size={15} />
						</div>
						<h1 className='text-lg font-bold text-white'>#{tag}</h1>
					</div>
				</div>

				{loading ? (
					<div className='flex justify-center items-center py-16'>
						<FaSpinner className='animate-spin text-brand-orange' size={24} />
					</div>
				) : (
					<div className='space-y-4'>
						{threads.map((thread) => (
							<Link key={thread.id} href={`/threads?threadId=${thread.id}`}>
								<div className='cursor-pointer'>
									<ThreadCard thread={thread} />
								</div>
							</Link>
						))}

						{threads.length === 0 && (
							<p className='text-center text-xs text-gray-500 italic py-12 select-none'>
								No posts found with hashtag #{tag}.
							</p>
						)}
					</div>
				)}
			</div>
		</main>
	);
}
