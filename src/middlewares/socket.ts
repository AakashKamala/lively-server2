// import { Socket } from "socket.io";
// import jwt, { JwtPayload } from "jsonwebtoken";

// export interface CustomSocket extends Socket {
//     user?: JwtPayload; 
// }

// export interface UserPayload extends JwtPayload {
//     _id: string;
//     username: string;
//     email: string;
// }

// const socketAuthenticateMiddleware = (socket: CustomSocket, next: (err?: Error) => void): void => {
//     try {
//         const token = socket.handshake.auth?.token;

//         if (!token) {
//             throw new Error("Authentication error: token is required");
//         }

//         const user = jwt.verify(token, process.env.JWT_SECRET || "mox") as UserPayload;
        
//         if (!user._id || !user.username) {
//             throw new Error("Invalid user payload");
//         }

//         socket.user = user;
//         next();
//     } catch (error) {
//         const err = error instanceof Error ? error : new Error("Authentication failed");
//         next(err);
//     }
// };

// export default socketAuthenticateMiddleware;




import { Socket } from "socket.io";
import jwt, { JwtPayload } from "jsonwebtoken";

export interface CustomSocket extends Socket {
    user?: JwtPayload; 
}

export interface UserPayload extends JwtPayload {
    _id: string;
    username: string;
    email: string;
}

const socketAuthenticateMiddleware = (socket: CustomSocket, next: (err?: Error) => void): void => {
    try {
        const token = socket.handshake.auth?.token;

        if (!token) {
            throw new Error("Authentication error: token is required");
        }

        const user = jwt.verify(token, process.env.JWT_SECRET || "mox") as UserPayload;
        
        if (!user._id || !user.username) {
            throw new Error("Invalid user payload");
        }

        socket.user = user;
        next();
    } catch (error) {
        console.error("Socket authentication error:", error);
        const err = error instanceof Error ? error : new Error("Authentication failed");
        next(err);
    }
};

export default socketAuthenticateMiddleware;