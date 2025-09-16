import { type User, type InsertUser, type Video, type InsertVideo, type Vote, type InsertVote } from "@shared/schema";
import { randomUUID } from "crypto";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  createVideo(video: InsertVideo & { userId: string; filename: string }): Promise<Video>;
  getVideos(): Promise<(Video & { username: string; likes: number; dislikes: number; wows: number; score: number })[]>;
  getVideo(id: string): Promise<Video | undefined>;
  getVideosByUser(userId: string): Promise<Video[]>;
  
  createVote(vote: InsertVote): Promise<Vote>;
  getUserVote(userId: string, videoId: string): Promise<Vote | undefined>;
  updateVote(userId: string, videoId: string, voteType: "like" | "dislike" | "wow"): Promise<Vote>;
  deleteVote(userId: string, videoId: string): Promise<void>;
  getVideoVotes(videoId: string): Promise<{ likes: number; dislikes: number; wows: number }>;
  
  getWeeklyLeaderboard(): Promise<Array<{
    username: string;
    userId: string;
    skillCategory: string;
    totalScore: number;
    totalVotes: number;
    rank: number;
  }>>;
  
  sessionStore: session.Store;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private videos: Map<string, Video>;
  private votes: Map<string, Vote>;
  public sessionStore: session.Store;

  constructor() {
    this.users = new Map();
    this.videos = new Map();
    this.votes = new Map();
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      ...insertUser, 
      id, 
      createdAt: new Date() 
    };
    this.users.set(id, user);
    return user;
  }

  async createVideo(videoData: InsertVideo & { userId: string; filename: string }): Promise<Video> {
    const id = randomUUID();
    const video: Video = {
      ...videoData,
      id,
      description: videoData.description || null,
      createdAt: new Date()
    };
    this.videos.set(id, video);
    return video;
  }

  async getVideos(): Promise<(Video & { username: string; likes: number; dislikes: number; wows: number; score: number })[]> {
    const videos = Array.from(this.videos.values());
    const result = [];
    
    for (const video of videos) {
      const user = await this.getUser(video.userId);
      const votes = await this.getVideoVotes(video.id);
      const score = votes.likes + votes.wows - votes.dislikes;
      
      result.push({
        ...video,
        username: user?.username || 'Unknown',
        ...votes,
        score
      });
    }
    
    // Sort by creation date (newest first)
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getVideo(id: string): Promise<Video | undefined> {
    return this.videos.get(id);
  }

  async getVideosByUser(userId: string): Promise<Video[]> {
    return Array.from(this.videos.values()).filter(video => video.userId === userId);
  }

  async createVote(vote: InsertVote): Promise<Vote> {
    const id = randomUUID();
    const newVote: Vote = {
      ...vote,
      id,
      createdAt: new Date()
    };
    
    // Remove any existing vote from this user for this video
    await this.deleteVote(vote.userId, vote.videoId);
    
    this.votes.set(id, newVote);
    return newVote;
  }

  async getUserVote(userId: string, videoId: string): Promise<Vote | undefined> {
    return Array.from(this.votes.values()).find(
      vote => vote.userId === userId && vote.videoId === videoId
    );
  }

  async updateVote(userId: string, videoId: string, voteType: "like" | "dislike" | "wow"): Promise<Vote> {
    await this.deleteVote(userId, videoId);
    return this.createVote({ userId, videoId, voteType });
  }

  async deleteVote(userId: string, videoId: string): Promise<void> {
    const existingVote = Array.from(this.votes.entries()).find(
      ([_, vote]) => vote.userId === userId && vote.videoId === videoId
    );
    
    if (existingVote) {
      this.votes.delete(existingVote[0]);
    }
  }

  async getVideoVotes(videoId: string): Promise<{ likes: number; dislikes: number; wows: number }> {
    const videoVotes = Array.from(this.votes.values()).filter(vote => vote.videoId === videoId);
    
    return {
      likes: videoVotes.filter(vote => vote.voteType === 'like').length,
      dislikes: videoVotes.filter(vote => vote.voteType === 'dislike').length,
      wows: videoVotes.filter(vote => vote.voteType === 'wow').length,
    };
  }

  async getWeeklyLeaderboard(): Promise<Array<{
    username: string;
    userId: string;
    skillCategory: string;
    totalScore: number;
    totalVotes: number;
    rank: number;
  }>> {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Monday
    startOfWeek.setHours(0, 0, 0, 0);

    // Get videos from this week
    const weeklyVideos = Array.from(this.videos.values()).filter(
      video => new Date(video.createdAt) >= startOfWeek
    );

    const userScores = new Map<string, {
      username: string;
      userId: string;
      skillCategory: string;
      totalScore: number;
      totalVotes: number;
    }>();

    for (const video of weeklyVideos) {
      const user = await this.getUser(video.userId);
      if (!user) continue;

      const votes = await this.getVideoVotes(video.id);
      const score = votes.likes + votes.wows - votes.dislikes;
      const totalVotes = votes.likes + votes.dislikes + votes.wows;

      const existing = userScores.get(video.userId);
      if (existing) {
        existing.totalScore += score;
        existing.totalVotes += totalVotes;
      } else {
        userScores.set(video.userId, {
          username: user.username,
          userId: video.userId,
          skillCategory: video.skillCategory,
          totalScore: score,
          totalVotes
        });
      }
    }

    const leaderboard = Array.from(userScores.values())
      .sort((a, b) => b.totalScore - a.totalScore)
      .map((entry, index) => ({
        ...entry,
        rank: index + 1
      }));

    return leaderboard.slice(0, 10); // Top 10
  }
}

export const storage = new MemStorage();
