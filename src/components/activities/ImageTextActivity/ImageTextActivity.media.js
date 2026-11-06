/** Preserve the intrinsic width, including absolutely positioned crop images. */
export function measureImageTextCroppedMedia(activity) {
  const media = activity?.firstElementChild;
  if (!(media instanceof HTMLElement)) return;
  if (media instanceof HTMLImageElement && media.naturalWidth) {
    media.style.setProperty('--image-text-natural-width', `${media.naturalWidth}px`);
    return;
  }
  if (!media.classList.contains('media-crop-frame')) return;
  const image = media.querySelector('img.media-crop-image');
  if (!image?.naturalWidth) return;
  const scale = Number.parseFloat(image.style.width) || 100;
  if (getComputedStyle(media).aspectRatio === 'auto') {
    media.style.aspectRatio = String((Number.parseFloat(image.style.height) || 100) / scale);
  }
  const [width, height = '1'] = getComputedStyle(media).aspectRatio.split('/');
  media.style.setProperty('--image-text-crop-natural-width', `${image.naturalWidth * 100 / scale}px`);
  media.style.setProperty('--image-text-crop-ratio', String((Number.parseFloat(width) || 1) / (Number.parseFloat(height) || 1)));
}

export function prepareImageTextMedia(root) {
  root.querySelectorAll('.paideia-image-text-activity').forEach(measureImageTextCroppedMedia);
}
