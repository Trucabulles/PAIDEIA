import type { ReactNode } from "react";
import type { PaideiaWorkspaceState } from "../../../types/project";

export type VideoActivityProps = {
  title?: string;
  summary?: string;
  summaryNode?: ReactNode;
  mediaSrc: string | null;
  posterSrc?: string | null;
  subtitleSrc: string | null;
  captionColor?: string;
  captionBackgroundEnabled?: boolean;
  captionOutline?: "none" | "thin" | "thick";
  allowFullscreen?: boolean;
  maxDisplayHeight?: number;
};

export type PlyrVideoPlayerProps = Omit<VideoActivityProps, "title" | "summary" | "summaryNode">;

export type VideoActivityEditorProps = {
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
  videoSrc: string | null;
  videoAccept: string;
  videoFileName: string;
  subtitleSrc: string | null;
  originalSubtitleSrc: string | null;
  subtitleFileName: string;
  subtitleAccept: string;
  captionColor: string;
  captionBackgroundEnabled: boolean;
  captionOutline: "none" | "thin" | "thick";
  allowFullscreen: boolean;
  onCaptionColorChange: (value: string) => void;
  onCaptionBackgroundEnabledChange: (value: boolean) => void;
  onCaptionOutlineChange: (value: "none" | "thin" | "thick") => void;
  onAllowFullscreenChange: (value: boolean) => void;
  onVideoPathUpload: (sourcePath: string) => Promise<void> | void;
  onVideoRemove: () => Promise<void> | void;
  onWorkspaceChange: (workspace: PaideiaWorkspaceState) => void;
  onSubtitleUpload: (file: File) => Promise<void> | void;
  onSubtitleEdit: (file: File) => Promise<void> | void;
  onSubtitleRemove: () => Promise<void> | void;
};
