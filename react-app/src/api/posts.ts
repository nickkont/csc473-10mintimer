import {
  addDoc, collection, getDocs, limit as fsLimit, orderBy, query, serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../firebase";

export interface PostDoc {
  id: string;
  uid: string;
  authorName: string;
  authorInitials: string;
  text: string;
  image: string | null;
  likes: number;
  comments: number;
  createdAt?: { seconds: number; nanoseconds?: number };
}

export async function listPosts(lim = 100): Promise<PostDoc[]> {
  const snap = await getDocs(
    query(collection(db, "socialPosts"), orderBy("createdAt", "desc"), fsLimit(lim))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as PostDoc));
}

export async function createPost(input: {
  text: string; image: string | null; authorName: string; authorInitials: string;
}): Promise<PostDoc> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  const ref = await addDoc(collection(db, "socialPosts"), {
    uid: user.uid,
    authorName: input.authorName,
    authorInitials: input.authorInitials,
    text: input.text,
    image: input.image,
    likes: 0,
    comments: 0,
    createdAt: serverTimestamp(),
  });
  return { id: ref.id, uid: user.uid, ...input, likes: 0, comments: 0 };
}
