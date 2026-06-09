import React, { useMemo, useState } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, firestore } from "@/firebase/firebase";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { FaCheckCircle } from "react-icons/fa";

interface PollOption {
	text: string;
	votes: string[]; // UIDs of users who voted for this option
}

interface Poll {
	question: string;
	options: PollOption[];
	expiresAt?: number;
}

interface PollComponentProps {
	threadId: string;
	poll: Poll;
	isReply?: boolean;
	replyId?: string; // If this poll is inside a reply
	repliesList?: any[]; // The replies array from parent thread (so we can update it)
}

const PollComponent: React.FC<PollComponentProps> = ({
	threadId,
	poll,
	isReply = false,
	replyId,
	repliesList = [],
}) => {
	const [user] = useAuthState(auth);
	const [errorMsg, setErrorMsg] = useState<string | null>(null);

	const totalVotes = useMemo(() => {
		return poll.options.reduce((sum, opt) => sum + (opt.votes?.length || 0), 0);
	}, [poll]);

	const hasVoted = useMemo(() => {
		if (!user) return false;
		return poll.options.some((opt) => opt.votes?.includes(user.uid));
	}, [poll, user]);

	const userVotedIndex = useMemo(() => {
		if (!user) return -1;
		return poll.options.findIndex((opt) => opt.votes?.includes(user.uid));
	}, [poll, user]);

	const handleVote = async (optionIndex: number) => {
		if (!user) {
			setErrorMsg("Please log in to vote.");
			setTimeout(() => setErrorMsg(null), 3000);
			return;
		}

		try {
			const threadRef = doc(firestore, "threads", threadId);

			let updatedOptions = poll.options.map((opt, idx) => {
				const votes = opt.votes ? [...opt.votes] : [];
				const userIndex = votes.indexOf(user.uid);

				// Remove vote if already voted for this option
				if (userIndex > -1) {
					votes.splice(userIndex, 1);
				}

				// Add vote if this is the clicked option
				if (idx === optionIndex) {
					if (userIndex === -1) {
						votes.push(user.uid);
					}
				} else {
					// Remove user vote from other options (single-choice poll)
					const otherIndex = votes.indexOf(user.uid);
					if (otherIndex > -1) {
						votes.splice(otherIndex, 1);
					}
				}

				return { ...opt, votes };
			});

			if (isReply && replyId) {
				// Update inside replies array
				const updatedReplies = repliesList.map((rep) => {
					if (rep.id === replyId) {
						return {
							...rep,
							submittedProblem: rep.submittedProblem || null, // Preserve compatibility
							poll: { ...poll, options: updatedOptions },
						};
					}
					return rep;
				});

				await updateDoc(threadRef, {
					replies: updatedReplies,
				});
			} else {
				// Update top-level thread poll
				await updateDoc(threadRef, {
					poll: { ...poll, options: updatedOptions },
				});
			}
		} catch (error) {
			console.error("Error voting in poll:", error);
			setErrorMsg("Failed to vote. Try again.");
			setTimeout(() => setErrorMsg(null), 3000);
		}
	};

	return (
		<div className='bg-slate-50 dark:bg-dark-layer-2 border border-slate-200 dark:border-slate-800/40 rounded-xl p-4 space-y-3 mt-2 max-w-md'>
			<h4 className='text-sm font-bold text-slate-900 dark:text-gray-200 leading-snug'>{poll.question}</h4>
			<div className='space-y-2.5'>
				{poll.options.map((option, idx) => {
					const optVotes = option.votes?.length || 0;
					const percentage = totalVotes > 0 ? Math.round((optVotes / totalVotes) * 100) : 0;
					const isUserVote = idx === userVotedIndex;

					return (
						<div
							key={idx}
							onClick={() => handleVote(idx)}
							className={`relative overflow-hidden border rounded-xl py-2.5 px-4 cursor-pointer select-none transition duration-300 flex items-center justify-between group ${
								hasVoted
									? isUserVote
										? "border-brand-orange bg-brand-orange/5"
										: "border-slate-200 dark:border-slate-800/60 bg-slate-100/50 dark:bg-dark-fill-3/5"
									: "border-slate-200 hover:border-slate-300 dark:border-slate-800/60 dark:hover:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-dark-fill-3/15 dark:hover:bg-dark-fill-3/25"
							}`}
						>
							{/* Percentage Indicator Background Bar */}
							{hasVoted && (
								<div
									className={`absolute left-0 top-0 bottom-0 transition-all duration-700 ease-out ${
										isUserVote ? "bg-brand-orange/15" : "bg-dark-fill-3/20"
									}`}
									style={{ width: `${percentage}%` }}
								/>
							)}

							<span className='relative z-10 text-xs font-semibold text-slate-700 dark:text-gray-300 group-hover:text-slate-950 dark:group-hover:text-white transition duration-150 flex items-center gap-2'>
								{option.text}
								{hasVoted && isUserVote && <FaCheckCircle className='text-brand-orange' size={12} />}
							</span>

							{hasVoted && (
								<span className='relative z-10 text-xs font-mono font-bold text-slate-500 dark:text-gray-400 group-hover:text-slate-950 dark:group-hover:text-white transition duration-150'>
									{percentage}% <span className='text-[10px] text-slate-400 dark:text-slate-500 font-normal'>({optVotes})</span>
								</span>
							)}
						</div>
					);
				})}
			</div>
			<div className='flex justify-between items-center text-[10px] text-slate-500 dark:text-gray-500 font-semibold px-1 pt-1'>
				<span>{totalVotes} {totalVotes === 1 ? "vote" : "votes"}</span>
				{errorMsg ? (
					<span className='text-rose-400 font-bold transition duration-300'>{errorMsg}</span>
				) : hasVoted ? (
					<span className='text-brand-orange font-bold animate-pulse'>✓ Voted</span>
				) : null}
			</div>
		</div>
	);
};

export default PollComponent;
