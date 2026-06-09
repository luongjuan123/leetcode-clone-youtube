import Topbar from "@/components/Topbar/Topbar";
import TabsNavigation from "@/components/TabsNavigation/TabsNavigation";
import Leaderboard from "@/components/Leaderboard/Leaderboard";
import useHasMounted from "@/hooks/useHasMounted";

export default function RankingsPage() {
	const hasMounted = useHasMounted();

	if (!hasMounted) return null;

	return (
		<>
			<main className='bg-dark-layer-2 min-h-screen pb-16'>
				<Topbar />
				
				{/* Shared Tab Navigation */}
				<TabsNavigation />

				{/* Rankings Content */}
				<div className='px-6'>
					<Leaderboard />
				</div>
			</main>
		</>
	);
}
