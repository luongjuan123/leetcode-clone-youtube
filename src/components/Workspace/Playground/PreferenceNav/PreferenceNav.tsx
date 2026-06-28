import { useState, useEffect } from "react";
import { AiOutlineFullscreen, AiOutlineFullscreenExit, AiOutlineSetting } from "react-icons/ai";
import { ISettings } from "../Playground";
import SettingsModal from "@/components/Modals/SettingsModal";

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
				<select
					value={language}
					onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
					className={`cursor-pointer rounded focus:outline-none px-3 py-1.5 text-xs font-semibold border transition-all duration-200 ${
						lightTheme
							? "bg-dark-layer-1 text-gray-700 border-gray-350 hover:bg-dark-elevated focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20"
							: "bg-dark-layer-2 text-dark-gray-8 border-gray-850 hover:bg-dark-fill-3 focus:border-brand-orange focus:ring-2 focus:ring-brand-orange/20"
					}`}
				>
					<option value='javascript' className={lightTheme ? "bg-dark-layer-1 text-gray-700" : "bg-dark-layer-2 text-dark-gray-8"}>JavaScript</option>
					<option value='python' className={lightTheme ? "bg-dark-layer-1 text-gray-700" : "bg-dark-layer-2 text-dark-gray-8"}>Python 3</option>
					<option value='cpp' className={lightTheme ? "bg-dark-layer-1 text-gray-700" : "bg-dark-layer-2 text-dark-gray-8"}>C++ (GCC 10)</option>
					<option value='java' className={lightTheme ? "bg-dark-layer-1 text-gray-700" : "bg-dark-layer-2 text-dark-gray-8"}>Java (OpenJDK 15)</option>
					<option value='c' className={lightTheme ? "bg-dark-layer-1 text-gray-700" : "bg-dark-layer-2 text-dark-gray-8"}>C (GCC 10)</option>
				</select>

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
