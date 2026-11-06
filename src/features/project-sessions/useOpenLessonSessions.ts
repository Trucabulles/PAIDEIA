import { useCallback, useMemo, useRef } from "react";
import type { QuizResult } from "../../assessment/assessmentTypes";
import type { LessonCustomFont, PaideiaWorkspaceState } from "../../types/project";

export type OpenLessonSession = {
  projectPath: string;
  workspaceState: PaideiaWorkspaceState;
  activePageId: string;
  selectedBlockId: string;
  archivePath: string;
  isPreviewMode: boolean;
  isLessonMenuOpen: boolean;
  previewCompletedBlocks: Record<string, boolean>;
  previewQuizResults: Record<string, QuizResult>;
  projectRichTextFonts: LessonCustomFont[];
  lessonFontsReadyKey: string;
};

export function useOpenLessonSessions() {
  const sessionsRef = useRef(new Map<string, OpenLessonSession>());

  const remember = useCallback((projectPath: string, session: OpenLessonSession) => {
    if (projectPath && session.projectPath === projectPath) sessionsRef.current.set(projectPath, session);
  }, []);

  const get = useCallback((projectPath: string) => {
    const session = sessionsRef.current.get(projectPath) ?? null;
    if (session && session.projectPath !== projectPath) {
      sessionsRef.current.delete(projectPath);
      return null;
    }
    return session;
  }, []);

  const entries = useCallback(() => {
    for (const [projectPath, session] of sessionsRef.current.entries()) {
      if (session.projectPath !== projectPath) sessionsRef.current.delete(projectPath);
    }
    return Array.from(sessionsRef.current.entries());
  }, []);

  const forget = useCallback((projectPath: string) => {
    sessionsRef.current.delete(projectPath);
  }, []);

  const remap = useCallback((oldPath: string, newPath: string) => {
    const session = sessionsRef.current.get(oldPath);
    sessionsRef.current.delete(oldPath);
    if (session && newPath) sessionsRef.current.set(newPath, { ...session, projectPath: newPath });
  }, []);

  const retain = useCallback((projectPaths: string[]) => {
    const retained = new Set(projectPaths);
    for (const projectPath of sessionsRef.current.keys()) {
      if (!retained.has(projectPath)) sessionsRef.current.delete(projectPath);
    }
  }, []);

  const clear = useCallback(() => sessionsRef.current.clear(), []);

  return useMemo(
    () => ({ clear, entries, forget, get, remember, remap, retain }),
    [clear, entries, forget, get, remember, remap, retain]
  );
}
