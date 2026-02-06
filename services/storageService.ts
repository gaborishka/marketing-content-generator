import { collection, doc, deleteDoc, getDocs, setDoc, writeBatch, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { getCurrentUser } from './authService';

const getUserId = (): string => {
  const user = getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  return user.uid;
};

export const getAll = async <T>(storeName: string): Promise<T[]> => {
  try {
    const userId = getUserId();
    const q = query(collection(db, storeName), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => d.data() as T);
  } catch (e) {
    console.error(`Error getting all from ${storeName}`, e);
    return [];
  }
};

export const put = async (storeName: string, item: any): Promise<void> => {
  try {
    const userId = getUserId();
    const sanitized = JSON.parse(JSON.stringify({ ...item, userId }));
    await setDoc(doc(db, storeName, item.id), sanitized);
  } catch (e) {
    console.error(`Error putting to ${storeName}`, e);
    throw e;
  }
};

export const deleteItem = async (storeName: string, id: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, storeName, id));
  } catch (e) {
    console.error(`Error deleting from ${storeName}`, e);
    throw e;
  }
};

export const clear = async (storeName: string): Promise<void> => {
  const userId = getUserId();
  const q = query(collection(db, storeName), where('userId', '==', userId));
  const snapshot = await getDocs(q);
  const batch = writeBatch(db);
  snapshot.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
};
