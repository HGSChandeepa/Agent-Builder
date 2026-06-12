"use client";

import { useCallback, useEffect, useState } from "react";

const DEFAULT_PANEL_WIDTH = 300;
const MIN_PANEL_WIDTH = 240;
const MAX_PANEL_WIDTH = 560;

export function useResizablePanel(): {
  readonly panelWidth: number;
  readonly onResizeStart: (event: React.MouseEvent<HTMLDivElement>) => void;
  readonly isResizing: boolean;
} {
  const [panelWidth, setPanelWidth] = useState<number>(DEFAULT_PANEL_WIDTH);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const onResizeStart = useCallback((event: React.MouseEvent<HTMLDivElement>): void => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = panelWidth;
    setIsResizing(true);
    function handleMouseMove(moveEvent: MouseEvent): void {
      const delta = startX - moveEvent.clientX;
      const nextWidth = Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, startWidth + delta));
      setPanelWidth(nextWidth);
    }
    function handleMouseUp(): void {
      setIsResizing(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    }
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }, [panelWidth]);
  useEffect(() => {
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, []);
  return { panelWidth, onResizeStart, isResizing };
}
