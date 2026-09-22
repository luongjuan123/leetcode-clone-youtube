import { authModalState } from "@/atoms/authModalAtom";
import React, { useEffect } from "react";
import { IoClose } from "react-icons/io5";
import Login from "./Login";
import ResetPassword from "./ResetPassword";
import Signup from "./Signup";
import { useRecoilValue, useSetRecoilState } from "recoil";

type AuthModalProps = {};

const AuthModal: React.FC<AuthModalProps> = () => {
	const authModal = useRecoilValue(authModalState);
	const closeModal = useCloseModal();
	if (!authModal.isOpen) return null;

	return (
		<div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
			<div
				className="fixed inset-0 bg-black/75 backdrop-blur-md"
				onClick={closeModal}
			></div>
			<div className="relative z-10 w-full sm:w-[450px] max-h-[90vh] overflow-y-auto">
				<div data-modal="auth-modal" className="bc-modal-shell rounded-2xl shadow-2xl relative w-full animate-fade-in overflow-hidden">
					<div className="flex justify-end p-2">
						<button
							type="button"
							className="bg-transparent rounded-lg text-sm p-1.5 ml-auto inline-flex items-center text-dark-gray-7 hover:text-dark-gray-8 hover:bg-dark-fill-3 transition"
							onClick={closeModal}
						>
							<IoClose className="h-5 w-5" />
						</button>
					</div>
					{authModal.type === "login" ? <Login /> : authModal.type === "register" ? <Signup /> : <ResetPassword />}
				</div>
			</div>
		</div>
	);
};
export default AuthModal;

function useCloseModal() {
	const setAuthModal = useSetRecoilState(authModalState);

	const closeModal = () => {
		setAuthModal((prev) => ({ ...prev, isOpen: false, type: "login" }));
	};

	useEffect(() => {
		const handleEsc = (e: KeyboardEvent) => {
			if (e.key === "Escape") closeModal();
		};
		window.addEventListener("keydown", handleEsc);
		return () => window.removeEventListener("keydown", handleEsc);
	}, []);

	return closeModal;
}
