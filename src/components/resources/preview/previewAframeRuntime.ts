import "aframe";
import Plyr from "plyr";

const plyrSpriteUrl = new URL("../../../../node_modules/plyr/dist/plyr.svg", import.meta.url).href;

if (typeof window !== "undefined") {
  const previewWindow = window as Window & {
    AFRAME?: unknown;
    __PAIDEIA_PREVIEW_RUNTIME_READY?: boolean;
    Plyr?: typeof Plyr;
    __PAIDEIA_PLYR_ICON_URL?: string;
  };
  previewWindow.Plyr = Plyr;
  previewWindow.__PAIDEIA_PLYR_ICON_URL = plyrSpriteUrl;
  previewWindow.__PAIDEIA_PREVIEW_RUNTIME_READY = !!previewWindow.AFRAME;
}

export {};
