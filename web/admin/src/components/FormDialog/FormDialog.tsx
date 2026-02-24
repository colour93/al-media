import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  CircularProgress,
} from '@mui/material';

export interface FormDialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
  loading?: boolean;
  submitDisabled?: boolean;
  submitLabel?: string;
  cancelLabel?: string;
  children: React.ReactNode;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** 渲染在 DialogActions 左侧（确定/取消之前）的额外操作 */
  actionsBefore?: React.ReactNode;
}

export function FormDialog({
  open,
  title,
  onClose,
  onSubmit,
  loading = false,
  submitDisabled = false,
  submitLabel = '确定',
  cancelLabel = '取消',
  children,
  maxWidth = 'sm',
  actionsBefore,
}: FormDialogProps) {
  const handleSubmit = async () => {
    await onSubmit();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth={maxWidth} fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers>{children}</DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Box sx={{ flex: 1 }}>{actionsBefore}</Box>
        <Button onClick={onClose} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button variant="contained" onClick={handleSubmit} disabled={loading || submitDisabled}>
          {loading ? <CircularProgress size={22} /> : submitLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
