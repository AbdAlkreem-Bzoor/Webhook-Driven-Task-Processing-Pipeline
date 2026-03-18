import { AppUserDto } from "../identity/types.js";


export interface IIdentityService {
    isInRoleAsync(userId: string, role: string): Promise<boolean>;
    authorizeAsync(userId: string, policyName?: string): Promise<boolean>;
    authenticateAsync(email: string, password: string): Promise<AppUserDto>;
    getUserByIdAsync(userId: string): Promise<AppUserDto>;
    getUserNameAsync(userId: string): Promise<string | null>;
}