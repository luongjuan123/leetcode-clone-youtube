import { authModalState } from "@/atoms/authModalAtom";
import Login from "@/components/Modals/Login";
import Signup from "@/components/Modals/Signup";
import ResetPassword from "@/components/Modals/ResetPassword";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/firebase/firebase";
import { useRecoilState } from "recoil";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { FaTerminal } from "react-icons/fa";

type AuthPageProps = {};

const AuthPage: React.FC<AuthPageProps> = () => {
	const [authModal, setAuthModalState] = useRecoilState(authModalState);
	const [user, loading] = useAuthState(auth);
	const [pageLoading, setPageLoading] = useState(true);
	const router = useRouter();

	useEffect(() => {
		if (user) {
			router.push("/");
		} else if (!loading) {
			setPageLoading(false);
		}
	}, [user, router, loading]);

	useEffect(() => {
		if (!router.isReady) return;
		const type = router.query.type as string;
		if (type && ["login", "register", "forgotPassword"].includes(type)) {
			setAuthModalState({ isOpen: true, type: type as any });
		}
	}, [router.isReady, router.query.type, setAuthModalState]);

	if (pageLoading || loading) return null;

	return (
		<div
			className="min-h-screen bg-dark-layer-2 flex items-center justify-center p-4"
			style={{
				backgroundImage: `
					radial-gradient(circle at top right, var(--brand-glow), transparent 50%),
					linear-gradient(rgba(255,255,255,0.007) 1px, transparent 1px),
					linear-gradient(90deg, rgba(255,255,255,0.007) 1px, transparent 1px)
				`,
				backgroundSize: "auto, 24px 24px, 24px 24px",
			}}
		>
			{/* Split Card Container */}
			<div className="w-full max-w-5xl bg-dark-layer-1/90 backdrop-blur-xl rounded-xl border border-gray-850 shadow-2xl overflow-hidden grid grid-cols-1 md:grid-cols-2">
				
				{/* Left Side: Dynamic Forms */}
				<div className="p-8 md:p-12 flex flex-col justify-center bg-gradient-to-b from-transparent to-dark-layer-2/30">
					{/* Logo Header */}
					<div className="mb-8 flex items-center gap-2.5">
						<span className="p-2 bg-brand-orange/10 rounded-lg text-brand-orange border border-brand-orange/20">
							<FaTerminal size={18} />
						</span>
						<span className="text-xl font-extrabold text-dark-gray-8 tracking-tight">BeastCode</span>
					</div>

					{/* Form router based on state */}
					{authModal.type === "login" ? (
						<Login />
					) : authModal.type === "register" ? (
						<Signup />
					) : (
						<ResetPassword />
					)}
				</div>

				{/* Right Side: Visual Editorial Block */}
				<div className="hidden md:flex flex-col justify-between bg-gradient-to-br from-dark-layer-1 to-dark-layer-2 border-l border-gray-850 p-12 relative overflow-hidden">
					{/* Ambient radial lighting */}
					<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-brand-orange/10 blur-3xl pointer-events-none rounded-full" />

					<div className="relative z-10">
						<span className="text-[10px] font-bold uppercase tracking-widest text-brand-orange bg-brand-orange/10 border border-brand-orange/20 px-2.5 py-1 rounded-full">
							System Status: active
						</span>
						<h3 className="text-xl font-bold text-dark-gray-8 mt-6 leading-snug">
							Unleash Competitive Logic at Scale
						</h3>
						<p className="text-xs text-dark-gray-7 mt-2.5 leading-relaxed">
							Compile, solve, and measure algorithms with microsecond-level accuracy. Access a dashboard custom-tailored for high-performance software engineering.
						</p>
					</div>

					{/* Floating code editor window mock */}
					<div className="relative w-full aspect-video bg-dark-layer-2/90 border border-gray-850 rounded-lg shadow-2xl p-4 font-mono text-[11px] text-dark-gray-7 animate-float my-8 select-none">
						<div className="flex items-center gap-1.5 border-b border-gray-850 pb-2.5 mb-3">
							<div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
							<div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
							<div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
							<span className="text-[10px] text-bc-muted ml-2 font-mono">Dijkstra.cpp</span>
						</div>
						<div className="space-y-1.5 text-dark-gray-7">
							<p><span className="text-bc-error">#include</span> <span className="text-bc-success">&lt;vector&gt;</span></p>
							<p><span className="text-bc-info">void</span> <span className="text-brand-orange">solve</span>() &#123;</p>
							<p className="pl-4"><span className="text-brand-orange">priority_queue</span>&lt;<span className="text-bc-info">pair</span>&lt;<span className="text-bc-info">int</span>, <span className="text-bc-info">int</span>&gt;&gt; pq;</p>
							<p className="pl-4">dist[src] = <span className="text-bc-success">0</span>;</p>
							<p className="pl-4">pq.<span className="text-brand-orange">push</span>(&#123;<span className="text-bc-success">0</span>, src&#125;);</p>
							<p>&#125;</p>
						</div>
					</div>
				</div>

			</div>
		</div>
	);
};

export default AuthPage;
