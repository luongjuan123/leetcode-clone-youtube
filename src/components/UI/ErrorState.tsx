import React from "react";
import Link from "next/link";
import { FiLock, FiAlertTriangle, FiWifiOff, FiHelpCircle, FiHome, FiRefreshCw } from "react-icons/fi";

type ErrorType = "401" | "403" | "404" | "500" | "offline" | "loading_failed" | "unexpected";

interface ErrorStateProps {
	type: ErrorType;
	message?: string;
	onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ type, message, onRetry }) => {
	const getErrorDetails = () => {
		switch (type) {
			case "401":
				return {
					icon: <FiLock size={28} />,
					title: "Unauthorized Access",
					desc: message || "You must be signed in to access this content.",
					iconClass: "bg-red-500/10 text-red-500 border-red-500/20 shadow-glow-error",
				};
			case "403":
				return {
					icon: <FiLock size={28} />,
					title: "Access Forbidden",
					desc: message || "You do not have permission to view this resource.",
					iconClass: "bg-red-500/10 text-red-500 border-red-500/20 shadow-glow-error",
				};
			case "offline":
				return {
					icon: <FiWifiOff size={28} />,
					title: "Network Connection Lost",
					desc: message || "Please check your internet connection and try again.",
					iconClass: "bg-amber-500/10 text-amber-500 border-amber-500/20 shadow-glow-warning",
				};
			case "loading_failed":
				return {
					icon: <FiAlertTriangle size={28} />,
					title: "Unable to Load Content",
					desc: message || "Please check your network connection and try again.",
					iconClass: "bg-brand-orange/10 text-brand-orange border-brand-orange/20 shadow-glow",
				};
			case "500":
				return {
					icon: <FiAlertTriangle size={28} />,
					title: "Internal Server Error",
					desc: message || "Something went wrong. Please try again later.",
					iconClass: "bg-red-500/10 text-red-500 border-red-500/20 shadow-glow-error",
				};
			default:
				return {
					icon: <FiHelpCircle size={28} />,
					title: "Unexpected Error",
					desc: message || "An unexpected error occurred. Please try again later.",
					iconClass: "bg-brand-orange/10 text-brand-orange border-brand-orange/20 shadow-glow",
				};
		}
	};

	const details = getErrorDetails();

	return (
		<div className="min-h-[400px] flex flex-col justify-center items-center px-4 select-none w-full">
			<div className="max-w-md w-full bg-dark-layer-1 border border-default p-8 rounded-2xl shadow-lg text-center flex flex-col items-center gap-6 animate-fade-in">
				<div className={`h-16 w-16 rounded-full flex justify-center items-center border ${details.iconClass}`}>
					{details.icon}
				</div>
				<div className="space-y-2">
					<h2 className="text-lg font-bold text-gray-200">{details.title}</h2>
					<p className="text-sm text-gray-400">{details.desc}</p>
				</div>
				<div className="flex flex-col sm:flex-row gap-3 w-full">
					{onRetry && (
						<button
							onClick={onRetry}
							className="flex items-center justify-center gap-2 flex-1 py-2.5 px-4 bg-brand-orange hover:bg-brand-orange-s text-black text-sm font-semibold rounded-lg transition-all duration-200 shadow-sm"
						>
							<FiRefreshCw size={16} />
							<span>Try Again</span>
						</button>
					)}
					<Link href="/" className="flex items-center justify-center gap-2 flex-1 py-2.5 px-4 bg-dark-fill-3 hover:bg-dark-fill-2 text-gray-200 text-sm font-semibold rounded-lg transition-all duration-200 border border-default">
						<FiHome size={16} />
						<span>Return Home</span>
					</Link>
				</div>
			</div>
		</div>
	);
};

export default ErrorState;
