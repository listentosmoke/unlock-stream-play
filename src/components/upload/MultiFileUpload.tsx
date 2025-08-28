import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/auth/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Upload as UploadIcon, Video, FileVideo, X, Check, AlertCircle } from 'lucide-react';
import { generateVideoThumbnail } from '@/utils/thumbnailGenerator';

interface UploadFile {
  id: string;
  file: File;
  title: string;
  description: string;
  progress: number; // 0..100
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
}

type PartETag = { PartNumber: number; ETag: string };

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB

function safeId() {
  try {
    const rnd = crypto.getRandomValues(new Uint32Array(2));
    return [...rnd].map(n => n.toString(36)).join('');
  } catch {
    return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  }
}

export default function MultiFileUpload() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  // Redirect if not authenticated
  useEffect(() => {
    if (!user) navigate('/auth');
  }, [user, navigate]);
  if (!user) return null;

  // ---- safe state reads / counters (prevents `.length` crash) ----
  const filesSafe = Array.isArray(uploadFiles) ? uploadFiles : [];

  const counts = useMemo(() => {
    let pending = 0, uploading = 0, completed = 0, errored = 0;
    for (const f of filesSafe) {
      if (f.status === 'pending') pending++;
      if (f.status === 'uploading') uploading++;
      if (f.status === 'completed') completed++;
      if (f.status === 'error') errored++;
    }
    return { pending, uploading, completed, errored, total: filesSafe.length };
  }, [filesSafe]);

  const totalProgress = counts.total
    ? Math.round(filesSafe.reduce((s, f) => s + (typeof f.progress === 'number' ? f.progress : 0), 0) / counts.total)
    : 0;

  // ---- list helpers ----
  const addFiles = useCallback((files: FileList) => {
    const toAdd: UploadFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('video/')) continue;
      const baseName = file.name.replace(/\.[^/.]+$/, '');
      toAdd.push({
        id: safeId(),
        file,
        title: baseName,
        description: '',
        progress: 0,
        status: 'pending',
      });
    }
    if (!toAdd.length) {
      toast({
        title: 'Error',
        description: 'Please select valid video files',
        variant: 'destructive',
      });
      return;
    }
    setUploadFiles(prev => [...prev, ...toAdd]);
  }, [toast]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    dragCounterRef.current++;
    setIsDragging(true);
  }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragging(false);
    }
  }, []);
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
  }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setIsDragging(false); dragCounterRef.current = 0;
    if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
  }, [addFiles]);
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) addFiles(files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (id: string) => setUploadFiles(prev => prev.filter(f => f.id !== id));
  const updateFile = (id: string, updates: Partial<UploadFile>) =>
    setUploadFiles(prev => prev.map(f => (f.id === id ? { ...f, ...updates } : f)));

  // ---- R2 presign helpers ----
  const getObjectWithRetry = async (objectKey: string, tries = 6) => {
    let lastErr: any = null;
    for (let i = 0; i < tries; i++) {
      try {
        const { data, error } = await supabase.functions.invoke('r2-presign', {
          body: { action: 'get-object', objectKey, expires: 3600 },
        });
        if (error) throw error;
        if (data?.presignedUrl) return data.presignedUrl as string;
        throw new Error('No presignedUrl in response');
      } catch (e: any) {
        lastErr = e;
        // backoff: 250ms, 500ms, 800ms, 1200ms, 1800ms, 2500ms
        const wait = [250, 500, 800, 1200, 1800, 2500][Math.min(i, 5)];
        await new Promise(r => setTimeout(r, wait));
      }
    }
    console.warn('GET presign still failing after retries; continuing without it', lastErr);
    return null; // non-fatal
  };

  const simpleUpload = async (item: UploadFile) => {
    const { data, error } = await supabase.functions.invoke('r2-presign', {
      body: {
        action: 'simple-upload',
        fileName: item.file.name,
        fileType: item.file.type,
        fileSize: item.file.size,
      },
    });
    if (error) throw error;

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          updateFile(item.id, { progress: 20 + Math.round(pct * 0.7) });
        }
      });
      xhr.addEventListener('load', () => (xhr.status === 200 ? resolve() : reject(new Error(`Upload failed ${xhr.status}`))));
      xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
      xhr.open('PUT', data.presignedUrl);
      xhr.setRequestHeader('Content-Type', item.file.type);
      xhr.send(item.file);
    });

    return { objectKey: data.objectKey as string, signedGetUrl: (data.signedGetUrl as string) ?? null };
  };

  const multipartUpload = async (item: UploadFile) => {
    const totalChunks = Math.ceil(item.file.size / CHUNK_SIZE);
    let uploadId = '';
    let objectKey = '';
    let didComplete = false;

    try {
      // 1) initiate
      const { data: init, error: initErr } = await supabase.functions.invoke('r2-presign', {
        body: {
          action: 'initiate-multipart',
          fileName: item.file.name,
          fileType: item.file.type,
          fileSize: item.file.size,
        },
      });
      if (initErr) throw initErr;
      uploadId = init.uploadId;
      objectKey = init.objectKey;
      if (!uploadId || !objectKey) throw new Error('Missing uploadId/objectKey from initiate-multipart');

      // 2) parts
      const parts: PartETag[] = [];
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, item.file.size);
        const blob = item.file.slice(start, end);
        const partNumber = i + 1;

        const { data: part, error: partErr } = await supabase.functions.invoke('r2-presign', {
          body: { action: 'get-part-url', objectKey, uploadId, partNumber },
        });
        if (partErr) throw partErr;

        const res = await fetch(part.presignedUrl, { method: 'PUT', body: blob });
        if (!res.ok) throw new Error(`Part ${partNumber} failed: ${res.status}`);
        const etag = res.headers.get('ETag');
        if (!etag) throw new Error(`Missing ETag for part ${partNumber}`);
        parts.push({ PartNumber: partNumber, ETag: etag });

        const pct = Math.round(((i + 1) / totalChunks) * 100);
        updateFile(item.id, { progress: 20 + Math.round(pct * 0.7) });
      }

      // 3) complete
      const { data: done, error: completeErr } = await supabase.functions.invoke('r2-presign', {
        body: { action: 'complete-multipart', objectKey, uploadId, parts },
      });
      if (completeErr) throw completeErr;
      didComplete = true;

      // prefer url from complete
      let signedGetUrl: string | null = done?.signedGetUrl ?? null;

      // if not returned (or a race happens), fetch GET url with retry — do NOT fail upload if this hiccups
      if (!signedGetUrl) signedGetUrl = await getObjectWithRetry(objectKey);

      return { objectKey, signedGetUrl: signedGetUrl ?? null };
    } catch (e) {
      // only try to abort if we actually initiated and haven't completed
      if (uploadId && objectKey && !didComplete) {
        try {
          await supabase.functions.invoke('r2-presign', {
            body: { action: 'abort-multipart', objectKey, uploadId },
          });
        } catch (abortErr) {
          // Ignore abort errors — they’re often non-actionable and can happen if R2 closed the upload itself
          console.warn('Abort failed (ignored):', abortErr);
        }
      }
      throw e;
    }
  };

  const uploadToR2 = async (item: UploadFile) => {
    if (item.file.size < CHUNK_SIZE) return simpleUpload(item);
    return multipartUpload(item);
  };

  const uploadOne = async (uf: UploadFile): Promise<{ id: string; ok: boolean }> => {
    try {
      updateFile(uf.id, { status: 'uploading', progress: 10 });

      // 1) thumbnail first
      const thumbBlob = await generateVideoThumbnail(uf.file);
      updateFile(uf.id, { progress: 20 });

      // 2) video to R2
      const { signedGetUrl, objectKey } = await uploadToR2(uf);
      updateFile(uf.id, { progress: 90 });

      // 3) thumbnail to Supabase Storage
      const thumbName = `thumbnails/${user!.id}/${Date.now()}-${uf.id}-thumbnail.jpg`;
      const { error: tErr } = await supabase.storage.from('videos').upload(thumbName, thumbBlob, {
        cacheControl: '3600',
        upsert: false,
      });
      if (tErr) throw new Error(`Thumbnail upload failed: ${tErr.message}`);

      const { data: thumbPub } = supabase.storage.from('videos').getPublicUrl(thumbName);
      const thumbnailUrl = thumbPub?.publicUrl ?? null;

      // 4) save metadata — note: full_video_url may be null if GET presign still propagating
      const { error: dbErr } = await supabase.from('videos').insert({
        title: uf.title.trim(),
        description: uf.description?.trim() || null,
        r2_object_key: objectKey,
        full_video_url: signedGetUrl ?? null,
        thumbnail_url: thumbnailUrl,
        uploader_id: user!.id,
        status: 'pending',
        unlock_cost: 10,
        reward_points: 5,
      });
      if (dbErr) throw new Error(`DB save failed: ${dbErr.message}`);

      updateFile(uf.id, { status: 'completed', progress: 100 });
      return { id: uf.id, ok: true };
    } catch (err: any) {
      updateFile(uf.id, { status: 'error', error: err?.message || 'Upload failed', progress: 0 });
      return { id: uf.id, ok: false };
    }
  };

  const startUpload = async () => {
    const valid = filesSafe.filter(f => f.title.trim() && f.status === 'pending');
    if (!valid.length) {
      toast({
        title: 'Error',
        description: 'Please add files and provide titles for all videos',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);

    const CONCURRENCY = 2;
    const results: Array<PromiseSettledResult<{ id: string; ok: boolean }>> = [];

    for (let i = 0; i < valid.length; i += CONCURRENCY) {
      const slice = valid.slice(i, i + CONCURRENCY);
      const settled = await Promise.allSettled(slice.map(uploadOne));
      results.push(...settled);
    }

    setIsUploading(false);

    let okCount = 0, failCount = 0;
    for (const r of results) {
      if (r.status === 'fulfilled') {
        r.value.ok ? okCount++ : failCount++;
      } else {
        failCount++;
      }
    }

    toast({
      title: 'Upload process complete',
      description: `${okCount} video(s) uploaded successfully${failCount ? `, ${failCount} failed` : ''}`,
    });

    if (okCount > 0) setTimeout(() => navigate('/'), 1500);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <Video className="h-16 w-16 text-primary mx-auto mb-4" />
            <h1 className="text-3xl font-bold mb-2">Upload Videos</h1>
            <p className="text-muted-foreground">Drag and drop multiple videos or click to select files</p>
          </div>

          {/* Drop Zone */}
          <Card className="mb-6">
            <CardContent className="p-6">
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-muted-foreground/50'
                }`}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                <FileVideo className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="mb-4">
                  <UploadIcon className="h-4 w-4 mr-2" />
                  Select Video Files
                </Button>
                <p className="text-sm text-muted-foreground">Drop video files here or click to browse</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Supports MP4, MOV, AVI, MKV • Large files via R2
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Overall Progress */}
          {isUploading && (
            <Card className="mb-6">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Overall Progress</span>
                  <span className="text-sm text-muted-foreground">{totalProgress}%</span>
                </div>
                <Progress value={totalProgress} className="h-2" />
              </CardContent>
            </Card>
          )}

          {/* File List */}
          {counts.total > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Files to Upload ({counts.total})</CardTitle>
                <CardDescription>Edit titles and descriptions for your videos</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filesSafe.map((f) => (
                    <div key={f.id} className="border rounded-lg p-4">
                      <div className="flex items-start gap-4">
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-2">
                            <FileVideo className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium truncate">{f.file.name}</span>
                            <div className="flex items-center gap-1">
                              {f.status === 'completed' && <Check className="h-4 w-4 text-green-500" />}
                              {f.status === 'error' && <AlertCircle className="h-4 w-4 text-red-500" />}
                              {f.status === 'uploading' && (
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent" />
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <Input
                                placeholder="Video title *"
                                value={f.title}
                                onChange={(e) => updateFile(f.id, { title: e.target.value })}
                                disabled={f.status === 'uploading' || f.status === 'completed'}
                              />
                            </div>
                            <div>
                              <Textarea
                                placeholder="Description (optional)"
                                value={f.description}
                                onChange={(e) => updateFile(f.id, { description: e.target.value })}
                                rows={1}
                                className="resize-none"
                                disabled={f.status === 'uploading' || f.status === 'completed'}
                              />
                            </div>
                          </div>

                          {f.status === 'uploading' && (
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span>Uploading...</span>
                                <span>{f.progress}%</span>
                              </div>
                              <Progress value={f.progress} className="h-1" />
                            </div>
                          )}

                          {f.status === 'error' && (
                            <p className="text-sm text-red-500">Error: {f.error}</p>
                          )}

                          {f.status === 'completed' && (
                            <p className="text-sm text-green-600">Upload completed successfully!</p>
                          )}
                        </div>

                        {f.status !== 'uploading' && f.status !== 'completed' && (
                          <Button variant="ghost" size="sm" onClick={() => removeFile(f.id)}>
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          {counts.total > 0 && (
            <div className="flex gap-4">
              <Button
                onClick={startUpload}
                disabled={isUploading || counts.pending === 0}
                className="flex-1"
              >
                {isUploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Uploading {counts.uploading} file(s)...
                  </>
                ) : (
                  <>
                    <UploadIcon className="h-4 w-4 mr-2" />
                    Upload {counts.pending} file(s)
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={() => navigate('/')} disabled={isUploading}>
                {counts.completed > 0 ? 'Continue' : 'Cancel'}
              </Button>
            </div>
          )}

          {/* Help */}
          <Card className="mt-6">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-medium mb-2">Features:</h3>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Drag & drop multiple files</li>
                    <li>• Upload progress tracking</li>
                    <li>• Large file support (multipart)</li>
                    <li>• Automatic thumbnail generation</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-medium mb-2">How it works:</h3>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Videos are reviewed by admins</li>
                    <li>• Earn 5 points per approved video</li>
                    <li>• Users unlock videos for 10 points</li>
                    <li>• Earn additional points from unlocks</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
