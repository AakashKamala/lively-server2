import express, { Request, Response } from "express";
import http from "http";
import cors from "cors";
import socketIo from "socket.io";
import socketAuthenticateMiddleware, { CustomSocket } from "./middlewares/socket";
import userRoute from "./routes/user";
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const app = express();

mongoose.connect(process.env.MONGODB_URI || "mongodb+srv://jonmoxley187:mox@cluster0.jp8fj.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0")
    .then(() => {
        console.log("Database connected successfully");
    })
    .catch((error) => {
        console.error("Database connection error:", error);
        process.exit(1);
    });

const server = http.createServer(app);
const io = new socketIo.Server(server, {
    cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:5173',
        methods: ["GET", "POST"],
        credentials: true
    }
});

app.use(cors());
app.use(express.json());
app.use("/user", userRoute);

io.use(socketAuthenticateMiddleware);

interface ActiveUser {
    _id: string;
    username: string;
    socketIds: Set<string>;  // Track multiple socket connections per user
}

interface ChatInvite {
    from: { _id: string; username: string };
    to: { _id: string; username: string };
    timestamp: number;
}

interface Room {
    id: string;
    participants: string[];  // user IDs
}

// Map to store active users by their _id
const activeUsers = new Map<string, ActiveUser>();

const rooms = new Map<string, Room>();

// Function to broadcast active users to all clients
const broadcastActiveUsers = () => {
    const activeUsersList = Array.from(activeUsers.values()).map(({ _id, username }) => ({
        _id,
        username
    }));
    io.emit("active", activeUsersList);
    console.log("Broadcasting active users:", activeUsersList);
};

io.on("connection", (socket: CustomSocket) => {
    if (!socket.user || typeof socket.user === 'string') {
        socket.disconnect();
        return;
    }

    const userId = socket.user._id;
    const username = socket.user.username;

    // Add new socket connection
    if (activeUsers.has(userId)) {
        // User already exists, add new socket ID
        const user = activeUsers.get(userId)!;
        user.socketIds.add(socket.id);
    } else {
        // New user, create entry
        activeUsers.set(userId, {
            _id: userId,
            username,
            socketIds: new Set([socket.id])
        });
    }

    console.log(`User connected: ${username} (${userId}) - Socket: ${socket.id}`);
    broadcastActiveUsers();

    // Handle get active users request
    socket.on("getActive", () => {
        socket.emit("active", Array.from(activeUsers.values()).map(({ _id, username }) => ({
            _id,
            username
        })));
    });

    socket.on("sendInvite", ({ from, to }: ChatInvite) => {
        const targetSocket = Array.from(io.sockets.sockets.values())
            .find((s: any) => s.user?._id === to._id) as CustomSocket;
        
        if (targetSocket) {
            const invite: ChatInvite = { from, to, timestamp: Date.now() };
            targetSocket.emit("chatInvite", invite);
        }
    });

    socket.on("acceptInvite", (invite: ChatInvite) => {
        const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Create and store room
        rooms.set(roomId, {
            id: roomId,
            participants: [invite.from._id, invite.to._id]
        });

        // Join both users to the room
        const fromSocket = Array.from(io.sockets.sockets.values())
            .find((s: any) => s.user?._id === invite.from._id) as CustomSocket;
        const toSocket = Array.from(io.sockets.sockets.values())
            .find((s: any) => s.user?._id === invite.to._id) as CustomSocket;

        if (fromSocket && toSocket) {
            fromSocket.join(roomId);
            toSocket.join(roomId);

            // Notify both users
            io.to(roomId).emit("inviteAccepted", { 
                roomId,
                from: invite.from
            });
        }
    });

    socket.on("declineInvite", (invite: ChatInvite) => {
        const fromSocket = Array.from(io.sockets.sockets.values())
            .find((s: any) => s.user?._id === invite.from._id) as CustomSocket;
        
        if (fromSocket) {
            fromSocket.emit("inviteDeclined", { from: invite.to });
        }
    });

    socket.on("inviteExpired", (invite: ChatInvite) => {
        const fromSocket = Array.from(io.sockets.sockets.values())
            .find((s: any) => s.user?._id === invite.from._id) as CustomSocket;
        
        if (fromSocket) {
            fromSocket.emit("inviteExpired", { from: invite.to });
        }
    });

    // Handle disconnection
    socket.on("disconnect", () => {
        const user = activeUsers.get(userId);
        if (user) {
            // Remove this socket ID
            user.socketIds.delete(socket.id);
            
            // If user has no more active sockets, remove them from active users
            if (user.socketIds.size === 0) {
                activeUsers.delete(userId);
                console.log(`User fully disconnected: ${username} (${userId})`);
            } else {
                console.log(`Socket disconnected for user: ${username} (${userId}), remaining sockets: ${user.socketIds.size}`);
            }
            
            broadcastActiveUsers();
        }
    });

    // Handle errors
    socket.on("error", (error) => {
        console.error(`Socket error for user ${username}:`, error);
    });
});

const PORT = process.env.PORT || 8009;

server.listen(PORT, () => {
    console.log(`Server is listening on PORT: ${PORT}`);
});