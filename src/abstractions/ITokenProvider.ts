import { AppUserDto, TokenResponse } from "../identity/types.js";
import { JwtPayload } from "jsonwebtoken";



export interface ITokenProvider {
    generateJwtTokenAsync(user: AppUserDto, signal?: AbortSignal): Promise<TokenResponse>;
    getPrincipalFromExpiredToken(token: string): JwtPayload;
}