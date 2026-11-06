import { cropImageStyle, normalizeImageCrop, shouldRenderImageCrop } from "../../app/mediaAssets";
import type { ImageCrop } from "../../types/project";

type CroppedImageProps = {
  alt?: string;
  className: string;
  crop?: ImageCrop | null;
  onClick?: () => void;
  rounded?: boolean;
  role?: "presentation";
  src: string;
};

export function CroppedImage({
  alt,
  className,
  crop,
  onClick,
  rounded,
  role,
  src
}: CroppedImageProps) {
  const shouldCrop = shouldRenderImageCrop(crop);
  const normalizedCrop = normalizeImageCrop(crop);
  const cropFrameStyle = normalizedCrop
    ? { aspectRatio: `${normalizedCrop.width} / ${normalizedCrop.height}` }
    : undefined;
  const roundedClassName = rounded ? " rounded-media" : "";
  const cropShapeClassName = normalizedCrop?.shape === "ellipse" ? " ellipse-crop" : "";

  if (!shouldCrop) {
    return <img alt={alt} className={`${className}${roundedClassName}`} onClick={onClick} role={role} src={src} />;
  }

  if (!onClick) {
    return (
      <div className={`${className} media-crop-frame${roundedClassName}${cropShapeClassName}`} style={cropFrameStyle}>
        <img alt={alt} className="media-crop-image" role={role} src={src} style={cropImageStyle(crop)} />
      </div>
    );
  }

  return (
    <button className={`${className} media-crop-frame${roundedClassName}${cropShapeClassName}`} onClick={onClick} style={cropFrameStyle} type="button">
      <img alt={alt} className="media-crop-image" role={role} src={src} style={cropImageStyle(crop)} />
    </button>
  );
}
