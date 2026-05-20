import {
  collection, getDocs, limit as fsLimit, orderBy, query,
} from "firebase/firestore";
import { db } from "../firebase";
import { apiRequest } from "./client";

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
  return apiRequest<PostDoc>("/posts", {
    method: "POST",
    body: input,
    auth: true,
  });
}

export async function createComment(postId: string, input: {
  text: string; authorName: string; authorInitials: string;
}): Promise<{ id: string }> {
  return apiRequest<{ id: string }>(`/posts/${postId}/comments`, {
    method: "POST",
    body: input,
    auth: true,
  });
}
