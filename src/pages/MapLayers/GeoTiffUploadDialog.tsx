import LayerImportDialog from './LayerImportDialog'

export interface GeoTiffUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPublished?: () => void
  defaultMode?: 'standalone' | 'time_series'
}

export default function GeoTiffUploadDialog({
  open,
  onOpenChange,
  onPublished,
  defaultMode = 'standalone',
}: GeoTiffUploadDialogProps) {
  return (
    <LayerImportDialog
      open={open}
      onOpenChange={onOpenChange}
      defaultTab="geotiff"
      defaultGeoTiffMode={defaultMode}
      onPublished={onPublished}
    />
  )
}
