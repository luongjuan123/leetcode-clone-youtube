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
};

const PreferenceNav: React.FC<PreferenceNavProps> = ({ setSettings, settings, language, setLanguage, lightTheme }) => {
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
			<div className='flex items-center px-2'>
				<select
					value={language}
					onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
					className={`cursor-pointer rounded focus:outline-none px-3 py-1.5 text-xs font-semibold border transition-all duration-200 ${
						lightTheme
							? "bg-white text-gray-700 border-gray-350 hover:bg-gray-50 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
							: "bg-slate-900 text-slate-100 border-slate-800/80 hover:bg-slate-800/60 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
					}`}
				>
					<option value='javascript' className={lightTheme ? "bg-white text-gray-700" : "bg-[#111622] text-slate-200"}>JavaScript</option>
					<option value='python' className={lightTheme ? "bg-white text-gray-700" : "bg-[#111622] text-slate-200"}>Python 3</option>
					<option value='cpp' className={lightTheme ? "bg-white text-gray-700" : "bg-[#111622] text-slate-200"}>C++ (GCC 10)</option>
					<option value='java' className={lightTheme ? "bg-white text-gray-700" : "bg-[#111622] text-slate-200"}>Java (OpenJDK 15)</option>
					<option value='c' className={lightTheme ? "bg-white text-gray-700" : "bg-[#111622] text-slate-200"}>C (GCC 10)</option>
				</select>
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
