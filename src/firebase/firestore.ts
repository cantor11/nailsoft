import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  orderBy
} from 'firebase/firestore';
import { db } from './config';

// Ruta base: users/{userId}/{colección}
const getUserCollection = (userId: string, collectionName: string) => {
  return collection(db, 'users', userId, collectionName);
};

// Obtener todos los documentos de una colección
export const getCollection = async <T>(
  userId: string,
  collectionName: string
): Promise<T[]> => {
  const colRef = getUserCollection(userId, collectionName);
  const snapshot = await getDocs(colRef);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
};

// Crear o reemplazar un documento (usa el id del objeto)
export const setDocument = async (
  userId: string,
  collectionName: string,
  id: string,
  data: object
): Promise<void> => {
  const docRef = doc(db, 'users', userId, collectionName, id);
  // Eliminamos el campo id del objeto antes de guardarlo
  const { id: _, ...dataWithoutId } = data as any;
  await setDoc(docRef, dataWithoutId, { merge: true });
};

// Actualizar campos específicos de un documento
export const updateDocument = async (
  userId: string,
  collectionName: string,
  id: string,
  data: object
): Promise<void> => {
  const docRef = doc(db, 'users', userId, collectionName, id);
  await updateDoc(docRef, data as any);
};

// Eliminar un documento
export const deleteDocument = async (
  userId: string,
  collectionName: string,
  id: string
): Promise<void> => {
  const docRef = doc(db, 'users', userId, collectionName, id);
  await deleteDoc(docRef);
};

// Guardar múltiples documentos de golpe (útil para carga inicial)
export const batchSet = async (
  userId: string,
  collectionName: string,
  items: Array<{ id: string; [key: string]: any }>
): Promise<void> => {
  if (items.length === 0) return;

  // Firestore permite máximo 500 operaciones por batch
  const chunks = [];
  for (let i = 0; i < items.length; i += 500) {
    chunks.push(items.slice(i, i + 500));
  }

  for (const chunk of chunks) {
    const batch = writeBatch(db);
    chunk.forEach(item => {
      const { id, ...data } = item;
      const docRef = doc(db, 'users', userId, collectionName, id);
      batch.set(docRef, data, { merge: true });
    });
    await batch.commit();
  }
};