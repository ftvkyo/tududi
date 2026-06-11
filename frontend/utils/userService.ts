import { getApiPath } from '../config/paths';

export interface UserItem {
    id: number;
    uid: string;
    email: string;
    name?: string;
    surname?: string;
    role: 'admin' | 'user';
    access_level?: 'rw' | 'ro';
}

/**
 * Fetch all users in the system.
 */
export async function fetchUsers(): Promise<UserItem[]> {
    const res = await fetch(getApiPath('users'), {
        credentials: 'include',
        headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
        let message = 'Failed to load users';
        try {
            const body = await res.json();
            if (body?.error) message = body.error;
        } catch {
            // ignore non-JSON error bodies
        }
        throw new Error(message);
    }
    return res.json();
}

/**
 * Fetch users who can be assigned to a specific task (owner + collaborators).
 */
export async function fetchAssignableUsers(
    taskUid: string
): Promise<UserItem[]> {
    const res = await fetch(getApiPath(`task/${taskUid}/assignable-users`), {
        credentials: 'include',
        headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
        let message = 'Failed to load assignable users';
        try {
            const body = await res.json();
            if (body?.error) message = body.error;
        } catch {
            // ignore non-JSON error bodies
        }
        throw new Error(message);
    }
    const data = await res.json();
    return data.users || [];
}

/** Format a UserItem as a display name, falling back to email. */
export function formatUserName(user: UserItem): string {
    if (user.name && user.surname) return `${user.name} ${user.surname}`;
    if (user.name) return user.name;
    return user.email;
}

/** Get initials for an avatar chip (up to 2 characters). */
export function getUserInitials(user: UserItem): string {
    if (user.name && user.surname)
        return `${user.name[0]}${user.surname[0]}`.toUpperCase();
    if (user.name) return user.name.slice(0, 2).toUpperCase();
    return user.email.slice(0, 2).toUpperCase();
}
