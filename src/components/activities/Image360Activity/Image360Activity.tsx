import { createElement, useEffect, useId, useMemo, useRef, useState } from "react";
import "aframe";
import { useI18n } from "../../../i18n/react";
import { IMAGE360_HOTSPOT_STYLE } from "./image360HotspotStyle";
import styles from "./Image360Activity.module.css";
import type { Image360ActivityProps, Image360CssVars } from "./types";

const SPHERE_RADIUS = 8;

function clampPitch(value: number) {
  return Math.max(-89, Math.min(89, value));
}

function degToRad(value: number) {
  return (value * Math.PI) / 180;
}

function radToDeg(value: number) {
  return (value * 180) / Math.PI;
}

function applyCameraRotation(camera: HTMLElement | null, yaw: number, pitch: number) {
  if (!camera) {
    return;
  }
  const safePitch = clampPitch(pitch);
  const safeYaw = Number.isFinite(yaw) ? yaw : 0;
  camera.setAttribute("rotation", `${safePitch} ${safeYaw} 0`);
  const object3D = (camera as any).object3D;
  object3D?.rotation?.set(degToRad(safePitch), degToRad(safeYaw), 0);

  const lookControls = (camera as any).components?.["look-controls"];
  if (lookControls?.pitchObject?.rotation && lookControls?.yawObject?.rotation) {
    lookControls.pitchObject.rotation.x = degToRad(safePitch);
    lookControls.yawObject.rotation.y = degToRad(safeYaw);
  }
}

function sphericalToPosition(yaw: number, pitch: number, radius = SPHERE_RADIUS) {
  const { x, y, z } = sphericalToVector(yaw, pitch, radius);
  return `${x.toFixed(3)} ${y.toFixed(3)} ${z.toFixed(3)}`;
}

function sphericalToVector(yaw: number, pitch: number, radius = SPHERE_RADIUS) {
  const yawRad = (yaw * Math.PI) / 180;
  const pitchRad = (pitch * Math.PI) / 180;
  const x = radius * Math.cos(pitchRad) * Math.sin(yawRad);
  const y = radius * Math.sin(pitchRad);
  const z = -radius * Math.cos(pitchRad) * Math.cos(yawRad);
  return { x, y, z };
}

function vectorToYawPitch(direction: { x: number; y: number; z: number }) {
  const yaw = (Math.atan2(direction.x, -direction.z) * 180) / Math.PI;
  const pitch = (Math.asin(Math.max(-1, Math.min(1, direction.y))) * 180) / Math.PI;
  return { yaw, pitch: clampPitch(pitch) };
}

function stripHtml(value: string | null | undefined) {
  return (
    value
      ?.replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, " ")
      .trim() ?? ""
  );
}

type HotspotOverlayPosition = {
  left: number;
  top: number;
  visible: boolean;
};

function readCameraRotation(camera: HTMLElement | null) {
  const lookControls = (camera as any)?.components?.["look-controls"];
  const lookYaw = lookControls?.yawObject?.rotation?.y;
  const lookPitch = lookControls?.pitchObject?.rotation?.x;
  if (Number.isFinite(lookYaw) && Number.isFinite(lookPitch)) {
    return { yaw: radToDeg(Number(lookYaw)), pitch: clampPitch(radToDeg(Number(lookPitch))) };
  }

  const objectRotation = (camera as any)?.object3D?.rotation;
  if (objectRotation) {
    const yaw = radToDeg(Number(objectRotation.y));
    const pitch = radToDeg(Number(objectRotation.x));
    if (Number.isFinite(yaw) && Number.isFinite(pitch)) {
      return { yaw, pitch: clampPitch(pitch) };
    }
  }

  const rotation = camera?.getAttribute("rotation") as { x?: number; y?: number; z?: number } | string | null;
  if (!rotation || typeof rotation === "string") {
    return { yaw: 0, pitch: 0 };
  }
  return {
    yaw: Number.isFinite(rotation.y) ? Number(rotation.y) : 0,
    pitch: Number.isFinite(rotation.x) ? clampPitch(Number(rotation.x)) : 0
  };
}

type HotspotEntityProps = {
  color: string;
  id: string;
  onActivate?: (id: string) => void;
  pitch: number;
  title: string;
  yaw: number;
};

function ensureLookAtCameraComponent() {
  const aframe = (window as Window & { AFRAME?: any }).AFRAME;
  if (!aframe || aframe.components?.["paideia-look-at-camera"]) {
    return;
  }
  aframe.registerComponent("paideia-look-at-camera", {
    tick() {
      const camera = this.el.sceneEl?.camera;
      if (camera) {
        this.el.object3D.lookAt(camera.position);
      }
    }
  });
}

