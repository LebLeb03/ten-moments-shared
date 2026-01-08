import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { X, Download, Leaf, Heart } from "lucide-react";
import QRCode from "qrcode";

interface QRCodeDisplayProps {
  eventCode: string;
  coupleName: string;
  partnerName: string;
  onClose: () => void;
}

const QRCodeDisplay = ({ eventCode, coupleName, partnerName, onClose }: QRCodeDisplayProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const joinUrl = `${window.location.origin}/join?code=${eventCode}`;

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, joinUrl, {
        width: 280,
        margin: 2,
        color: {
          dark: "#4a6741",
          light: "#faf8f5",
        },
      });
    }
  }, [joinUrl]);

  const handleDownload = () => {
    if (!canvasRef.current) return;
    // Sanitize filenames - remove special characters that could cause issues
    const sanitize = (str: string) => str.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '-').substring(0, 50);
    const link = document.createElement("a");
    link.download = `${sanitize(coupleName)}-${sanitize(partnerName)}-qr-code.png`;
    link.href = canvasRef.current.toDataURL();
    link.click();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 animate-scale-in">
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4"
        onClick={onClose}
      >
        <X className="w-6 h-6" />
      </Button>

      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <div className="relative">
            <Leaf className="w-12 h-12 text-primary" />
            <Heart className="w-6 h-6 text-secondary absolute -bottom-1 -right-1" />
          </div>
        </div>
        <h1 className="font-display text-3xl mb-2">
          {coupleName} & {partnerName}
        </h1>
        <p className="text-muted-foreground">Scan to join and share photos</p>
      </div>

      <div className="bg-card rounded-3xl p-8 shadow-lg mb-8">
        <canvas ref={canvasRef} className="rounded-xl" />
      </div>

      <div className="text-center mb-8">
        <p className="text-sm text-muted-foreground mb-1">Or enter code:</p>
        <p className="text-2xl font-mono font-semibold tracking-widest text-primary">
          {eventCode}
        </p>
      </div>

      <Button
        variant="outline"
        onClick={handleDownload}
        className="border-secondary text-secondary hover:bg-secondary/10"
      >
        <Download className="mr-2 h-4 w-4" />
        Download QR Code
      </Button>
    </div>
  );
};

export default QRCodeDisplay;
