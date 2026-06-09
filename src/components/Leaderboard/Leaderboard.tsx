import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { firestore } from "@/firebase/firebase";
import { DBProblem } from "@/utils/types/problem";

import { FaTrophy, FaUser, FaMedal } from "react-icons/fa";

interface UserRanking {
	uid: string;
	displayName: string;
	studentId: string;
	class: string;
	school: string;
	avatarUrl?: string;
	solvedProblems: string[];
	score: number;
	solvedCounts: { easy: number; medium: number; hard: number };
	showStudentInfo?: boolean;
}

import Link from "next/link";

const DIFFICULTY_WEIGHTS = { easy: 1, medium: 3, hard: 5 };

const Leaderboard: React.FC = () => {
	const [rankings, setRankings] = useState<UserRanking[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const fetchRankings = async () => {
			setLoading(true);
			try {
				// 1. Get all problems difficulty map
				const problemsSnap = await getDocs(collection(firestore, "problems"));
				const difficultyMap: Record<string, string> = {};

				// Build difficulty map — Firestore is the single source of truth.
				// Only problems that currently exist in the DB count toward scores.
				problemsSnap.forEach((doc) => {
					const data = doc.data();
					if (data.difficulty) {
						difficultyMap[doc.id] = data.difficulty;
					}
				});

				// 2. Fetch all users
				const usersSnap = await getDocs(collection(firestore, "users"));
				const rankingsList: UserRanking[] = [];

				usersSnap.forEach((docSnap) => {
					const data = docSnap.data();
					const solvedList: string[] = data.solvedProblems || [];

					let easyCount = 0;
					let mediumCount = 0;
					let hardCount = 0;

					// Only count problems that still exist in the problems map
					// (deleted problems are excluded from the difficulty map)
					solvedList.forEach((probId) => {
						if (!(probId in difficultyMap)) return; // skip deleted problems
						const diff = difficultyMap[probId].toLowerCase();
						if (diff === "easy") easyCount++;
						else if (diff === "medium") mediumCount++;
						else if (diff === "hard") hardCount++;
					});

					// Score: Easy = 1, Medium = 3, Hard = 5
					const score =
						easyCount * DIFFICULTY_WEIGHTS.easy +
						mediumCount * DIFFICULTY_WEIGHTS.medium +
						hardCount * DIFFICULTY_WEIGHTS.hard;

					const validSolvedCount = easyCount + mediumCount + hardCount;

					rankingsList.push({
						uid: docSnap.id,
						displayName: data.displayName || "Anonymous User",
						studentId: data.studentId || "N/A",
						class: data.class || "N/A",
						school: data.school || "BeastCode University",
						avatarUrl: data.avatarUrl || undefined,
						solvedProblems: solvedList.filter((id) => id in difficultyMap),
						score,
						solvedCounts: { easy: easyCount, medium: mediumCount, hard: hardCount },
						showStudentInfo: data.showStudentInfo !== false,
					});
				});

				// Sort rankings by score desc, then by valid solved count desc
				// solvedProblems is already filtered to only existing problems
				rankingsList.sort((a, b) => {
					if (b.score !== a.score) return b.score - a.score;
					return b.solvedProblems.length - a.solvedProblems.length;
				});

				setRankings(rankingsList);
			} catch (e) {
				console.error("Error fetching leaderboard rankings:", e);
			} finally {
				setLoading(false);
			}
		};

		fetchRankings();
	}, []);

	if (loading) {
		return (
			<div className='max-w-[1200px] mx-auto sm:w-7/12 w-full space-y-4 animate-pulse mt-4'>
				{[...Array(5)].map((_, idx) => (
					<div key={idx} className='flex items-center space-x-12 px-6 h-14 bg-white dark:bg-dark-layer-1 border border-slate-200 dark:border-slate-800/60 rounded-xl'>
						<div className='w-8 h-8 rounded-full bg-slate-200 dark:bg-dark-fill-3' />
						<div className='h-4 w-40 rounded bg-slate-200 dark:bg-dark-fill-3' />
						<div className='h-4 w-24 rounded bg-slate-200 dark:bg-dark-fill-3' />
						<div className='h-4 w-20 rounded bg-slate-200 dark:bg-dark-fill-3' />
					</div>
				))}
			</div>
		);
	}

	return (
		<div className='max-w-[1200px] mx-auto sm:w-7/12 w-full overflow-hidden border border-slate-200 dark:border-slate-800/60 rounded-2xl bg-white dark:bg-dark-layer-1 shadow-md dark:shadow-none'>
			<div className='p-6 border-b border-slate-200 dark:border-slate-800/60 bg-slate-50/50 dark:bg-dark-fill-3/10 flex justify-between items-center'>
				<div>
					<h3 className='text-lg font-bold text-slate-800 dark:text-gray-200'>Leaderboard</h3>
					<p className='text-xs text-slate-500 dark:text-gray-500 mt-0.5'>Ranks are calculated based on difficulty: Easy (1pt), Medium (3pts), Hard (5pts)</p>
				</div>
				<div className='flex gap-4 text-xs text-slate-600 dark:text-gray-400 font-medium'>
					<span className='flex items-center gap-1'><span className='w-2 h-2 rounded-full bg-green-500' /> Easy: 1pt</span>
					<span className='flex items-center gap-1'><span className='w-2 h-2 rounded-full bg-yellow-500' /> Medium: 3pts</span>
					<span className='flex items-center gap-1'><span className='w-2 h-2 rounded-full bg-red-500' /> Hard: 5pts</span>
				</div>
			</div>

			<table className='w-full text-sm text-left text-slate-500 dark:text-gray-450'>
				<thead className='text-xs uppercase bg-slate-50 dark:bg-dark-fill-3/30 text-slate-500 dark:text-gray-400 border-b border-slate-200 dark:border-slate-800/60'>
					<tr>
						<th scope='col' className='px-6 py-4 w-16 text-center'>Rank</th>
						<th scope='col' className='px-6 py-4'>User</th>
						<th scope='col' className='px-6 py-4 hidden md:table-cell'>School</th>
						<th scope='col' className='px-6 py-4 text-center'>Solved Details</th>
						<th scope='col' className='px-6 py-4 text-right pr-8'>Total Score</th>
					</tr>
				</thead>
				<tbody className='divide-y divide-slate-200 dark:divide-slate-800/60'>
					{rankings.map((user, idx) => {
						const rank = idx + 1;
						const isTop3 = rank <= 3;
						const rankColor =
							rank === 1
								? "text-yellow-500"
								: rank === 2
									? "text-gray-300"
									: rank === 3
										? "text-amber-600"
										: "text-gray-500";

						return (
							<tr key={user.uid} className='hover:bg-slate-50/60 dark:hover:bg-dark-fill-3/15 transition duration-150'>
								{/* Rank */}
								<td className='px-6 py-4 text-center font-bold'>
									<div className='flex justify-center items-center'>
										{rank === 1 ? (
											<FaTrophy className='text-yellow-500' size={18} />
										) : rank === 2 ? (
											<FaMedal className='text-gray-300' size={18} />
										) : rank === 3 ? (
											<FaMedal className='text-amber-600' size={18} />
										) : (
											<span className='text-slate-400 dark:text-gray-500'>{rank}</span>
										)}
									</div>
								</td>

								{/* User info */}
								<td className='px-6 py-4 font-semibold text-slate-800 dark:text-white'>
									<Link href={`/profile?uid=${user.uid}`} className='flex items-center gap-3 hover:text-brand-orange transition cursor-pointer w-fit'>
										{user.avatarUrl ? (
											<img
												src={user.avatarUrl}
												alt='Avatar'
												className='w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-gray-700'
											/>
										) : (
											<div className='w-8 h-8 rounded-full bg-slate-100 dark:bg-dark-fill-3 flex items-center justify-center text-slate-400 dark:text-gray-500 border border-slate-200 dark:border-gray-800'>
												<FaUser size={12} />
											</div>
										)}
										<span className='truncate max-w-[150px] sm:max-w-[200px]'>{user.displayName}</span>
									</Link>
								</td>

								{/* School Info */}
								<td className='px-6 py-4 hidden md:table-cell text-xs text-slate-550 dark:text-gray-500'>
									<span className='text-slate-700 dark:text-gray-300 font-semibold'>{user.school}</span>
								</td>

								{/* Solved details */}
								<td className='px-6 py-4 text-center'>
									<div className='flex justify-center gap-3 text-xs'>
										<span className='text-green-500 font-semibold' title='Easy solved'>{user.solvedCounts.easy}E</span>
										<span className='text-yellow-500 font-semibold' title='Medium solved'>{user.solvedCounts.medium}M</span>
										<span className='text-red-500 font-semibold' title='Hard solved'>{user.solvedCounts.hard}H</span>
									</div>
								</td>

								{/* Score */}
								<td className='px-6 py-4 text-right pr-8 font-extrabold text-base text-brand-orange'>
									{user.score}
								</td>
							</tr>
						);
					})}
					{rankings.length === 0 && (
						<tr>
							<td colSpan={5} className='px-6 py-10 text-center text-slate-400 dark:text-gray-500 italic'>
								No students registered yet.
							</td>
						</tr>
					)}
				</tbody>
			</table>
		</div>
	);
};

export default Leaderboard;
