import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { isProjectImageAnimated } from "../../lib/projectApi";

const ImageCropProjectPathContext = createContext("");
const animationChecks = new Map<string, Promise<boolean>>();

function animationCandidate(assetRef: string) {
  return /\.(gif|webp)(?:$|[?#])/i.test(assetRef);
}

function checkAnimation(projectPath: string, assetRef: string) {
  const key = `${projectPath}\n${assetRef}`;
  const existing = animationChecks.get(key);
  if (existing) return existing;
  const check = isProjectImageAnimated(projectPath, assetRef).catch(() => true);
  animationChecks.set(key, check);
  return check;
}

export function ImageCropAvailabilityProvider({
  children,
  projectPath
}: {
  children: ReactNode;
  projectPath: string;
}) {
  return (
    <ImageCropProjectPathContext.Provider value={projectPath}>
      {children}
    </ImageCropProjectPathContext.Provider>
  );
}

export function ImageCropAction({
  assetRef,
  children
}: {
  assetRef?: string | null;
  children: ReactNode;
}) {
  const projectPath = useContext(ImageCropProjectPathContext);
  const candidate = Boolean(assetRef && animationCandidate(assetRef));
  const cacheKey = useMemo(() => `${projectPath}\n${assetRef ?? ""}`, [assetRef, projectPath]);
  const [visible, setVisible] = useState(!candidate);

  useEffect(() => {
    let active = true;
    if (!candidate || !assetRef || !projectPath) {
      setVisible(!candidate);
      return () => {
        active = false;
      };
    }
    setVisible(false);
    void checkAnimation(projectPath, assetRef).then((animated) => {
      if (active) setVisible(!animated);
    });
    return () => {
      active = false;
    };
  }, [assetRef, cacheKey, candidate, projectPath]);

  return visible ? children : null;
}
