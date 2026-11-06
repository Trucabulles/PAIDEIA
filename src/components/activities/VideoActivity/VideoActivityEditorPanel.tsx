import { VideoActivityEditor } from "./VideoActivityEditor";
import type { PaideiaWorkspaceState } from "../../../types/project";

type VideoEditorValue = {
  videoAllowFullscreen: boolean;
  videoCaptionColor: string;
  videoCaptionBackgroundEnabled: boolean;
  videoCaptionOutline: "none" | "thin" | "thick";
};

type VideoActivityEditorPanelProps = {
  blockId: string;
  projectPath: string;
  optimizationAvailable: boolean;
  subtitleGenerationConfiguration: {
    ready: boolean;
    enginePath: string;
    smallModelPath: string;
    mediumModelPath: string;
    smallAvailable: boolean;
    mediumAvailable: boolean;
    defaultLanguage: string;
  };
  optimizedVideoActive: boolean;
  originalVideoAvailable: boolean;
  onChange: (patch: Partial<VideoEditorValue>) => void;
  onSubtitleUpload: (file: File) => Promise<void> | void;
  onSubtitleEdit: (file: File) => Promise<void> | void;
  onSubtitleRemove: () => Promise<void> | void;
  onVideoPathUpload: (sourcePath: string) => Promise<void> | void;
  onVideoRemove: () => Promise<void> | void;
  onWorkspaceChange: (workspace: PaideiaWorkspaceState) => void;
  subtitleAccept: string;
  subtitleFileName: string;
  subtitleSrc: string | null;
  originalSubtitleSrc: string | null;
  value: VideoEditorValue;
  videoAccept: string;
  videoFileName: string;
  videoSrc: string | null;
};

export function VideoActivityEditorPanel({
  blockId,
  projectPath,
  optimizationAvailable,
  subtitleGenerationConfiguration,
  optimizedVideoActive,
  originalVideoAvailable,
  onChange,
  onSubtitleUpload,
  onSubtitleEdit,
  onSubtitleRemove,
  onVideoPathUpload,
  onVideoRemove,
  onWorkspaceChange,
  subtitleAccept,
  subtitleFileName,
  subtitleSrc,
  originalSubtitleSrc,
  value,
  videoAccept,
  videoFileName,
  videoSrc
}: VideoActivityEditorPanelProps) {
  return (
    <VideoActivityEditor
      blockId={blockId}
      projectPath={projectPath}
      optimizationAvailable={optimizationAvailable}
      subtitleGenerationConfiguration={subtitleGenerationConfiguration}
      optimizedVideoActive={optimizedVideoActive}
      originalVideoAvailable={originalVideoAvailable}
      allowFullscreen={value.videoAllowFullscreen}
      captionColor={value.videoCaptionColor}
      captionBackgroundEnabled={value.videoCaptionBackgroundEnabled}
      captionOutline={value.videoCaptionOutline}
      onAllowFullscreenChange={(videoAllowFullscreen) => onChange({ videoAllowFullscreen })}
      onCaptionColorChange={(videoCaptionColor) => onChange({ videoCaptionColor })}
      onCaptionBackgroundEnabledChange={(videoCaptionBackgroundEnabled) => onChange({ videoCaptionBackgroundEnabled })}
      onCaptionOutlineChange={(videoCaptionOutline) => onChange({ videoCaptionOutline })}
      onSubtitleUpload={onSubtitleUpload}
      onSubtitleEdit={onSubtitleEdit}
      onSubtitleRemove={onSubtitleRemove}
      onVideoPathUpload={onVideoPathUpload}
      onVideoRemove={onVideoRemove}
      onWorkspaceChange={onWorkspaceChange}
      subtitleAccept={subtitleAccept}
      subtitleFileName={subtitleFileName}
      subtitleSrc={subtitleSrc}
      originalSubtitleSrc={originalSubtitleSrc}
      videoAccept={videoAccept}
      videoFileName={videoFileName}
      videoSrc={videoSrc}
    />
  );
}
