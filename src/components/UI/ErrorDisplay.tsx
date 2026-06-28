import React from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
	FiAlertOctagon,
	FiShield,
	FiLock,
	FiServer,
	FiCloudOff,
	FiCpu,
	FiAward,
	FiCode,
	FiMessageSquare,
	FiTerminal,
	FiSlash,
	FiCalendar,
	FiZapOff,
	FiClock,
	FiHome,
	FiArrowLeft,
	FiRefreshCw,
	FiSearch,
	FiMail,
} from "react-icons/fi";

export type ErrorType =
	| "404"
	| "403"
	| "401"
	| "500"
	| "503"
	| "maintenance"
	| "contest_not_found"
	| "problem_not_found"
	| "thread_not_found"
	| "submission_not_found"
	| "access_denied"
	| "expired_invitation"
	| "contest_ended"
	| "contest_not_started";

interface ErrorConfig {
	code: string;
	title: string;
	message: string;
	icon: React.ComponentType<{ size: number; className?: string }>;
	showRetry?: boolean;
	showSearchProblems?: boolean;
}

const ERROR_CONFIGS: Record<ErrorType, ErrorConfig> = {
	"404": {
		code: "404",
		title: "Page Not Found",
		message: "The page you are looking for has vanished into space or does not exist.",
		icon: FiAlertOctagon,
	},
	"403": {
		code: "403",
		title: "Forbidden",
		message: "You do not have permission to access this resource. Double-check your access privileges.",
		icon: FiShield,
	},
	"401": {
		code: "401",
		title: "Unauthorized",
		message: "Authentication is required. Please sign in to access this page.",
		icon: FiLock,
	},
	"500": {
		code: "500",
		title: "Internal Server Error",
		message: "Something went wrong on our end. This page is temporarily unavailable.",
		icon: FiServer,
		showRetry: true,
	},
	"503": {
		code: "503",
		title: "Service Unavailable",
		message: "The server is temporarily overloaded or down for maintenance. Please check back later.",
		icon: FiCloudOff,
		showRetry: true,
	},
	maintenance: {
		code: "503",
		title: "System Maintenance",
		message: "We are currently upgrading our systems. BeastCode will be back online shortly.",
		icon: FiCpu,
		showRetry: true,
	},
	contest_not_found: {
		code: "Contest Error",
		title: "Contest Not Found",
		message: "The requested contest could not be found. It may have been deleted, archived, or was private.",
		icon: FiAward,
	},
	problem_not_found: {
		code: "Problem Error",
		title: "Problem Not Found",
		message: "The requested coding problem could not be found. Make sure the ID is correct.",
		icon: FiCode,
		showSearchProblems: true,
	},
	thread_not_found: {
		code: "Thread Error",
		title: "Thread Not Found",
		message: "The requested discussion thread or post could not be found or has been deleted.",
		icon: FiMessageSquare,
	},
	submission_not_found: {
		code: "Submission Error",
		title: "Submission Not Found",
		message: "The requested code submission record could not be found in our database.",
		icon: FiTerminal,
	},
	access_denied: {
		code: "Access Denied",
		title: "Access Restricted",
		message: "Access is restricted. You do not possess the required administrator or role clearance.",
		icon: FiSlash,
	},
	expired_invitation: {
		code: "Expired Link",
		title: "Invitation Expired",
		message: "This invitation link is expired, invalid, or has already been consumed.",
		icon: FiCalendar,
	},
	contest_ended: {
		code: "Contest Closed",
		title: "Contest Has Ended",
		message: "This contest has already ended. Submissions and registrations are now closed.",
		icon: FiZapOff,
	},
	contest_not_started: {
		code: "Contest Scheduled",
		title: "Contest Has Not Started",
		message: "This contest has not started yet. Registrants will be able to access problems when the timer begins.",
		icon: FiClock,
		showRetry: true,
	},
};

