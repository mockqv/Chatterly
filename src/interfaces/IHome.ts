export interface UserMetadata {
    id: string;
    full_name: string;
    avatar_url: string | null;
}

export interface CurrentUser {
    id: string;
    email?: string | null;
    full_name?: string | null;
    avatar_url?: string | null;
}

export interface ChannelMember {
    user_id: string;
    profiles: UserMetadata | null;
}

export interface Channel {
    id: string;
    last_message: string | null;
    last_message_at: string | null;
    created_at: string;
    members: {
        user_id: string;
        profiles: UserMetadata | null;
    }[];
}

export interface Message {
    id: string;
    content: string;
    created_at: string;
    sender_id: string;
    channel_id: string;
    profiles: UserMetadata | null;
    user_metadata?: UserMetadata;
} 