function HotspotEntity({ color, id, onActivate, pitch, title, yaw }: HotspotEntityProps) {
  const ref = useRef<HTMLElement | null>(null);
  const pointPosition = sphericalToPosition(yaw, pitch);

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }
    const nextPosition = sphericalToVector(yaw, pitch);
    node.setAttribute("position", pointPosition);
    (node as any).object3D?.position?.set(nextPosition.x, nextPosition.y, nextPosition.z);
  }, [pitch, pointPosition, yaw]);

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }
    const handleClick = (event: Event) => {
      event.stopPropagation();
      onActivate?.(id);
    };
    node.addEventListener("click", handleClick);
    return () => node.removeEventListener("click", handleClick);
  }, [id, onActivate]);

  return createElement(
    "a-entity",
    null,
    createElement(
      "a-entity",
      {
        ref,
        class: "clickable",
        "data-hotspot-id": id,
        position: pointPosition,
        title: stripHtml(title)
      },
      createElement("a-entity", {
        animation: "property: scale; dir: alternate; dur: 1100; easing: easeInOutSine; loop: true; to: 1.25 1.25 1.25",
        geometry: `primitive: sphere; radius: ${IMAGE360_HOTSPOT_STYLE.glowRadius}`,
        material: `color: ${color}; opacity: ${IMAGE360_HOTSPOT_STYLE.glowOpacity}; transparent: true; shader: flat`,
        position: "0 0 0"
      }),
      createElement("a-entity", {
        class: "clickable",
        "data-hotspot-id": id,
        geometry: `primitive: sphere; radius: ${IMAGE360_HOTSPOT_STYLE.sphereRadius}`,
        material: `color: ${color}; shader: flat`,
        position: "0 0 0"
      }),
      createElement("a-entity", {
        class: "clickable",
        "data-hotspot-id": id,
        geometry: `primitive: ring; radiusInner: ${IMAGE360_HOTSPOT_STYLE.ringInnerRadius}; radiusOuter: ${IMAGE360_HOTSPOT_STYLE.ringOuterRadius}`,
        material: `color: ${color}; opacity: ${IMAGE360_HOTSPOT_STYLE.ringOpacity}; transparent: true; side: double`,
        position: "0 0 0"
      })
    ),
    null
  );
}

