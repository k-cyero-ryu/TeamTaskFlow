import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  try {
    // If there's no dot, this is likely a legacy password format or plaintext
    if (!stored.includes('.')) {
      console.log('Legacy password format detected, attempting direct comparison');
      // For legacy users, just compare directly as a fallback
      return supplied === stored;
    }
    
    // Regular password comparison using salt
    const [hashed, salt] = stored.split(".");
    if (!hashed || !salt) {
      console.log('Invalid password format, attempting direct comparison');
      return supplied === stored;
    }
    
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    return timingSafeEqual(hashedBuf, suppliedBuf);
  } catch (error) {
    console.error('Password comparison error:', error);
    // As a last resort fallback, try direct comparison
    return supplied === stored;
  }
}

export function setupAuth(app: Express) {
  // Ensure we have a valid secret
  if (!process.env.SESSION_SECRET && !process.env.REPL_ID) {
    throw new Error("Neither SESSION_SECRET nor REPL_ID environment variable is set");
  }

  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || process.env.REPL_ID!,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      secure: app.get("env") === "production",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/'  // Explicitly set path to ensure WebSocket can access the cookie
    }
  };

  if (app.get("env") === "production") {
    app.set("trust proxy", 1);
  }

  // Monitor session store errors
  storage.sessionStore.on('error', (error) => {
    console.error('Session store error:', error);
  });

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        console.log(`Attempting authentication for user: ${username}`);
        
        // Basic validation - just checking username and password exist
        if (!username || !password) {
          console.log(`Authentication failed: Missing credentials`);
          return done(null, false, { message: 'Username and password are required' });
        }
        
        const user = await storage.getUserByUsername(username);
        if (!user || !(await comparePasswords(password, user.password))) {
          console.log(`Authentication failed for user: ${username}`);
          return done(null, false, { message: 'Invalid username or password' });
        }
        
        console.log(`Authentication successful for user: ${username}`);
        return done(null, user);
      } catch (error) {
        console.error("Authentication error:", error);
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => {
    console.log(`Serializing user: ${user.id}`);
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      console.log(`Deserializing user: ${id}`);
      const user = await storage.getUser(id);
      if (!user) {
        console.log(`User not found during deserialization: ${id}`);
        return done(null, false);
      }
      done(null, user);
    } catch (error) {
      console.error("Deserialization error:", error);
      done(error);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      console.log("Registration attempt for:", req.body.username);

      // Strict validation for registration
      if (!req.body.username || !req.body.password) {
        console.log("Registration failed: Missing credentials");
        return res.status(400).json({ message: "Username and password are required" });
      }
      
      // Enforce minimum requirements for registration
      if (req.body.username.length < 3) {
        console.log("Registration failed: Username too short");
        return res.status(400).json({ message: "Username must be at least 3 characters" });
      }
      
      if (req.body.password.length < 6) {
        console.log("Registration failed: Password too short");
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        console.log("Registration failed: Username exists");
        return res.status(400).json({ message: "Username already exists" });
      }

      const user = await storage.createUser({
        ...req.body,
        password: await hashPassword(req.body.password),
      });

      console.log("User registered successfully:", user.id);
      req.login(user, (err) => {
        if (err) {
          console.error("Login after registration failed:", err);
          return next(err);
        }
        res.status(201).json(user);
      });
    } catch (error) {
      console.error("Registration error:", error);
      next(error);
    }
  });

  app.post("/api/login", (req, res, next) => {
    console.log("Login attempt for:", req.body.username);

    if (!req.body.username || !req.body.password) {
      console.log("Login failed: Missing credentials");
      return res.status(400).json({ message: "Username and password are required" });
    }

    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        console.error("Login error:", err);
        return next(err);
      }
      if (!user) {
        console.log("Login failed: Invalid credentials");
        return res.status(401).json({ message: "Invalid credentials" });
      }
      req.login(user, (err) => {
        if (err) {
          console.error("Login session error:", err);
          return next(err);
        }
        console.log("Login successful for user:", user.id);
        res.status(200).json(user);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    console.log("Logout endpoint called, user authenticated:", req.isAuthenticated());
    console.log("Session before logout:", req.session);

    if (!req.isAuthenticated()) {
      console.log("Logout attempted while not authenticated");
      return res.status(401).json({ message: "Not authenticated" });
    }

    const userId = req.user?.id;
    console.log("Logging out user:", userId);
    
    req.logout((err) => {
      if (err) {
        console.error("Logout error:", err);
        return next(err);
      }
      
      req.session.destroy((err) => {
        if (err) {
          console.error("Session destruction error:", err);
          return next(err);
        }
        
        // Get cookie settings from the session configuration
        const cookieOptions = {
          path: '/',
          httpOnly: true,
          secure: app.get("env") === "production",
          sameSite: 'lax' as const
        };
        
        console.log("Session destroyed, clearing cookies with options:", cookieOptions);
        
        // Clear connect.sid cookie
        res.clearCookie('connect.sid', cookieOptions);
        
        console.log("Logout successful, session destroyed and cookies cleared");
        res.status(200).json({ message: "Logged out successfully", success: true });
      });
    });
  });

  app.get("/api/user", (req, res) => {
    console.log("User status check:", req.isAuthenticated() ? "authenticated" : "not authenticated");
    console.log("Session ID:", req.sessionID);
    console.log("Session data:", req.session);

    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    res.json(req.user);
  });
}