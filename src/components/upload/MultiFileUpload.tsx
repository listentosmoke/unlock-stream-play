import { useState, useCallback, useRef } from 'react';
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
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
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
  if (!user) {
    navigate('/auth');
    return null;
  }

  const generateFileId = () => Math.random().toString(36).substr(2, 9);

  const addFiles = useCallback((files: FileList) => {
    const newFiles: UploadFile[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('video/')) {
        const fileName = file.name.replace(/\.[^/.]+$/, ""); // Remove extension for title
        newFiles.push({
          id: generateFileId(),
          file,
          title: fileName,
          description: '',
          progress: 0,
          status: 'pending'
        });
      }
    }

    if (newFiles.length === 0) {
      toast({
        title: "Error",
        description: "Please select valid video files",
        variant: "destructive",
      });
      return;
    }

    setUploadFiles(prev => [...prev, ...newFiles]);
  }, [toast]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (!isDragging) {
      setIsDragging(true);
    }
  }, [isDragging]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      addFiles(files);
    }
  }, [addFiles]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      addFiles(files);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (id: string) => {
    setUploadFiles(prev => prev.filter(f => f.id !== id));
  };

  const updateFile = (id: string, updates: Partial<UploadFile>) => {
    setUploadFiles(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const checkBucketSize = async (): Promise<number> => {
    try {
      // Get all files recursively from the bucket
      const getAllFiles = async (folder = '', allFiles: any[] = []): Promise<any[]> => {
        const { data, error } = await supabase.storage
          .from('videos')
          .list(folder, { limit: 1000 });
        
        if (error) throw error;
        
        for (const file of data || []) {
          if (file.name && file.metadata?.size) {
            // Only count files that have metadata with size
            const fullPath = folder ? `${folder}/${file.name}` : file.name;
            allFiles.push({ ...file, path: fullPath });
          }
        }
        
        return allFiles;
      };

      const files = await getAllFiles();
      
      // Calculate total size from all files
      let totalSize = 0;
      for (const file of files) {
        if (file.metadata?.size) {
          totalSize += file.metadata.size;
        }
      }
      
      console.log(`Current bucket size: ${totalSize} bytes (${(totalSize / 1024 / 1024).toFixed(2)} MB)`);
      return totalSize;
    } catch (error) {
      console.error('Error checking bucket size:', error);
      return 0;
    }
  };

  // Upload large file to Catbox via edge function with XHR progress
  const uploadLargeViaEdge = (file: File, onProgress?: (progress: number) => void): Promise<string> => {
    return new Promise((resolve, reject) => {
      // Use the hardcoded Supabase URL to construct functions URL
      const endpoint = 'https://yuqujmglvhnkgqflnlys.functions.supabase.co/catbox-upload';

      const formData = new FormData();
      formData.append('file', file, file.name);

      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (evt) => {
        if (evt.lengthComputable && onProgress) {
          onProgress((evt.loaded / evt.total) * 100);
        }
      });

      xhr.addEventListener('load', () => {
        try {
          const status = xhr.status;
          const text = xhr.responseText || '';
          let json: any = {};
          
          try {
            json = JSON.parse(text);
          } catch {
            return reject(new Error(`Bad JSON from catbox-upload: ${text.slice(0, 120)}`));
          }
          
          if (status >= 200 && status < 300 && json?.url) {
            resolve(json.url as string);
          } else {
            reject(new Error(json?.error || `catbox-upload failed (${status})`));
          }
        } catch (e: any) {
          reject(new Error(e?.message || 'Upload failed'));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Network error to catbox-upload'));
      });

      xhr.open('POST', endpoint);
      xhr.send(formData);
    });
  };

  const uploadFile = async (uploadFile: UploadFile) => {
    try {
      updateFile(uploadFile.id, { status: 'uploading', progress: 0 });

      // Generate thumbnail first
      updateFile(uploadFile.id, { progress: 10 });
      const thumbnailBlob = await generateVideoThumbnail(uploadFile.file);
      
      updateFile(uploadFile.id, { progress: 20 });

      // Check file size and bucket size
      const maxSupabaseSize = 100 * 1024 * 1024; // 100MB
      const maxBucketSize = 45 * 1024 * 1024; // 45MB
      const isLargeFile = uploadFile.file.size > maxSupabaseSize;
      
      // Check current bucket size
      const currentBucketSize = await checkBucketSize();
      const wouldExceedBucket = (currentBucketSize + uploadFile.file.size) > maxBucketSize;
      
      let videoUrl: string;
      
      if (isLargeFile || wouldExceedBucket) {
        // Upload to Catbox via edge function with accurate progress
        console.log('Uploading to Catbox via edge function...', { 
          fileSize: uploadFile.file.size, 
          currentBucketSize, 
          wouldExceed: wouldExceedBucket 
        });
        
        videoUrl = await uploadLargeViaEdge(uploadFile.file, (progress) => {
          // Map 0–100 upload progress into 20–90 UI progress
          const mapped = 20 + (progress * 0.7);
          updateFile(uploadFile.id, { progress: Math.min(90, Math.round(mapped)) });
        });
        
        // Small smoothing bump to show "processing"
        updateFile(uploadFile.id, { progress: 95 });
        console.log('File uploaded to Catbox:', videoUrl);
        
      } else {
        // Upload smaller files to Supabase as before
        const fileExt = uploadFile.file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}-${uploadFile.id}.${fileExt}`;
        
        // Upload to Supabase with progress tracking
        const { error: uploadError } = await supabase.storage
          .from('videos')
          .upload(fileName, uploadFile.file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          throw new Error(uploadError.message || 'Failed to upload video');
        }

        updateFile(uploadFile.id, { progress: 80 });
        
        // Get public URL from Supabase
        const { data: { publicUrl } } = supabase.storage
          .from('videos')
          .getPublicUrl(fileName);
        
        videoUrl = publicUrl;
      }

      updateFile(uploadFile.id, { progress: 85 });

      // Upload thumbnail to Supabase (always use Supabase for thumbnails)
      const thumbnailFileName = `thumbnails/${user.id}/${Date.now()}-${uploadFile.id}-thumbnail.jpg`;
      const { error: thumbnailUploadError } = await supabase.storage
        .from('videos')
        .upload(thumbnailFileName, thumbnailBlob, {
          cacheControl: '3600',
          upsert: false
        });

      if (thumbnailUploadError) {
        console.error('Thumbnail upload error:', thumbnailUploadError);
        throw new Error('Failed to upload thumbnail');
      }

      // Get thumbnail URL
      const { data: { publicUrl: thumbnailUrl } } = supabase.storage
        .from('videos')
        .getPublicUrl(thumbnailFileName);

      updateFile(uploadFile.id, { progress: 95 });

      // Insert video record with proper error handling
      const videoData = {
        uploader_id: user.id,
        title: uploadFile.title.trim(),
        description: uploadFile.description?.trim() || null,
        full_video_url: videoUrl,
        thumbnail_url: thumbnailUrl,
        unlock_cost: 10,
        reward_points: 5,
        status: 'pending' as const
      };

      const { error: insertError } = await supabase
        .from('videos')
        .insert(videoData);

      if (insertError) {
        console.error('Database insert error:', insertError);
        throw new Error('Failed to save video information');
      }

      updateFile(uploadFile.id, { status: 'completed', progress: 100 });
      
    } catch (error: any) {
      console.error('Upload file error:', error);
      updateFile(uploadFile.id, { 
        status: 'error', 
        error: error?.message || 'Upload failed',
        progress: 0 
      });
    }
  };

  const startUpload = async () => {
    const validFiles = uploadFiles.filter(f => f.title.trim() && f.status === 'pending');
    
    if (validFiles.length === 0) {
      toast({
        title: "Error",
        description: "Please add files and provide titles for all videos",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    // Upload files in parallel with concurrency limit
    const concurrencyLimit = 2; // Reduced for large files
    const batches = [];
    
    for (let i = 0; i < validFiles.length; i += concurrencyLimit) {
      batches.push(validFiles.slice(i, i + concurrencyLimit));
    }

    for (const batch of batches) {
      await Promise.allSettled(batch.map(uploadFile));
    }

    setIsUploading(false);

    const completed = uploadFiles.filter(f => f.status === 'completed').length;
    const failed = uploadFiles.filter(f => f.status === 'error').length;

    if (completed > 0 || failed > 0) {
      toast({
        title: "Upload Process Complete!",
        description: `${completed} video(s) uploaded successfully${failed > 0 ? `, ${failed} had errors` : ''}`,
      });
    }

    // Always allow navigation after uploads complete (even if some failed)
    if (completed > 0) {
      setTimeout(() => navigate('/'), 2000);
    }
  };

  const totalProgress = uploadFiles.length > 0 
    ? Math.round(uploadFiles.reduce((sum, f) => sum + f.progress, 0) / uploadFiles.length)
    : 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <Video className="h-16 w-16 text-primary mx-auto mb-4" />
            <h1 className="text-3xl font-bold mb-2">Upload Videos</h1>
            <p className="text-muted-foreground">
              Drag and drop multiple videos or click to select files
            </p>
          </div>

          {/* Drop Zone */}
          <Card className="mb-6">
            <CardContent className="p-6">
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  isDragging 
                    ? 'border-primary bg-primary/5' 
                    : 'border-muted-foreground/25 hover:border-muted-foreground/50'
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
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="mb-4"
                >
                  <UploadIcon className="h-4 w-4 mr-2" />
                  Select Video Files
                </Button>
                <p className="text-sm text-muted-foreground">
                  Drop video files here or click to browse
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Supports MP4, MOV, AVI, MKV • Large files supported
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Upload Progress */}
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
          {uploadFiles.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Files to Upload ({uploadFiles.length})</CardTitle>
                <CardDescription>
                  Edit titles and descriptions for your videos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {uploadFiles.map((uploadFile) => (
                    <div key={uploadFile.id} className="border rounded-lg p-4">
                      <div className="flex items-start gap-4">
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-2">
                            <FileVideo className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium truncate">
                              {uploadFile.file.name}
                            </span>
                            <div className="flex items-center gap-1">
                              {uploadFile.status === 'completed' && (
                                <Check className="h-4 w-4 text-green-500" />
                              )}
                              {uploadFile.status === 'error' && (
                                <AlertCircle className="h-4 w-4 text-red-500" />
                              )}
                              {uploadFile.status === 'uploading' && (
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent" />
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <Input
                                placeholder="Video title *"
                                value={uploadFile.title}
                                onChange={(e) => updateFile(uploadFile.id, { title: e.target.value })}
                                disabled={uploadFile.status === 'uploading' || uploadFile.status === 'completed'}
                              />
                            </div>
                            <div>
                              <Textarea
                                placeholder="Description (optional)"
                                value={uploadFile.description}
                                onChange={(e) => updateFile(uploadFile.id, { description: e.target.value })}
                                rows={1}
                                className="resize-none"
                                disabled={uploadFile.status === 'uploading' || uploadFile.status === 'completed'}
                              />
                            </div>
                          </div>

                          {uploadFile.status === 'uploading' && (
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span>Uploading...</span>
                                <span>{uploadFile.progress}%</span>
                              </div>
                              <Progress value={uploadFile.progress} className="h-1" />
                            </div>
                          )}

                          {uploadFile.status === 'error' && (
                            <p className="text-sm text-red-500">
                              Error: {uploadFile.error}
                            </p>
                          )}

                          {uploadFile.status === 'completed' && (
                            <p className="text-sm text-green-600">
                              Upload completed successfully!
                            </p>
                          )}
                        </div>

                        {uploadFile.status !== 'uploading' && uploadFile.status !== 'completed' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile(uploadFile.id)}
                          >
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

          {/* Action Buttons */}
          {uploadFiles.length > 0 && (
            <div className="flex gap-4">
                <Button 
                onClick={startUpload}
                disabled={isUploading || uploadFiles.filter(f => f.status === 'pending').length === 0}
                className="flex-1"
              >
                {isUploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Uploading {uploadFiles.filter(f => f.status === 'uploading').length} file(s)...
                  </>
                ) : (
                  <>
                    <UploadIcon className="h-4 w-4 mr-2" />
                    Upload {uploadFiles.filter(f => f.status === 'pending').length} file(s)
                  </>
                )}
              </Button>
              <Button 
                variant="outline"
                onClick={() => navigate('/')}
                disabled={isUploading}
              >
                {uploadFiles.some(f => f.status === 'completed') ? 'Continue' : 'Cancel'}
              </Button>
            </div>
          )}

          {/* Instructions */}
          <Card className="mt-6">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-medium mb-2">Features:</h3>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Drag & drop multiple files</li>
                    <li>• Upload progress tracking</li>
                    <li>• Background upload support</li>
                    <li>• Large file support</li>
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