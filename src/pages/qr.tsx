import React, { useState, useEffect } from "react";
import Topbar from "@/components/Topbar/Topbar";
import { FaUniversity, FaCreditCard, FaWallet, FaCopy, FaCheck, FaSpinner, FaLock, FaExternalLinkAlt } from "react-icons/fa";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardNumberElement, CardExpiryElement, CardCvcElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { getFriendlyErrorMessage } from "@/utils/errorFilter";

const STRIPE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";
const stripePromise = STRIPE_KEY ? loadStripe(STRIPE_KEY) : null;

// StripeCardForm subcomponent
function StripeCardForm({ amount }: { amount: number }) {
	const stripe = useStripe();
	const elements = useElements();
	const [cardholderName, setCardholderName] = useState("");
	const [processing, setProcessing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);
	const [focusedField, setFocusedField] = useState<string | null>(null);
	const [theme, setTheme] = useState("default");

	useEffect(() => {
		if (typeof window !== "undefined") {
			const currentTheme = document.documentElement.getAttribute("data-theme") || "default";
			setTheme(currentTheme);
			const handleThemeChange = () => {
				setTheme(document.documentElement.getAttribute("data-theme") || "default");
			};
			window.addEventListener("themechange", handleThemeChange);
			return () => window.removeEventListener("themechange", handleThemeChange);
		}
	}, []);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!stripe || !elements) return;

		setProcessing(true);
		setError(null);

		try {
			const res = await fetch("/api/create-payment-intent", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ amount, currency: "usd" }),
			});
			const data = await res.json();
			if (!res.ok) {
				throw new Error(data.error || "Failed to initialize secure payment.");
			}

			const clientSecret = data.clientSecret;

			const result = await stripe.confirmCardPayment(clientSecret, {
				payment_method: {
					card: elements.getElement(CardNumberElement)!,
					billing_details: {
						name: cardholderName,
					},
				},
			});

			if (result.error) {
				setError(getFriendlyErrorMessage(result.error, "Payment failed. Please try again."));
			} else if (result.paymentIntent?.status === "succeeded") {
				setSuccess(true);
			}
		} catch (err: any) {
			setError(getFriendlyErrorMessage(err, "An unexpected error occurred."));
		} finally {
			setProcessing(false);
		}
	};

	if (success) {
		return (
			<div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
				<div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[#10b981] flex items-center justify-center text-xl animate-bounce">
					✓
				</div>
				<h4 className="text-md font-bold" style={{ color: "var(--text-primary)" }}>
					Thank You for Your Support!
				</h4>
				<p className="text-xs max-w-xs" style={{ color: "var(--text-secondary)" }}>
					Your donation of ${amount} was processed successfully. We appreciate your generosity!
				</p>
			</div>
		);
	}

	const isLightTheme = theme === "light";
	const elementOptions = {
		style: {
			base: {
				fontSize: "14px",
				color: isLightTheme ? "#111827" : "#f3f4f6",
				fontFamily: "monospace, Courier, monospace",
				"::placeholder": {
					color: isLightTheme ? "#9ca3af" : "#6b7280",
				},
			},
			invalid: {
				color: "#ef4444",
			},
		},
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			{error && (
				<div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-xs rounded-xl">
					{error}
				</div>
			)}

			<div>
				<label className="text-xs font-semibold uppercase tracking-wider block mb-1.5" style={{ color: "var(--text-secondary)" }}>
					Cardholder Name
				</label>
				<input
					type="text"
					value={cardholderName}
					onChange={(e) => setCardholderName(e.target.value.toUpperCase())}
					placeholder="JOHN DOE"
					required
					disabled={processing}
					className="w-full border rounded-xl p-3 text-sm uppercase focus-visible:outline-none transition-all duration-300 focus-visible:border-brand-orange glow-focus"
					style={{
						backgroundColor: "var(--bg-dark-layer-1)",
						borderColor: "var(--border-default)",
						color: "var(--text-primary)",
					}}
				/>
			</div>

			<div>
				<label className="text-xs font-semibold uppercase tracking-wider block mb-1.5" style={{ color: "var(--text-secondary)" }}>
					Card Number
				</label>
				<div
					className={`border rounded-xl p-3 transition-all duration-300 ${focusedField === "number" ? "border-brand-orange glow-sm" : ""
						}`}
					style={{
						backgroundColor: "var(--bg-dark-layer-1)",
						borderColor: focusedField === "number" ? "" : "var(--border-default)",
					}}
				>
					<CardNumberElement
						options={elementOptions}
						onFocus={() => setFocusedField("number")}
						onBlur={() => setFocusedField(null)}
					/>
				</div>
			</div>

			<div className="grid grid-cols-2 gap-4">
				<div>
					<label className="text-xs font-semibold uppercase tracking-wider block mb-1.5" style={{ color: "var(--text-secondary)" }}>
						Expiry Date
					</label>
					<div
						className={`border rounded-xl p-3 transition-all duration-300 ${focusedField === "expiry" ? "border-brand-orange glow-sm" : ""
							}`}
						style={{
							backgroundColor: "var(--bg-dark-layer-1)",
							borderColor: focusedField === "expiry" ? "" : "var(--border-default)",
						}}
					>
						<CardExpiryElement
							options={elementOptions}
							onFocus={() => setFocusedField("expiry")}
							onBlur={() => setFocusedField(null)}
						/>
					</div>
				</div>

				<div>
					<label className="text-xs font-semibold uppercase tracking-wider block mb-1.5" style={{ color: "var(--text-secondary)" }}>
						CVC / CVV
					</label>
					<div
						className={`border rounded-xl p-3 transition-all duration-300 ${focusedField === "cvc" ? "border-brand-orange glow-sm" : ""
							}`}
						style={{
							backgroundColor: "var(--bg-dark-layer-1)",
							borderColor: focusedField === "cvc" ? "" : "var(--border-default)",
						}}
					>
						<CardCvcElement
							options={elementOptions}
							onFocus={() => setFocusedField("cvc")}
							onBlur={() => setFocusedField(null)}
						/>
					</div>
				</div>
			</div>

			<button
				type="submit"
				disabled={processing || !stripe}
				className="w-full font-bold py-3.5 rounded-xl transition-all duration-300 transform active:scale-[0.99] flex items-center justify-center gap-2 mt-6 cursor-pointer disabled:opacity-50"
				style={{
					backgroundColor: "var(--brand-orange)",
					color: "#0d0d0f",
				}}
			>
				{processing ? (
					<>
						<FaSpinner className="animate-spin" size={16} />
						<span>Processing Payment...</span>
					</>
				) : (
					<>
						<FaLock size={12} />
						<span>Donate ${amount} Securely</span>
					</>
				)}
			</button>
		</form>
	);
}

