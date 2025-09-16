import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq, desc, gte, sql, and } from "drizzle-orm";
import { users, videos, votes, type User, type InsertUser, type Video, type InsertVideo, type Vote, type InsertVote } from "@shared/schema";
import { IStorage } from "./storage";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";

const PgSession = connectPgSimple(session);

export class DbStorage implements IStorage {
  private db;
  public sessionStore: session.Store;

  constructor() {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is required");
    }

    const sql_client = neon(process.env.DATABASE_URL);
    this.db = drizzle(sql_client);
    
    // Create PostgreSQL session store
    this.sessionStore = new PgSession({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: true,
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await this.db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async createVideo(videoData: InsertVideo & { userId: string; filename: string }): Promise<Video> {
    const result = await this.db.insert(videos).values(videoData).returning();
    return result[0];
  }

  async getVideos(): Promise<(Video & { username: string; likes: number; dislikes: number; wows: number; score: number })[]> {
    const result = await this.db
      .select({
        id: videos.id,
        userId: videos.userId,
        filename: videos.filename,
        originalName: videos.originalName,
        duration: videos.duration,
        size: videos.size,
        skillCategory: videos.skillCategory,
        description: videos.description,
        createdAt: videos.createdAt,
        username: users.username,
        likes: sql<number>`COALESCE(SUM(CASE WHEN ${votes.voteType} = 'like' THEN 1 ELSE 0 END), 0)`.as('likes'),
        dislikes: sql<number>`COALESCE(SUM(CASE WHEN ${votes.voteType} = 'dislike' THEN 1 ELSE 0 END), 0)`.as('dislikes'),
        wows: sql<number>`COALESCE(SUM(CASE WHEN ${votes.voteType} = 'wow' THEN 1 ELSE 0 END), 0)`.as('wows'),
      })
      .from(videos)
      .leftJoin(users, eq(videos.userId, users.id))
      .leftJoin(votes, eq(videos.id, votes.videoId))
      .groupBy(videos.id, users.id, users.username)
      .orderBy(desc(videos.createdAt));

    return result.map(row => ({
      ...row,
      username: row.username || 'Unknown',
      score: row.likes + row.wows - row.dislikes
    }));
  }

  async getVideo(id: string): Promise<Video | undefined> {
    const result = await this.db.select().from(videos).where(eq(videos.id, id));
    return result[0];
  }

  async getVideosByUser(userId: string): Promise<Video[]> {
    return await this.db.select().from(videos).where(eq(videos.userId, userId));
  }

  async createVote(vote: InsertVote): Promise<Vote> {
    // First, delete any existing vote from this user for this video
    await this.deleteVote(vote.userId, vote.videoId);
    
    const result = await this.db.insert(votes).values(vote).returning();
    return result[0];
  }

  async getUserVote(userId: string, videoId: string): Promise<Vote | undefined> {
    const result = await this.db
      .select()
      .from(votes)
      .where(and(eq(votes.userId, userId), eq(votes.videoId, videoId)));
    return result[0];
  }

  async updateVote(userId: string, videoId: string, voteType: "like" | "dislike" | "wow"): Promise<Vote> {
    await this.deleteVote(userId, videoId);
    return this.createVote({ userId, videoId, voteType });
  }

  async deleteVote(userId: string, videoId: string): Promise<void> {
    await this.db
      .delete(votes)
      .where(and(eq(votes.userId, userId), eq(votes.videoId, videoId)));
  }

  async getVideoVotes(videoId: string): Promise<{ likes: number; dislikes: number; wows: number }> {
    const result = await this.db
      .select({
        likes: sql<number>`COALESCE(SUM(CASE WHEN ${votes.voteType} = 'like' THEN 1 ELSE 0 END), 0)`,
        dislikes: sql<number>`COALESCE(SUM(CASE WHEN ${votes.voteType} = 'dislike' THEN 1 ELSE 0 END), 0)`,
        wows: sql<number>`COALESCE(SUM(CASE WHEN ${votes.voteType} = 'wow' THEN 1 ELSE 0 END), 0)`,
      })
      .from(votes)
      .where(eq(votes.videoId, videoId));

    return result[0] || { likes: 0, dislikes: 0, wows: 0 };
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

    const result = await this.db
      .select({
        username: users.username,
        userId: videos.userId,
        skillCategory: videos.skillCategory,
        totalScore: sql<number>`COALESCE(SUM(
          CASE WHEN ${votes.voteType} = 'like' THEN 1
               WHEN ${votes.voteType} = 'wow' THEN 1
               WHEN ${votes.voteType} = 'dislike' THEN -1
               ELSE 0 END
        ), 0)`,
        totalVotes: sql<number>`COALESCE(COUNT(${votes.id}), 0)`,
      })
      .from(videos)
      .leftJoin(users, eq(videos.userId, users.id))
      .leftJoin(votes, eq(videos.id, votes.videoId))
      .where(gte(videos.createdAt, startOfWeek))
      .groupBy(videos.userId, users.username, videos.skillCategory)
      .orderBy(sql`totalScore DESC`)
      .limit(10);

    return result.map((entry, index) => ({
      ...entry,
      username: entry.username || 'Unknown',
      rank: index + 1
    }));
  }
}