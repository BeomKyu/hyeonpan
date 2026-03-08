// Data models matching spec/spec.md $Model definitions

export interface Message {
    id: string;
    role: 'user' | 'agent';
    content: string;
    diff: string | null;
    timestamp: string;
}

export interface Card {
    id: string;
    title: string;
    description: string;
    messages: Message[];
    column_id: string;
    created_at: string;
}

export interface Column {
    id: string;
    title: string;
    order: number;
    card_ids: string[];
}

export interface Board {
    columns: Column[];
    cards: Record<string, Card>;
}
