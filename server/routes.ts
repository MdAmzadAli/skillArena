import type { Express, Request } from "express";
import express from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { insertVideoSchema, insertVoteSchema } from "@shared/schema";

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for video uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    }
  }),
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only MP4, MOV, and AVI files are allowed'));
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  }
});

// TEMPORARY: Authentication disabled for testing
function requireAuth(req: any, res: any, next: any) {
  // TODO: Re-enable authentication later
  // if (!req.isAuthenticated()) {
  //   return res.status(401).json({ error: 'Authentication required' });
  // }
  
  // Mock user for testing purposes
  if (!req.user) {
    req.user = {
      id: 'test-user-id',
      username: 'testuser',
      password: 'hashed-password',
      createdAt: new Date()
    };
  }
  next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  // Serve uploaded videos
  app.use('/uploads', express.static(uploadsDir));

  // Get all videos (feed)
  app.get('/api/videos', async (req, res) => {
    try {
      const videos = await storage.getVideos();
      res.json(videos);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch videos' });
    }
  });

  // Upload video
  app.post('/api/videos', requireAuth, upload.single('video'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No video file provided' });
      }

      const videoData = insertVideoSchema.parse({
        originalName: req.file.originalname,
        duration: parseInt(req.body.duration) || 5000, // Default 5 seconds if not provided
        size: req.file.size,
        skillCategory: req.body.skillCategory,
        description: req.body.description || null
      });

      // Validate duration (5 seconds max = 5000ms)
      if (videoData.duration > 5000) {
        // Delete uploaded file if duration is too long
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'Video must be 5 seconds or less' });
      }

      const video = await storage.createVideo({
        ...videoData,
        userId: req.user!.id,
        filename: req.file.filename
      });

      res.status(201).json(video);
    } catch (error) {
      // Clean up uploaded file on error
      if (req.file) {
        try {
          fs.unlinkSync(req.file.path);
        } catch {}
      }
      res.status(400).json({ error: error instanceof Error ? error.message : 'Upload failed' });
    }
  });

  // Vote on video
  app.post('/api/videos/:videoId/vote', requireAuth, async (req, res) => {
    try {
      const { videoId } = req.params;
      const voteData = insertVoteSchema.parse({
        userId: req.user!.id,
        videoId,
        voteType: req.body.voteType
      });

      const existingVote = await storage.getUserVote(req.user!.id, videoId);
      
      let vote;
      if (existingVote) {
        if (existingVote.voteType === voteData.voteType) {
          // Same vote type - remove vote
          await storage.deleteVote(req.user!.id, videoId);
          vote = null;
        } else {
          // Different vote type - update vote
          vote = await storage.updateVote(req.user!.id, videoId, voteData.voteType);
        }
      } else {
        // New vote
        vote = await storage.createVote(voteData);
      }

      const votes = await storage.getVideoVotes(videoId);
      res.json({ vote, votes });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Vote failed' });
    }
  });

  // Get user's vote for a video
  app.get('/api/videos/:videoId/vote', requireAuth, async (req, res) => {
    try {
      const vote = await storage.getUserVote(req.user!.id, req.params.videoId);
      res.json({ vote });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch vote' });
    }
  });

  // Get leaderboard
  app.get('/api/leaderboard', async (req, res) => {
    try {
      const leaderboard = await storage.getWeeklyLeaderboard();
      res.json(leaderboard);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
