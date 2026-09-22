import { useState, useEffect } from "react";
import { AiOutlineFullscreen, AiOutlineFullscreenExit, AiOutlineSetting } from "react-icons/ai";
import { ISettings } from "../Playground";
import SettingsModal from "@/components/Modals/SettingsModal";
import BeastCodeSelect from "@/components/UI/BeastCodeSelect";

type SupportedLanguage = "javascript" | "python" | "cpp" | "java" | "c";

type PreferenceNavProps = {
	settings: ISettings;
	setSettings: React.Dispatch<React.SetStateAction<ISettings>>;
	language: SupportedLanguage;
	setLanguage: (lang: SupportedLanguage) => void;
	lightTheme?: boolean;
	syncStatus: "connected" | "syncing" | "offline-saved" | "error";
};

const PreferenceNav: React.FC<PreferenceNavProps> = ({ setSettings, settings, language, setLanguage, lightTheme, syncStatus }) => {
	const [isFullScreen, setIsFullScreen] = useState(false);

	const handleFullScreen = () => {
		if (isFullScreen) {
			document.exitFullscreen();
		} else {
			document.documentElement.requestFullscreen();
		}
		setIsFullScreen(!isFullScreen);
	};

	useEffect(() => {
		function exitHandler(e: any) {
			if (!document.fullscreenElement) {
				setIsFullScreen(false);
				return;
			}
			setIsFullScreen(true);
		}

		if (document.addEventListener) {
			document.addEventListener("fullscreenchange", exitHandler);
			document.addEventListener("webkitfullscreenchange", exitHandler);
			document.addEventListener("mozfullscreenchange", exitHandler);
			document.addEventListener("MSFullscreenChange", exitHandler);
		}
	}, [isFullScreen]);

	return (
		<div className={`flex items-center justify-between h-11 w-full border-b ${lightTheme ? "bg-gray-100 border-gray-300" : "bg-dark-layer-2 border-transparent"}`}>
			<div className='flex items-center px-2 gap-3'>
				<BeastCodeSelect
					size="sm"
					options={[
						{ value: "javascript", label: "JavaScript" },
						{ value: "python", label: "Python 3" },
						{ value: "cpp", label: "C++ (GCC 10)" },
						{ value: "java", label: "Java (OpenJDK 15)" },
						{ value: "c", label: "C (GCC 10)" }
					]}
					value={language}
					onChange={(val) => setLanguage(val as SupportedLanguage)}
					className="w-44 font-semibold"
				/>

				{/* Sync Status Badge */}
				<div 
					className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold border transition-all duration-300 select-none shadow-sm"
					style={
						syncStatus === "connected"
							? { color: "var(--color-success)", background: "color-mix(in srgb, var(--color-success) 8%, transparent)", borderColor: "color-mix(in srgb, var(--color-success) 20%, transparent)" }
							: syncStatus === "syncing"
							? { color: "var(--color-warning)", background: "color-mix(in srgb, var(--color-warning) 8%, transparent)", borderColor: "color-mix(in srgb, var(--color-warning) 20%, transparent)" }
							: syncStatus === "offline-saved"
							? { color: "#f59e0b", background: "rgba(245, 158, 11, 0.08)", borderColor: "rgba(245, 158, 11, 0.2)" }
							: { color: "var(--color-error)", background: "color-mix(in srgb, var(--color-error) 8%, transparent)", borderColor: "color-mix(in srgb, var(--color-error) 20%, transparent)" }
					}
				>
					<span 
						className={`h-1.5 w-1.5 rounded-full ${syncStatus === "syncing" ? "animate-pulse scale-105" : ""}`} 
						style={{
							backgroundColor: syncStatus === "connected" ? "var(--color-success)" :
											syncStatus === "syncing" ? "var(--color-warning)" :
											syncStatus === "offline-saved" ? "#f59e0b" : "var(--color-error)"
						}} 
					/>
					<span>{syncStatus === "offline-saved" ? "offline draft" : syncStatus === "connected" ? "cloud saved" : syncStatus}</span>
				</div>
			</div>

			<div className='flex items-center m-2'>
				<button
					className={`preferenceBtn group ${lightTheme ? "hover:bg-gray-200" : "hover:bg-dark-fill-3"}`}
					onClick={() => setSettings({ ...settings, settingsModalIsOpen: true })}
				>
					<div className={`h-4 w-4 font-bold text-lg ${lightTheme ? "text-gray-650" : "text-dark-gray-6"}`}>
						<AiOutlineSetting />
					</div>
					<div className='preferenceBtn-tooltip'>Settings</div>
				</button>

				<button className={`preferenceBtn group ${lightTheme ? "hover:bg-gray-200" : "hover:bg-dark-fill-3"}`} onClick={handleFullScreen}>
					<div className={`h-4 w-4 font-bold text-lg ${lightTheme ? "text-gray-650" : "text-dark-gray-6"}`}>
						{!isFullScreen ? <AiOutlineFullscreen /> : <AiOutlineFullscreenExit />}
					</div>
					<div className='preferenceBtn-tooltip'>Full Screen</div>
				</button>
			</div>
			{settings.settingsModalIsOpen && <SettingsModal settings={settings} setSettings={setSettings} />}
		</div>
	);
};
export default PreferenceNav;
