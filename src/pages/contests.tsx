import Topbar from "@/components/Topbar/Topbar";
import TabsNavigation from "@/components/TabsNavigation/TabsNavigation";
import useHasMounted from "@/hooks/useHasMounted";

export default function ContestsPage() {
	const hasMounted = useHasMounted();

	if (!hasMounted) return null;

	return (
		<>
			<main className='bg-dark-layer-2 min-h-screen pb-16'>
				<Topbar />
				
				{/* Shared Tab Navigation */}
				<TabsNavigation />

				{/* Contests Content */}
				<div className='px-4'>
					<div
						className='flex flex-col items-center justify-center py-20 rounded-2xl max-w-[860px] mx-auto w-full mt-4'
						style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}
					>
						<h3 className='text-xl font-bold mb-2' style={{ color: "var(--text-primary)" }}>Coding Contests</h3>
						<p className='text-sm mb-6' style={{ color: "var(--text-muted)" }}>Exciting coding contests are coming soon!</p>
						<div className='text-xs font-bold uppercase tracking-wider px-6 py-2.5 rounded-full animate-pulse' style={{ background: "var(--brand-glow)", color: "var(--brand-orange)", border: "1px solid var(--border-accent)" }}>
							Coming Soon
						</div>
					</div>
				</div>
			</main>
		</>
	);
}
