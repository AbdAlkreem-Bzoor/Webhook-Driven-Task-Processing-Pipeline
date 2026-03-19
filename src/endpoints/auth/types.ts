

export interface LoginRequest {
    email: string;
    password: string;
}

export interface RefreshTokenRequest {
    accessToken: string;
    refreshToken: string;
}