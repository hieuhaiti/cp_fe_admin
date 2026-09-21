import LayerImportDialog from './LayerImportDialog'

export interface ShapefileImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export default function ShapefileImportDialog({
  open,
  onOpenChange,
  onSuccess,
}: ShapefileImportDialogProps) {
  return (
    <LayerImportDialog
      open={open}
      onOpenChange={onOpenChange}
      defaultTab="shapefile"
      onSuccess={onSuccess}
    />
  )
}
