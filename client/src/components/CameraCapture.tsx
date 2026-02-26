import { useRef, useState, useCallback } from "react";
import Webcam from "react-webcam";
import { Camera, Upload, X, SwitchCamera, CameraOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import SciFiOverlay from "./SciFiOverlay";
import { Language, t } from "@/lib/translations";

interface CameraCaptureProps {
  onCapture: (imageData: string) => void;
  isProcessing: boolean;
  progress: number;
  language: Language;
}

export default function CameraCapture({ onCapture, isProcessing, progress, language }: CameraCaptureProps) {
  const webcamRef = useRef<Webcam>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoConstraints = {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    facingMode,
  };

  const compressImage = async (imageData: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxWidth = 800;
        const maxHeight = 800;
        let { width, height } = img;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.src = imageData;
    });
  };

  const handleCapture = useCallback(async () => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      const compressed = await compressImage(imageSrc);
      setPreviewImage(compressed);
      setShowCamera(false);
      onCapture(compressed);
    }
  }, [webcamRef, onCapture]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const imageData = reader.result as string;
      const compressed = await compressImage(imageData);
      setPreviewImage(compressed);
      onCapture(compressed);
    };
    reader.readAsDataURL(file);
  };

  const handleCameraClick = () => {
    setCameraError(null);
    setShowCamera(true);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleClearPreview = () => {
    setPreviewImage(null);
    setShowCamera(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSwitchCamera = () => {
    setFacingMode(prev => prev === "user" ? "environment" : "user");
  };

  const handleCameraError = () => {
    setCameraError(t("cameraAccessDenied", language));
  };

  if (previewImage) {
    const overlayMode = isProcessing ? 'scanning' : 'idle';
    
    return (
      <Card className="overflow-hidden shadow-2xl border-0 rounded-3xl transition-smooth">
        <div className="relative">
          <img 
            src={previewImage} 
            alt={t("capturedItem", language)} 
            className="w-full h-80 object-cover"
          />
          
          <SciFiOverlay mode={overlayMode} progress={progress} />
          
          {!isProcessing && (
            <Button
              variant="secondary"
              size="icon"
              className="absolute top-4 right-4 rounded-full shadow-lg hover:shadow-xl transition-smooth z-10 pointer-events-auto"
              onClick={handleClearPreview}
              data-testid="button-clear-photo"
            >
              <X className="h-5 w-5" />
            </Button>
          )}
          {isProcessing && (
            <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
              <div className="text-center bg-background/80 dark:bg-background/70 backdrop-blur-md px-8 py-6 rounded-2xl shadow-2xl">
                <p className="text-2xl font-bold text-foreground mb-2" aria-live="polite">
                  {Math.round(progress)}%
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("analyzing", language)}
                </p>
              </div>
            </div>
          )}
        </div>
      </Card>
    );
  }

  if (showCamera) {
    return (
      <Card className="overflow-hidden shadow-2xl border-0 rounded-3xl">
        <div className="relative">
          {cameraError ? (
            <div className="h-80 flex flex-col items-center justify-center bg-gradient-to-br from-muted/50 to-muted p-6 text-center">
              <CameraOff className="h-16 w-16 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-6 max-w-xs">{cameraError}</p>
              <Button onClick={() => setShowCamera(false)} className="rounded-full shadow-lg" data-testid="button-close-camera">
                {t("goBack", language)}
              </Button>
            </div>
          ) : (
            <>
              <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/jpeg"
                videoConstraints={videoConstraints}
                className="w-full h-80 object-cover"
                onUserMediaError={handleCameraError}
                data-testid="webcam-view"
              />
              
              <SciFiOverlay mode="idle" progress={0} />
              
              <div className="absolute bottom-6 left-0 right-0 flex justify-center items-center gap-4 z-10">
                <Button
                  size="icon"
                  variant="secondary"
                  onClick={handleSwitchCamera}
                  className="rounded-full p-4 shadow-xl hover:shadow-2xl transition-smooth"
                  data-testid="button-switch-camera"
                >
                  <SwitchCamera className="h-6 w-6" />
                </Button>
                <Button
                  size="lg"
                  onClick={handleCapture}
                  className="relative rounded-full p-8 shadow-2xl hover:shadow-2xl transition-smooth gradient-primary ring-4 ring-primary/30 hover:ring-primary/50 active:scale-95"
                  data-testid="button-capture"
                >
                  <Camera className="h-8 w-8" />
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-primary/20 to-secondary/20 animate-pulse-ring" />
                </Button>
                <Button
                  size="icon"
                  variant="secondary"
                  onClick={() => setShowCamera(false)}
                  className="rounded-full p-4 shadow-xl hover:shadow-2xl transition-smooth"
                  data-testid="button-close-camera"
                >
                  <X className="h-6 w-6" />
                </Button>
              </div>
            </>
          )}
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        data-testid="input-upload"
      />

      <Button
        onClick={handleCameraClick}
        size="lg"
        className="w-full text-xl gap-4 rounded-3xl shadow-xl hover:shadow-2xl transition-smooth gradient-primary min-h-32"
        data-testid="button-camera"
      >
        <Camera className="h-10 w-10" />
        <div className="flex flex-col items-start">
          <span className="font-bold">{t("takePhoto", language)}</span>
          <span className="text-sm font-normal opacity-90">{t("openCamera", language)}</span>
        </div>
      </Button>

      <Button
        onClick={handleUploadClick}
        variant="outline"
        size="lg"
        className="w-full text-lg gap-3 rounded-2xl shadow-md hover:shadow-lg transition-smooth"
        data-testid="button-upload"
      >
        <Upload className="h-7 w-7" />
        {t("uploadPhoto", language)}
      </Button>
    </div>
  );
}
