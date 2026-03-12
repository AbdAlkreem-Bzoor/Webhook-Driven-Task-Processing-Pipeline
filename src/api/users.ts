import type { Request, Response } from "express";

import {createUser, updateUser} from "../db/queries/users.js";
import { BadRequestError } from "../errors.js";
import { respondWithJSON } from "./json.js";
import { NewUser } from "../db/schema.js";
import {getBearerToken, hashPassword, validateJWT} from "../auth.js";
import {config} from "../config.js";

export type UserResponse = Omit<NewUser, "hashedPassword">;

export async function handlerUsersCreate(req: Request, res: Response) {
    type parameters = {
        email: string;
        password: string;
    };
    const params: parameters = req.body;

    if (!params.password || !params.email) {
        throw new BadRequestError("Missing required fields");
    }

    const hashedPassword = await hashPassword(params.password);

    const user = await createUser({
        email: params.email,
        hashedPassword,
    } satisfies NewUser);

    if (!user) {
        throw new Error("Could not create user");
    }

    respondWithJSON(res, 201, {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        isChirpyRed: user.isChirpyRed
    } satisfies UserResponse);
}


export async function handlerUsersUpdate(request: Request, response: Response) {
    type parameters = {
        email: string;
        password: string;
    };
    const params: parameters = request.body;

    if (!params.password || !params.email) {
        throw new BadRequestError("Missing required fields");
    }

    const accessToken: string = getBearerToken(request);

    const userId: string = validateJWT(accessToken, config.jwt.secret);

    const hashedPassword = await hashPassword(params.password);

    const user = await updateUser(userId,{
        email: params.email,
        hashedPassword
    } satisfies NewUser);

    if (!user) {
        throw new Error("Could not update user");
    }

    respondWithJSON(response, 200, {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        isChirpyRed: user.isChirpyRed
    } satisfies UserResponse);
}