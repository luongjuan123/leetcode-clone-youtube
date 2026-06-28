import Topbar from "@/components/Topbar/Topbar";

import ThreadsBoard from "@/components/Threads/Threads";
import useHasMounted from "@/hooks/useHasMounted";

export default function ThreadsPage() {
	const hasMounted = useHasMounted();
	if (!hasMounted) return null;

	return (
		<>
			<main className='bg-dark-layer-2 min-h-screen pb-16'>
				<Topbar />

				<div className='px-6'>
					<ThreadsBoard />
				</div>
			</main>
		</>
	);
}
