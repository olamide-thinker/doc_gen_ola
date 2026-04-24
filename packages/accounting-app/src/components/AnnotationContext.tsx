import React, { createContext, useContext, useState } from 'react';

export interface ToolConfig {
  pin:       { size: number };
  highlight: { thickness: number; opacity: number };
  draw:      { thickness: number };
}

export interface RelocatingAnnotation {
  id: string; x: number; y: number; originalX: number; originalY: number;
}

export const PRESET_COLORS = [
  'hsl(var(--primary))', '#ef4444', '#f59e0b', '#10b981',
  '#3b82f6', '#8b5cf6', '#ec4899', '#1e293b',
];

export const DEFAULT_TOOL_CONFIG: ToolConfig = {
  pin:       { size: 48 },
  highlight: { thickness: 10, opacity: 0.25 },
  draw:      { thickness: 2 },
};

export interface AnnotationContextValue {
  activeAnnotationId: string | null;
  setActiveAnnotationId: (id: string | null) => void;

  activeMode: 'inspect' | 'pin' | 'highlight' | 'draw';
  setActiveMode: (mode: 'inspect' | 'pin' | 'highlight' | 'draw') => void;

  activeColor: string;
  setActiveColor: (color: string) => void;

  toolConfig: ToolConfig;
  setToolConfig: React.Dispatch<React.SetStateAction<ToolConfig>>;

  openConfig: 'pin' | 'highlight' | 'draw' | null;
  setOpenConfig: (v: 'pin' | 'highlight' | 'draw' | null) => void;

  isMinimized: boolean;
  setIsMinimized: (v: boolean) => void;

  editingId: string | null;
  setEditingId: (id: string | null) => void;

  editingText: string;
  setEditingText: (t: string) => void;

  relocatingAnnotation: RelocatingAnnotation | null;
  setRelocatingAnnotation: (r: RelocatingAnnotation | null) => void;

  replyText: Record<string, string>;
  setReplyText: React.Dispatch<React.SetStateAction<Record<string, string>>>;

  /** Called by PdfViewer to let the sidebar scroll a page into view when annotation is selected */
  scrollToPage?: (pageNumber: number) => void;
  setScrollToPage: (fn: ((page: number) => void) | undefined) => void;
}

const AnnotationContext = createContext<AnnotationContextValue | null>(null);

/** Required — throws if used outside provider */
export const useAnnotationContext = (): AnnotationContextValue => {
  const ctx = useContext(AnnotationContext);
  if (!ctx) throw new Error('useAnnotationContext must be used within AnnotationProvider');
  return ctx;
};

/** Optional — returns null when outside provider (legacy single-page mode) */
export const useOptionalAnnotationContext = (): AnnotationContextValue | null =>
  useContext(AnnotationContext);

export const AnnotationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null);
  const [activeMode, setActiveMode]                 = useState<'inspect' | 'pin' | 'highlight' | 'draw'>('inspect');
  const [activeColor, setActiveColor]               = useState(PRESET_COLORS[0]);
  const [toolConfig, setToolConfig]                 = useState<ToolConfig>(DEFAULT_TOOL_CONFIG);
  const [openConfig, setOpenConfig]                 = useState<'pin' | 'highlight' | 'draw' | null>(null);
  const [isMinimized, setIsMinimized]               = useState(true);
  const [editingId, setEditingId]                   = useState<string | null>(null);
  const [editingText, setEditingText]               = useState('');
  const [relocatingAnnotation, setRelocatingAnnotation] = useState<RelocatingAnnotation | null>(null);
  const [replyText, setReplyText]                   = useState<Record<string, string>>({});
  const [scrollToPage, setScrollToPage]             = useState<((page: number) => void) | undefined>(undefined);

  return (
    <AnnotationContext.Provider value={{
      activeAnnotationId, setActiveAnnotationId,
      activeMode, setActiveMode,
      activeColor, setActiveColor,
      toolConfig, setToolConfig,
      openConfig, setOpenConfig,
      isMinimized, setIsMinimized,
      editingId, setEditingId,
      editingText, setEditingText,
      relocatingAnnotation, setRelocatingAnnotation,
      replyText, setReplyText,
      scrollToPage,
      setScrollToPage,
    }}>
      {children}
    </AnnotationContext.Provider>
  );
};
