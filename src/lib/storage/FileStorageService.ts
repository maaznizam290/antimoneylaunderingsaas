/// Storage abstraction so the database only ever holds a `storageKey`
/// reference (see UploadedFile.storageKey), never document bytes. Swap
/// `LocalDiskStorage` for an S3 / GCS / Supabase-Storage implementation in
/// production by implementing this same interface — nothing else in the
/// app depends on the storage backend.
export interface FileStorageService {
  /// Persists `data` and returns an opaque key to retrieve it later.
  upload(params: { applicationId: string; fileName: string; data: Buffer }): Promise<string>;

  /// Retrieves previously stored bytes by key. Throws if the key is unknown.
  retrieve(storageKey: string): Promise<Buffer>;

  /// Permanently removes stored bytes. Safe to call on an already-deleted key.
  delete(storageKey: string): Promise<void>;
}
