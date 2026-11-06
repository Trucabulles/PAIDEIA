import { useMemo } from "react";
import type { PointOfInterestMarkerMedia } from "../../../types/project";
import { PlyrAudioPlayer } from "../AudioActivity/PlyrAudioPlayer";
import { PlyrVideoPlayer } from "../VideoActivity/PlyrVideoPlayer";
import styles from "./PointOfInterestActivity.module.css";
import { TranscriptAccessButton } from "../../transcript";

type Props = {
  media: PointOfInterestMarkerMedia;
  onImageOpen?: (src: string, alt: string) => void;
  resolveAssetUrl: (assetRef?: string | null) => string | null;
};

const keepSingleAudioTrack = () => {};

function CompactAudioPlayer({ fileName, src }: { fileName: string; src: string }) {
  const tracks = useMemo(() => [{
    id: "point-of-interest-audio",
    title: fileName,
    contentHtml: "",
    audioSrc: src
  }], [fileName, src]);

  return (
    <PlyrAudioPlayer
      accentColor="#123a7a"
      activeTrackIndex={0}
      allowDownload={false}
      autoplayNext={false}
      onActiveTrackIndexChange={keepSingleAudioTrack}
      playRequestId={0}
      tracks={tracks}
      volumePanelPlacement="below"
    />
  );
}

export function PointOfInterestMarkerMediaView({ media, onImageOpen, resolveAssetUrl }: Props) {
  const source = resolveAssetUrl(media.optimizedAssetRef || media.assetRef);
  if (!source) return null;
  if (media.type === "video") {
    return (
      <div className={styles.markerVideo} onPointerDown={(event) => event.stopPropagation()}>
        <PlyrVideoPlayer
          allowFullscreen
          mediaSrc={source}
          posterSrc={resolveAssetUrl(media.posterAssetRef)}
          subtitleSrc={resolveAssetUrl(media.subtitleAssetRef)}
        />
      </div>
    );
  }
  if (media.type === "audio") {
    return (
      <div className={styles.markerAudioWithTranscript}>
        <CompactAudioPlayer fileName={media.fileName} src={source} />
        {media.transcriptStatus === "validated" && media.transcriptHtml ? (
          <TranscriptAccessButton
            allowDownload={Boolean(media.transcriptAllowDownload)}
            html={media.transcriptHtml}
            language={media.transcriptLanguage}
            title={media.fileName}
          />
        ) : null}
      </div>
    );
  }
  const accessibility = media.imageAccessibility;
  const alt = accessibility?.decorative ? "" : accessibility?.altText || media.fileName;
  return (
    <button className={styles.markerImageButton} onClick={() => onImageOpen?.(source, alt)} type="button">
      <img alt={alt} role={accessibility?.decorative ? "presentation" : undefined} src={source} />
    </button>
  );
}
