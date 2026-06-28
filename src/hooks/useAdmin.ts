import { useEffect, useState } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, firestore } from "@/firebase/firebase";
import { doc, getDoc } from "firebase/firestore";

export function useAdmin() {
	const [user, loadingAuth] = useAuthState(auth);
	const [isAdmin, setIsAdmin] = useState(false);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const checkAdmin = async () => {
			if (!user) {
				setIsAdmin(false);
				setLoading(false);
				return;
			}
			// check if email is admin email
			const adminEmails = ["admin@leetcode.com", "juan@test.com", "admin@test.com", "dungpubgame@gmail.com", "24110215@st.vju.ac.vn"];
			if (adminEmails.includes(user.email || "")) {
				setIsAdmin(true);
				setLoading(false);
				return;
			}

			// check firestore
			try {
				const userRef = doc(firestore, "users", user.uid);
				const userDoc = await getDoc(userRef);
				if (userDoc.exists()) {
					const data = userDoc.data();
					if (data.isAdmin || data.role === "admin") {
						setIsAdmin(true);
					} else {
						setIsAdmin(false);
					}
				} else {
					setIsAdmin(false);
				}
			} catch (e) {
				console.error("Error checking admin status", e);
				setIsAdmin(false);
			}
			setLoading(false);
		};

		if (!loadingAuth) {
			checkAdmin();
		}
	}, [user, loadingAuth]);

	return [isAdmin, loading || loadingAuth] as const;
}
