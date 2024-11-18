import { Request, Response } from "express";
import bcrypt from "bcryptjs"
import User from "../models/user";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config()

export const signup=async(req:Request, res:Response): Promise<void>=>{
    const user=req.body;
    try {
        const {username, email, password}=user
        const emailExists=await User.findOne({email: email})
        if(emailExists) {
            res.json({mesage: "email already exists"})
            return
        }
        const hashedPassword=await bcrypt.hash(password, 7)
        const newUser=new User({
            username,
            email,
            password: hashedPassword
        })
        const userSaved=await newUser.save()
        const authToken = jwt.sign({username: username, email: email, _id: userSaved._id}, process.env.JWT_SECRET || "mox")
        res.json({"message": "signup successful", "token": authToken})
    }  catch (error: unknown) {
        console.log("error during signup", error);
        if (error instanceof Error) {
            res.json({ message: `error during signup, ${error.message}` });
        } else {
            res.json({ message: 'Unknown error during signup' });
        }
        return; 
    }
}

export const login=async(req: Request, res: Response): Promise<void> =>{
    const user=req.body;
    try {
        const {email, password}=user
        const userExists=await User.findOne({email: email})
        if(!userExists) {
            res.json({mesage: "wrong email or password"})
            return
        }
        const validPassword=bcrypt.compare(userExists.password, password)
        if(!validPassword) {
            res.json({message: "wrong email or password"})
            return
        }
        const authToken=jwt.sign({username: userExists.username, email: email, _id: userExists._id}, process.env.JWT_SECRET || "mox")
        res.json({message: "signin successful", "token": authToken})
    } catch (error: unknown) {
        console.log("error during signup", error);
        if (error instanceof Error) {
            res.json({ message: `error during signup, ${error.message}` });
        } else {
            res.json({ message: 'Unknown error during signup' });
        }
        return; 
    }
}