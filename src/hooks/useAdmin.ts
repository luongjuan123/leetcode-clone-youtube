import { useEffect, useState } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/firebase/firebase";

export const useAdmin = () => {
const [user, loading] = useAuthState(auth);
const [isAdmin, setIsAdmin] = useState(false);
const [adminLoading, setAdminLoading] = useState(true);

useEffect(() => {
const checkAdmin = async () => {
if (user) {
try {
const idTokenResult = await user.getIdTokenResult();
const claims = idTokenResult.claims;
setIsAdmin(claims.admin === true);
} catch (error) {
console.error("Error checking admin status:", error);
setIsAdmin(false);
}
} else {
setIsAdmin(false);
}
setAdminLoading(false);
};

if (!loading) {
checkAdmin();
}
}, [user, loading]);

return { isAdmin, loading: adminLoading || loading, user };
};
