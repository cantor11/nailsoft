import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword,
  signInWithPopup,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { auth, isDevWithoutFirebase } from './config';

const googleProvider = new GoogleAuthProvider();

// —————————————————————————————————————————————————
// MOCK AUTH (modo desarrollo sin Firebase)
// —————————————————————————————————————————————————
const MOCK_USER: User = {
  uid: 'dev-user-123',
  email: 'dev@nailsoft.local',
  displayName: 'Usuario Dev',
  photoURL: null,
  emailVerified: true,
  isAnonymous: false,
  metadata: {},
  providerData: [],
  refreshToken: '',
  tenantId: null,
  delete: async () => {},
  getIdToken: async () => 'mock-token',
  getIdTokenResult: async () => ({ token: 'mock-token', claims: {}, authTime: '', expirationTime: '', issuedAtTime: '', signInProvider: null, signInSecondFactor: null } as any),
  reload: async () => {},
  toJSON: () => ({}),
} as User;

let mockUser: User | null = null;

// Auth state change para modo desarrollo
function onAuthStateChange(callback: (user: User | null) => void) {
  if (isDevWithoutFirebase) {
    // Simular carga inicial y luego devolver mock user
    setTimeout(() => {
      callback(mockUser || MOCK_USER);
    }, 500);

    return () => {}; // unsubscribe no-op
  }

  return onAuthStateChanged(auth!, callback);
}

// —————————————————————————————————————————————————
// FUNCIONES DE AUTH
// —————————————————————————————————————————————————

// Registro con email y contraseña
export const signUp = async (email: string, password: string): Promise<User> => {
  if (isDevWithoutFirebase) {
    mockUser = { ...MOCK_USER, email, displayName: email.split('@')[0] };
    return mockUser;
  }
  const result = await createUserWithEmailAndPassword(auth!, email, password);
  return result.user;
};

// Login con email y contraseña
export const signIn = async (email: string, password: string): Promise<User> => {
  if (isDevWithoutFirebase) {
    mockUser = { ...MOCK_USER, email, displayName: email.split('@')[0] };
    return mockUser;
  }
  const result = await signInWithEmailAndPassword(auth!, email, password);
  return result.user;
};

// Login con Google
export const signInWithGoogle = async (): Promise<User> => {
  if (isDevWithoutFirebase) {
    mockUser = { ...MOCK_USER, email: 'dev@nailsoft.local' };
    return mockUser;
  }
  const result = await signInWithPopup(auth!, googleProvider);
  return result.user;
};

// Cerrar sesión
export const signOut = async (): Promise<void> => {
  if (isDevWithoutFirebase) {
    mockUser = null;
    return;
  }
  await firebaseSignOut(auth!);
};

export { onAuthStateChange };
