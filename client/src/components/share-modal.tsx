import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, Link, X, Trophy, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: any;
}

export default function ShareModal({ isOpen, onClose, data }: ShareModalProps) {
  const { toast } = useToast();

  const generateShareCard = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    canvas.width = 600;
    canvas.height = 400;

    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#3b82f6'); // Primary color
    gradient.addColorStop(1, '#10b981'); // Chart-2 color
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Card content
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    
    // Trophy emoji
    ctx.font = '60px Arial';
    ctx.fillText('🏆', canvas.width / 2, 100);
    
    // Username
    ctx.font = 'bold 32px Arial';
    ctx.fillText(data.username || 'User', canvas.width / 2, 160);
    
    // Skill type
    ctx.font = '20px Arial';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillText(data.skillType || 'Skill', canvas.width / 2, 190);
    
    // Rank
    ctx.font = 'bold 40px Arial';
    ctx.fillStyle = 'white';
    ctx.fillText(`#${data.rank || 1}`, canvas.width / 2, 250);
    
    // Score
    ctx.font = '24px Arial';
    ctx.fillText(`Score: +${data.score || 0}`, canvas.width / 2, 290);
    
    // Hashtag
    ctx.font = '18px Arial';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillText('#MiniSkillArena', canvas.width / 2, 350);

    return canvas;
  };

  const handleDownload = () => {
    const canvas = generateShareCard();
    if (!canvas) {
      toast({
        title: "Download failed",
        description: "Could not generate share card",
        variant: "destructive",
      });
      return;
    }

    const link = document.createElement('a');
    link.download = `miniskillarena-${data.username || 'share'}.png`;
    link.href = canvas.toDataURL();
    link.click();

    toast({
      title: "Share card downloaded!",
      description: "Your achievement card has been saved to your device.",
    });
  };

  const handleCopyLink = () => {
    const url = window.location.origin;
    navigator.clipboard.writeText(url).then(() => {
      toast({
        title: "Link copied!",
        description: "Share link has been copied to your clipboard.",
      });
    }).catch(() => {
      toast({
        title: "Copy failed",
        description: "Could not copy link to clipboard",
        variant: "destructive",
      });
    });
  };

  if (!data) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md" data-testid="modal-share">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Share Your Achievement</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              data-testid="button-close-share"
            >
              <X className="w-4 h-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        {/* Share Card Preview */}
        <div className="bg-gradient-to-br from-primary to-chart-2 p-6 rounded-lg text-white mb-4 text-center">
          <div className="text-4xl mb-2">🏆</div>
          <h4 className="text-xl font-bold" data-testid="text-share-username">
            {data.username}
          </h4>
          <p className="text-primary-foreground/80 text-sm" data-testid="text-share-skill">
            {data.skillType}
          </p>
          <div className="mt-4">
            <div className="text-2xl font-bold" data-testid="text-share-rank">
              #{data.rank}
            </div>
            <div className="text-sm">This Week</div>
            <div className="text-lg font-medium mt-2">
              Score: <span data-testid="text-share-score">+{data.score}</span>
            </div>
          </div>
          <div className="mt-4 text-sm text-primary-foreground/80">
            #MiniSkillArena
          </div>
        </div>

        {/* Share Options */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="flex items-center justify-center space-x-2"
            onClick={handleDownload}
            data-testid="button-download-card"
          >
            <Download className="w-4 h-4" />
            <span>Download</span>
          </Button>
          <Button
            className="flex items-center justify-center space-x-2"
            onClick={handleCopyLink}
            data-testid="button-copy-link"
          >
            <Copy className="w-4 h-4" />
            <span>Copy Link</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
