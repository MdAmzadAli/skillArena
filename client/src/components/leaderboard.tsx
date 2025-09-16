import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, Calendar, Share2, Medal, Award } from "lucide-react";
import ShareModal from "@/components/share-modal";
import { useState } from "react";

interface LeaderboardEntry {
  username: string;
  userId: string;
  skillCategory: string;
  totalScore: number;
  totalVotes: number;
  rank: number;
}

export default function Leaderboard() {
  const [shareModalOpen, setShareModalOpen] = useState(false);
  
  const { data: leaderboard = [], isLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/leaderboard"],
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const handleShareLeaderboard = () => {
    setShareModalOpen(true);
  };

  const getWeekRange = () => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Monday
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // Sunday
    
    const format = { month: 'short', day: 'numeric' } as const;
    return `${startOfWeek.toLocaleDateString('en-US', format)} - ${endOfWeek.toLocaleDateString('en-US', format)}, ${now.getFullYear()}`;
  };

  const PodiumCard = ({ entry, position }: { entry: LeaderboardEntry; position: 1 | 2 | 3 }) => {
    const icons = { 1: "🏆", 2: "🥈", 3: "🥉" };
    const colors = {
      1: "border-2 border-primary",
      2: "border border-border",
      3: "border border-border"
    };
    const sizes = {
      1: "w-20 h-20 text-3xl",
      2: "w-16 h-16 text-2xl", 
      3: "w-16 h-16 text-2xl"
    };
    
    return (
      <Card className={`leaderboard-card bg-card rounded-lg p-6 text-center relative ${colors[position]} ${position === 2 ? 'mt-8' : ''} ${position === 3 ? 'mt-8' : ''}`}>
        {position === 1 && (
          <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-full">
            👑 CHAMPION
          </div>
        )}
        <div className={`bg-${position === 1 ? 'chart-3' : position === 2 ? 'muted' : 'chart-4'} rounded-full mx-auto mb-4 flex items-center justify-center ${sizes[position]}`}>
          {icons[position]}
        </div>
        <h3 className={`font-bold text-card-foreground ${position === 1 ? 'text-lg' : ''}`} data-testid={`text-podium-username-${position}`}>
          {entry.username}
        </h3>
        <p className="text-muted-foreground text-sm mb-2" data-testid={`text-podium-category-${position}`}>
          {entry.skillCategory}
        </p>
        <div className={`font-bold text-primary mb-2 ${position === 1 ? 'text-3xl' : 'text-2xl'}`} data-testid={`text-podium-score-${position}`}>
          +{entry.totalScore}
        </div>
        <div className="text-xs text-muted-foreground">
          {position === 1 ? '1st' : position === 2 ? '2nd' : '3rd'} Place
        </div>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-muted-foreground">Loading leaderboard...</div>
      </div>
    );
  }

  const top3 = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-foreground mb-2">Weekly Leaderboard</h2>
        <p className="text-muted-foreground">Top performers this week • Resets every Monday</p>
        <div className="flex items-center justify-center space-x-2 mt-4">
          <Calendar className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-card-foreground">
            Week of {getWeekRange()}
          </span>
        </div>
      </div>

      {leaderboard.length === 0 ? (
        <div className="text-center py-12">
          <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No entries this week</h3>
          <p className="text-muted-foreground">
            Be the first to upload a video and claim the top spot!
          </p>
        </div>
      ) : (
        <>
          {/* Top 3 Podium */}
          {top3.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {/* 2nd Place */}
              {top3[1] && <PodiumCard entry={top3[1]} position={2} />}
              
              {/* 1st Place */}
              {top3[0] && <PodiumCard entry={top3[0]} position={1} />}
              
              {/* 3rd Place */}
              {top3[2] && <PodiumCard entry={top3[2]} position={3} />}
            </div>
          )}

          {/* Full Leaderboard */}
          {rest.length > 0 && (
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-card-foreground">
                  Complete Rankings
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {rest.map((entry) => (
                    <div
                      key={entry.userId}
                      className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
                      data-testid={`row-leaderboard-${entry.rank}`}
                    >
                      <div className="flex items-center space-x-4">
                        <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center text-sm font-medium">
                          {entry.rank}
                        </div>
                        <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-sm font-medium">
                          {entry.username.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="font-medium text-card-foreground" data-testid={`text-username-${entry.rank}`}>
                            {entry.username}
                          </h4>
                          <p className="text-sm text-muted-foreground" data-testid={`text-category-${entry.rank}`}>
                            {entry.skillCategory}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-primary" data-testid={`text-score-${entry.rank}`}>
                          +{entry.totalScore}
                        </div>
                        <div className="text-xs text-muted-foreground" data-testid={`text-votes-${entry.rank}`}>
                          {entry.totalVotes} votes
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Share Button */}
          <div className="text-center mt-8">
            <Button
              onClick={handleShareLeaderboard}
              className="bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors"
              data-testid="button-share-leaderboard"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share This Week's Results
            </Button>
          </div>
        </>
      )}

      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        data={{
          type: 'leaderboard',
          weekRange: getWeekRange(),
          topEntries: top3
        }}
      />
    </div>
  );
}
