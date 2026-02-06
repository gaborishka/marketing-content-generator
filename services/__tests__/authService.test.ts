import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockAuth,
  mockCreateUser,
  mockSignInEmail,
  mockSignInPopup,
  mockSignOut,
  mockOnAuthStateChanged,
} = vi.hoisted(() => ({
  mockAuth: { currentUser: { getIdToken: vi.fn() } },
  mockCreateUser: vi.fn(),
  mockSignInEmail: vi.fn(),
  mockSignInPopup: vi.fn(),
  mockSignOut: vi.fn(),
  mockOnAuthStateChanged: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => mockAuth),
  createUserWithEmailAndPassword: (...args: any[]) => mockCreateUser(...args),
  signInWithEmailAndPassword: (...args: any[]) => mockSignInEmail(...args),
  signInWithPopup: (...args: any[]) => mockSignInPopup(...args),
  signOut: (...args: any[]) => mockSignOut(...args),
  onAuthStateChanged: (...args: any[]) => mockOnAuthStateChanged(...args),
  GoogleAuthProvider: class {},
}));

vi.mock('../firebase', () => ({
  auth: mockAuth,
}));

import {
  signUpWithEmail,
  signInWithEmail,
  signInWithGoogle,
  logOut,
  onAuthChange,
  getCurrentUser,
  getIdToken,
} from '../authService';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('authService', () => {
  describe('signUpWithEmail', () => {
    it('calls createUserWithEmailAndPassword with auth and credentials', async () => {
      mockCreateUser.mockResolvedValueOnce({ user: { uid: '123' } });

      await signUpWithEmail('test@example.com', 'password123');

      expect(mockCreateUser).toHaveBeenCalledWith(
        mockAuth,
        'test@example.com',
        'password123'
      );
    });

    it('propagates errors from Firebase', async () => {
      mockCreateUser.mockRejectedValueOnce(new Error('Email already in use'));

      await expect(signUpWithEmail('test@example.com', 'pass')).rejects.toThrow(
        'Email already in use'
      );
    });
  });

  describe('signInWithEmail', () => {
    it('calls signInWithEmailAndPassword with auth and credentials', async () => {
      mockSignInEmail.mockResolvedValueOnce({ user: { uid: '123' } });

      await signInWithEmail('test@example.com', 'password123');

      expect(mockSignInEmail).toHaveBeenCalledWith(
        mockAuth,
        'test@example.com',
        'password123'
      );
    });

    it('propagates errors', async () => {
      mockSignInEmail.mockRejectedValueOnce(new Error('Wrong password'));

      await expect(signInWithEmail('test@example.com', 'wrong')).rejects.toThrow(
        'Wrong password'
      );
    });
  });

  describe('signInWithGoogle', () => {
    it('calls signInWithPopup with auth and GoogleAuthProvider', async () => {
      mockSignInPopup.mockResolvedValueOnce({ user: { uid: '456' } });

      await signInWithGoogle();

      expect(mockSignInPopup).toHaveBeenCalledTimes(1);
      expect(mockSignInPopup.mock.calls[0][0]).toBe(mockAuth);
    });

    it('propagates errors', async () => {
      mockSignInPopup.mockRejectedValueOnce(new Error('Popup closed'));

      await expect(signInWithGoogle()).rejects.toThrow('Popup closed');
    });
  });

  describe('logOut', () => {
    it('calls signOut with auth', async () => {
      mockSignOut.mockResolvedValueOnce(undefined);

      await logOut();

      expect(mockSignOut).toHaveBeenCalledWith(mockAuth);
    });
  });

  describe('onAuthChange', () => {
    it('calls onAuthStateChanged with auth and callback', () => {
      const unsubscribe = vi.fn();
      mockOnAuthStateChanged.mockReturnValueOnce(unsubscribe);

      const callback = vi.fn();
      const result = onAuthChange(callback);

      expect(mockOnAuthStateChanged).toHaveBeenCalledWith(mockAuth, callback);
      expect(result).toBe(unsubscribe);
    });
  });

  describe('getCurrentUser', () => {
    it('returns auth.currentUser', () => {
      const user = getCurrentUser();
      expect(user).toBe(mockAuth.currentUser);
    });
  });

  describe('getIdToken', () => {
    it('calls getIdToken on the current user', async () => {
      mockAuth.currentUser.getIdToken.mockResolvedValueOnce('mock-token');

      const token = await getIdToken();

      expect(mockAuth.currentUser.getIdToken).toHaveBeenCalled();
      expect(token).toBe('mock-token');
    });
  });
});
