import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockGetDocs,
  mockSetDoc,
  mockDeleteDoc,
  mockWriteBatch,
  mockCollection,
  mockDoc,
  mockQuery,
  mockWhere,
} = vi.hoisted(() => ({
  mockGetDocs: vi.fn(),
  mockSetDoc: vi.fn(),
  mockDeleteDoc: vi.fn(),
  mockWriteBatch: vi.fn(),
  mockCollection: vi.fn().mockReturnValue('mock-collection-ref'),
  mockDoc: vi.fn().mockReturnValue('mock-doc-ref'),
  mockQuery: vi.fn().mockReturnValue('mock-query-ref'),
  mockWhere: vi.fn().mockReturnValue('mock-where-constraint'),
}));

vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  doc: mockDoc,
  getDocs: mockGetDocs,
  setDoc: mockSetDoc,
  deleteDoc: mockDeleteDoc,
  writeBatch: mockWriteBatch,
  query: mockQuery,
  where: mockWhere,
}));

vi.mock('../firebase', () => ({
  db: 'mock-db',
}));

vi.mock('../authService', () => ({
  getCurrentUser: () => ({ uid: 'test-user-123' }),
}));

import { getAll, put, deleteItem, clear } from '../storageService';

beforeEach(() => {
  vi.clearAllMocks();
});

// ──────────────────────────── getAll ────────────────────────────

describe('getAll', () => {
  it('returns documents from Firestore collection scoped to user', async () => {
    const docs = [
      { data: () => ({ id: '1', name: 'Product A' }) },
      { data: () => ({ id: '2', name: 'Product B' }) },
    ];
    mockGetDocs.mockResolvedValueOnce({ docs });

    const result = await getAll<{ id: string; name: string }>('products');

    expect(mockCollection).toHaveBeenCalledWith('mock-db', 'products');
    expect(mockWhere).toHaveBeenCalledWith('userId', '==', 'test-user-123');
    expect(mockQuery).toHaveBeenCalledWith('mock-collection-ref', 'mock-where-constraint');
    expect(result).toEqual([
      { id: '1', name: 'Product A' },
      { id: '2', name: 'Product B' },
    ]);
  });

  it('returns empty array on error', async () => {
    mockGetDocs.mockRejectedValueOnce(new Error('Firestore error'));

    const result = await getAll('products');

    expect(result).toEqual([]);
  });
});

// ──────────────────────────── put ────────────────────────────

describe('put', () => {
  it('sanitizes item via JSON round-trip and adds userId before saving', async () => {
    mockSetDoc.mockResolvedValueOnce(undefined);
    const item = { id: 'x', name: 'Test', undef: undefined };

    await put('products', item);

    // JSON round-trip removes undefined keys, userId is added
    expect(mockSetDoc).toHaveBeenCalledWith(
      'mock-doc-ref',
      { id: 'x', name: 'Test', userId: 'test-user-123' }
    );
  });

  it('calls setDoc with correct collection and id', async () => {
    mockSetDoc.mockResolvedValueOnce(undefined);
    const item = { id: 'abc-123', value: 42 };

    await put('campaigns', item);

    expect(mockDoc).toHaveBeenCalledWith('mock-db', 'campaigns', 'abc-123');
    expect(mockSetDoc).toHaveBeenCalled();
  });

  it('throws on Firestore error', async () => {
    mockSetDoc.mockRejectedValueOnce(new Error('Write failed'));

    await expect(put('products', { id: '1' })).rejects.toThrow('Write failed');
  });
});

// ──────────────────────────── deleteItem ────────────────────────────

describe('deleteItem', () => {
  it('calls deleteDoc with correct path', async () => {
    mockDeleteDoc.mockResolvedValueOnce(undefined);

    await deleteItem('products', 'prod-1');

    expect(mockDoc).toHaveBeenCalledWith('mock-db', 'products', 'prod-1');
    expect(mockDeleteDoc).toHaveBeenCalledWith('mock-doc-ref');
  });

  it('throws on error', async () => {
    mockDeleteDoc.mockRejectedValueOnce(new Error('Delete failed'));

    await expect(deleteItem('products', 'prod-1')).rejects.toThrow('Delete failed');
  });
});

// ──────────────────────────── clear ────────────────────────────

describe('clear', () => {
  it('batch-deletes all user documents', async () => {
    const mockBatchDelete = vi.fn();
    const mockBatchCommit = vi.fn().mockResolvedValue(undefined);
    mockWriteBatch.mockReturnValueOnce({ delete: mockBatchDelete, commit: mockBatchCommit });

    const docs = [
      { ref: 'ref-1' },
      { ref: 'ref-2' },
      { ref: 'ref-3' },
    ];
    mockGetDocs.mockResolvedValueOnce({ docs });

    await clear('content');

    expect(mockCollection).toHaveBeenCalledWith('mock-db', 'content');
    expect(mockWhere).toHaveBeenCalledWith('userId', '==', 'test-user-123');
    expect(mockWriteBatch).toHaveBeenCalledWith('mock-db');
    expect(mockBatchDelete).toHaveBeenCalledTimes(3);
    expect(mockBatchDelete).toHaveBeenCalledWith('ref-1');
    expect(mockBatchDelete).toHaveBeenCalledWith('ref-2');
    expect(mockBatchDelete).toHaveBeenCalledWith('ref-3');
    expect(mockBatchCommit).toHaveBeenCalled();
  });
});