export function Image360Activity({
  allowFullscreen,
  backgroundColor,
  borderColor,
  borderStyle,
  borderWidth,
  contentNode,
  fullWidth,
  hotspots,
  imageSrc,
  imageAlt,
  imageDecorative = false,
  initialPitch,
  initialYaw,
  onHotspotActivate,
  onScenePointPick,
  onViewChange,
  pickingMode = false,
  rounded,
  shadow,
  titleNode,
  zoomEnabled
}: Image360ActivityProps) {
  const { t } = useI18n();
  const sceneId = useId().replace(/:/g, "");
  const [activeHotspotId, setActiveHotspotId] = useState("");
  const shellRef = useRef<HTMLElement | null>(null);
  const sceneRef = useRef<HTMLElement | null>(null);
  const cameraRef = useRef<HTMLElement | null>(null);
  const lastHotspotActivationRef = useRef(0);
  const [hotspotOverlayPositions, setHotspotOverlayPositions] = useState<Record<string, HotspotOverlayPosition>>({});
  const [isFullscreen, setIsFullscreen] = useState(false);
  const skyId = `image360-sky-${sceneId}`;
  const activeHotspot = hotspots.find((hotspot) => hotspot.id === activeHotspotId) ?? null;
  const cameraRotation = `${clampPitch(initialPitch)} ${initialYaw} 0`;

  const style = {
    "--image360-background": backgroundColor,
    "--image360-border-color": borderColor,
    "--image360-border-style": borderStyle,
    "--image360-border-width": borderWidth,
    "--image360-radius": rounded ? "28px" : "0px"
  } as Image360CssVars;

  const className = [
    styles.card,
    fullWidth ? styles.fullWidth : "",
    shadow ? styles.shadow : "",
    pickingMode ? styles.picking : ""
  ]
    .filter(Boolean)
    .join(" ");

  useEffect(() => {
    ensureLookAtCameraComponent();
  }, []);

  useEffect(() => {
    const camera = cameraRef.current;
    if (!camera) {
      return;
    }
    const applyInitialView = () => applyCameraRotation(camera, initialYaw, initialPitch);
    applyInitialView();
    const frame = window.requestAnimationFrame(() => {
      applyInitialView();
      window.requestAnimationFrame(applyInitialView);
    });
    camera.addEventListener("componentinitialized", applyInitialView);
    camera.addEventListener("loaded", applyInitialView);
    sceneRef.current?.addEventListener("loaded", applyInitialView);
    return () => {
      window.cancelAnimationFrame(frame);
      camera.removeEventListener("componentinitialized", applyInitialView);
      camera.removeEventListener("loaded", applyInitialView);
      sceneRef.current?.removeEventListener("loaded", applyInitialView);
    };
  }, [initialPitch, initialYaw, imageSrc]);

  useEffect(() => {
    if (!onViewChange) {
      return;
    }
    const interval = window.setInterval(() => {
      const { yaw, pitch } = readCameraRotation(cameraRef.current);
      onViewChange(yaw, pitch);
    }, 500);
    return () => window.clearInterval(interval);
  }, [onViewChange]);

  useEffect(() => {
    const shell = shellRef.current;
    const camera = cameraRef.current;
    if (!shell || !camera || !zoomEnabled) {
      return;
    }
    let fov = 80;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      fov = Math.max(45, Math.min(80, fov + (event.deltaY > 0 ? 4 : -4)));
      camera.setAttribute("camera", `fov: ${fov}`);
      const cameraComponent = (camera as any).components?.camera?.camera;
      if (cameraComponent) {
        cameraComponent.fov = fov;
        cameraComponent.updateProjectionMatrix?.();
      }
    };
    shell.addEventListener("wheel", handleWheel, { passive: false, capture: true });
    return () => shell.removeEventListener("wheel", handleWheel, { capture: true } as AddEventListenerOptions);
  }, [zoomEnabled]);

  useEffect(() => {
    const scene = sceneRef.current;
    const shell = shellRef.current;
    if (!scene || !onScenePointPick) {
      return;
    }
    const handleContextMenu = (event: MouseEvent) => {
      if (!pickingMode) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const canvas = (scene as any).canvas as HTMLCanvasElement | undefined;
      const aframe = (window as Window & { AFRAME?: { THREE?: any } }).AFRAME;
      const camera = (scene as any).camera;
      if (!canvas || !aframe?.THREE || !camera) {
        const { yaw, pitch } = readCameraRotation(cameraRef.current);
        onScenePointPick(yaw, pitch);
        return;
      }
      const rect = canvas.getBoundingClientRect();
      const mouse = {
        x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
        y: -((event.clientY - rect.top) / rect.height) * 2 + 1
      };
      const raycaster = new aframe.THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);
      const { yaw, pitch } = vectorToYawPitch(raycaster.ray.direction.normalize());
      onScenePointPick(yaw, pitch);
    };
    shell?.addEventListener("contextmenu", handleContextMenu);
    return () => shell?.removeEventListener("contextmenu", handleContextMenu);
  }, [onScenePointPick, pickingMode]);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) {
      return;
    }

    const handleViewerClick = (event: MouseEvent) => {
      if (event.button !== 0) {
        return;
      }
      if (window.performance.now() - lastHotspotActivationRef.current < 160) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Element)) {
        setActiveHotspotId("");
        return;
      }
      if (target.closest("[data-hotspot-id]") || target.closest("[data-image360-panel-overlay]")) {
        return;
      }
      setActiveHotspotId("");
    };

    shell.addEventListener("click", handleViewerClick);
    return () => shell.removeEventListener("click", handleViewerClick);
  }, []);

  useEffect(() => {
    const scene = sceneRef.current as any;
    if (!scene) {
      return;
    }
    let frame = 0;
    let isMounted = true;
    const updateOverlayPositions = () => {
      if (!isMounted) {
        return;
      }
      const canvas = scene.canvas as HTMLCanvasElement | undefined;
      const camera = scene.camera;
      const aframe = (window as Window & { AFRAME?: { THREE?: any } }).AFRAME;
      if (!canvas || !camera || !aframe?.THREE) {
        frame = window.requestAnimationFrame(updateOverlayPositions);
        return;
      }
      const rect = canvas.getBoundingClientRect();
      const nextPositions: Record<string, HotspotOverlayPosition> = {};
      hotspots.forEach((hotspot) => {
        const yawRad = (hotspot.yaw * Math.PI) / 180;
        const pitchRad = (hotspot.pitch * Math.PI) / 180;
        const vector = new aframe.THREE.Vector3(
          SPHERE_RADIUS * Math.cos(pitchRad) * Math.sin(yawRad),
          SPHERE_RADIUS * Math.sin(pitchRad),
          -SPHERE_RADIUS * Math.cos(pitchRad) * Math.cos(yawRad)
        );
        vector.project(camera);
        nextPositions[hotspot.id] = {
          left: (vector.x * 0.5 + 0.5) * rect.width,
          top: (-vector.y * 0.5 + 0.5) * rect.height,
          visible: vector.z > -1 && vector.z < 1
        };
      });
      setHotspotOverlayPositions(nextPositions);
      frame = window.requestAnimationFrame(updateOverlayPositions);
    };
    frame = window.requestAnimationFrame(updateOverlayPositions);
    return () => {
      isMounted = false;
      window.cancelAnimationFrame(frame);
    };
  }, [hotspots]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === shellRef.current);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  async function toggleFullscreen() {
    const shell = shellRef.current;
    if (!shell) {
      return;
    }
    if (document.fullscreenElement === shell) {
      await document.exitFullscreen();
      return;
    }
    await shell.requestFullscreen();
  }

  const hotspotNodes = useMemo(
    () =>
      hotspots.map((hotspot) => (
        <HotspotEntity
          color={hotspot.color || IMAGE360_HOTSPOT_STYLE.defaultColor}
          id={hotspot.id}
          key={`${hotspot.id}-${hotspot.yaw}-${hotspot.pitch}`}
          onActivate={(hotspotId) => {
            lastHotspotActivationRef.current = window.performance.now();
            setActiveHotspotId((current) => (current === hotspotId ? "" : hotspotId));
            onHotspotActivate?.(hotspotId);
          }}
          pitch={hotspot.pitch}
          title={hotspot.title}
          yaw={hotspot.yaw}
        />
      )),
    [hotspots, onHotspotActivate]
  );

  return (
    <article className={className} style={style}>
      {titleNode ? <div className={styles.title}>{titleNode}</div> : null}
      <section className={styles.viewerShell} ref={shellRef}>
        <div className={styles.viewer}>
          {createElement(
            "a-scene",
            {
              key: imageSrc,
              ref: sceneRef,
              embedded: true,
              "vr-mode-ui": "enabled: false",
              renderer: "antialias: true",
              cursor: "rayOrigin: mouse",
              raycaster: "objects: .clickable"
            },
            createElement("a-assets", null, createElement("img", {
              alt: imageDecorative ? "" : imageAlt,
              id: skyId,
              role: imageDecorative ? "presentation" : undefined,
              src: imageSrc
            })),
            createElement("a-sky", { rotation: "0 -90 0", src: `#${skyId}` }),
            createElement("a-entity", {
              ref: cameraRef,
              camera: "fov: 80",
              "data-initial-pitch": clampPitch(initialPitch),
              "data-initial-yaw": initialYaw,
              "look-controls": "enabled: true; reverseMouseDrag: false; magicWindowTrackingEnabled: true; pointerLockEnabled: false",
              position: "0 1.6 0",
              rotation: cameraRotation,
              "wasd-controls": "enabled: false"
            }),
            hotspotNodes
          )}
        </div>
        {activeHotspot ? (
          <aside className={styles.hotspotPanel} data-image360-panel-overlay>
            <div className={styles.hotspotPanelTitle} dangerouslySetInnerHTML={{ __html: activeHotspot.title || "<p></p>" }} />
            <div className="rich-content" dangerouslySetInnerHTML={{ __html: activeHotspot.contentHtml || "<p></p>" }} />
          </aside>
        ) : null}
        <div className={styles.hotspotBadgeLayer} aria-hidden={false}>
          {hotspots.map((hotspot) => {
            const position = hotspotOverlayPositions[hotspot.id];
            if (!position?.visible) {
              return null;
            }
            return (
              <button
                aria-label={t("image360.hotspotAria", { count: hotspot.order }, "Point {count}")}
                className={styles.hotspotBadge}
                data-hotspot-id={hotspot.id}
                key={hotspot.id}
                onClick={(event) => {
                  event.stopPropagation();
                  lastHotspotActivationRef.current = window.performance.now();
                  setActiveHotspotId((current) => (current === hotspot.id ? "" : hotspot.id));
                  onHotspotActivate?.(hotspot.id);
                }}
                style={{ left: position.left, top: position.top }}
                type="button"
              >
                {String(hotspot.order).padStart(2, "0")}
              </button>
            );
          })}
        </div>
        
        {allowFullscreen ? (
          <button
            aria-label={isFullscreen ? t("image360.exitFullscreen", undefined, "Quitter le plein écran") : t("image360.enterFullscreen", undefined, "Afficher en plein écran")}
            className={styles.fullscreenButton}
            onClick={toggleFullscreen}
            type="button"
          >
            <svg aria-hidden="true" className={styles.fullscreenIcon} viewBox="0 0 32 32">
              <path d="M13 5H6v7" />
              <path d="M6 5l8 8" />
              <path d="M19 5h7v7" />
              <path d="M26 5l-8 8" />
              <path d="M13 27H6v-7" />
              <path d="M6 27l8-8" />
              <path d="M19 27h7v-7" />
              <path d="M26 27l-8-8" />
            </svg>
          </button>
        ) : null}
      </section>
      {contentNode ? <div className={styles.content}>{contentNode}</div> : null}
    </article>
  );
}
