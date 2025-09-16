import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { CloudUpload, Video, X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertVideoSchema } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

interface UploadFormData {
  skillCategory: string;
  description?: string;
  acceptTerms: boolean;
}

export default function UploadForm() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<UploadFormData>({
    defaultValues: {
      skillCategory: "",
      description: "",
      acceptTerms: false,
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100);
            setUploadProgress(progress);
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            reject(new Error(xhr.responseText || "Upload failed"));
          }
        });

        xhr.addEventListener("error", () => {
          reject(new Error("Network error"));
        });

        xhr.open("POST", "/api/videos");
        xhr.send(formData);
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
      toast({
        title: "Video uploaded successfully!",
        description: "Your skill is now live in the feed.",
      });
      handleReset();
    },
    onError: (error: Error) => {
      setUploadProgress(0);
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ["video/mp4", "video/quicktime", "video/x-msvideo"];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please select an MP4, MOV, or AVI file.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (50MB)
    if (file.size > 50 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select a file smaller than 50MB.",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleVideoLoaded = () => {
    if (videoRef.current) {
      const duration = videoRef.current.duration * 1000; // Convert to milliseconds
      setVideoDuration(duration);
      
      if (duration > 5000) {
        toast({
          title: "Video too long",
          description: "Videos must be 5 seconds or less.",
          variant: "destructive",
        });
        handleReset();
      }
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPreviewUrl("");
    setVideoDuration(0);
    setUploadProgress(0);
    form.reset();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = (data: UploadFormData) => {
    if (!selectedFile || !data.acceptTerms) return;

    const formData = new FormData();
    formData.append("video", selectedFile);
    formData.append("skillCategory", data.skillCategory);
    formData.append("description", data.description || "");
    formData.append("duration", videoDuration.toString());

    uploadMutation.mutate(formData);
  };

  const canSubmit = selectedFile && videoDuration > 0 && videoDuration <= 5000 && form.watch("acceptTerms") && form.watch("skillCategory");

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Card>
        <CardHeader className="text-center">
          <CloudUpload className="w-12 h-12 text-primary mx-auto mb-4" />
          <CardTitle className="text-2xl">Upload Your Skill</CardTitle>
          <CardDescription>
            Share a 5-second micro-skill video with the community
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Upload Dropzone */}
          <div 
            className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
            onClick={() => fileInputRef.current?.click()}
            data-testid="dropzone-upload"
          >
            <Video className="w-8 h-8 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium text-card-foreground mb-2">
              Drop your video here or <span className="text-primary">browse</span>
            </p>
            <p className="text-sm text-muted-foreground">MP4, MOV up to 5 seconds</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".mp4,.mov,.avi,video/*"
              onChange={handleFileSelect}
              className="hidden"
              data-testid="input-video-file"
            />
          </div>

          {/* Upload Progress */}
          {uploadMutation.isPending && (
            <div className="space-y-2">
              <Progress value={uploadProgress} className="h-2" />
              <p className="text-sm text-muted-foreground text-center">
                Uploading... {uploadProgress}%
              </p>
            </div>
          )}

          {/* Video Preview */}
          {previewUrl && (
            <div className="space-y-4">
              <div className="bg-black rounded-lg overflow-hidden relative">
                <video
                  ref={videoRef}
                  className="w-full aspect-video object-cover"
                  controls
                  onLoadedMetadata={handleVideoLoaded}
                  data-testid="video-preview"
                >
                  <source src={previewUrl} />
                </video>
                <Button
                  variant="secondary"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={handleReset}
                  data-testid="button-remove-video"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Duration: <span className="font-mono">{(videoDuration / 1000).toFixed(1)}s</span></span>
                <span>Size: <span className="font-mono">{(selectedFile!.size / (1024 * 1024)).toFixed(1)}MB</span></span>
              </div>
            </div>
          )}

          {/* Upload Form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="skillCategory"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Skill Category</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-skill-category">
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pen-spinning">Pen Spinning</SelectItem>
                        <SelectItem value="bottle-flip">Bottle Flip</SelectItem>
                        <SelectItem value="coin-tricks">Coin Tricks</SelectItem>
                        <SelectItem value="card-tricks">Card Tricks</SelectItem>
                        <SelectItem value="skateboard">Skateboard Tricks</SelectItem>
                        <SelectItem value="juggling">Juggling</SelectItem>
                        <SelectItem value="yo-yo">Yo-yo Tricks</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe your skill..."
                        rows={3}
                        {...field}
                        data-testid="textarea-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="acceptTerms"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-terms"
                      />
                    </FormControl>
                    <FormLabel className="text-sm text-muted-foreground">
                      I agree to the community guidelines and terms of service
                    </FormLabel>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full"
                disabled={!canSubmit || uploadMutation.isPending}
                data-testid="button-upload-submit"
              >
                <CloudUpload className="w-4 h-4 mr-2" />
                {uploadMutation.isPending ? "Uploading..." : "Upload Video"}
              </Button>
            </form>
          </Form>

          {/* Upload Requirements */}
          <Card className="bg-muted">
            <CardContent className="pt-4">
              <h3 className="text-sm font-medium text-card-foreground mb-2">Upload Requirements</h3>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Video must be exactly 5 seconds or less</li>
                <li>• Supported formats: MP4, MOV, AVI</li>
                <li>• Maximum file size: 50MB</li>
                <li>• Content must be appropriate for all ages</li>
              </ul>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}
