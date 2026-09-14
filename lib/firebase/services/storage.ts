/**
 * Cloud Storage service contract.
 * Separates media asset uploads (camera challenge photos, voice notes) from UI.
 */
export interface StorageServiceContract {
  uploadChallengePhoto(coupleId: string, file: Blob, mimeType: string): Promise<string>;
  uploadVoiceNote(coupleId: string, audioBlob: Blob): Promise<string>;
}

export class FirebaseStorageService implements StorageServiceContract {
  async uploadChallengePhoto(_coupleId: string, _file: Blob, _mimeType: string): Promise<string> {
    return "";
  }

  async uploadVoiceNote(_coupleId: string, _audioBlob: Blob): Promise<string> {
    return "";
  }
}

export const storageService = new FirebaseStorageService();
