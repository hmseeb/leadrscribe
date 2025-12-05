import React from "react";
import { MicrophoneSelector } from "./MicrophoneSelector";
import { LanguageSelector } from "./LanguageSelector";
import { LeadrScribeShortcut } from "./LeadrScribeShortcut";
import { SettingsGroup } from "../ui/SettingsGroup";
import { OutputDeviceSelector } from "./OutputDeviceSelector";
import { PushToTalk } from "./PushToTalk";
import { AudioFeedback } from "./AudioFeedback";
import { useSettings } from "../../hooks/useSettings";
import { VolumeSlider } from "./VolumeSlider";
import { ShowOverlay } from "./ShowOverlay";
import { TranslateToEnglish } from "./TranslateToEnglish";
import { ModelUnloadTimeoutSetting } from "./ModelUnloadTimeout";
import { StartHidden } from "./StartHidden";
import { AutostartToggle } from "./AutostartToggle";
import { OutputModeSetting } from "./OutputMode";
import { OpenRouterApiKey } from "./OpenRouterApiKey";
import { OpenRouterModel } from "./OpenRouterModel";
import { CustomInstructions } from "./CustomInstructions";
import { CustomWords } from "./CustomWords";
import ModelSelector from "../model-selector";

export const GeneralSettings: React.FC = () => {
  const { audioFeedbackEnabled, getSetting } = useSettings();
  const outputMode = getSetting("output_mode") || "transcript";
  const isGhostwriterMode = outputMode === "ghostwriter";
  const isTranscriptMode = outputMode === "transcript";

  return (
    <div className="max-w-3xl w-full mx-auto space-y-6">
      <div className="space-y-3 relative z-50">
        <div className="px-1">
          <h2 className="text-sm font-kalam font-bold text-pencil tracking-tight">
            Speech-to-Text Model
          </h2>
        </div>
        <div className="bg-white border-3 border-pencil rounded-wobbly-lg shadow-md overflow-visible">
          <div className="p-4 overflow-visible">
            <ModelSelector />
          </div>
        </div>
      </div>

      <div className="relative z-40">
        <SettingsGroup title="General">
          <LeadrScribeShortcut descriptionMode="tooltip" grouped={true} />
          <LanguageSelector descriptionMode="tooltip" grouped={true} />
          <PushToTalk descriptionMode="tooltip" grouped={true} />
          <StartHidden descriptionMode="tooltip" grouped={true} />
          <AutostartToggle descriptionMode="tooltip" grouped={true} />
          <ShowOverlay descriptionMode="tooltip" grouped={true} />
          <TranslateToEnglish descriptionMode="tooltip" grouped={true} />
          <ModelUnloadTimeoutSetting descriptionMode="tooltip" grouped={true} />
        </SettingsGroup>
      </div>

      <div className="relative z-30">
        <SettingsGroup title="Audio">
          <MicrophoneSelector descriptionMode="tooltip" grouped={true} />
          <AudioFeedback descriptionMode="tooltip" grouped={true} />
          <OutputDeviceSelector
            descriptionMode="tooltip"
            grouped={true}
            disabled={!audioFeedbackEnabled}
          />
          <VolumeSlider disabled={!audioFeedbackEnabled} />
        </SettingsGroup>
      </div>

      <div className="relative z-20">
        <SettingsGroup title="Output">
          <OutputModeSetting descriptionMode="tooltip" grouped={true} />
          {isGhostwriterMode && (
            <>
              <OpenRouterApiKey descriptionMode="tooltip" grouped={true} />
              <OpenRouterModel descriptionMode="tooltip" grouped={true} />
              <CustomInstructions descriptionMode="tooltip" grouped={true} />
            </>
          )}
          {isTranscriptMode && (
            <CustomWords descriptionMode="tooltip" grouped />
          )}
        </SettingsGroup>
      </div>
    </div>
  );
};
