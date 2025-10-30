import React from "react";
import { ShowOverlay } from "./ShowOverlay";
import { TranslateToEnglish } from "./TranslateToEnglish";
import { ModelUnloadTimeoutSetting } from "./ModelUnloadTimeout";
import { SettingsGroup } from "../ui/SettingsGroup";
import { StartHidden } from "./StartHidden";
import { AutostartToggle } from "./AutostartToggle";

export const BasicSettings: React.FC = () => {
  return (
    <div className="max-w-3xl w-full mx-auto space-y-6">
      <SettingsGroup title="Basic">
        <StartHidden descriptionMode="tooltip" grouped={true} />
        <AutostartToggle descriptionMode="tooltip" grouped={true} />
        <ShowOverlay descriptionMode="tooltip" grouped={true} />
        <TranslateToEnglish descriptionMode="tooltip" grouped={true} />
        <ModelUnloadTimeoutSetting descriptionMode="tooltip" grouped={true} />
      </SettingsGroup>
    </div>
  );
};
