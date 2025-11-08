import { useState } from "react";

export interface UploadedFile {
  originalName: string;
  filename: string;
  size: number;
  mimetype: string;
  path: string;
}

export function useFileUpload() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadFile = async (file: File): Promise<UploadedFile | null> => {
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("files", file);

      const response = await fetch("/api/files/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload file");
      }

      const data = await response.json();
      return data.files[0]; // Return first uploaded file metadata
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Upload failed";
      setError(errorMessage);
      return null;
    } finally {
      setUploading(false);
    }
  };

  return { uploadFile, uploading, error };
}
