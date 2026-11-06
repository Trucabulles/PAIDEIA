export type ObservationMessage = {
  id: string;
  authorId: string;
  authorDisplayName: string;
  text: string;
  createdAt: string;
  deletedAt: string | null;
  deletedByDisplayName: string | null;
};

export type ObservationThread = {
  id: string;
  chapterId: string;
  pageId: string;
  blockId: string;
  blockLabel: string;
  sourceRevision: string;
  resolved: boolean;
  messages: ObservationMessage[];
};

export type ObservationState = {
  threads: ObservationThread[];
  currentUserId: string;
  currentUserDisplayName: string;
  collaborative: boolean;
  canResolve: boolean;
  canPurge: boolean;
  revision: string;
};

export type ObservationTarget = {
  chapterId: string;
  pageId: string;
  blockId: string;
  blockLabel: string;
  chapterNumber: number | null;
  activityNumber: number | null;
  activityLabel: string;
};