// MockCardForm subcomponent for testing and fallback when API Keys are not set
function MockCardForm({ amount }: { amount: number }) {
	const [cardNumber, setCardNumber] = useState("");
	const [cardName, setCardName] = useState("");
	const [cardExpiry, setCardExpiry] = useState("");
	const [cardCvc, setCardCvc] = useState("");
	const [submitState, setSubmitState] = useState<"idle" | "processing" | "success">("idle");
	const [formErrors, setFormErrors] = useState<{
		cardName?: string;
		cardNumber?: string;
		cardExpiry?: string;
		cardCvc?: string;
	}>({});

	const validateLuhn = (numStr: string): boolean => {
		const cleanNum = numStr.replace(/\s+/g, "");
		if (!/^\d{13,19}$/.test(cleanNum)) return false;
		let sum = 0;
		let shouldDouble = false;
		for (let i = cleanNum.length - 1; i >= 0; i--) {
			let digit = parseInt(cleanNum.charAt(i), 10);
			if (shouldDouble) {
				digit *= 2;
				if (digit > 9) digit -= 9;
			}
			sum += digit;
			shouldDouble = !shouldDouble;
		}
		return sum % 10 === 0;
	};

	const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const clean = e.target.value.replace(/\D/g, "");
		const formatted = clean.match(/.{1,4}/g)?.join(" ") || "";
		setCardNumber(formatted.slice(0, 19));
		if (formErrors.cardNumber) setFormErrors((prev) => ({ ...prev, cardNumber: undefined }));
	};

	const handleCardNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setCardName(e.target.value.toUpperCase().replace(/[^A-Z\s-]/g, ""));
		if (formErrors.cardName) setFormErrors((prev) => ({ ...prev, cardName: undefined }));
	};

	const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		let clean = e.target.value.replace(/\D/g, "");
		if (clean.length > 2) {
			clean = clean.slice(0, 2) + "/" + clean.slice(2, 4);
		}
		setCardExpiry(clean.slice(0, 5));
		if (formErrors.cardExpiry) setFormErrors((prev) => ({ ...prev, cardExpiry: undefined }));
	};

	const handleCvcChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setCardCvc(e.target.value.replace(/\D/g, "").slice(0, 4));
		if (formErrors.cardCvc) setFormErrors((prev) => ({ ...prev, cardCvc: undefined }));
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		const errors: typeof formErrors = {};

		const cleanName = cardName.trim();
		if (!cleanName || cleanName.length < 3) {
			errors.cardName = "Name must be at least 3 characters.";
		}

		const cleanCard = cardNumber.replace(/\s+/g, "");
		if (!cleanCard || cleanCard.length < 13 || cleanCard.length > 19) {
			errors.cardNumber = "Card number must be 13-19 digits.";
		} else if (!validateLuhn(cleanCard)) {
			errors.cardNumber = "Invalid card number (fails Luhn check).";
		}

		if (!cardExpiry) {
			errors.cardExpiry = "Expiry date is required.";
		} else {
			const parts = cardExpiry.split("/");
			if (parts.length !== 2 || parts[0].length !== 2 || parts[1].length !== 2) {
				errors.cardExpiry = "Use MM/YY format.";
			} else {
				const month = parseInt(parts[0], 10);
				const year = parseInt(parts[1], 10) + 2000;
				const now = new Date();
				if (month < 1 || month > 12) {
					errors.cardExpiry = "Month must be 01-12.";
				} else if (year < now.getFullYear() || (year === now.getFullYear() && month < (now.getMonth() + 1))) {
					errors.cardExpiry = "Card has expired.";
				}
			}
		}

		if (!cardCvc || cardCvc.length < 3 || cardCvc.length > 4) {
			errors.cardCvc = "CVC must be 3 or 4 digits.";
		}

		if (Object.keys(errors).length > 0) {
			setFormErrors(errors);
			return;
		}

		setFormErrors({});
		setSubmitState("processing");

		setTimeout(() => {
			setSubmitState("success");
			setTimeout(() => {
				setSubmitState("idle");
				setCardNumber("");
				setCardName("");
				setCardExpiry("");
				setCardCvc("");
			}, 3000);
		}, 2000);
	};

	if (submitState === "success") {
		return (
			<div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
				<div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[#10b981] flex items-center justify-center text-xl animate-bounce">
					✓
				</div>
				<h4 className="text-md font-bold" style={{ color: "var(--text-primary)" }}>
					Mock Payment Succeeded!
				</h4>
				<p className="text-xs max-w-xs" style={{ color: "var(--text-secondary)" }}>
					Thank you for your support of ${amount}! (Stripe simulator mode)
				</p>
			</div>
		);
	}

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			<div>
				<label className="text-xs font-semibold uppercase tracking-wider block mb-1.5" style={{ color: "var(--text-secondary)" }}>
					Cardholder Name
				</label>
				<input
					type="text"
					value={cardName}
					onChange={handleCardNameChange}
					placeholder="JOHN DOE"
					required
					disabled={submitState === "processing"}
					className={`w-full border rounded-xl p-3 text-sm placeholder:text-text-muted focus-visible:outline-none transition-all duration-300 uppercase glow-focus ${formErrors.cardName ? "border-red-500 glow-error" : "focus-visible:border-brand-orange"
						}`}
					style={{
						backgroundColor: "var(--bg-dark-layer-1)",
						borderColor: formErrors.cardName ? "var(--color-error)" : "var(--border-default)",
						color: "var(--text-primary)",
					}}
				/>
				{formErrors.cardName && <span className="text-xs text-red-500 mt-1 block">{formErrors.cardName}</span>}
			</div>

			<div>
				<label className="text-xs font-semibold uppercase tracking-wider block mb-1.5" style={{ color: "var(--text-secondary)" }}>
					Card Number
				</label>
				<div className="relative">
					<input
						type="text"
						value={cardNumber}
						onChange={handleCardNumberChange}
						placeholder="4000 1234 5678 9010"
						required
						disabled={submitState === "processing"}
						className={`w-full border rounded-xl p-3 text-sm placeholder:text-text-muted focus-visible:outline-none transition-all duration-300 pr-20 font-mono glow-focus ${formErrors.cardNumber ? "border-red-500 glow-error" : "focus-visible:border-brand-orange"
							}`}
						style={{
							backgroundColor: "var(--bg-dark-layer-1)",
							borderColor: formErrors.cardNumber ? "var(--color-error)" : "var(--border-default)",
							color: "var(--text-primary)",
						}}
					/>
					<div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 select-none pointer-events-none">
						<svg viewBox="0 0 48 48" className="h-5 w-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
							<path d="M18.8 33L21.5 16H25.8L23.1 33H18.8ZM34.7 16.5C33.9 16.2 32.7 16 31.4 16C27.2 16 24.2 18.2 24 21.4C23.8 23.8 26 25.1 27.6 25.9C29.2 26.7 29.8 27.2 29.8 27.9C29.8 29 28.5 29.5 27.4 29.5C25.8 29.5 24.8 29.1 24.1 28.8L23.3 32.5C24.3 33 25.9 33.4 27.6 33.4C32.1 33.4 35 31.2 35.2 27.8C35.4 24.9 33.6 23.6 31 22.4C28.9 21.3 28.2 20.8 28.2 19.9C28.2 19.1 29.1 18.3 30.8 18.3C32.2 18.3 33.3 18.6 33.9 18.9L34.7 16.5ZM43.9 16H40C38.8 16 38 16.7 37.5 17.8L31.8 33H36.2L37.1 30.5H42.5L43 33H47L43.9 16ZM38.3 27.2L40.7 20.6L42.1 27.2H38.3ZM12.7 16L8.4 27.6L7.9 25.1C7.1 22.3 4.5 19.1 1.7 17.6L1 17.2V16H10.1C11.1 16 11.9 16.7 12.1 17.7L14.7 31.2L19.1 16H12.7Z" fill="#a1a1aa" />
						</svg>
						<svg viewBox="0 0 48 48" className="h-5 w-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
							<circle cx="18" cy="24" r="14" fill="#EB001B" fillOpacity="0.8" />
							<circle cx="30" cy="24" r="14" fill="#F79E1B" fillOpacity="0.8" />
						</svg>
					</div>
				</div>
				{formErrors.cardNumber && <span className="text-xs text-red-500 mt-1 block">{formErrors.cardNumber}</span>}
			</div>

			<div className="grid grid-cols-2 gap-4">
				<div>
					<label className="text-xs font-semibold uppercase tracking-wider block mb-1.5" style={{ color: "var(--text-secondary)" }}>
						Expiry Date
					</label>
					<input
						type="text"
						value={cardExpiry}
						onChange={handleExpiryChange}
						placeholder="MM/YY"
						required
						disabled={submitState === "processing"}
						className={`w-full border rounded-xl p-3 text-sm placeholder:text-text-muted focus-visible:outline-none transition-all duration-300 font-mono glow-focus ${formErrors.cardExpiry ? "border-red-500 glow-error" : "focus-visible:border-brand-orange"
							}`}
						style={{
							backgroundColor: "var(--bg-dark-layer-1)",
							borderColor: formErrors.cardExpiry ? "var(--color-error)" : "var(--border-default)",
							color: "var(--text-primary)",
						}}
					/>
					{formErrors.cardExpiry && <span className="text-xs text-red-500 mt-1 block">{formErrors.cardExpiry}</span>}
				</div>

				<div>
					<label className="text-xs font-semibold uppercase tracking-wider block mb-1.5" style={{ color: "var(--text-secondary)" }}>
						CVC / CVV
					</label>
					<input
						type="password"
						value={cardCvc}
						onChange={handleCvcChange}
						placeholder="•••"
						required
						disabled={submitState === "processing"}
						className={`w-full border rounded-xl p-3 text-sm placeholder:text-text-muted focus-visible:outline-none transition-all duration-300 font-mono glow-focus ${formErrors.cardCvc ? "border-red-500 glow-error" : "focus-visible:border-brand-orange"
							}`}
						style={{
							backgroundColor: "var(--bg-dark-layer-1)",
							borderColor: formErrors.cardCvc ? "var(--color-error)" : "var(--border-default)",
							color: "var(--text-primary)",
						}}
					/>
					{formErrors.cardCvc && <span className="text-xs text-red-500 mt-1 block">{formErrors.cardCvc}</span>}
				</div>
			</div>

			<button
				type="submit"
				disabled={submitState === "processing"}
				className="w-full font-bold py-3.5 rounded-xl transition-all duration-300 transform active:scale-[0.99] flex items-center justify-center gap-2 mt-6 cursor-pointer"
				style={{
					backgroundColor: "var(--brand-orange)",
					color: "#0d0d0f",
				}}
			>
				{submitState === "processing" ? (
					<>
						<FaSpinner className="animate-spin" size={16} />
						<span>Simulating mock payment...</span>
					</>
				) : (
					<>
						<FaLock size={12} />
						<span>Donate ${amount} (Simulation)</span>
					</>
				)}
			</button>
		</form>
	);
}

