import type {
  PaideiaBlock,
  PaideiaChapter,
  PaideiaModule,
  PaideiaPage,
  PaideiaProject,
  PaideiaWorkspaceState
} from "../types/project";

export type ChapterEntry = {
  module: PaideiaModule;
  chapter: PaideiaChapter;
};

export type ChapterProgress = {
  chapterId: string;
  title: string;
  total: number;
  completed: number;
  percent: number;
};

export type CourseProgress = {
  chapters: ChapterProgress[];
  total: number;
  completed: number;
  percent: number;
  completedAll: boolean;
};

export function flattenPages(project: PaideiaProject): PaideiaPage[] {
  return project.course.modules.flatMap((module) =>
    module.chapters.flatMap((chapter) => chapter.pages)
  );
}

export function workspaceWithoutBlock(
  workspaceState: PaideiaWorkspaceState,
  pageId: string,
  blockId: string
): PaideiaWorkspaceState {
  const nextState = structuredClone(workspaceState);
  const page = flattenPages(nextState.project).find((candidate) => candidate.id === pageId);
  if (page) {
    page.blocks = page.blocks.filter((block) => block.id !== blockId);
  }
  return nextState;
}

export function flattenChapters(project: PaideiaProject): ChapterEntry[] {
  return project.course.modules.flatMap((module) =>
    module.chapters.map((chapter) => ({ module, chapter }))
  );
}

export function firstPageForChapter(chapter: PaideiaChapter): PaideiaPage | null {
  return chapter.pages[0] ?? null;
}

export function visibleProjectAuthor(project: PaideiaProject | null) {
  const author = project?.createdBy?.trim() ?? "";
  return ["system", "système", "local-user"].includes(author.toLocaleLowerCase("fr-FR")) ? "" : author;
}

export function countBlocksForChapter(chapter: PaideiaChapter) {
  return chapter.pages.reduce((total, page) => total + page.blocks.length, 0);
}

export function countQuizBlocksForChapter(chapter: PaideiaChapter) {
  return chapter.pages.reduce(
    (total, page) => total + page.blocks.filter((block) => block.type === "quiz").length,
    0
  );
}

export function isTrackableBlock(block: PaideiaBlock) {
  return !["divider", "section-marker", "header", "course-exit", "result-message"].includes(block.type);
}

export function isPassiveCompletionBlock(block: PaideiaBlock) {
  return !["continue", "course-exit", "quiz", "result-message"].includes(block.type) && !["divider", "section-marker", "header"].includes(block.type);
}

export function calculateCourseProgress(
  chapterEntries: ChapterEntry[],
  completedBlocks: Record<string, boolean>
): CourseProgress {
  const chapters = chapterEntries.map(({ chapter }) => {
    const blockIds = chapter.pages.flatMap((page) => page.blocks.filter(isTrackableBlock).map((block) => block.id));
    const completed = blockIds.filter((blockId) => completedBlocks[blockId]).length;
    const percent = blockIds.length ? Math.round((completed / blockIds.length) * 100) : 0;
    return {
      chapterId: chapter.id,
      title: chapter.title,
      total: blockIds.length,
      completed,
      percent
    };
  });
  const total = chapters.reduce((sum, chapter) => sum + chapter.total, 0);
  const completed = chapters.reduce((sum, chapter) => sum + chapter.completed, 0);
  const percent = total ? Math.round((completed / total) * 100) : 0;
  return {
    chapters,
    total,
    completed,
    percent,
    completedAll: total > 0 && completed === total
  };
}
