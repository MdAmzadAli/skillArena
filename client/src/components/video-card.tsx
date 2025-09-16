import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ThumbsUp, ThumbsDown, Zap, Share2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface VideoCardProps {
  video: {
    id: string;
    username: string;
    filename: string;
    originalName: string;
    skillCategory: string;
    description?: string;
    duration: number;
    likes: number;
    dislikes: number;
    wows: number;
    score: number;
    createdAt: string;
  };
  currentUserId?: string;
  onShare: () => void;
}

export default function VideoCard({ video, currentUserId, onShare }: VideoCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: userVoteData } = useQuery<{vote?: {voteType: string}}>({
    queryKey: ["/api/videos", video.id, "vote"],
    enabled: !!currentUserId,
  });

  const userVote = userVoteData?.vote?.voteType;

  const voteMutation = useMutation({
    mutationFn: async (voteType: "like" | "dislike" | "wow") => {
      const res = await apiRequest("POST", `/api/videos/${video.id}/vote`, { voteType });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/videos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/videos", video.id, "vote"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Vote failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleVote = (voteType: "like" | "dislike" | "wow") => {
    voteMutation.mutate(voteType);
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return "Just now";
    if (diffInHours === 1) return "1 hour ago";
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    if (diffInHours < 48) return "1 day ago";
    return `${Math.floor(diffInHours / 24)} days ago`;
  };

  const VoteButton = ({ 
    type, 
    icon: Icon, 
    count, 
    color 
  }: { 
    type: "like" | "dislike" | "wow"; 
    icon: any; 
    count: number; 
    color: string;
  }) => {
    const isActive = userVote === type;
    
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleVote(type)}
        disabled={voteMutation.isPending}
        className={`vote-button flex items-center space-x-2 px-3 py-2 rounded-lg transition-all hover:scale-110 ${
          isActive 
            ? `bg-${color} text-white scale-110` 
            : `bg-${color}/10 text-${color} hover:bg-${color}/20`
        }`}
        data-testid={`button-vote-${type}-${video.id}`}
      >
        <Icon className="w-4 h-4" />
        <span className="font-medium">{count}</span>
      </Button>
    );
  };

  return (
    <Card className="video-card bg-card rounded-lg border border-border hover:shadow-lg transition-all duration-200 hover:-translate-y-1">
      <CardContent className="p-4">
        {/* User Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-sm font-medium">
              {video.username.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h3 className="font-medium text-card-foreground" data-testid={`text-username-${video.id}`}>
                {video.username}
              </h3>
              <p className="text-xs text-muted-foreground" data-testid={`text-time-${video.id}`}>
                {formatTimeAgo(video.createdAt)}
              </p>
            </div>
          </div>
          <div className="text-xs font-mono bg-muted text-muted-foreground px-2 py-1 rounded-md">
            {(video.duration / 1000).toFixed(1)}s
          </div>
        </div>

        {/* Video Container */}
        <div className="relative bg-black rounded-lg overflow-hidden mb-4">
          <video 
            className="w-full aspect-video object-cover" 
            controls 
            muted 
            loop
            preload="metadata"
            data-testid={`video-player-${video.id}`}
          >
            <source src={`/uploads/${video.filename}`} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
          <div className="absolute top-3 left-3 bg-black/70 text-white px-2 py-1 rounded-md text-xs font-medium">
            {video.skillCategory}
          </div>
        </div>

        {video.description && (
          <p className="text-sm text-muted-foreground mb-4" data-testid={`text-description-${video.id}`}>
            {video.description}
          </p>
        )}

        {/* Voting System */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <VoteButton
              type="like"
              icon={ThumbsUp}
              count={video.likes}
              color="chart-1"
            />
            <VoteButton
              type="dislike"
              icon={ThumbsDown}
              count={video.dislikes}
              color="destructive"
            />
            <VoteButton
              type="wow"
              icon={Zap}
              count={video.wows}
              color="chart-3"
            />
          </div>
          <div className="flex items-center space-x-2">
            <div className="text-sm font-medium bg-primary/10 text-primary px-3 py-2 rounded-lg">
              Score: <span className="font-mono" data-testid={`text-score-${video.id}`}>
                {video.score > 0 ? '+' : ''}{video.score}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onShare}
              className="p-2 text-muted-foreground hover:text-foreground"
              data-testid={`button-share-${video.id}`}
            >
              <Share2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
