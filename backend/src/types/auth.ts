export interface AuthUser {
  id: string;
  email: string;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}
