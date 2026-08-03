export interface BaseDialogProps {
  closeLabel: string;
  closeDisabled?: boolean;
  closeOnOverlay?: boolean;
  gridTemplateRows?: string;
  headerPadding?: string;
  label: string;
  maxHeight?: string;
  overlayBackground?: string;
  overlayBackdropFilter?: string;
  overflow?: string;
  panelClass?: string;
  title?: string;
  width?: string;
  zIndex?: number;
}

export interface BaseDialogEmits {
  close: [];
}
