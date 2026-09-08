export function makeFile(name: string, type: string, size = 128): File {
  const file = new File(['test'], name, { type })
  Object.defineProperty(file, 'size', { configurable: true, value: size })
  return file
}

export function mockApiResponse<T>(data: T) {
  return { success: true, data, message: '' }
}
