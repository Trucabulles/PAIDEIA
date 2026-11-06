export type ObservationPdfMessage = {
  heading: string;
  text: string;
  deleted: boolean;
};

export type ObservationPdfThread = {
  target: string;
  resolvedLabel: string | null;
  messages: ObservationPdfMessage[];
};

export type ObservationPdfModel = {
  title: string;
  lessonTitle: string;
  generatedAt: string;
  threads: ObservationPdfThread[];
};

export type ObservationPdfWorkerRequest = {
  model: ObservationPdfModel;
  fonts: ArrayBuffer[];
};

export type ObservationPdfWorkerResponse =
  | { kind: "success"; pdf: ArrayBuffer }
  | { kind: "failure"; message: string };
