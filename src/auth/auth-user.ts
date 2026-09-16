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
  provider?: string;
  emailVerified?: boolean;
}

export function toAuthUser(doc: {
  _id: unknown;
  email: string;
  name?: string;
  lastName?: string;
  provider?: string;
  emailVerified?: boolean;
}): AuthUser {
  const id = String(doc._id);
  return {
    _id: id,
    id,
    email: doc.email,
    name: doc.name,
    lastName: doc.lastName,
    provider: doc.provider,
    emailVerified: doc.emailVerified,
  };
}
