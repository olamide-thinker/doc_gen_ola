import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { checkFirebaseInitialized } from '../config/firebase';

@Injectable()
export class FirebaseGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization as string | undefined;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!checkFirebaseInitialized()) {
      throw new ForbiddenException('Firebase Admin SDK is not initialized. Please provide credentials.');
    }

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      const admin = await import('firebase-admin');
      const decoded = await admin.auth().verifyIdToken(token);

      // Some Firebase providers don't include email in the token claims.
      // Fall back to looking up the user record directly from Firebase Auth.
      let email = decoded.email;
      if (!email) {
        try {
          const userRecord = await admin.auth().getUser(decoded.uid);
          email = userRecord.email || null;
        } catch {
          email = null;
        }
      }

      request.user = {
        uid: decoded.uid,
        email: email,
        name: decoded.name || '',
        picture: decoded.picture || '',
        email_verified: decoded.email_verified || false,
      };
      return true;
    } catch (e) {
      throw new ForbiddenException('Invalid token');
    }
  }
}
