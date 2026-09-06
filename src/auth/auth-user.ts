/**
 * Usuario autenticado adjunto a req.user (JWT o dev bypass).
 * Usar con @CurrentUser() en controllers.
 */
export interface AuthUser {
  _id: string;
  id: string;
  email: string;
  name?: string;
  lastName?: string;
  role: 'client' | 'provider';
  provider?: string;
  emailVerified?: boolean;
}

export function toAuthUser(doc: {
  _id: unknown;
  email: string;
  name?: string;
  lastName?: string;
  role: string;
  provider?: string;
  emailVerified?: boolean;
}): AuthUser {
  const id = String(doc._id);
  const role: AuthUser['role'] =
    doc.role === 'provider' ? 'provider' : 'client';
  return {
    _id: id,
    id,
    email: doc.email,
    name: doc.name,
    lastName: doc.lastName,
    role,
    provider: doc.provider,
    emailVerified: doc.emailVerified,
  };
}
