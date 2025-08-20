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

  const uploadFile = async (uploadFile: UploadFile) => {
    try {
      updateFile(uploadFile.id, { status: 'uploading', progress: 0 });

      // Generate thumbnail
      updateFile(uploadFile.id, { progress: 10 });
      const thumbnailBlob = await generateVideoThumbnail(uploadFile.file);
      
      // Upload video with progress
      updateFile(uploadFile.id, { progress: 20 });
      const fileExt = uploadFile.file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}-${uploadFile.id}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(fileName, uploadFile.file);

      if (uploadError) throw uploadError;

      // Simulate progress for user feedback
      updateFile(uploadFile.id, { progress: 80 });

      // Upload thumbnail
      updateFile(uploadFile.id, { progress: 85 });
      const thumbnailFileName = `thumbnails/${user.id}/${Date.now()}-${uploadFile.id}-thumbnail.jpg`;
      const { error: thumbnailUploadError } = await supabase.storage
        .from('videos')
        .upload(thumbnailFileName, thumbnailBlob);

      if (thumbnailUploadError) throw thumbnailUploadError;

      // Get public URLs
      const { data: { publicUrl: videoUrl } } = supabase.storage
        .from('videos')
        .getPublicUrl(fileName);

      const { data: { publicUrl: thumbnailUrl } } = supabase.storage
        .from('videos')
        .getPublicUrl(thumbnailFileName);

      // Insert video record
      updateFile(uploadFile.id, { progress: 95 });
      const { error } = await supabase
        .from('videos')
        .insert({
          uploader_id: user.id,
          title: uploadFile.title,
          description: uploadFile.description,
          full_video_url: videoUrl,
          thumbnail_url: thumbnailUrl,
          unlock_cost: 10,
          reward_points: 5,
          status: 'pending'
        });

      if (error) throw error;

      updateFile(uploadFile.id, { status: 'completed', progress: 100 });
    } catch (error: any) {
      updateFile(uploadFile.id, { 
        status: 'error', 
        error: error.message || 'Upload failed',
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
    const concurrencyLimit = 3;
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

    if (completed > 0) {
      toast({
        title: "Upload Complete!",
        description: `${completed} video(s) uploaded successfully${failed > 0 ? `, ${failed} failed` : ''}`,
      });
    }

    // Auto-navigate if all uploads completed successfully
    if (failed === 0 && completed > 0) {
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
                disabled={isUploading || uploadFiles.every(f => f.status === 'completed')}
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
                {uploadFiles.some(f => f.status === 'completed') ? 'Done' : 'Cancel'}
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