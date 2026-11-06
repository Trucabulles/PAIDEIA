import { useEffect, useRef } from "react";
import type { ResolvedDesignerSocialMediaEffect } from "./designerSocialRegistry";

type Props = {
  effect: ResolvedDesignerSocialMediaEffect;
  effectKey: number;
};

export function DesignerSocialMediaEffect({ effect, effectKey }: Props) {
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  useEffect(() => {
    if (mediaRef.current && effect.volume !== undefined) mediaRef.current.volume = effect.volume;
  }, [effect.volume, effectKey]);
  if (effect.kind === "audio") {
    return <audio autoPlay className="designer-social-media-effect" controls key={effectKey} ref={(node) => { mediaRef.current = node; }} src={effect.source} />;
  }
  if (effect.kind === "video") {
    return <video autoPlay className="designer-social-media-effect" controls key={effectKey} ref={(node) => { mediaRef.current = node; }} src={effect.source} />;
  }
  return <img alt={effect.alt ?? ""} className="designer-social-media-effect designer-social-media-effect-image" key={effectKey} src={effect.source} />;
}
