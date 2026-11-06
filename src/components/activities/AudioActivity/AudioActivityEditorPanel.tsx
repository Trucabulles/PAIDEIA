import type { ReactNode } from "react";
import type { ImageCrop, ActivityItem } from "../../../types/project";
import { AudioCoverFallback } from "../../app/AudioCoverFallback";
import { CroppedImage } from "../../app/CroppedImage";
import { AudioActivityEditor } from "./AudioActivityEditor";
import { normalizeAudioTracks } from "./audioItems";

type AudioEditorValue = {
  activityItems: ActivityItem[];
  audioAllowDownload: boolean;
  audioAutoplayNext: boolean;
  imageRounded: boolean;
  panelBackgroundColor: string;
  panelBorderColor: string;
  panelBorderStyle: string;
  panelBorderWidth: string;
  panelRounded: boolean;
  panelShadow: boolean;
};

type AudioActivityEditorPanelProps = {
  accentColor: string;
  audioAccept: string;
  coverAccept: string;
  coverCrop?: ImageCrop | null;
  coverName: string;
  coverSrc: string | null;
  coverTitle: string;
  getTrackAudioName: (track: ActivityItem) => string;
  getTrackAudioSrc: (track: ActivityItem) => string | null;
  onAccentColorChange: (value: string) => void;
  onAddTrack: () => void;
  onChange: (patch: Partial<AudioEditorValue>) => void;
  onCoverUpload: (file: File) => void;
  onMoveTrack: (trackId: string, delta: number) => void;
  onRemoveCover: () => void;
  onRemoveTrack: (trackId: string) => void;
  onRemoveTrackAudio: (trackId: string) => void;
  onUploadTrackAudio: (trackId: string, file: File) => void;
  renderTranscriptControls: (track: ActivityItem) => ReactNode;
  tracks: ActivityItem[];
  value: AudioEditorValue;
};

export function AudioActivityEditorPanel({
  accentColor,
  audioAccept,
  coverAccept,
  coverCrop,
  coverName,
  coverSrc,
  coverTitle,
  getTrackAudioName,
  getTrackAudioSrc,
  onAccentColorChange,
  onAddTrack,
  onChange,
  onCoverUpload,
  onMoveTrack,
  onRemoveCover,
  onRemoveTrack,
  onRemoveTrackAudio,
  onUploadTrackAudio,
  tracks,
  value,
  renderTranscriptControls
}: AudioActivityEditorPanelProps) {
  const coverNode = coverSrc ? (
    <CroppedImage
      alt={coverTitle || "Cover audio"}
      className="media-thumbnail-image"
      crop={coverCrop}
      src={coverSrc}
    />
  ) : (
    <AudioCoverFallback />
  );

  return (
    <AudioActivityEditor
      accentColor={accentColor}
      allowDownload={value.audioAllowDownload}
      audioAccept={audioAccept}
      autoplayNext={value.audioAutoplayNext}
      backgroundColor={value.panelBackgroundColor}
      borderColor={value.panelBorderColor}
      borderStyle={value.panelBorderStyle}
      borderWidth={value.panelBorderWidth}
      coverAccept={coverAccept}
      coverName={coverName}
      coverNode={coverNode}
      coverRounded={value.imageRounded}
      getTrackAudioName={getTrackAudioName}
      getTrackAudioSrc={getTrackAudioSrc}
      onAccentColorChange={onAccentColorChange}
      onAddTrack={onAddTrack}
      onAllowDownloadChange={(audioAllowDownload) => onChange({ audioAllowDownload })}
      onAutoplayNextChange={(audioAutoplayNext) => onChange({ audioAutoplayNext })}
      onBackgroundColorChange={(panelBackgroundColor) => onChange({ panelBackgroundColor })}
      onBorderColorChange={(panelBorderColor) => onChange({ panelBorderColor })}
      onBorderStyleChange={(panelBorderStyle) => onChange({ panelBorderStyle })}
      onBorderWidthChange={(panelBorderWidth) => onChange({ panelBorderWidth })}
      onCoverRoundedChange={(imageRounded) => onChange({ imageRounded })}
      onCoverUpload={onCoverUpload}
      onMoveTrack={onMoveTrack}
      onRemoveCover={onRemoveCover}
      onRemoveTrack={onRemoveTrack}
      onRemoveTrackAudio={onRemoveTrackAudio}
      onRoundedChange={(panelRounded) => onChange({ panelRounded })}
      onShadowChange={(panelShadow) => onChange({ panelShadow })}
      onTrackTitleChange={(trackId, title) =>
        onChange({
          activityItems: normalizeAudioTracks(value.activityItems).map((track) =>
            track.id === trackId ? { ...track, title } : track
          )
        })
      }
      onUploadTrackAudio={onUploadTrackAudio}
      rounded={value.panelRounded}
      shadow={value.panelShadow}
      tracks={tracks}
      renderTranscriptControls={renderTranscriptControls}
    />
  );
}
