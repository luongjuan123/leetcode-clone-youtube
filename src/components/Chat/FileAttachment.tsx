import React, { useState } from "react";
import { FaFile, FaDownload, FaSpinner } from "react-icons/fa";
import { ChatAttachment } from "@/types/chat";
import { downloadAuthorizedMedia } from "@/hooks/chat/useAuthorizedChatMedia";

interface FileAttachmentProps {
	attachment: ChatAttachment;
	isOutgoing?: boolean;
}

export const FileAttachment: React.FC<FileAttachmentProps> = ({ attachment, isOutgoing = false }) => {
	const [downloading, setDownloading] = useState(false);

	const handleDownload = async (e: React.MouseEvent) => {
		e.preventDefault();
		if (downloading) return;
		setDownloading(true);
		try {
			await downloadAuthorizedMedia(attachment);
		} finally {
			setDownloading(false);
		}
	};

	const formatSize = (bytes: number) => {
		if (!bytes || isNaN(bytes)) return "";
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	};

	return (
		<button
			type="button"
			onClick={handleDownload}
			className="flex items-center gap-3 p-2.5 rounded-xl bg-black/20 hover:bg-black/30 active:scale-[0.99] transition text-left select-none w-full max-w-[280px] sm:max-w-[340px]"
			title={`Download ${attachment.name}`}
		>
			<div className="p-2.5 rounded-lg bg-white/10 text-white shrink-0">
				<FaFile size={16} />
			</div>
			<div className="flex-1 min-w-0">
				<div className="text-xs font-bold truncate text-white">{attachment.name}</div>
				<div className="text-[10px] opacity-75 text-white/80 font-mono">
					{formatSize(attachment.size)}
				</div>
			</div>
			<div className="shrink-0 p-1.5 text-white/80 hover:text-white transition">
				{downloading ? (
					<FaSpinner size={13} className="animate-spin text-brand-orange" />
				) : (
					<FaDownload size={12} />
				)}
			</div>
		</button>
	);
};
