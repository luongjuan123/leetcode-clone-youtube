import { atom } from "recoil";

export interface ThreadComposerState {
	isOpen: boolean;
	parentThreadId?: string;
	replyToDisplayName?: string;
}

export const threadComposerState = atom<ThreadComposerState>({
	key: "threadComposerState",
	default: {
		isOpen: false,
	},
});
