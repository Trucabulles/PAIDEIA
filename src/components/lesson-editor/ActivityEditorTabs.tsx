import { type KeyboardEvent, type ReactNode, useEffect, useId, useState } from "react";
import "./ActivityEditorTabs.css";

type ActivityEditorTab = "activity" | "appearance";

type ActivityEditorTabsProps = {
  defaultTab?: ActivityEditorTab;
  activityLabel: string;
  activityPanelCard?: boolean;
  activityPanel: ReactNode;
  appearanceLabel: string;
  appearancePanel: ReactNode;
  sessionKey: string;
};

export function ActivityEditorTabs({
  defaultTab = "activity",
  activityLabel,
  activityPanelCard = true,
  activityPanel,
  appearanceLabel,
  appearancePanel,
  sessionKey
}: ActivityEditorTabsProps) {
  const baseId = useId();
  const [activeTab, setActiveTab] = useState<ActivityEditorTab>(defaultTab);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab, sessionKey]);

  const selectTabFromKeyboard = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentTab: ActivityEditorTab
  ) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      return;
    }
    event.preventDefault();
    const nextTab = event.key === "Home"
      ? "activity"
      : event.key === "End"
        ? "appearance"
        : currentTab === "activity"
          ? "appearance"
          : "activity";
    setActiveTab(nextTab);
    const nextButton = event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(
      `[data-activity-editor-tab="${nextTab}"]`
    );
    nextButton?.focus();
  };

  return (
    <div className="activity-editor-tabs inspector-span-2">
      <div aria-label={`${activityLabel} / ${appearanceLabel}`} className="activity-editor-tabs__list" role="tablist">
        <button
          aria-controls={`${baseId}-activity-panel`}
          aria-selected={activeTab === "activity"}
          className="activity-editor-tabs__tab"
          data-activity-editor-tab="activity"
          id={`${baseId}-activity-tab`}
          onClick={() => setActiveTab("activity")}
          onKeyDown={(event) => selectTabFromKeyboard(event, "activity")}
          role="tab"
          tabIndex={activeTab === "activity" ? 0 : -1}
          type="button"
        >
          {activityLabel}
        </button>
        <button
          aria-controls={`${baseId}-appearance-panel`}
          aria-selected={activeTab === "appearance"}
          className="activity-editor-tabs__tab"
          data-activity-editor-tab="appearance"
          id={`${baseId}-appearance-tab`}
          onClick={() => setActiveTab("appearance")}
          onKeyDown={(event) => selectTabFromKeyboard(event, "appearance")}
          role="tab"
          tabIndex={activeTab === "appearance" ? 0 : -1}
          type="button"
        >
          {appearanceLabel}
        </button>
      </div>

      <div
        aria-labelledby={`${baseId}-activity-tab`}
        className={`activity-editor-tabs__panel${activityPanelCard ? " activity-editor-tabs__panel--card" : ""}`}
        hidden={activeTab !== "activity"}
        id={`${baseId}-activity-panel`}
        role="tabpanel"
      >
        {activityPanel}
      </div>
      <div
        aria-labelledby={`${baseId}-appearance-tab`}
        className="activity-editor-tabs__panel"
        hidden={activeTab !== "appearance"}
        id={`${baseId}-appearance-panel`}
        role="tabpanel"
      >
        {appearancePanel}
      </div>
    </div>
  );
}
