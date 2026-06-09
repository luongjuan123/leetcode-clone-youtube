import { authModalState } from "@/atoms/authModalAtom";
import Login from "@/components/Modals/Login";
import Signup from "@/components/Modals/Signup";
import ResetPassword from "@/components/Modals/ResetPassword";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/firebase/firebase";
import { useRecoilValue } from "recoil";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { FaTerminal } from "react-icons/fa";

type AuthPageProps = {};

const AuthPage: React.FC<AuthPageProps> = () => {
	const authModal = useRecoilValue(authModalState);
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

	if (pageLoading || loading) return null;

	return (
		<div className="min-h-screen bg-[#0B0F19] bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.06),transparent_50%)] bg-[linear-gradient(rgba(255,255,255,0.007)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.007)_1px,transparent_1px)] bg-[size:24px_24px] flex items-center justify-center p-4">
			{/* Split Card Container */}
			<div className="w-full max-w-5xl bg-[#0D0E12]/90 backdrop-blur-xl rounded-xl border border-slate-800/80 shadow-2xl overflow-hidden grid grid-cols-1 md:grid-cols-2">
				
				{/* Left Side: Dynamic Forms */}
				<div className="p-8 md:p-12 flex flex-col justify-center bg-gradient-to-b from-transparent to-slate-900/30">
					{/* Logo Header */}
					<div className="mb-8 flex items-center gap-2.5">
						<span className="p-2 bg-amber-500/10 rounded-lg text-amber-500 border border-amber-500/20">
							<FaTerminal size={18} />
						</span>
						<span className="text-xl font-extrabold text-white tracking-tight">BeastCode</span>
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
				<div className="hidden md:flex flex-col justify-between bg-gradient-to-br from-[#12131a] to-[#0d0e12] border-l border-slate-800/80 p-12 relative overflow-hidden">
					{/* Ambient radial lighting */}
					<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-amber-500/10 blur-3xl pointer-events-none rounded-full" />

					<div className="relative z-10">
						<span className="text-[10px] font-bold uppercase tracking-widest text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full">
							System Status: active
						</span>
						<h3 className="text-xl font-bold text-white mt-6 leading-snug">
							Unleash Competitive Logic at Scale
						</h3>
						<p className="text-xs text-slate-400 mt-2.5 leading-relaxed">
							Compile, solve, and measure algorithms with microsecond-level accuracy. Access a dashboard custom-tailored for high-performance software engineering.
						</p>
					</div>

					{/* Floating code editor window mock */}
					<div className="relative w-full aspect-video bg-[#0B0F19]/90 border border-slate-800/80 rounded-lg shadow-2xl p-4 font-mono text-[11px] text-slate-300 animate-float my-8 select-none">
						<div className="flex items-center gap-1.5 border-b border-slate-800/80 pb-2.5 mb-3">
							<div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
							<div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
							<div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
							<span className="text-[10px] text-slate-500 ml-2 font-mono">Dijkstra.cpp</span>
						</div>
						<div className="space-y-1.5 text-slate-400">
							<p><span className="text-rose-400">#include</span> <span className="text-emerald-400">&lt;vector&gt;</span></p>
							<p><span className="text-blue-400">void</span> <span className="text-amber-400">solve</span>() &#123;</p>
							<p className="pl-4"><span className="text-amber-400">priority_queue</span>&lt;<span className="text-blue-400">pair</span>&lt;<span className="text-blue-400">int</span>, <span className="text-blue-400">int</span>&gt;&gt; pq;</p>
							<p className="pl-4">dist[src] = <span className="text-emerald-400">0</span>;</p>
							<p className="pl-4">pq.<span className="text-amber-400">push</span>(&#123;<span className="text-emerald-400">0</span>, src&#125;);</p>
							<p>&#125;</p>
						</div>
					</div>

					<div className="relative z-10 flex items-center justify-between text-[10px] text-slate-500">
						<span>Powered by Next.js & Firebase</span>
						<span>v2.5.0</span>
					</div>
				</div>

			</div>
		</div>
	);
};

export default AuthPage;
