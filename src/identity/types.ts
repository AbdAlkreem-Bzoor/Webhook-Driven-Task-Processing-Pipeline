


export interface AppUserDto {
    userId: string;
    email: string;
    roles: string[];
    claims: Record<string, string>;
}

export interface TokenResponse {
    accessToken: string;
    refreshToken: string;
    expiresOnUtc: Date;
}