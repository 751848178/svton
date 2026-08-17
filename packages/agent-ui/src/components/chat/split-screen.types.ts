export type SplitScreenContent =
  | { type: 'document'; title: string; content: string }
  | { type: 'code'; title: string; code: string; language?: string }
  | { type: 'pdf'; title: string; images: string[]; currentPage?: number }
  | { type: 'image'; title: string; src: string; alt?: string }
  | { type: 'preview_images'; title: string; images: string[] };

export interface SplitScreenPanelProps {
  content: SplitScreenContent | null;
  onClose: () => void;
  className?: string;
  /** Hides mutable actions for artifact popout windows. */
  readOnly?: boolean;
}
