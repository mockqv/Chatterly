interface UserMetadata {
    id: string;
    full_name?: string | null;
    avatar_url?: string | null;
}

interface CurrentUser {
    id: string;
    email?: string | null;
    full_name?: string | null;
    avatar_url?: string | null;
}

interface ChannelMember {
    user_id: string;
    profiles: UserMetadata | null;
}