interface ErrorDisplayProps {
	type?: ErrorType;
	customTitle?: string;
	customMessage?: string;
	retryAction?: () => void | Promise<void>;
	children?: React.ReactNode;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
	type = "404",
	customTitle,
	customMessage,
	retryAction,
	children,
}) => {
	const router = useRouter();
	const config = ERROR_CONFIGS[type] || ERROR_CONFIGS["404"];

	const title = customTitle || config.title;
	const message = customMessage || config.message;
	const IconComponent = config.icon;

	const handleBack = () => {
		if (window.history.length > 1) {
			router.back();
		} else {
			router.push("/");
		}
	};

	const handleRetry = async () => {
		if (retryAction) {
			await retryAction();
		} else {
			window.location.reload();
		}
	};

	return (
		<div className="min-h-screen flex flex-col justify-center items-center bg-dark-layer-2 px-4 select-none relative overflow-hidden font-sans">
			{/* Subtle background gradient glow */}
			<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-brand-orange/5 rounded-full blur-[80px] pointer-events-none" />

			<div className="max-w-lg w-full bg-dark-layer-1 border border-default p-8 rounded-[22px] shadow-lg text-center flex flex-col items-center gap-6 z-10 hover:shadow-glow transition-all duration-300">
				{/* Themed glow icon */}
				<div className="h-16 w-16 rounded-full bg-brand-orange/10 flex justify-center items-center text-brand-orange border border-brand-orange/20 shadow-glow animate-pulse">
					<IconComponent size={28} />
				</div>

				<div className="space-y-2">
					<span className="text-[11px] font-bold font-mono tracking-widest text-brand-orange uppercase bg-brand-orange/10 px-3 py-1 rounded-full border border-brand-orange/20">
						{config.code}
					</span>
					<h1 className="text-2xl font-extrabold text-gray-100 tracking-tight mt-2">
						{title}
					</h1>
					<p className="text-sm text-gray-400 leading-relaxed max-w-sm mx-auto">
						{message}
					</p>
				</div>

				{children}

				<div className="flex flex-col gap-3 w-full mt-2">
					{/* Primary Navigation Actions */}
					<div className="flex flex-col sm:flex-row gap-3 w-full">
						<button
							onClick={handleBack}
							className="flex items-center justify-center gap-2 flex-1 py-2.5 px-4 bg-dark-fill-3 hover:bg-dark-fill-2 text-gray-200 text-sm font-semibold rounded-xl border border-default transition duration-200"
						>
							<FiArrowLeft size={16} />
							<span>Go Back</span>
						</button>
						<Link
							href="/"
							className="flex items-center justify-center gap-2 flex-1 py-2.5 px-4 bg-brand-orange hover:bg-brand-orange-s text-black text-sm font-semibold rounded-xl transition duration-200 shadow-glow-sm"
						>
							<FiHome size={16} />
							<span>Go Home</span>
						</Link>
					</div>

					{/* Secondary Context Actions */}
					{(config.showRetry || retryAction) && (
						<button
							onClick={handleRetry}
							className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-dark-fill-3 hover:bg-dark-fill-2 text-gray-200 text-sm font-semibold rounded-xl border border-default transition duration-200"
						>
							<FiRefreshCw size={14} className="animate-spin" style={{ animationDuration: "3s" }} />
							<span>Retry Action</span>
						</button>
					)}

					{config.showSearchProblems && (
						<Link
							href="/problems"
							className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-dark-fill-3 hover:bg-dark-fill-2 text-gray-200 text-sm font-semibold rounded-xl border border-default transition duration-200"
						>
							<FiSearch size={14} />
							<span>Search Problems</span>
						</Link>
					)}

					<a
						href="mailto:support@beastcode.com?subject=BeastCode%20Error%20Report"
						className="flex items-center justify-center gap-2 w-full py-2 px-4 text-xs font-semibold text-gray-400 hover:text-gray-200 transition duration-150"
					>
						<FiMail size={12} />
						<span>Contact Support</span>
					</a>
				</div>
			</div>
		</div>
	);
};

export default ErrorDisplay;
