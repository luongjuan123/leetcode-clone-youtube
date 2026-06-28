import React, { useEffect, useState, useRef } from "react";
import Topbar from "@/components/Topbar/Topbar";

import { auth, firestore } from "@/firebase/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { FaPalette, FaUserCog, FaSave, FaUser, FaCamera, FaBell, FaKey } from "react-icons/fa";
import useHasMounted from "@/hooks/useHasMounted";
import { getFriendlyErrorMessage } from "@/utils/errorFilter";
import NotificationPreferences from "@/components/Notification/NotificationPreferences";
import ChangePasswordForm from "@/components/Settings/ChangePasswordForm";

interface UserProfile {
	displayName: string;
	studentId: string;
	school: string;
	class: string;
	faculty: string;
	bio: string;
	avatarUrl?: string;
	showStudentInfo?: boolean;
	country?: string;
	notificationPreferences?: {
		reminders: boolean;
		achievements: boolean;
		editorials: boolean;
		upsolve: boolean;
		social: boolean;
		university: boolean;
		announcements: boolean;
		marketing: boolean;
		digest: boolean;
	};
}

export default function SettingsPage() {
	const hasMounted = useHasMounted();
	const [user] = useAuthState(auth);
	const [activeTheme, setActiveTheme] = useState("default");
	const [loading, setLoading] = useState(false);
	const avatarInputRef = useRef<HTMLInputElement>(null);
	const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
	const [avatarBase64, setAvatarBase64] = useState<string | null>(null);

	const [profile, setProfile] = useState<UserProfile>({
		displayName: "",
		studentId: "",
		school: "BeastCode University",
		class: "",
		faculty: "",
		bio: "",
		avatarUrl: "",
		showStudentInfo: true,
		country: "United States",
		notificationPreferences: {
			reminders: true,
			achievements: true,
			editorials: true,
			upsolve: true,
			social: true,
			university: true,
			announcements: true,
			marketing: true,
			digest: true,
		}
	});

	const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

	// Load active theme
	useEffect(() => {
		if (typeof window !== "undefined") {
			const saved = localStorage.getItem("theme") || "default";
			setActiveTheme(saved);
		}
	}, []);

	// Load profile info if logged in
	useEffect(() => {
		if (!user) return;
		const loadProfile = async () => {
			try {
				const userRef = doc(firestore, "users", user.uid);
				const userSnap = await getDoc(userRef);
				if (userSnap.exists()) {
					const data = userSnap.data();
					setProfile({
						displayName: data.displayName || "",
						studentId: data.studentId || "",
						school: data.school || "BeastCode University",
						class: data.class || "",
						faculty: data.faculty || "",
						bio: data.bio || "",
						avatarUrl: data.avatarUrl || "",
						showStudentInfo: data.showStudentInfo !== false,
						country: data.country || "United States",
						notificationPreferences: {
							reminders: data.notificationPreferences?.reminders !== false,
							achievements: data.notificationPreferences?.achievements !== false,
							editorials: data.notificationPreferences?.editorials !== false,
							upsolve: data.notificationPreferences?.upsolve !== false,
							social: data.notificationPreferences?.social !== false,
							university: data.notificationPreferences?.university !== false,
							announcements: data.notificationPreferences?.announcements !== false,
							marketing: data.notificationPreferences?.marketing !== false,
							digest: data.notificationPreferences?.digest !== false,
						}
					});
					if (data.avatarUrl) {
						setAvatarPreview(data.avatarUrl);
					}
				}
			} catch (e) {
				console.error("Error loading profile:", e);
			}
		};
		loadProfile();
	}, [user]);

	const handleThemeChange = (newTheme: string) => {
		localStorage.setItem("theme", newTheme);
		document.documentElement.setAttribute("data-theme", newTheme);
		setActiveTheme(newTheme);
		window.dispatchEvent(new Event("themechange"));
	};

	const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		if (file.size > 5 * 1024 * 1024) {
			setFeedback({ type: "error", text: "File size must be less than 5MB" });
			return;
		}
		const reader = new FileReader();
		reader.onloadend = () => {
			const base64String = reader.result as string;
			setAvatarPreview(base64String);
			setAvatarBase64(base64String);
			setFeedback(null);
		};
		reader.readAsDataURL(file);
	};

	const handleSave = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!user) return;
		setLoading(true);
		setFeedback(null);

		try {
			const userRef = doc(firestore, "users", user.uid);
			const updatedData = {
				...profile,
				avatarUrl: avatarBase64 || profile.avatarUrl || "",
				updatedAt: Date.now(),
			};
			await setDoc(userRef, updatedData, { merge: true });
			setFeedback({ type: "success", text: "Profile settings updated successfully!" });
			setTimeout(() => {
				setFeedback(null);
			}, 4000);
		} catch (error: any) {
			setFeedback({ type: "error", text: getFriendlyErrorMessage(error, "Update failed. Please try again.") });
		} finally {
			setLoading(false);
		}
	};

	if (!hasMounted) return null;

	const themesList = [
		{
			id: "default",
			name: "Default (LeetCode Dark)",
			desc: "Modern dark slate interface with orange accents.",
			previewBg: "bg-dark-layer-1",
			previewAccent: "bg-brand-orange",
		},
		{
			id: "light",
			name: "Light Mode",
			desc: "Clean light grey and white interface with blue highlights.",
			previewBg: "bg-dark-layer-1",
			previewAccent: "bg-bc-info",
		},
		{
			id: "sakura",
			name: "Sakura (Cherry Blossom)",
			desc: "Elegant cherry-blossom pink styling for a soft visual feel.",
			previewBg: "bg-dark-layer-1",
			previewAccent: "bg-brand-orange",
		},
		{
			id: "red",
			name: "Red (Crimson)",
			desc: "Vibrant crimson borders and headers with sleek dark panels.",
			previewBg: "bg-dark-layer-1",
			previewAccent: "bg-bc-error",
		},
	];

	return (
		<main className='bg-dark-layer-2 min-h-screen pb-16'>
			<Topbar />
			<div className='max-w-[860px] mx-auto w-full mt-8 px-4'>


				<h1 className='text-2xl font-bold mb-6' style={{ color: 'var(--text-primary)' }}>
					Settings & Personalization
				</h1>

				<div className='space-y-8'>
					{/* Theme Switcher section */}
					<div className='rounded-2xl p-6 space-y-4' style={{ background: "var(--bg-dark-layer-1)", border: "1px solid var(--border-subtle)" }}>
						<h2 className='text-lg font-bold pb-3 flex items-center gap-2' style={{ color: "var(--text-primary)", borderBottom: "1px solid var(--border-subtle)" }}>
							<FaPalette className='text-brand-orange' />
							Website Theme Style
						</h2>
						<p className='text-xs' style={{ color: "var(--text-secondary)" }}>
							Select a visual style theme to apply across the entire Online Judge platform.
						</p>

						<div className='grid grid-cols-1 md:grid-cols-2 gap-4 pt-2'>
							{themesList.map((theme) => {
								const isSelected = activeTheme === theme.id;
								return (
									<div
										key={theme.id}
										onClick={() => handleThemeChange(theme.id)}
										className={`cursor-pointer border rounded-xl p-4 flex gap-4 transition duration-300 hover:scale-[1.01] ${
											isSelected
												? "border-brand-orange bg-brand-glow"
												: "border-border-subtle hover:border-border-accent bg-dark-fill-3"
										}`}
									>
										{/* Mini screen preview */}
										<div className={`w-16 h-12 rounded-lg ${theme.previewBg} p-2 flex flex-col justify-between shrink-0`} style={{ border: "1px solid var(--border-subtle)" }}>
											<div className='h-1.5 w-1/2 bg-gray-700 rounded-full' />
											<div className='flex justify-between items-center'>
												<div className='h-2 w-8 bg-gray-800 rounded' />
												<div className={`h-3 w-3 rounded-full ${theme.previewAccent}`} />
											</div>
										</div>

										<div className='overflow-hidden'>
											<p className='text-sm font-bold truncate' style={{ color: isSelected ? "var(--brand-orange)" : "var(--text-primary)" }}>
												{theme.name}
											</p>
											<p className='text-[10px] mt-1 line-clamp-2' style={{ color: "var(--text-muted)" }}>
												{theme.desc}
											</p>
										</div>
									</div>
								);
							})}
						</div>
					</div>

					{/* Account Modification section */}
					{user ? (
						<form onSubmit={handleSave} className='rounded-2xl p-6 space-y-6' style={{ background: "var(--bg-dark-layer-1)", border: "1px solid var(--border-subtle)" }}>
							<h2 className='text-lg font-bold pb-3 flex items-center gap-2' style={{ color: "var(--text-primary)", borderBottom: "1px solid var(--border-subtle)" }}>
								<FaUserCog className='text-brand-orange' />
								Account Details & Student Info
							</h2>

							{/* Avatar Uploader */}
							<div className='flex flex-col items-center gap-3 p-4 rounded-xl' style={{ background: "var(--bg-dark-fill-3)", border: "1px dashed var(--border-subtle)" }}>
								<p className='text-xs font-semibold uppercase tracking-wider' style={{ color: "var(--text-secondary)" }}>Profile Picture</p>
								<div className='relative group cursor-pointer' onClick={() => avatarInputRef.current?.click()}>
									{avatarPreview ? (
										<img
											src={avatarPreview}
											alt='Avatar preview'
											className='w-20 h-20 rounded-full object-cover border-2 border-brand-orange/60 shadow-lg'
										/>
									) : (
										<div className='w-20 h-20 rounded-full flex items-center justify-center' style={{ background: "var(--bg-dark-fill-3)", border: "2px solid var(--border-subtle)" }}>
											<FaUser size={28} style={{ color: "var(--text-muted)" }} />
										</div>
									)}
									<div className='absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center'>
										<FaCamera size={16} className='text-white' />
									</div>
								</div>
								<button
									type='button'
									onClick={() => avatarInputRef.current?.click()}
									className='text-xs text-brand-orange hover:underline font-medium'
								>
									Change avatar picture
								</button>
								<input
									ref={avatarInputRef}
									type='file'
									accept='image/*'
									className='hidden'
									onChange={handleAvatarChange}
								/>
								{avatarBase64 && (
									<span className='text-[10px] text-green-400 font-medium'>✓ New avatar ready — save to apply</span>
								)}
							</div>

							<div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
								<div className='col-span-1 md:col-span-2'>
									<label htmlFor='displayName' className='text-sm font-semibold block mb-2' style={{ color: "var(--text-secondary)" }}>
										Display Name
									</label>
									<input
										value={profile.displayName}
										onChange={(e) => setProfile((p) => ({ ...p, displayName: e.target.value }))}
										type='text'
										id='displayName'
										className='outline-none sm:text-sm rounded-lg focus:ring-1 focus:ring-brand-orange focus:border-brand-orange block w-full p-3'
										style={{ background: "var(--bg-dark-fill-3)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}
										placeholder='Nguyen Van A'
										required
									/>
								</div>

								<div>
									<label htmlFor='studentId' className='text-sm font-semibold block mb-2' style={{ color: "var(--text-secondary)" }}>
										Student ID Code
									</label>
									<input
										value={profile.studentId}
										onChange={(e) => setProfile((p) => ({ ...p, studentId: e.target.value }))}
										type='text'
										id='studentId'
										className='outline-none sm:text-sm rounded-lg focus:ring-1 focus:ring-brand-orange focus:border-brand-orange block w-full p-3 font-mono'
										style={{ background: "var(--bg-dark-fill-3)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}
										placeholder='e.g. 22010234'
									/>
								</div>

								<div>
									<label htmlFor='school' className='text-sm font-semibold block mb-2' style={{ color: "var(--text-secondary)" }}>
										School / University
									</label>
									<input
										value={profile.school}
										onChange={(e) => setProfile((p) => ({ ...p, school: e.target.value }))}
										type='text'
										id='school'
										className='outline-none sm:text-sm rounded-lg focus:ring-1 focus:ring-brand-orange focus:border-brand-orange block w-full p-3'
										style={{ background: "var(--bg-dark-fill-3)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}
										placeholder='BeastCode University'
									/>
								</div>

								<div>
									<label htmlFor='country' className='text-sm font-semibold block mb-2' style={{ color: "var(--text-secondary)" }}>
										Country
									</label>
									<select
										value={profile.country || "United States"}
										onChange={(e) => setProfile((p) => ({ ...p, country: e.target.value }))}
										id='country'
										className='outline-none sm:text-sm rounded-lg focus:ring-1 focus:ring-brand-orange focus:border-brand-orange block w-full p-3 cursor-pointer'
										style={{ background: "var(--bg-dark-fill-3)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}
									>
										<option value="United States">🇺🇸 United States</option>
										<option value="Canada">🇨🇦 Canada</option>
										<option value="United Kingdom">🇬🇧 United Kingdom</option>
										<option value="Vietnam">🇻🇳 Vietnam</option>
										<option value="Singapore">🇸🇬 Singapore</option>
										<option value="Australia">🇦🇺 Australia</option>
										<option value="Germany">🇩🇪 Germany</option>
										<option value="France">🇫🇷 France</option>
										<option value="Japan">🇯🇵 Japan</option>
									</select>
								</div>

								<div>
									<label htmlFor='faculty' className='text-sm font-semibold block mb-2' style={{ color: "var(--text-secondary)" }}>
										Faculty / Department
									</label>
									<input
										value={profile.faculty}
										onChange={(e) => setProfile((p) => ({ ...p, faculty: e.target.value }))}
										type='text'
										id='faculty'
										className='outline-none sm:text-sm rounded-lg focus:ring-1 focus:ring-brand-orange focus:border-brand-orange block w-full p-3'
										style={{ background: "var(--bg-dark-fill-3)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}
										placeholder='e.g. Computer Science & Engineering'
									/>
								</div>

								<div>
									<label htmlFor='class' className='text-sm font-semibold block mb-2' style={{ color: "var(--text-secondary)" }}>
										Class
									</label>
									<input
										value={profile.class}
										onChange={(e) => setProfile((p) => ({ ...p, class: e.target.value }))}
										type='text'
										id='class'
										className='outline-none sm:text-sm rounded-lg focus:ring-1 focus:ring-brand-orange focus:border-brand-orange block w-full p-3'
										style={{ background: "var(--bg-dark-fill-3)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}
										placeholder='e.g. CSE-2026'
									/>
								</div>

								<div className='col-span-1 md:col-span-2'>
									<label htmlFor='bio' className='text-sm font-semibold block mb-2' style={{ color: "var(--text-secondary)" }}>
										Short Bio
									</label>
									<textarea
										value={profile.bio}
										onChange={(e) => setProfile((p) => ({ ...p, bio: e.target.value }))}
										id='bio'
										rows={4}
										className='outline-none sm:text-sm rounded-lg focus:ring-1 focus:ring-brand-orange block w-full p-3'
										style={{ background: "var(--bg-dark-fill-3)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}
										placeholder='Tell us a bit about yourself...'
									/>
								</div>

								<div className='col-span-1 md:col-span-2 flex items-center justify-between p-4 rounded-xl mt-2' style={{ background: "var(--bg-dark-fill-3)", border: "1px solid var(--border-subtle)" }}>
									<div>
										<label className='text-sm font-semibold block' style={{ color: "var(--text-primary)" }}>
											Public Student Information
										</label>
										<p className='text-xs mt-0.5' style={{ color: "var(--text-muted)" }}>
											Allow other users to see your Student ID, school, class, and faculty.
										</p>
									</div>
									<button
										type='button'
										onClick={() => setProfile((p) => ({ ...p, showStudentInfo: p.showStudentInfo !== false ? false : true }))}
										className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
											profile.showStudentInfo !== false ? "bg-brand-orange" : "bg-gray-700"
										}`}
									>
										<span
											className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
												profile.showStudentInfo !== false ? "translate-x-5" : "translate-x-0"
											}`}
										/>
									</button>
								</div>

								<NotificationPreferences
									preferences={profile.notificationPreferences || {
										reminders: true,
										achievements: true,
										editorials: true,
										upsolve: true,
										social: true,
										university: true,
										announcements: true,
										marketing: true,
										digest: true,
									}}
									onChange={(updatedPreferences) => setProfile((p) => ({
										...p,
										notificationPreferences: updatedPreferences
									}))}
								/>
							</div>

							<div className='pt-6 flex justify-between items-center gap-4' style={{ borderTop: "1px solid var(--border-subtle)" }}>
								<div>
									{feedback && (
										<span className={`text-xs font-semibold ${
											feedback.type === "success" ? "text-green-400" : "text-rose-450"
										}`}>
											{feedback.text}
										</span>
									)}
								</div>
								<button
									type='submit'
									disabled={loading}
									className='bg-brand-orange hover:bg-brand-orange-s text-white px-8 py-2.5 rounded-lg font-bold transition shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed'
								>
									<FaSave size={16} />
									{loading ? "Saving..." : "Save Settings"}
								</button>
							</div>
						</form>
					) : (
						<div className='rounded-2xl p-6 shadow-2xl text-center text-sm py-10' style={{ background: "var(--bg-dark-layer-1)", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}>
							Please <span className='text-brand-orange font-bold'>Sign In</span> to modify your student details and upload your profile picture.
						</div>
					)}
					{/* ── Security: Change Password ──────────────────────── */}
					{user && (
						<div>
							<h2 className='text-lg font-bold mb-4 flex items-center gap-2' style={{ color: "var(--text-primary)" }}>
								<FaKey className='text-brand-orange' size={16} />
								Security
							</h2>
							<ChangePasswordForm />
						</div>
					)}

				</div>
			</div>
		</main>
	);
}