export default function QRPage() {
	const [activeMethod, setActiveMethod] = useState<"bank" | "card" | "paypal" | "wallet">("bank");
	const [copiedField, setCopiedField] = useState<string | null>(null);

	// Active Wallet state
	const [activeWallet, setActiveWallet] = useState<"momo" | "zalopay">("momo");

	// Donation Amount states
	const [donationAmount, setDonationAmount] = useState<number>(10);
	const [customAmount, setCustomAmount] = useState<string>("");

	const handleCopy = (text: string, fieldKey: string): void => {
		navigator.clipboard.writeText(text);
		setCopiedField(fieldKey);
		setTimeout(() => {
			setCopiedField(null);
		}, 2000);
	};

	const renderAmountSelector = () => {
		const amounts = [5, 10, 25, 50, 100];
		return (
			<div className="mb-6 border-b pb-5 animate-fade-in-up" style={{ borderColor: "var(--border-subtle)" }}>
				<label className="text-xs font-semibold uppercase tracking-wider block mb-3" style={{ color: "var(--text-secondary)" }}>
					Donation Amount (USD)
				</label>
				<div className="flex flex-wrap gap-2.5 items-center">
					{amounts.map((amt) => (
						<button
							key={amt}
							type="button"
							onClick={() => {
								setDonationAmount(amt);
								setCustomAmount("");
							}}
							className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${donationAmount === amt && !customAmount
									? "bg-brand-orange text-[#0d0d0f] shadow-lg"
									: "border hover:border-brand-orange text-text-secondary"
								}`}
							style={{
								borderColor: donationAmount === amt && !customAmount ? "var(--brand-orange)" : "var(--border-default)",
								backgroundColor: donationAmount === amt && !customAmount ? "var(--brand-orange)" : "transparent",
								color: donationAmount === amt && !customAmount ? "#0d0d0f" : "var(--text-secondary)",
							}}
						>
							${amt}
						</button>
					))}
					<div className="relative flex items-center">
						<span className="absolute left-3 text-xs font-semibold" style={{ color: "var(--text-muted)" }}>$</span>
						<input
							type="number"
							placeholder="Other"
							value={customAmount}
							onChange={(e) => {
								const val = e.target.value;
								setCustomAmount(val);
								const num = parseFloat(val);
								if (!isNaN(num) && num > 0) {
									setDonationAmount(num);
								}
							}}
							className="pl-6 pr-3 py-2 rounded-xl border text-xs font-bold w-20 focus-visible:outline-none transition-all duration-300 focus-visible:border-brand-orange"
							style={{
								backgroundColor: "var(--bg-dark-layer-1)",
								borderColor: customAmount ? "var(--brand-orange)" : "var(--border-default)",
								color: "var(--text-primary)",
							}}
						/>
					</div>
				</div>
			</div>
		);
	};

	const renderCopyField = (label: string, value: string, fieldKey: string) => {
		const isCopied = copiedField === fieldKey;
		return (
			<div className="flex flex-col gap-1.5 w-full">
				<div className="flex justify-between items-center text-xs font-semibold uppercase tracking-wider">
					<span style={{ color: "var(--text-secondary)" }}>{label}</span>
					{isCopied && (
						<span className="text-[#10b981] font-bold animate-pulse text-[11px]" style={{ textShadow: "0 0 8px rgba(16, 185, 129, 0.3)" }}>
							Copied!
						</span>
					)}
				</div>
				<div className="flex items-center gap-2 p-3 rounded-xl border font-mono text-sm relative group w-full"
					style={{ backgroundColor: "var(--bg-dark-layer-1)", borderColor: "var(--border-default)", color: "var(--text-primary)" }}>
					<span className="truncate select-all">{value}</span>
					<button
						type="button"
						onClick={() => handleCopy(value, fieldKey)}
						className="ml-auto transition-colors duration-200 hover:text-brand-orange"
						style={{ color: "var(--text-muted)" }}
						title="Copy to clipboard"
					>
						{isCopied ? <FaCheck className="text-[#10b981]" size={14} /> : <FaCopy size={14} />}
					</button>
				</div>
			</div>
		);
	};

	return (
		<div className="min-h-screen pb-16 bg-dark-layer-2" style={{ backgroundColor: "var(--bg-base)" }}>
			<Topbar />

			{/* Inline styling to support smooth animation */}
			<style jsx global>{`
				@keyframes fadeInUp {
					from {
						opacity: 0;
						transform: translateY(12px);
					}
					to {
						opacity: 1;
						transform: translateY(0);
					}
				}
				.animate-fade-in-up {
					animation: fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
				}
			`}</style>

			<div className="max-w-4xl mx-auto px-4 py-12">
				{/* Header Section */}
				<div className="text-center mb-12">
					<h1 className="text-3xl font-extrabold tracking-tight text-shadow-glow" style={{ color: "var(--text-primary)" }}>
						Support BeastCode
					</h1>
					<p className="text-sm max-w-md mx-auto mt-2" style={{ color: "var(--text-secondary)" }}>
						Help us keep the servers running and the competitive programming spirit alive.
					</p>
				</div>

				{/* Method Selector (Interactive Grid) */}
				<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
					{/* Bank Transfer Card */}
					<div
						onClick={() => setActiveMethod("bank")}
						className={`bg-bg-surface border rounded-2xl p-5 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 relative select-none hover:scale-[1.02] ${activeMethod === "bank"
							? "glow-sm"
							: "opacity-70 hover:opacity-100"
							}`}
						style={{
							backgroundColor: "var(--bg-surface)",
							borderColor: activeMethod === "bank" ? "var(--border-accent)" : "var(--border-subtle)",
						}}
					>
						<FaUniversity
							className="mb-3 transition-colors duration-300"
							size={26}
							style={{ color: activeMethod === "bank" ? "#f59e0b" : "var(--text-muted)" }}
						/>
						<span className="text-sm font-semibold transition-colors duration-300"
							style={{ color: activeMethod === "bank" ? "var(--text-primary)" : "var(--text-secondary)" }}>
							Bank Transfer
						</span>
						<span className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
							Direct VietQR Payment
						</span>
					</div>

					{/* Credit/Debit Card Card */}
					<div
						onClick={() => setActiveMethod("card")}
						className={`bg-bg-surface border rounded-2xl p-5 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 relative select-none hover:scale-[1.02] ${activeMethod === "card"
							? "glow-sm"
							: "opacity-70 hover:opacity-100"
							}`}
						style={{
							backgroundColor: "var(--bg-surface)",
							borderColor: activeMethod === "card" ? "var(--border-accent)" : "var(--border-subtle)",
						}}
					>
						<FaCreditCard
							className="mb-3 transition-colors duration-300"
							size={26}
							style={{ color: activeMethod === "card" ? "#f59e0b" : "var(--text-muted)" }}
						/>
						<span className="text-sm font-semibold transition-colors duration-300"
							style={{ color: activeMethod === "card" ? "var(--text-primary)" : "var(--text-secondary)" }}>
							Credit / Debit Card
						</span>
						<span className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
							Visa, Mastercard, JCB
						</span>
					</div>

					{/* PayPal Card */}
					<div
						onClick={() => setActiveMethod("paypal")}
						className={`bg-bg-surface border rounded-2xl p-5 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 relative select-none hover:scale-[1.02] ${activeMethod === "paypal"
							? "glow-sm"
							: "opacity-70 hover:opacity-100"
							}`}
						style={{
							backgroundColor: "var(--bg-surface)",
							borderColor: activeMethod === "paypal" ? "var(--border-accent)" : "var(--border-subtle)",
						}}
					>
						<svg viewBox="0 0 24 24" className="mb-3 transition-colors duration-300 w-[26px] h-[26px]" style={{ fill: activeMethod === "paypal" ? "#f59e0b" : "var(--text-muted)" }}>
							<path d="M20.067 8.478c.189.982.029 2.12-.497 3.393-.667 1.619-1.914 2.894-3.719 3.799-.813.41-1.724.697-2.698.852l-.123.018-.088.006h-.372c-.17 0-.329.117-.373.284l-.013.048-1.077 4.316-.017.067c-.035.137-.156.23-.298.23H8.38c-.217 0-.374-.202-.33-.414l.011-.05 1.767-7.078.016-.067c.036-.137.157-.23.298-.23h2.361c2.193 0 3.967-.442 5.033-1.637.712-.803.966-1.782.721-2.906-.118-.541-.336-1.018-.65-1.428-.316-.41-.75-.724-1.282-.934-.582-.23-1.29-.345-2.09-.345H8.795c-.17 0-.328.118-.372.285L6.002 18.25c-.032.127-.146.215-.278.215H3.328c-.217 0-.374-.203-.33-.414L6.155 5.467C6.2 5.29 6.36 5.17 6.544 5.17h7.247c1.47 0 2.68.217 3.585.666 1.347.669 2.158 1.583 2.506 2.456.096.241.157.488.185.786z" />
						</svg>
						<span className="text-sm font-semibold transition-colors duration-300"
							style={{ color: activeMethod === "paypal" ? "var(--text-primary)" : "var(--text-secondary)" }}>
							PayPal
						</span>
						<span className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
							Direct PayPal Donation
						</span>
					</div>

					{/* E-Wallets Card */}
					<div
						onClick={() => setActiveMethod("wallet")}
						className={`bg-bg-surface border rounded-2xl p-5 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 relative select-none hover:scale-[1.02] ${activeMethod === "wallet"
							? "glow-sm"
							: "opacity-70 hover:opacity-100"
							}`}
						style={{
							backgroundColor: "var(--bg-surface)",
							borderColor: activeMethod === "wallet" ? "var(--border-accent)" : "var(--border-subtle)",
						}}
					>
						<FaWallet
							className="mb-3 transition-colors duration-300"
							size={26}
							style={{ color: activeMethod === "wallet" ? "#f59e0b" : "var(--text-muted)" }}
						/>
						<span className="text-sm font-semibold transition-colors duration-300"
							style={{ color: activeMethod === "wallet" ? "var(--text-primary)" : "var(--text-secondary)" }}>
							E-Wallets
						</span>
						<span className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
							MoMo, ZaloPay
						</span>
					</div>
				</div>

				{/* Panels */}
				<div className="border rounded-3xl p-8 relative overflow-hidden animate-fade-in-up"
					style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>

					{activeMethod === "bank" && (
						<div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
							{/* Left Column (The Scanner) */}
							<div className="flex flex-col items-center justify-center">
								<div className="relative p-4 rounded-2xl bg-white transition-transform duration-300 hover:scale-[1.01]"
									style={{ boxShadow: "var(--shadow-glow-sm)" }}>
									<img src="/qr.png" alt="BeastCode VietinBank QR Code" className="w-64 h-auto rounded-lg object-contain animate-fade-in" />
								</div>
								<span className="text-[11px] mt-4 tracking-wider uppercase font-semibold" style={{ color: "var(--text-muted)" }}>
									Scan with VietQR or Banking App
								</span>
							</div>

							{/* Right Column (Account Details) */}
							<div className="space-y-4">
								<h3 className="text-lg font-bold border-b pb-2 mb-4" style={{ color: "var(--text-primary)", borderColor: "var(--border-subtle)" }}>
									Account Details
								</h3>

								{renderCopyField("Bank Name", "VietinBank", "bankName")}
								{renderCopyField("Account Number", "100873970867", "accountNum")}
								{renderCopyField("Account Holder", "MISTER BEAST", "accountHolder")}
								{renderCopyField("Transfer Description", "BEASTCODE SUPPORT", "transferDesc")}
							</div>
						</div>
					)}

					{activeMethod === "card" && (
						<div className="max-w-md mx-auto">
							<div className="flex justify-between items-center border-b pb-3 mb-6" style={{ borderColor: "var(--border-subtle)" }}>
								<h3 className="text-lg font-bold animate-fade-in-up" style={{ color: "var(--text-primary)" }}>
									Credit / Debit Card
								</h3>
								<span className="text-xs flex items-center gap-1 text-emerald-400 font-medium bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
									<FaLock size={10} /> Secure
								</span>
							</div>

							{renderAmountSelector()}

							{stripePromise ? (
								<Elements stripe={stripePromise}>
									<StripeCardForm amount={donationAmount} />
								</Elements>
							) : (
								<div>
									<div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs rounded-xl flex flex-col gap-1">
										<span className="font-bold flex items-center gap-1">⚠ Sandbox Mode / Stripe Key Missing</span>
										<span>Stripe credentials are not configured. We are running in simulated checkout mode. Your card will not be charged.</span>
									</div>
									<MockCardForm amount={donationAmount} />
								</div>
							)}
						</div>
					)}

					{activeMethod === "paypal" && (
						<div className="max-w-md mx-auto animate-fade-in">
							<div className="flex justify-between items-center border-b pb-3 mb-6" style={{ borderColor: "var(--border-subtle)" }}>
								<h3 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
									PayPal Donation
								</h3>
								<span className="text-xs flex items-center gap-1 text-emerald-400 font-medium bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
									<FaLock size={10} /> Secure
								</span>
							</div>

							{renderAmountSelector()}

							<div className="text-center py-4 space-y-4">
								<p className="text-sm" style={{ color: "var(--text-secondary)" }}>
									You are donating <strong className="text-brand-orange">${donationAmount} USD</strong> to support BeastCode.
								</p>
								<button
									type="button"
									onClick={() => {
										const paypalUrl = `https://www.paypal.com/donate/?business=nguyenvandunglolyasuo@gmail.com&no_recurring=0&item_name=Support+BeastCode&amount=${donationAmount}&currency_code=USD`;
										window.open(paypalUrl, "_blank", "noopener,noreferrer");
									}}
									className="w-full font-bold py-3.5 rounded-xl transition-all duration-300 transform active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
									style={{
										backgroundColor: "#f59e0b",
										color: "#0d0d0f",
									}}
								>
									<svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
										<path d="M20.067 8.478c.189.982.029 2.12-.497 3.393-.667 1.619-1.914 2.894-3.719 3.799-.813.41-1.724.697-2.698.852l-.123.018-.088.006h-.372c-.17 0-.329.117-.373.284l-.013.048-1.077 4.316-.017.067c-.035.137-.156.23-.298.23H8.38c-.217 0-.374-.202-.33-.414l.011-.05 1.767-7.078.016-.067c.036-.137.157-.23.298-.23h2.361c2.193 0 3.967-.442 5.033-1.637.712-.803.966-1.782.721-2.906-.118-.541-.336-1.018-.65-1.428-.316-.41-.75-.724-1.282-.934-.582-.23-1.29-.345-2.09-.345H8.795c-.17 0-.328.118-.372.285L6.002 18.25c-.032.127-.146.215-.278.215H3.328c-.217 0-.374-.203-.33-.414L6.155 5.467C6.2 5.29 6.36 5.17 6.544 5.17h7.247c1.47 0 2.68.217 3.585.666 1.347.669 2.158 1.583 2.506 2.456.096.241.157.488.185.786z" />
									</svg>
									<span>Donate ${donationAmount} via PayPal</span>
								</button>
								<p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
									You will be redirected to PayPal&apos;s secure gateway to complete your transaction.
								</p>
							</div>
						</div>
					)}

					{activeMethod === "wallet" && (
						<div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center animate-fade-in">
							{/* Left Column (Wallet Selector + QR Code Scanner) */}
							<div className="flex flex-col items-center">
								{/* Wallet Selector Toggles */}
								<div className="flex gap-2 p-1 rounded-xl mb-6 border"
									style={{ backgroundColor: "var(--bg-dark-layer-1)", borderColor: "var(--border-default)" }}>
									<button
										type="button"
										onClick={() => setActiveWallet("momo")}
										className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer ${activeWallet === "momo"
											? "bg-[#a50064] text-white shadow-sm"
											: "hover:text-text-primary"
											}`}
										style={{ color: activeWallet === "momo" ? "#ffffff" : "var(--text-secondary)" }}
									>
										MoMo
									</button>
									<button
										type="button"
										onClick={() => setActiveWallet("zalopay")}
										className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer ${activeWallet === "zalopay"
											? "bg-[#002f87] text-white shadow-sm"
											: "hover:text-text-primary"
											}`}
										style={{ color: activeWallet === "zalopay" ? "#ffffff" : "var(--text-secondary)" }}
									>
										ZaloPay
									</button>
								</div>

								{/* QR Code Frame */}
								{activeWallet === "momo" ? (
									<div className="flex flex-col items-center">
										<div className="relative p-4 rounded-2xl bg-white flex flex-col items-center justify-center w-64"
											style={{ boxShadow: "var(--shadow-glow-sm)" }}>
											<img
												src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=https://nhantien.momo.vn/0913355790"
												alt="MoMo payment QR code"
												className="w-56 h-56 rounded-lg object-contain"
											/>
										</div>
										<a
											href="https://nhantien.momo.vn/0913355790"
											target="_blank"
											rel="noopener noreferrer"
											className="mt-4 font-bold text-xs px-5 py-2.5 rounded-xl transition-all duration-200 transform hover:scale-[1.02] flex items-center gap-2 cursor-pointer"
											style={{
												backgroundColor: "#a50064",
												color: "#ffffff",
											}}
										>
											Open in MoMo App <FaExternalLinkAlt size={10} />
										</a>
									</div>
								) : (
									<div className="flex flex-col items-center">
										{/* ZaloPay scans direct to bank */}
										<div className="relative p-4 rounded-2xl bg-white flex flex-col items-center justify-center w-64"
											style={{ boxShadow: "var(--shadow-glow-sm)" }}>
											<img
												src="/qr.png"
												alt="ZaloPay Bank VietQR code"
												className="w-56 h-56 rounded-lg object-contain"
											/>
										</div>
										<span className="text-[11px] mt-4 tracking-wider uppercase font-semibold text-center max-w-xs" style={{ color: "var(--text-muted)" }}>
											Scan VietQR with ZaloPay to pay directly
										</span>
									</div>
								)}
							</div>

							{/* Right Column (Wallet Details) */}
							<div className="space-y-4">
								<h3 className="text-lg font-bold border-b pb-2 mb-4" style={{ color: "var(--text-primary)", borderColor: "var(--border-subtle)" }}>
									{activeWallet === "momo" ? "MoMo" : "ZaloPay"} Details
								</h3>

								{renderCopyField(activeWallet === "momo" ? "Phone Number" : "Recipient Account", "0913355790", "walletPhone")}
								{renderCopyField("Recipient Name", "MISTER BEAST", "walletName")}
								{renderCopyField("Transfer Message", "BEASTCODE SUPPORT", "walletMessage")}
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}