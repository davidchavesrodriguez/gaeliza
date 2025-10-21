// ==================== USER & AUTH ====================
export interface User {
  id: string;
  email: string;
  username: string;
  full_name?: string;
  avatar_url?: string;
  created_at: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  username: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

// ==================== TEAM ====================
export interface Team {
  id: number;
  name: string;
  shield_url?: string;
  type: 'oficial' | 'temporal';
  created_at: string;
  created_by?: string;
}

export interface TeamCreate {
  name: string;
  shield_url?: string;
  type?: 'oficial' | 'temporal';
}

// ==================== PLAYER ====================
export interface Player {
  id: number;
  first_name: string;
  last_name: string;
  number?: number;
  team_id?: number;
  created_at: string;
}

export interface PlayerCreate {
  first_name: string;
  last_name: string;
  number?: number;
  team_id?: number;
}

// ==================== MATCH ====================
export interface Match {
  id: number;
  home_team_id: number;
  away_team_id: number;
  match_date: string;
  location?: string;
  competition?: string;
  video_url?: string;
  created_at: string;
  created_by: string;
}

export interface MatchCreate {
  home_team_id: number;
  away_team_id: number;
  match_date: string;
  location?: string;
  competition?: string;
  video_url?: string;
}

// ==================== ACTION ====================
export interface Action {
  id: number;
  match_id: number;
  player_id?: number;
  type: string;
  minute: number;
  second: number;
  x_position?: number;
  y_position?: number;
  description?: string;
  created_at: string;
}

export interface ActionCreate {
  match_id: number;
  player_id?: number;
  type: string;
  minute: number;
  second?: number;
  x_position?: number;
  y_position?: number;
  description?: string;
}

// ==================== MATCH PARTICIPANT ====================
export interface MatchParticipant {
  id: number;
  match_id: number;
  player_id: number;
  team_id: number;
  position?: string;
  minutes_played: number;
}

export interface MatchParticipantCreate {
  match_id: number;
  player_id: number;
  team_id: number;
  position?: string;
  minutes_played?: number;
}