import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Trophy, Bell, Home, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import VideoCard from "@/components/video-card";
import UploadForm from "@/components/upload-form";
import Leaderboard from "@/components/leaderboard";
import ShareModal from "@/components/share-modal";
import { useQuery } from "@tanstack/react-query";

type TabType = "feed" | "upload" | "leaderboard";

export default function HomePage() {
  const { user, logoutMutation } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>("feed");
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareData, setShareData] = useState<any>(null);

  const { data: videos = [], isLoading: videosLoading } = useQuery<any[]>({
    queryKey: ["/api/videos"],
    refetchInterval: 5000, // Refetch every 5 seconds for real-time updates
  });

  const handleShare = (video: any) => {
    setShareData({
      username: video.username,
      skillType: video.skillCategory,
      score: video.score,
      rank: 1, // This would be calculated based on position in leaderboard
    });
    setShareModalOpen(true);
  };

  const TabButton = ({ 
    tab, 
    icon: Icon, 
    label 
  }: { 
    tab: TabType; 
    icon: any; 
    label: string 
  }) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors flex items-center space-x-2 ${
        activeTab === tab
          ? "border-primary text-primary"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
      data-testid={`tab-${tab}`}
    >
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Trophy className="text-primary text-2xl" />
              <h1 className="text-xl font-bold text-foreground">MiniSkillArena</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground"
                data-testid="button-notifications"
              >
                <Bell className="w-5 h-5" />
              </Button>
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-sm font-medium">
                {user?.username.slice(0, 2).toUpperCase()}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => logoutMutation.mutate()}
                data-testid="button-logout"
              >
                Logout
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Tab Navigation */}
      <div className="sticky top-16 z-40 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            <TabButton tab="feed" icon={Home} label="Feed" />
            <TabButton tab="upload" icon={Plus} label="Upload" />
            <TabButton tab="leaderboard" icon={Trophy} label="Leaderboard" />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="pt-32 min-h-screen">
        {activeTab === "feed" && (
          <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
            {videosLoading ? (
              <div className="flex justify-center items-center py-12">
                <div className="text-muted-foreground">Loading videos...</div>
              </div>
            ) : videos.length === 0 ? (
              <div className="text-center py-12">
                <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No videos yet</h3>
                <p className="text-muted-foreground mb-4">
                  Be the first to share your skills with the community!
                </p>
                <Button onClick={() => setActiveTab("upload")} data-testid="button-upload-first">
                  Upload Your First Video
                </Button>
              </div>
            ) : (
              videos.map((video: any) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  currentUserId={user?.id}
                  onShare={() => handleShare(video)}
                />
              ))
            )}
          </div>
        )}

        {activeTab === "upload" && <UploadForm />}

        {activeTab === "leaderboard" && <Leaderboard />}
      </main>

      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        data={shareData}
      />
    </div>
  );
}
