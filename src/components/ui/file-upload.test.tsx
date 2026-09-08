import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FileUpload, FileUploadClear, FileUploadDropzone, FileUploadItem, FileUploadItemDelete, FileUploadItemMetadata, FileUploadItemPreview, FileUploadItemProgress, FileUploadList, FileUploadTrigger } from './file-upload'

const makeFile = (name: string, type: string, size = 10) => {
  const value = new File(['x'], name, { type })
  Object.defineProperty(value, 'size', { value: size })
  return value
}

function renderUpload(itemFile: File, props: Record<string, unknown> = {}) {
  const callbacks = { onValueChange: vi.fn(), onFileReject: vi.fn(), onAccept: vi.fn(), onFileAccept: vi.fn() }
  render(
    <FileUpload label="Files" {...callbacks} {...props}>
      <FileUploadDropzone>Drop files</FileUploadDropzone>
      <FileUploadTrigger>Choose</FileUploadTrigger>
      <FileUploadList>
        <FileUploadItem value={itemFile}>
          <FileUploadItemPreview />
          <FileUploadItemMetadata />
          <FileUploadItemProgress variant="linear" />
          <FileUploadItemProgress variant="circular" />
          <FileUploadItemProgress variant="fill" />
          <FileUploadItemDelete>Delete</FileUploadItemDelete>
        </FileUploadItem>
      </FileUploadList>
      <FileUploadClear forceMount>Clear</FileUploadClear>
    </FileUpload>
  )
  return callbacks
}

describe('FileUpload', () => {
  it('accepts valid files and renders metadata', async () => {
    const selected = makeFile('readme.txt', 'text/plain')
    const callbacks = renderUpload(selected)
    const input = screen.getByLabelText('Files') as HTMLInputElement
    fireEvent.change(input, { target: { files: [selected] } })
    await waitFor(() => expect(callbacks.onValueChange).toHaveBeenCalled())
    expect(screen.getByText('readme.txt')).toBeInTheDocument()
    expect(callbacks.onAccept).toHaveBeenCalledWith([selected])
    expect(callbacks.onFileAccept).toHaveBeenCalledWith(selected)
  })

  it('rejects custom validation, unsupported types and oversized files', async () => {
    const custom = vi.fn(() => 'custom rejection')
    const selected = makeFile('bad.txt', 'text/plain', 10)
    const callbacks = renderUpload(selected, { accept: 'application/json', maxSize: 5, onFileValidate: custom })
    const input = screen.getByLabelText('Files')
    fireEvent.change(input, { target: { files: [selected] } })
    await waitFor(() => expect(callbacks.onFileReject).toHaveBeenCalled())
    expect(custom).toHaveBeenCalled()
    expect(callbacks.onFileReject).toHaveBeenCalledWith(expect.any(File), 'custom rejection')
  })

  it('runs upload callbacks, renders progress variants and clears files', async () => {
    const selected = makeFile('upload.txt', 'text/plain')
    const onUpload = vi.fn(async (files: File[], options: { onProgress: (file: File, progress: number) => void }) => {
      options.onProgress(files[0], 40)
    })
    const callbacks = renderUpload(selected, { onUpload })
    const input = screen.getByLabelText('Files') as HTMLInputElement
    fireEvent.change(input, { target: { files: [selected] } })
    await waitFor(() => expect(onUpload).toHaveBeenCalled())
    expect(screen.getAllByRole('progressbar').length).toBe(3)
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    await waitFor(() => expect(callbacks.onValueChange).toHaveBeenLastCalledWith([]))
  })
})
