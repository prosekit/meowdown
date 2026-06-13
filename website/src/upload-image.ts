/**
 * Uploads a file to https://tmpfiles.org and returns the URL of the uploaded
 * image.
 *
 * This is for demonstration only: tmpfiles.org deletes uploads after one hour.
 * A production host would POST to its own storage and return a stable URL.
 */
export async function uploadImage(file: File): Promise<string> {
  const body = new FormData()
  body.append('file', file)
  const response = await fetch('https://tmpfiles.org/api/v1/upload', { method: 'POST', body })
  if (!response.ok) {
    throw new Error(`Upload failed with status ${response.status}`)
  }
  const json = (await response.json()) as { data: { url: string } }
  // tmpfiles returns a viewer URL; rewrite it to the direct file URL.
  return json.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/')
}
