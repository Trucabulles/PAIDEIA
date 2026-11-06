import type { ReactNode } from "react";
import type { ActivityItem } from "../../../types/project";

export type AudioTrack = ActivityItem & {
  audioSrc?: string | null;
};

export type AudioActivityProps = {
  accentColor: string;
  allowDownload: boolean;
  autoplayNext: boolean;
  backgroundColor: string;
  borderColor: string;
  borderStyle: string;
  borderWidth: string;
  coverNode: ReactNode;
  descriptionNode: ReactNode;
  rounded: boolean;
  shadow: boolean;
  titleNode: ReactNode;
  tracks: AudioTrack[];
};

export type PlyrAudioPlayerProps = {
  accentColor: string;
  allowDownload: boolean;
  autoplayNext: boolean;
  activeTrackIndex: number;
  onActiveTrackIndexChange: (index: number) => void;
  playRequestId: number;
  tracks: AudioTrack[];
  volumePanelPlacement?: "above" | "below";
};

export type AudioActivityEditorProps = {
  accentColor: string;
  audioAccept: string;
  autoplayNext: boolean;
  allowDownload: boolean;
  backgroundColor: string;
  borderColor: string;
  borderStyle: string;
  borderWidth: string;
  coverAccept: string;
  coverName: string;
  coverNode: ReactNode;
  coverRounded: boolean;
  rounded: boolean;
  shadow: boolean;
  tracks: ActivityItem[];
  getTrackAudioName: (track: ActivityItem) => string;
  getTrackAudioSrc: (track: ActivityItem) => string | null;
  onAccentColorChange: (value: string) => void;
  onAddTrack: () => void;
  onAllowDownloadChange: (value: boolean) => void;
  onAutoplayNextChange: (value: boolean) => void;
  onBackgroundColorChange: (value: string) => void;
  onBorderColorChange: (value: string) => void;
  onBorderStyleChange: (value: string) => void;
  onBorderWidthChange: (value: string) => void;
  onCoverRoundedChange: (value: boolean) => void;
  onCoverUpload: (file: File) => void;
  onMoveTrack: (trackId: string, delta: number) => void;
  onRemoveCover: () => void;
  onRemoveTrack: (trackId: string) => void;
  onRemoveTrackAudio: (trackId: string) => void;
  onRoundedChange: (value: boolean) => void;
  onShadowChange: (value: boolean) => void;
  onTrackTitleChange: (trackId: string, title: string) => void;
  onUploadTrackAudio: (trackId: string, file: File) => void;
  renderTranscriptControls: (track: ActivityItem) => ReactNode;
};
